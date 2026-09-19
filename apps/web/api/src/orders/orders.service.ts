import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContainersService } from '../containers/containers.service';
import { VesselsService } from '../vessels/vessels.service';
import { attachPortCoords, enrichKnownContainer, lookupCarrier } from '../containers/registry';
import { CreateInsuranceDto, CreateOrderDto, UpdateInsuranceDto, UpdateStatusDto, UpdateVoyageDto } from './dto';
import { generateTrackingCode, hasInsuranceRecord, mapContractSummary, mapOrder, ORDER_INCLUDE, parseTransitRoute } from './order.mapper';
import { NotifyService, normalizePhone, siteBase, statusLabelAz, type NotifyResult } from '../notify/notify.service';
import { CloudinaryStorage } from '../storage/cloudinary.storage';

function opt(value?: string) {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t === '' ? null : t;
}

function locationForStatus(status: ShipmentStatus, destinationPort?: string | null) {
  const dest = destinationPort?.trim();
  if (status === 'DESTINATION_PORT' || status === 'TIR_LOADED' || status === 'TIR_DEPARTED') {
    return dest ? { currentPort: dest, currentCountry: 'Georgia' } : {};
  }
  if (status === 'TIR_GEORGIA_BORDER') {
    return { currentPort: 'Gürcüstan sərhədi', currentCountry: 'Georgia' };
  }
  if (status === 'TIR_BAKU_CUSTOMS') {
    return { currentPort: 'Bakı gömrüyü', currentCountry: 'Azerbaijan' };
  }
  return {};
}

function packTransits(existing: unknown, stops?: unknown[], currentIndex?: number) {
  const parsed = parseTransitRoute(existing);
  return {
    stops: stops !== undefined ? parseTransitRoute(stops).stops : parsed.stops,
    currentIndex: currentIndex !== undefined ? currentIndex : parsed.currentIndex,
  };
}

function lookupCode(raw: string) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeTrackingCode(raw?: string) {
  if (raw === undefined) return undefined;
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return null;
  if (!/^[A-Z0-9-]{4,24}$/.test(code)) {
    throw new BadRequestException('Tracking code must be 4–24 letters or digits.');
  }
  return code;
}

const ARCHIVE_MS = 30 * 24 * 60 * 60 * 1000;

function coord(value?: number | null) {
  if (value === undefined) return undefined;
  if (value === null || !Number.isFinite(Number(value))) return null;
  return Number(value);
}

function decodeDataUrl(url: string): { mime: string; buf: Buffer } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(url.trim());
  if (!match) return null;
  try {
    const buf = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buf.length) return null;
    return { mime: match[1], buf };
  } catch {
    return null;
  }
}

