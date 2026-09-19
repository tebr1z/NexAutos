import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContainersService } from '../containers/containers.service';
import { VesselsService } from '../vessels/vessels.service';
import { attachPortCoords, enrichKnownContainer, lookupCarrier } from '../containers/registry';
import { CreateOrderDto, UpdateStatusDto, UpdateVoyageDto } from './dto';
import { generateTrackingCode, mapOrder, ORDER_INCLUDE, parseTransitRoute } from './order.mapper';
import { NotifyService, statusLabelAz } from '../notify/notify.service';
import { R2Storage } from '../storage/r2.storage';

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
    private r2: R2Storage,
  ) {}

  async create(dto: CreateOrderDto, userId?: string) {
    let customer = await this.prisma.customer.findFirst({
      where: { email: (dto.email ?? `${dto.customerName}@autonex.local`).toLowerCase() },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          name: dto.customerName,
          email: (dto.email ?? `${dto.vin.toLowerCase()}@autonex.local`).toLowerCase(),
          phone: dto.phone ?? '',
        },
      });
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
    let trackingCode = dto.trackingCode || generateTrackingCode(dto.customerName, dto.make ?? '', dto.model, existing);
    while (await this.prisma.order.findUnique({ where: { trackingCode } })) {
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

  async findByCode(code: string) {
    await this.purgeExpiredArchive();
    const raw = code.toUpperCase().replace(/\s+/g, '');
    const order = await this.prisma.order.findFirst({
      where: { trackingCode: { equals: raw, mode: 'insensitive' } },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Göndəriş tapılmadı');
    const deliveredAt = (order as { deliveredAt?: Date | null }).deliveredAt;
    if (order.currentStatus === 'DELIVERED' && deliveredAt && Date.now() - deliveredAt.getTime() > ARCHIVE_MS) {
      throw new NotFoundException('Göndəriş tapılmadı');
    }
    return mapOrder(order);
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
    const notify = await this.notify.statusChanged({
      phone: order.customer.phone,
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
    const key = this.r2.keyFromUrl(row.url);
    if (key) {
      const file = await this.r2.get(key);
      if (file) return file;
    }
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
    if (this.r2.enabled() && parsed) {
      const created = await this.prisma.orderPhoto.create({
        data: { orderId, url: 'pending', caption: rows[0].caption, category: rows[0].category },
      });
      try {
        const key = `orders/${orderId}/${created.id}.jpg`;
        const url = await this.r2.put(key, parsed.buf, parsed.mime);
        await this.prisma.orderPhoto.update({ where: { id: created.id }, data: { url } });
      } catch (err) {
        console.error('R2 photo upload failed, storing in database', err);
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
      const key = this.r2.keyFromUrl(row.url);
      if (key) await this.r2.remove(key);
    }
    if (doomed.length) {
      await this.prisma.orderPhoto.deleteMany({ where: { id: { in: doomed.map((row) => row.id) } } });
    }
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    return mapOrder(order);
  }
}