function photoRows(photos?: { url?: string; category?: string; caption?: string }[]) {
  if (!photos?.length) return [];
  return photos
    .filter((row) => typeof row.url === "string" && (row.url.startsWith("data:image/") || /^https?:\/\//i.test(row.url)))
    .slice(0, 40)
    .map((row) => ({
      url: row.url as string,
      caption: row.caption?.trim() || null,
      category: row.category?.trim() || "auction",
    }));
}

function isLiveVesselMapStatus(status?: string | null) {
  if (!status) return true;
  return !(
    status.startsWith('TIR_') ||
    status === 'CUSTOMS_CLEARANCE' ||
    status === 'READY_FOR_DELIVERY' ||
    status === 'DELIVERED' ||
    status === 'CANCELLED'
  );
}

function normalizeImo(raw?: string | null) {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length !== 7) throw new BadRequestException('IMO 7 rəqəm olmalıdır.');
  if (/^0+$/.test(digits)) return null;
  const d = digits.split('').map(Number);
  const sum = d[0] * 7 + d[1] * 6 + d[2] * 5 + d[3] * 4 + d[4] * 3 + d[5] * 2;
  if (sum % 10 !== d[6]) throw new BadRequestException('IMO yoxlama rəqəmi səhvdir.');
  return digits;
}

type MapPin = { lat?: number; lng?: number; vesselName?: string };

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private containers: ContainersService,
    private vessels: VesselsService,
    private notify: NotifyService,
    private cloud: CloudinaryStorage,
  ) {}

  private async syncCustomer(customerId: string, dto: { phone?: string; customerName?: string }) {
    const name = dto.customerName?.trim();
    const rawPhone = dto.phone;
    const phone = rawPhone !== undefined ? normalizePhone(rawPhone) : undefined;
    if (rawPhone !== undefined && rawPhone.trim() && !phone) {
      throw new BadRequestException('Düzgün telefon yazın — məsələn 050 719 75 57 və ya 994705990399.');
    }
    if (phone === undefined && !name) return;
    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(phone ? { phone } : {}),
        ...(name ? { name } : {}),
      },
    });
  }

  async create(dto: CreateOrderDto, userId?: string) {
    let customer = await this.prisma.customer.findFirst({
      where: { email: (dto.email ?? `${dto.customerName}@autonex.local`).toLowerCase() },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          name: dto.customerName,
          email: (dto.email ?? `${dto.vin.toLowerCase()}@autonex.local`).toLowerCase(),
          phone: normalizePhone(dto.phone) ?? dto.phone ?? '',
        },
      });
    } else if (dto.phone || dto.customerName) {
      await this.syncCustomer(customer.id, { phone: dto.phone, customerName: dto.customerName });
      customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    }

    const vehicle = await this.prisma.vehicle.upsert({
      where: { vin: dto.vin.toUpperCase() },
      update: { make: dto.make, model: dto.model },
      create: {
        vin: dto.vin.toUpperCase(),
        auctionHouse: dto.auctionHouse ?? 'OTHER',
        make: dto.make,
        model: dto.model,
      },
    });

    const existing = (await this.prisma.order.findMany({ select: { trackingCode: true } })).map((o) => o.trackingCode);
    const requested = normalizeTrackingCode(dto.trackingCode);
    if (requested) {
      const already = await this.prisma.order.findUnique({ where: { trackingCode: requested }, include: ORDER_INCLUDE });
      if (already) {
        if (already.vin === dto.vin.toUpperCase()) return mapOrder(already);
        throw new ConflictException('Bu izləmə kodu artıq başqa maşındadır.');
      }
    }
    let trackingCode = requested || generateTrackingCode(dto.customerName, dto.make ?? '', dto.model, existing);
    while (!requested && (await this.prisma.order.findUnique({ where: { trackingCode } }))) {
      trackingCode = generateTrackingCode(dto.customerName, dto.make ?? '', dto.model, [...existing, trackingCode]);
    }

    const ocean = dto.containerNumber
      ? attachPortCoords(enrichKnownContainer(lookupCarrier(dto.containerNumber)))
      : null;

    const order = await this.prisma.order.create({
      data: {
        trackingCode,
        customerId: customer.id,
        vehicleId: vehicle.id,
        vin: dto.vin.toUpperCase(),
        auctionHouse: dto.auctionHouse ?? 'OTHER',
        containerNumber: ocean?.containerNumber ?? dto.containerNumber,
        carrierCode: ocean?.carrier?.code,
        carrierName: ocean?.carrier?.name,
        vesselName: opt(dto.vesselName) ?? ocean?.vesselName,
        vesselImo: normalizeImo(dto.vesselImo),
        voyageNumber: ocean?.voyageNumber,
        containerStatus: ocean?.containerStatus,
        originPort: opt(dto.originPort) ?? ocean?.originPort,
        destinationPort: opt(dto.destinationPort) ?? ocean?.destinationPort,
        currentCountry: opt(dto.currentCountry) ?? ocean?.currentCountry,
        currentPort: opt(dto.currentPort) ?? ocean?.currentPort,
        mapLat: coord(dto.mapLat) ?? ocean?.lat ?? undefined,
        mapLng: coord(dto.mapLng) ?? ocean?.lng ?? undefined,
        transitPorts: packTransits(undefined, dto.transitPorts, dto.currentTransitIndex),
        eta: dto.eta ? new Date(dto.eta) : ocean?.eta ? new Date(ocean.eta) : undefined,
        notes: dto.notes,
        createdById: userId,
        events: {
          create: {
            status: 'PURCHASED',
            title: 'Purchased',
            description: 'Order created',
            occurredAt: new Date(),
          },
        },
        /* photos uploaded one-by-one after create — giant data URLs break nginx/Plesk */
      },
      include: ORDER_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ORDER_CREATE',
        entity: 'Order',
        entityId: order.id,
        meta: { trackingCode },
      },
    });

    return mapOrder(order);
  }

  async attachContainer(id: string, containerNumber: string, userId?: string) {
    const ocean = await this.containers.lookup(containerNumber);
    const order = await this.prisma.order.update({
      where: { id },
      data: {
        containerNumber: ocean.formatted,
        carrierCode: ocean.carrierCode,
        carrierName: ocean.carrierName,
        vesselName: ocean.vesselName,
        voyageNumber: ocean.voyageNumber,
        containerStatus: ocean.containerStatus,
        originPort: ocean.originPort ?? undefined,
        destinationPort: ocean.destinationPort ?? undefined,
        currentPort: ocean.currentPort,
        currentCountry: ocean.currentCountry,
        eta: ocean.eta ? new Date(ocean.eta) : undefined,
      },
      include: ORDER_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CONTAINER_LOAD',
        entity: 'Order',
        entityId: id,
        meta: { containerNumber: ocean.containerNumber, carrier: ocean.carrierCode },
      },
    });
    return mapOrder(order);
  }

  async purgeExpiredArchive() {
    const cutoff = new Date(Date.now() - ARCHIVE_MS);
    try {
      await this.prisma.order.deleteMany({
        where: { currentStatus: 'DELIVERED', deliveredAt: { not: null, lt: cutoff } },
      });
    } catch {
      /* deliveredAt column may be missing until migrate */
    }
  }

  async findAll() {
    await this.purgeExpiredArchive();
    const orders = await this.prisma.order.findMany({
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return orders.map(mapOrder);
  }

  async findMine(userId: string) {
    await this.purgeExpiredArchive();
    const orders = await this.prisma.order.findMany({
      where: { customer: { userId } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return orders.map(mapOrder);
  }

  private async resolveOrderByCode(code: string) {
    const raw = code.toUpperCase().replace(/\s+/g, '');
    const compact = lookupCode(code);
    const exact = raw
      ? await this.prisma.order.findUnique({ where: { trackingCode: raw }, include: ORDER_INCLUDE }).catch(() => null)
      : null;
    if (exact) return exact;

    const listed = await this.prisma.order.findMany({
      select: { id: true, trackingCode: true },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });
    const hit = listed.find((row) => lookupCode(row.trackingCode) === compact);
    if (hit) {
      return this.prisma.order.findUnique({ where: { id: hit.id }, include: ORDER_INCLUDE });
    }

    const contracts = await this.prisma.contract.findMany({
      where: { status: { not: 'VOID' }, trackingCode: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const contract = contracts.find((row) => lookupCode(row.trackingCode || '') === compact);
    if (contract?.orderId) {
      return this.prisma.order.findUnique({ where: { id: contract.orderId }, include: ORDER_INCLUDE });
    }
    return contract ?? null;
  }

  async findByCode(code: string) {
    await this.purgeExpiredArchive();
    const found = await this.resolveOrderByCode(code);
    if (!found) throw new NotFoundException('Göndəriş tapılmadı');

    if ('customer' in found && found.customer) {
      const order = found;
      const deliveredAt = (order as { deliveredAt?: Date | null }).deliveredAt;
      if (order.currentStatus === 'DELIVERED' && deliveredAt && Date.now() - deliveredAt.getTime() > ARCHIVE_MS) {
        throw new NotFoundException('Göndəriş tapılmadı');
      }
      return mapOrder(order);
    }

    const contract = found as {
      trackingCode?: string | null;
      customerName: string;
      vin?: string | null;
      make?: string | null;
      model?: string | null;
      year?: number | null;
      status: string;
      kind?: string | null;
      token: string;
      signedAt?: Date | null;
    };
    const summary = mapContractSummary([contract]);
    return {
      trackingCode: contract.trackingCode || lookupCode(code),
      vin: contract.vin || '',
      make: contract.make || undefined,
      model: contract.model || undefined,
      year: contract.year || undefined,
      auctionHouse: 'OTHER',
      currentStatus: 'PURCHASED',
      customerName: contract.customerName,
      events: [],
      documents: [],
      photos: [],
      contract: summary,
    };
  }

  async insurancePublic(order: Parameters<typeof mapOrder>[0]) {
    if (!hasInsuranceRecord(order)) throw new NotFoundException('Sığorta tapılmadı');
    const mapped = mapOrder(order);
    const vin = order.vin || '';
    const waiting = mapped.insurance?.status === 'SIGN_WAIT' || mapped.insurance?.status === 'PROCESSING';
    const contract = waiting
      ? await this.prisma.contract.findFirst({
          where: { orderId: order.id, kind: 'INSURANCE', status: { not: 'VOID' } },
          orderBy: { createdAt: 'desc' },
          select: { token: true, status: true },
        })
      : null;
    const signUrl =
      waiting && contract && contract.status !== 'SIGNED'
        ? `${siteBase()}/insurance-contract/${contract.token}`
        : undefined;
    return {
      trackingCode: mapped.trackingCode,
      make: mapped.make,
      model: mapped.model,
      year: mapped.year,
      vinHint: vin.startsWith('SIG') ? '' : vin.length > 4 ? `••••${vin.slice(-4)}` : vin,
      firstName: mapped.insurance?.firstName,
      lastName: mapped.insurance?.lastName,
      docSeries: mapped.insurance?.docSeries,
      trustee: mapped.insurance?.trustee,
      amountUsd: mapped.insurance?.amountUsd || mapped.insurance?.amountAzn,
      amountAzn: mapped.insurance?.amountUsd || mapped.insurance?.amountAzn,
      status: mapped.insurance?.status || 'DRAFT',
      signRequired: waiting,
      signUrl,
      notifiedAt: mapped.insurance?.notifiedAt,
      paidOutAt: mapped.insurance?.paidOutAt,
      receiptUrl: mapped.insurance?.receiptUrl,
    };
  }

  async findInsuranceReceipt(token: string) {
    const order = await this.prisma.order.findFirst({
      where: { insuranceReceiptToken: token },
      include: ORDER_INCLUDE,
    });
    if (!order?.insurancePaidOutAt) throw new NotFoundException('Çek tapılmadı');
    const mapped = mapOrder(order);
    const fullName = [mapped.insurance?.firstName, mapped.insurance?.lastName].filter(Boolean).join(' ') || mapped.customerName;
    return {
      trackingCode: mapped.trackingCode,
      customerName: fullName,
      docSeries: mapped.insurance?.docSeries,
      trustee: mapped.insurance?.trustee,
      make: mapped.make,
      model: mapped.model,
      year: mapped.year,
      amountUsd: mapped.insurance?.amountUsd || mapped.insurance?.amountAzn,
      amountAzn: mapped.insurance?.amountUsd || mapped.insurance?.amountAzn,
      vinHint: order.vin?.startsWith('SIG') ? '' : order.vin && order.vin.length > 4 ? `••••${order.vin.slice(-4)}` : order.vin,
      paidOutAt: order.insurancePaidOutAt.toISOString(),
      message: 'Pul sizə köçürülmüşdür',
    };
  }

  async confirmInsurancePayout(id: string, userId?: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: true, vehicle: true },
    });
    if (!existing) throw new NotFoundException('Göndəriş tapılmadı');
    const token = existing.insuranceReceiptToken || randomBytes(16).toString('base64url');
    const order = await this.prisma.order.update({
      where: { id },
      data: {
        insuranceStatus: 'TRANSFERRED',
        insuranceReceiptToken: token,
        insurancePaidOutAt: existing.insurancePaidOutAt ?? new Date(),
      },
      include: ORDER_INCLUDE,
    });
    const receiptUrl = `${siteBase()}/insurance-check/${token}`;
    const notify = await this.notify.insurancePayout({
      phone: order.customer.phone,
      trackingCode: order.trackingCode,
      receiptUrl,
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'INSURANCE_PAYOUT',
        entity: 'Order',
        entityId: id,
        meta: { token, notify } as object,
      },
    });
    return { ...mapOrder(order), notify, receiptUrl };
  }

  async findInsuranceByCode(code: string) {
    const found = await this.resolveOrderByCode(code);
    if (!found || !('customer' in found) || !found.customer) {
      throw new NotFoundException('Göndəriş tapılmadı');
    }
    return this.insurancePublic(found);
  }

  async createInsuranceCase(dto: CreateInsuranceDto, userId?: string) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException('Düzgün telefon nömrəsi yazın.');
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName?.trim() || '';
    const name = [firstName, lastName].filter(Boolean).join(' ');
    if (name.length < 2) throw new BadRequestException('Ad yazın.');

    let customer = await this.prisma.customer.findFirst({ where: { phone } });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          name,
          email: `sig-${randomBytes(6).toString('hex')}@autonex.local`,
          phone,
        },
      });
    }

    const vinRaw = dto.vin?.trim().toUpperCase() || '';
    const realVin = vinRaw.length >= 8 && !vinRaw.startsWith('SIG') ? vinRaw : null;
    const vin = (realVin || `SIG${randomBytes(8).toString('hex').toUpperCase()}`).slice(0, 17);
    let vehicleId: string | undefined;
    if (realVin) {
      const vehicle = await this.prisma.vehicle.upsert({
        where: { vin: realVin },
        update: { make: opt(dto.make), model: opt(dto.model), year: dto.year ?? undefined },
        create: {
          vin: realVin,
          auctionHouse: 'OTHER',
          make: opt(dto.make) ?? undefined,
          model: opt(dto.model) ?? undefined,
          year: dto.year ?? undefined,
        },
      });
      vehicleId = vehicle.id;
    }
    let trackingCode = `SIG-${String(Date.now()).slice(-6)}`;
    while (await this.prisma.order.findUnique({ where: { trackingCode } })) {
      trackingCode = `SIG-${randomBytes(3).toString('hex').toUpperCase()}`;
    }

    const order = await this.prisma.order.create({
      data: {
        trackingCode,
        customerId: customer.id,
        vehicleId,
        vin,
        auctionHouse: 'OTHER',
        insuranceFirstName: firstName,
        insuranceLastName: lastName || null,
        insuranceDocSeries: opt(dto.docSeries) ?? null,
        insuranceTrustee: opt(dto.trustee) ?? null,
        insuranceAmountAzn: opt(dto.amountUsd ?? dto.amountAzn) ?? null,
        insuranceStatus: 'DRAFT',
        createdById: userId,
        events: {
          create: {
            status: 'PURCHASED',
            title: 'Insurance',
            description: 'Standalone insurance case',
            occurredAt: new Date(),
          },
        },
      },
      include: ORDER_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'INSURANCE_CREATE',
        entity: 'Order',
        entityId: order.id,
        meta: { trackingCode },
      },
    });

    return mapOrder(order);
  }

  async sendCustomerSms(id: string, dto: { kind?: string; text?: string; phone?: string }, userId?: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: true, vehicle: true },
    });
    if (!existing) throw new NotFoundException('Göndəriş tapılmadı');
    if (dto.phone !== undefined) await this.syncCustomer(existing.customerId, { phone: dto.phone });
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: { customer: true, vehicle: true },
    });
    const kind = (dto.kind || 'custom').trim();
    const intro =
      kind === 'photos'
        ? 'Auto Nex: maşınınıza yeni şəkillər əlavə olundu. Track linkindən baxın.'
        : dto.text?.trim() || 'Auto Nex: göndərişiniz haqqında yenilik.';
    const notify = await this.notify.customerUpdate({
      phone: dto.phone || order.customer.phone,
      trackingCode: order.trackingCode,
      make: order.vehicle?.make,
      model: order.vehicle?.model,
      intro,
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CUSTOMER_SMS',
        entity: 'Order',
        entityId: id,
        meta: { kind, notify },
      },
    });
    return { ...mapOrder(await this.prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE })), notify };
  }

  async updateInsurance(id: string, dto: UpdateInsuranceDto, userId?: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: true, vehicle: true },
    });
    if (!existing) throw new NotFoundException('Göndəriş tapılmadı');

    const allowed = new Set(['DRAFT', 'PENDING', 'PROCESSING', 'SIGN_WAIT', 'SIGNED', 'PAID', 'TRANSFERRED', 'ACTIVE']);
    const status = dto.status === undefined ? undefined : opt(dto.status);
    if (status && !allowed.has(status)) throw new BadRequestException('Sığorta statusu səhvdir.');

    const labels: Record<string, string> = {
      DRAFT: 'Hazırlanır',
      PENDING: 'Sənədlər gözlənilir',
      PROCESSING: 'Sığorta müqaviləsi imza gözləyir',
      SIGN_WAIT: 'Sığorta müqaviləsi imza gözləyir',
      SIGNED: 'Sığorta imzalanıb',
      PAID: 'Sığorta imzalanıb',
      TRANSFERRED: 'Pul köçürülüb',
      ACTIVE: 'Sığorta aktivdir',
    };

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { insuranceFirstName: opt(dto.firstName) } : {}),
        ...(dto.lastName !== undefined ? { insuranceLastName: opt(dto.lastName) } : {}),
        ...(dto.docSeries !== undefined ? { insuranceDocSeries: opt(dto.docSeries) } : {}),
        ...(dto.trustee !== undefined ? { insuranceTrustee: opt(dto.trustee) } : {}),
        ...(dto.amountUsd !== undefined || dto.amountAzn !== undefined
          ? { insuranceAmountAzn: opt(dto.amountUsd ?? dto.amountAzn) }
          : {}),
        ...(status !== undefined ? { insuranceStatus: status } : {}),
        ...(dto.vin !== undefined && dto.vin.trim() && !dto.vin.toUpperCase().startsWith('SIG')
          ? { vin: dto.vin.trim().toUpperCase() }
          : {}),
      },
      include: ORDER_INCLUDE,
    });

    const shouldNotify = dto.notify !== false;
    let notify: NotifyResult = { sent: false, error: 'skipped' };
    if (shouldNotify) {
      const waiting = order.insuranceStatus === 'SIGN_WAIT' || order.insuranceStatus === 'PROCESSING';
      const contract = waiting
        ? await this.prisma.contract.findFirst({
            where: { orderId: order.id, kind: 'INSURANCE', status: { not: 'VOID' } },
            orderBy: { createdAt: 'desc' },
            select: { token: true, status: true },
          })
        : null;
      notify = await this.notify.insuranceReady({
        phone: order.customer.phone,
        trackingCode: order.trackingCode,
        make: order.vehicle?.make,
        model: order.vehicle?.model,
        statusLabel: labels[order.insuranceStatus || 'DRAFT'],
        mustSign: waiting,
        signUrl:
          waiting && contract && contract.status !== 'SIGNED'
            ? `${siteBase()}/insurance-contract/${contract.token}`
            : undefined,
      });
      if (notify.sent) {
        await this.prisma.order.update({
          where: { id },
          data: { insuranceNotifiedAt: new Date() },
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'INSURANCE_UPDATE',
        entity: 'Order',
        entityId: id,
        meta: { status: order.insuranceStatus, notify },
      },
    });

    return { ...mapOrder(await this.prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE })), notify };
  }

  async updateVoyage(id: string, dto: UpdateVoyageDto, userId?: string) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Göndəriş tapılmadı');

    const vesselName = opt(dto.vesselName);
    const vesselImo = normalizeImo(dto.vesselImo);
    const originPort = opt(dto.originPort);
    const destinationPort = opt(dto.destinationPort);
    const currentPort = opt(dto.currentPort);
    const currentCountry = opt(dto.currentCountry);
    const transitPorts =
      dto.transitPorts !== undefined || dto.currentTransitIndex !== undefined
        ? packTransits((existing as { transitPorts?: unknown }).transitPorts, dto.transitPorts, dto.currentTransitIndex)
        : undefined;
    const voyageNumber = opt(dto.voyageNumber);
    const containerNumber = opt(dto.containerNumber);
    const trackingCode = normalizeTrackingCode(dto.trackingCode);
    const mapLat = coord(dto.mapLat);
    const mapLng = coord(dto.mapLng);
    const eta =
      dto.eta === undefined
        ? undefined
        : dto.eta.trim() && !Number.isNaN(Date.parse(dto.eta))
          ? new Date(dto.eta)
          : null;

    if (trackingCode && trackingCode !== existing.trackingCode) {
      const clash = await this.prisma.order.findUnique({ where: { trackingCode } });
      if (clash) throw new ConflictException('This tracking code is already in use.');
    }

    if (dto.phone !== undefined || dto.customerName !== undefined) {
      await this.syncCustomer(existing.customerId, {
        phone: dto.phone,
        customerName: dto.customerName,
      });
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        ...(containerNumber !== undefined ? { containerNumber } : {}),
        ...(vesselName !== undefined ? { vesselName } : {}),
        ...(vesselImo !== undefined ? { vesselImo } : {}),
        ...(originPort !== undefined ? { originPort } : {}),
        ...(destinationPort !== undefined ? { destinationPort } : {}),
        ...(currentPort !== undefined ? { currentPort } : {}),
        ...(currentCountry !== undefined ? { currentCountry } : {}),
        ...(transitPorts !== undefined ? { transitPorts } : {}),
        ...(voyageNumber !== undefined ? { voyageNumber } : {}),
        ...(trackingCode ? { trackingCode } : {}),
        ...(eta !== undefined ? { eta } : {}),
        ...(mapLat !== undefined ? { mapLat } : {}),
        ...(mapLng !== undefined ? { mapLng } : {}),
      },
      include: ORDER_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'VOYAGE_UPDATE',
        entity: 'Order',
        entityId: id,
        meta: { vesselName, vesselImo, currentPort, originPort, destinationPort, trackingCode },
      },
    });
    return mapOrder(order);
  }

  private async withLivePin(order: Parameters<typeof mapOrder>[0] & {
    vesselImo?: string | null;
    containerNumber: string | null;
  }) {
    const mapped = mapOrder(order);
    const pin = await this.resolvePin(order);
    const liveImo = Boolean(order.vesselImo && isLiveVesselMapStatus(order.currentStatus));
    if (!order.containerNumber) {
      return {
        ...mapped,
        ...pin,
        vesselName: pin.vesselName || mapped.vesselName,
      };
    }

    try {
      const ocean = await this.containers.lookup(order.containerNumber);
      return {
        ...mapped,
        vesselName: pin.vesselName || mapped.vesselName || ocean.vesselName,
        voyageNumber: mapped.voyageNumber || ocean.voyageNumber,
        carrierName: mapped.carrierName || ocean.carrierName,
        carrierCode: mapped.carrierCode || ocean.carrierCode,
        currentPort: mapped.currentPort || ocean.currentPort,
        currentCountry: mapped.currentCountry || ocean.currentCountry,
        originPort: mapped.originPort || ocean.originPort,
        destinationPort: mapped.destinationPort || ocean.destinationPort,
        containerStatus: mapped.containerStatus || ocean.containerStatus,
        eta: mapped.eta || ocean.eta,
        lat: pin.lat ?? mapped.lat ?? (liveImo ? undefined : ocean.lat),
        lng: pin.lng ?? mapped.lng ?? (liveImo ? undefined : ocean.lng),
      };
    } catch {
      return { ...mapped, ...pin, vesselName: pin.vesselName || mapped.vesselName };
    }
  }

  private async resolvePin(order: {
    currentStatus?: string | null;
    vesselImo?: string | null;
    vesselName?: string | null;
    currentPort?: string | null;
    destinationPort?: string | null;
    originPort?: string | null;
    containerNumber?: string | null;
    mapLat?: number | null;
    mapLng?: number | null;
  }): Promise<MapPin> {
    const manual: MapPin | null =
      order.mapLat != null && order.mapLng != null
        ? { lat: order.mapLat, lng: order.mapLng }
        : null;

    if (order.vesselImo && isLiveVesselMapStatus(order.currentStatus)) {
      try {
        const pos = await this.vessels.positionByImo(order.vesselImo);
        if (pos?.hasCoordinates && pos.latitude != null && pos.longitude != null) {
          return {
            lat: pos.latitude,
            lng: pos.longitude,
            vesselName: pos.name ?? undefined,
          };
        }
        return { ...(manual ?? {}), vesselName: pos?.name ?? undefined };
      } catch {
        return manual ?? {};
      }
    }

    if (manual) return manual;

    const port = attachPortCoords({
      containerNumber: order.containerNumber || '',
      validFormat: false,
      checkDigitOk: null,
      prefix: '',
      source: 'prefix',
      currentPort: order.currentPort ?? undefined,
      destinationPort: order.destinationPort ?? undefined,
      originPort: order.originPort ?? undefined,
    });
    return { lat: port.lat, lng: port.lng };
  }

  async updateStatus(id: string, dto: UpdateStatusDto, userId?: string) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Göndəriş tapılmadı');
    const status = dto.status as ShipmentStatus;
    const packed =
      dto.currentTransitIndex !== undefined
        ? packTransits((existing as { transitPorts?: unknown }).transitPorts, undefined, dto.currentTransitIndex)
        : undefined;
    const location = locationForStatus(status, existing.destinationPort);
    const title = statusLabelAz(status);
    const order = await this.prisma.order.update({
      where: { id },
      data: {
        currentStatus: status,
        ...location,
        ...(status === 'DELIVERED'
          ? { deliveredAt: (existing as { deliveredAt?: Date | null }).deliveredAt ?? new Date() }
          : {}),
        ...(packed ? { transitPorts: packed } : {}),
        events: {
          create: {
            status,
            title,
            description: dto.note || `Hazırkı mərhələ: ${title}`,
            occurredAt: new Date(),
          },
        },
      },
      include: ORDER_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'STATUS_UPDATE', entity: 'Order', entityId: id, meta: { status } },
    });
    if (dto.phone !== undefined) {
      await this.syncCustomer(existing.customerId, { phone: dto.phone });
    }
    const notify = await this.notify.statusChanged({
      phone: dto.phone || order.customer.phone,
      trackingCode: order.trackingCode,
      status,
      make: order.vehicle?.make,
      model: order.vehicle?.model,
    });
    return { ...mapOrder(order), notify };
  }

  async photoBinary(id: string) {
    const row = await this.prisma.orderPhoto.findUnique({ where: { id } });
    if (!row?.url) throw new NotFoundException('Şəkil tapılmadı');
    const parsed = decodeDataUrl(row.url);
    if (parsed) return parsed;
    const file = await this.cloud.get(row.url);
    if (file) return file;
    throw new NotFoundException('Şəkil tapılmadı');
  }

  async addPhoto(orderId: string, dto: { url?: string; category?: string; caption?: string }) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new NotFoundException('Göndəriş tapılmadı');
    const rows = photoRows([dto]);
    if (!rows.length) throw new BadRequestException('Şəkil JPEG və ya PNG olmalıdır.');
    const count = await this.prisma.orderPhoto.count({ where: { orderId } });
    if (count >= 40) throw new BadRequestException('Maksimum 40 şəkil.');
    const parsed = decodeDataUrl(rows[0].url);
    if ((await this.cloud.isEnabled()) && parsed) {
      const created = await this.prisma.orderPhoto.create({
        data: { orderId, url: 'pending', caption: rows[0].caption, category: rows[0].category },
      });
      try {
        const url = await this.cloud.put(existing.vin, created.id, rows[0].url);
        await this.prisma.orderPhoto.update({ where: { id: created.id }, data: { url } });
      } catch (err) {
        console.error('Cloudinary photo upload failed, storing in database', err);
        await this.prisma.orderPhoto.update({
          where: { id: created.id },
          data: { url: rows[0].url },
        });
      }
    } else {
      await this.prisma.orderPhoto.create({ data: { orderId, ...rows[0] } });
    }
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    return mapOrder(order);
  }

  async prunePhotos(orderId: string, keepIds: string[] = [], keepUrls: string[] = []) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new NotFoundException('Göndəriş tapılmadı');
    const all = await this.prisma.orderPhoto.findMany({ where: { orderId } });
    const keep = new Set([...keepIds, ...keepUrls]);
    const doomed = all.filter((row) => !keep.has(row.id) && !keep.has(row.url));
    for (const row of doomed) {
      await this.cloud.remove(row.url);
    }
    if (doomed.length) {
      await this.prisma.orderPhoto.deleteMany({ where: { id: { in: doomed.map((row) => row.id) } } });
    }
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    return mapOrder(order);
  }
}
