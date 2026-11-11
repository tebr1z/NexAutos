import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Logger, Optional } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import { Prisma, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContainersService } from '../containers/containers.service';
import { VesselsService } from '../vessels/vessels.service';
import { attachPortCoords, enrichKnownContainer, lookupCarrier } from '../containers/registry';
import { CreateInsuranceDto, CreateOrderDto, CreateOrderReviewDto, TrackingDetailsDto, UpdateInsuranceDto, UpdateStatusDto, UpdateVoyageDto } from './dto';
import { generateTrackingCode, hasInsuranceRecord, mapContractSummary, mapOrder, ORDER_INCLUDE, parseTransitRoute } from './order.mapper';
import { NotifyService, normalizePhone, siteBase, statusLabelAz, type NotifyResult } from '../notify/notify.service';
import { CloudinaryStorage } from '../storage/cloudinary.storage';
import { PhotoNotificationsService, safeShipmentNotifyResult, type PhotoNotificationQueueResult } from './photo-notifications.service';

function opt(value?: string | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = value.trim();
  return t === '' ? null : t;
}

function workflowFields(dto: TrackingDetailsDto) {
  let carrierTrackingUrl = opt(dto.carrierTrackingUrl);
  if (carrierTrackingUrl) {
    let url: URL;
    try { url = new URL(carrierTrackingUrl); } catch {
      throw new BadRequestException('Daşıyıcının keçidi düzgün HTTPS ünvanı olmalıdır.');
    }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || carrierTrackingUrl.length > 2000) {
      throw new BadRequestException('Daşıyıcının keçidi düzgün HTTPS ünvanı olmalıdır.');
    }
    carrierTrackingUrl = url.href;
  }
  const choices: Record<string, readonly unknown[]> = {
    originCountry: ['USA', 'KOREA', 'CHINA', 'OTHER', null],
    freightPaymentStatus: ['UNPAID', 'PARTIAL', 'PAID'],
    documentMethod: ['UNSET', 'POWER_OF_ATTORNEY', 'SIGNIFY'],
    documentStatus: ['PENDING', 'COMPLETED'],
  };
  for (const [key, allowed] of Object.entries(choices)) {
    const value = dto[key as keyof TrackingDetailsDto];
    if (value !== undefined && !allowed.includes(value)) {
      throw new BadRequestException(`${key}: düzgün dəyər seçin.`);
    }
  }
  if (dto.purchasePaymentPercent != null && (!Number.isInteger(dto.purchasePaymentPercent) || dto.purchasePaymentPercent < 0 || dto.purchasePaymentPercent > 100)) {
    throw new BadRequestException('İlkin ödəniş faizi 0–100 aralığında olmalıdır.');
  }
  if (dto.commissionUsd != null && (!Number.isFinite(dto.commissionUsd) || dto.commissionUsd < 0 || dto.commissionUsd > 1000000 || Math.abs(dto.commissionUsd * 100 - Math.round(dto.commissionUsd * 100)) > 1e-7)) {
    throw new BadRequestException('Komissiya 0–1 000 000 USD aralığında, ən çox iki onluq rəqəmlə olmalıdır.');
  }
  const containerOpeningDate = opt(dto.containerOpeningDate);
  if (containerOpeningDate && (!/^\d{4}-\d{2}-\d{2}$/.test(containerOpeningDate) || Number.isNaN(Date.parse(containerOpeningDate)) || new Date(containerOpeningDate).toISOString().slice(0, 10) !== containerOpeningDate)) {
    throw new BadRequestException('Konteyner açılma tarixi YYYY-MM-DD formatında düzgün tarix olmalıdır.');
  }
  return {
    ...(carrierTrackingUrl !== undefined ? { carrierTrackingUrl } : {}),
    ...(dto.originCountry !== undefined ? { originCountry: dto.originCountry } : {}),
    ...(dto.freightPaymentStatus !== undefined ? { freightPaymentStatus: dto.freightPaymentStatus } : {}),
    ...(dto.documentMethod !== undefined ? { documentMethod: dto.documentMethod } : {}),
    ...(dto.documentStatus !== undefined ? { documentStatus: dto.documentStatus } : {}),
    ...(dto.purchasePaymentPercent !== undefined ? { purchasePaymentPercent: dto.purchasePaymentPercent } : {}),
    ...(dto.commissionUsd !== undefined ? { commissionUsd: dto.commissionUsd } : {}),
    ...(containerOpeningDate !== undefined ? { containerOpeningDate } : {}),
  };
}

function publicOrder(order: Parameters<typeof mapOrder>[0]) {
  const { adminNotes: _adminNotes, ...mapped } = mapOrder(order);
  return mapped;
}

function locationForStatus(status: ShipmentStatus, destinationPort?: string | null) {
  const dest = destinationPort?.trim();
  if (['DESTINATION_PORT', 'CONTAINER_DISCHARGED', 'CONTAINER_OPENING_PENDING', 'CONTAINER_OPENED', 'TIR_LOADING_PENDING', 'TIR_LOADED', 'CUSTOMS_DOCUMENTS', 'CUSTOMS_DOCUMENTS_READY'].includes(status)) {
    return dest ? { currentPort: dest, currentCountry: 'Georgia' } : {};
  }
  if (status === 'TIR_GEORGIA_BORDER') {
    return { currentPort: 'Gürcüstan sərhədi', currentCountry: 'Georgia' };
  }
  if (['TIR_BAKU_CUSTOMS', 'CUSTOMS_CLEARANCE', 'READY_FOR_DELIVERY'].includes(status)) {
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

// VINs and auction lots are public identifiers, not the customer's private tracking key.
// Keep their query and response separate from resolveOrderByCode (also used for reviews/insurance).
const PUBLIC_TRACKING_SELECT = {
  // Used only to screen embedded links/free-form logistics fields, never returned.
  trackingCode: true,
  vin: true,
  auctionHouse: true,
  currentStatus: true,
  deliveredAt: true,
  containerNumber: true,
  carrierCode: true,
  carrierName: true,
  carrierTrackingUrl: true,
  vesselName: true,
  voyageNumber: true,
  originCountry: true,
  containerStatus: true,
  originPort: true,
  destinationPort: true,
  currentCountry: true,
  currentPort: true,
  mapLat: true,
  mapLng: true,
  transitPorts: true,
  eta: true,
  containerOpeningDate: true,
  vehicle: { select: { make: true, model: true, year: true, lotNumber: true } },
  events: { orderBy: { occurredAt: 'asc' as const }, select: { status: true, occurredAt: true } },
  photos: { select: { id: true, url: true, category: true } },
} satisfies Prisma.OrderSelect;

type PublicTrackingOrder = Prisma.OrderGetPayload<{ select: typeof PUBLIC_TRACKING_SELECT }>;

function containsPrivateTrackingCode(value: string, code: string) {
  const key = lookupCode(code);
  if (!key) return false;
  let inspected = value;
  // Decode ASCII percent escapes independently, so one malformed escape cannot
  // hide an otherwise valid encoded tracking key elsewhere in a URL.
  for (let depth = 0; depth < 8; depth += 1) {
    if (lookupCode(inspected).includes(key)) return true;
    const decoded = inspected.replace(/%([0-9a-f]{2})/gi, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
    if (decoded === inspected) return false;
    inspected = decoded;
  }
  // Opaque, repeatedly encoded values cannot be screened reliably; fail closed.
  return lookupCode(inspected).includes(key) || /%[0-9a-f]{2}/i.test(inspected);
}

function publicTrackingText(value: string | null | undefined, code: string) {
  return value && !containsPrivateTrackingCode(value, code) ? value : undefined;
}

function publicTrackingUrl(value: string | null | undefined, code: string, photo = false) {
  if (!value || containsPrivateTrackingCode(value, code)) return undefined;
  if (photo && /^\/api\/v1\/media\/photos\/[A-Za-z0-9_-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (isIP(host) || !host.includes('.') || /\.(localhost|local|internal)$/.test(host)) return undefined;
    const siteHosts = ['nex.autos'];
    try { siteHosts.push(new URL(siteBase()).hostname.toLowerCase().replace(/^www\./, '')); } catch { /* Retain the canonical host guard. */ }
    const sameSite = siteHosts.some((siteHost) => host === siteHost || host.endsWith(`.${siteHost}`));
    if (sameSite && (!photo || !/^\/api\/v1\/media\/photos\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.search || url.hash)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function publicIdentifierOrder(order: PublicTrackingOrder, identifier: string, lookupType: 'vin' | 'lot') {
  const transits = parseTransitRoute(order.transitPorts);
  const text = (value: string | null | undefined) => publicTrackingText(value, order.trackingCode);
  return {
    lookupType,
    // This alias preserves refresh/share URLs without exposing the private tracking code.
    trackingCode: identifier,
    vin: order.vin,
    make: order.vehicle?.make ?? undefined,
    model: order.vehicle?.model ?? undefined,
    year: order.vehicle?.year ?? undefined,
    lotNumber: order.vehicle?.lotNumber ?? undefined,
    auctionHouse: order.auctionHouse,
    customerName: '',
    currentStatus: order.currentStatus,
    deliveredAt: order.deliveredAt?.toISOString(),
    containerNumber: text(order.containerNumber),
    carrierCode: text(order.carrierCode),
    carrierName: text(order.carrierName),
    carrierTrackingUrl: publicTrackingUrl(order.carrierTrackingUrl, order.trackingCode),
    vesselName: text(order.vesselName),
    voyageNumber: text(order.voyageNumber),
    originCountry: text(order.originCountry),
    containerStatus: text(order.containerStatus),
    originPort: text(order.originPort),
    destinationPort: text(order.destinationPort),
    currentCountry: text(order.currentCountry),
    currentPort: text(order.currentPort),
    mapLat: order.mapLat ?? undefined,
    mapLng: order.mapLng ?? undefined,
    lat: order.mapLat ?? undefined,
    lng: order.mapLng ?? undefined,
    transitPorts: transits.stops.map((stop) => ({ place: text(stop.place) ?? '—', occurredAt: text(stop.occurredAt) })),
    currentTransitIndex: transits.currentIndex,
    eta: order.eta?.toISOString(),
    containerOpeningDate: order.containerOpeningDate ?? undefined,
    events: order.events.map((event) => ({
      status: event.status,
      title: statusLabelAz(event.status),
      occurredAt: event.occurredAt.toISOString(),
    })),
    documents: [],
    photos: order.photos.flatMap((photo) => {
      const url = photo.url.startsWith('data:image/') || photo.url.startsWith('r2:')
        ? `/api/v1/media/photos/${photo.id}` : publicTrackingUrl(photo.url, order.trackingCode, true);
      return url ? [{ id: photo.id, url, category: text(photo.category) }] : [];
    }),
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

export type TelegramOrderChangeKind = 'status' | 'container' | 'carrier' | 'openingDate';

/** Validate bot input independently of the conversation UI and persisted callbacks. */
export function normalizeTelegramOrderChange(kind: TelegramOrderChangeKind, raw: string): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new BadRequestException('Yeni dəyəri yazın.');
  const value = raw.trim();
  if (kind === 'status') {
    if (!Object.values(ShipmentStatus).includes(value as ShipmentStatus)) throw new BadRequestException('İzləmə mərhələsi düzgün deyil.');
    return value;
  }
  if (kind === 'container') {
    const container = value.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{4}\d{7}$/.test(container)) throw new BadRequestException('Konteyner kodu 4 hərf və 7 rəqəmdən ibarət olmalıdır. Məsələn: MSCU1234567.');
    return container;
  }
  if (kind === 'carrier') {
    return workflowFields({ carrierTrackingUrl: value }).carrierTrackingUrl!;
  }
  if (kind === 'openingDate') {
    return workflowFields({ containerOpeningDate: value }).containerOpeningDate!;
  }
  throw new BadRequestException('Bu əməliyyat dəstəklənmir.');
}

type TelegramNotificationOrder = {
  trackingCode: string;
  currentStatus: ShipmentStatus;
  customer: { phone: string };
  vehicle: { make: string | null; model: string | null } | null;
};

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private containers: ContainersService,
    private vessels: VesselsService,
    private notify: NotifyService,
    private cloud: CloudinaryStorage,
    @Optional() private photoNotifications?: PhotoNotificationsService,
  ) {}

  private async auditStatusNotification(orderId: string, status: string, notify: NotifyResult, userId?: string) {
    try {
      await this.prisma.auditLog.create({ data: {
        userId, action: 'CUSTOMER_STATUS_NOTIFICATION', entity: 'Order', entityId: orderId,
        meta: { status, notify: safeShipmentNotifyResult(notify) } as Prisma.InputJsonValue,
      } });
    } catch { this.log.warn('Shipment notification result could not be audited; the saved shipment was retained.'); }
  }

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
    const details = workflowFields(dto);
    const vin = dto.vin.trim().toUpperCase();
    if (!vin) throw new BadRequestException('VIN yazın.');
    const customerName = dto.customerName?.trim() || 'Müştəri təyin edilməyib';
    // Unknown customers must not all share the same placeholder email/account.
    const customerEmail = (dto.email || `${vin.toLowerCase()}@autonex.local`).toLowerCase();
    let customer = await this.prisma.customer.findFirst({
      where: { email: customerEmail },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          name: customerName,
          email: customerEmail,
          phone: normalizePhone(dto.phone) ?? dto.phone ?? '',
        },
      });
    } else if (dto.phone || dto.customerName) {
      await this.syncCustomer(customer.id, { phone: dto.phone, customerName: dto.customerName });
      customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    }

    const vehicle = await this.prisma.vehicle.upsert({
      where: { vin },
      update: { make: dto.make, model: dto.model, year: dto.year, lotNumber: opt(dto.lotNumber) },
      create: {
        vin,
        auctionHouse: dto.auctionHouse ?? 'OTHER',
        make: dto.make,
        model: dto.model,
        year: dto.year,
        lotNumber: opt(dto.lotNumber),
      },
    });

    const existing = (await this.prisma.order.findMany({ select: { trackingCode: true } })).map((o) => o.trackingCode);
    const requested = normalizeTrackingCode(dto.trackingCode);
    if (requested) {
      const already = await this.prisma.order.findUnique({ where: { trackingCode: requested }, include: ORDER_INCLUDE });
      if (already) {
        if (already.vin === vin) return mapOrder(already);
        throw new ConflictException('Bu izləmə kodu artıq başqa maşındadır.');
      }
    }
    let trackingCode = requested || generateTrackingCode(customerName, dto.make ?? '', dto.model, existing);
    while (!requested && (await this.prisma.order.findUnique({ where: { trackingCode } }))) {
      trackingCode = generateTrackingCode(customerName, dto.make ?? '', dto.model, [...existing, trackingCode]);
    }

    const ocean = dto.containerNumber
      ? attachPortCoords(enrichKnownContainer(lookupCarrier(dto.containerNumber)))
      : null;

    const order = await this.prisma.order.create({
      data: {
        trackingCode,
        customerId: customer.id,
        vehicleId: vehicle.id,
        vin,
        ...details,
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
            title: statusLabelAz('PURCHASED'),
            description: 'Maşın alınıb, izləmə yaradılıb.',
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

    let notify: NotifyResult;
    try {
      notify = await this.notify.statusChanged({
        phone: order.customer.phone, trackingCode: order.trackingCode, status: 'PURCHASED',
        make: order.vehicle?.make, model: order.vehicle?.model,
      });
    } catch {
      this.log.warn('New-order notification failed; the saved order was retained.');
      notify = { sent: false, error: 'notify_failed' };
    }
    await this.auditStatusNotification(order.id, 'PURCHASED', notify, userId);
    return { ...mapOrder(order), notify };
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
    return orders.map(publicOrder);
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

  private async findByPublicIdentifier(code: string) {
    const identifier = code.trim().replace(/\s+/g, '').toUpperCase();
    const isVin = /^[A-HJ-NPR-Z0-9]{17}$/.test(identifier);
    const isLot = /^[A-Z0-9][A-Z0-9-]{2,48}[A-Z0-9]$/.test(identifier);
    if (!isVin && !isLot) throw new NotFoundException('Göndəriş tapılmadı');

    const identifiers: Prisma.OrderWhereInput[] = [];
    // Stored VINs are normalized on write. Exact equality uses Order.vin's existing index.
    if (isVin) identifiers.push({ vin: identifier });
    if (isLot) identifiers.push({ vehicle: { lotNumber: { equals: identifier, mode: 'insensitive' } } });
    const cutoff = new Date(Date.now() - ARCHIVE_MS);
    const orders = await this.prisma.order.findMany({
      where: {
        AND: [
          { OR: identifiers },
          { OR: [{ currentStatus: { not: 'DELIVERED' } }, { deliveredAt: null }, { deliveredAt: { gte: cutoff } }] },
        ],
      },
      select: PUBLIC_TRACKING_SELECT,
      take: 2,
    });
    // A lot can recur across auctions, and a VIN can have more than one shipment.
    // Cross-namespace collisions are also ambiguous: never pick a customer's record arbitrarily.
    if (orders.length > 1) {
      throw new ConflictException('Bu VIN və ya lot üzrə birdən çox göndəriş var. Şəxsi izləmə kodunu daxil edin.');
    }
    const order = orders[0];
    if (!order) throw new NotFoundException('Göndəriş tapılmadı');
    return publicIdentifierOrder(order, identifier, isVin && order.vin === identifier ? 'vin' : 'lot');
  }

  async findByCode(code: string) {
    if (typeof code !== 'string' || !code.trim() || code.length > 100) throw new NotFoundException('Göndəriş tapılmadı');
    // Existing tracking/contract codes deliberately win over public VIN/lot identifiers.
    // Public reads must not delete archived orders as a side effect.
    const found = await this.resolveOrderByCode(code);
    if (!found) return this.findByPublicIdentifier(code);

    if ('customer' in found && found.customer) {
      const order = found;
      const deliveredAt = (order as { deliveredAt?: Date | null }).deliveredAt;
      if (order.currentStatus === 'DELIVERED' && deliveredAt && Date.now() - deliveredAt.getTime() > ARCHIVE_MS) {
        throw new NotFoundException('Göndəriş tapılmadı');
      }
      let reviewToken = order.reviewToken;
      if (order.currentStatus === 'DELIVERED' && !reviewToken) {
        // Lazily cover delivered records created before this workflow, safely under concurrency.
        await this.prisma.order.updateMany({
          where: { id: order.id, reviewToken: null, currentStatus: 'DELIVERED' },
          data: { reviewToken: randomBytes(24).toString('hex') },
        });
        reviewToken = (await this.prisma.order.findUnique({ where: { id: order.id }, select: { reviewToken: true } }))?.reviewToken ?? null;
      }
      return {
        ...publicOrder(order),
        ...(order.currentStatus === 'DELIVERED' && reviewToken ? { reviewToken } : {}),
      };
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

  async createReview(code: string, dto: CreateOrderReviewDto) {
    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5 || (dto.comment?.length ?? 0) > 2000) {
      throw new BadRequestException('Qiymət 1–5, rəy isə ən çox 2000 simvol olmalıdır.');
    }
    const found = await this.resolveOrderByCode(code);
    if (!found || !('customer' in found) || !found.customer) throw new NotFoundException('Göndəriş tapılmadı');
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize submission with status updates and duplicate submissions for this order.
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${found.id} FOR UPDATE`;
        const order = await tx.order.findUnique({ where: { id: found.id }, select: { id: true, currentStatus: true, reviewToken: true, review: true } });
        if (!order) throw new NotFoundException('Göndəriş tapılmadı');
        if (order.currentStatus !== 'DELIVERED') throw new BadRequestException('Xidməti yalnız maşın təhvil verildikdən sonra dəyərləndirə bilərsiniz.');
        const token = typeof dto.reviewToken === 'string' ? dto.reviewToken : '';
        if (!order.reviewToken || order.reviewToken.length !== 48 || !/^[a-f0-9]{48}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(order.reviewToken))) {
          throw new ForbiddenException('Rəy keçidi etibarlı deyil. İzləmə səhifəsini yeniləyin.');
        }
        if (order.review) throw new ConflictException('Bu sifariş üçün rəy artıq göndərilib.');
        const review = await tx.orderReview.create({ data: { orderId: order.id, rating: dto.rating, comment: dto.comment?.trim() || null } });
        return { rating: review.rating, comment: review.comment, createdAt: review.createdAt.toISOString() };
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Bu sifariş üçün rəy artıq göndərilib.');
      throw error;
    }
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
    const notify = kind === 'photos'
      ? this.photoNotifications ? await this.photoNotifications.flush(id, true, userId) : { sent: false, error: 'not_configured' }
      : await this.notify.customerUpdate({
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
    const details = workflowFields(dto);
    if (dto.vin !== undefined && (typeof dto.vin !== 'string' || !dto.vin.trim())) {
      throw new BadRequestException('VIN boş ola bilməz.');
    }
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

    const vin = dto.vin === undefined ? undefined : dto.vin.trim().toUpperCase();
    let vehicleId: string | undefined;
    if (vin !== undefined || dto.make !== undefined || dto.model !== undefined || dto.year !== undefined || dto.lotNumber !== undefined) {
      const vehicle = await this.prisma.vehicle.upsert({
        where: { vin: vin || existing.vin },
        update: { make: opt(dto.make), model: opt(dto.model), year: dto.year, lotNumber: opt(dto.lotNumber) },
        create: { vin: vin || existing.vin, auctionHouse: existing.auctionHouse, make: opt(dto.make), model: opt(dto.model), year: dto.year, lotNumber: opt(dto.lotNumber) },
      });
      vehicleId = vehicle.id;
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        ...details,
        ...(vin !== undefined ? { vin } : {}),
        ...(vehicleId !== undefined ? { vehicleId } : {}),
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
        meta: { vesselName, vesselImo, currentPort, originPort, destinationPort, trackingCode, ...details },
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
    // Validate all fallible request input before changing the persisted stage/event.
    if (dto.phone !== undefined && (typeof dto.phone !== 'string' || (dto.phone.trim() && !normalizePhone(dto.phone)))) {
      throw new BadRequestException('Düzgün telefon yazın — məsələn 050 719 75 57 və ya 994705990399.');
    }
    const status = dto.status as ShipmentStatus;
    if (!Object.values(ShipmentStatus).includes(status)) throw new BadRequestException('İzləmə mərhələsi düzgün deyil.');
    const { existing, order, changed } = await this.prisma.$transaction(async (tx) => {
    // Follow Telegram's User -> Order lock order before the audit's user FK.
    if (userId) await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR KEY SHARE`;
    // Compare under the write lock: concurrent repeated admin requests must not
    // each notify for the same stage. Notes/events retain their existing behavior.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
    const existing = await tx.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Göndəriş tapılmadı');
    const changed = existing.currentStatus !== status;
    const packed =
      dto.currentTransitIndex !== undefined
        ? packTransits((existing as { transitPorts?: unknown }).transitPorts, undefined, dto.currentTransitIndex)
        : undefined;
    const location = locationForStatus(status, existing.destinationPort);
    const movedToDifferentPlace = Boolean(
      (location.currentPort !== undefined && location.currentPort !== existing.currentPort) ||
      (location.currentCountry !== undefined && location.currentCountry !== existing.currentCountry),
    );
    const title = statusLabelAz(status);
    const order = await tx.order.update({
      where: { id },
      data: {
        currentStatus: status,
        ...location,
        // An explicit coordinate belongs to its reported place, not later milestones.
        ...(movedToDifferentPlace ? { mapLat: null, mapLng: null } : {}),
        ...(status === 'DELIVERED'
          ? { deliveredAt: existing.deliveredAt ?? new Date(), reviewToken: existing.reviewToken ?? randomBytes(24).toString('hex') }
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
    await tx.auditLog.create({
      data: { userId, action: 'STATUS_UPDATE', entity: 'Order', entityId: id, meta: { status } },
    });
    return { existing, order, changed };
    });
    if (dto.phone !== undefined) {
      await this.syncCustomer(existing.customerId, { phone: dto.phone });
    }
    // syncCustomer ignores an empty phone; notifications and the response must
    // reflect the normalized number actually retained, not whitespace or the
    // customer snapshot read before this request updated their phone.
    const phone = normalizePhone(dto.phone) ?? order.customer.phone;
    const responseOrder = { ...order, customer: { ...order.customer, phone } };
    let notify: NotifyResult = { sent: false, error: 'skipped' };
    if (changed) {
      try {
        notify = await this.notify.statusChanged({
          phone,
          trackingCode: order.trackingCode,
          status,
          make: order.vehicle?.make,
          model: order.vehicle?.model,
        });
      } catch {
        this.log.warn('Shipment notification failed; the saved stage was retained.');
        notify = { sent: false, error: 'notify_failed' };
      }
      await this.auditStatusNotification(id, status, notify, userId);
    }
    return { ...mapOrder(responseOrder), notify };
  }

  /** The caller claims its one-use action in this same transaction. No network I/O here. */
  async applyTelegramChange(tx: Prisma.TransactionClient, input: {
    orderId: string;
    kind: TelegramOrderChangeKind;
    value: string;
    expectedUpdatedAt: string;
    userId: string;
  }) {
    const value = normalizeTelegramOrderChange(input.kind, input.value);
    // Serialize against admin writes, then compare the version shown in the preview.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const existing = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!existing) throw new NotFoundException('Göndəriş tapılmadı.');
    if (existing.updatedAt.toISOString() !== input.expectedUpdatedAt) {
      throw new ConflictException('Bu maşının məlumatları başqa əməliyyatla yenilənib. Maşını yenidən açın və dəyişikliyi təkrar təsdiqləyin.');
    }
    const field = { status: 'currentStatus', container: 'containerNumber', carrier: 'carrierTrackingUrl', openingDate: 'containerOpeningDate' }[input.kind];
    const oldValue = existing[field] ?? null;
    if (oldValue === value) throw new BadRequestException('Bu dəyər artıq qeyd olunub. Dəyişiklik edilmədi.');
    let data: Prisma.OrderUpdateInput;
    if (input.kind === 'status') {
      const status = value as ShipmentStatus;
      const location = locationForStatus(status, existing.destinationPort);
      const moved = (location.currentPort !== undefined && location.currentPort !== existing.currentPort)
        || (location.currentCountry !== undefined && location.currentCountry !== existing.currentCountry);
      const title = statusLabelAz(status);
      data = {
        currentStatus: status,
        ...location,
        ...(moved ? { mapLat: null, mapLng: null } : {}),
        ...(status === 'DELIVERED'
          ? { deliveredAt: existing.deliveredAt ?? new Date(), reviewToken: existing.reviewToken ?? randomBytes(24).toString('hex') }
          : {}),
        events: { create: { status, title, description: `Telegram vasitəsilə təsdiqlənib: ${title}`, occurredAt: new Date() } },
      };
    } else {
      data = { [field]: value };
    }
    const order = await tx.order.update({ where: { id: input.orderId }, data, include: { customer: true, vehicle: true } });
    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: input.kind === 'status' ? 'STATUS_UPDATE' : 'VOYAGE_UPDATE',
        entity: 'Order', entityId: input.orderId,
        meta: { source: 'telegram', field, oldValue, value },
      },
    });
    return order;
  }

  /** Only called after the action, order, event and audit have committed successfully. */
  async notifyTelegramStatus(order: TelegramNotificationOrder): Promise<NotifyResult> {
    return this.notify.statusChanged({
      phone: order.customer.phone, trackingCode: order.trackingCode, status: order.currentStatus,
      make: order.vehicle?.make, model: order.vehicle?.model,
    });
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
    const parsed = decodeDataUrl(rows[0].url);
    let uploadedPhotoId: string;
    if ((await this.cloud.isEnabled()) && parsed) {
      const created = await this.prisma.orderPhoto.create({
        data: { orderId, url: 'pending', caption: rows[0].caption, category: rows[0].category },
      });
      uploadedPhotoId = created.id;
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
      const created = await this.prisma.orderPhoto.create({ data: { orderId, ...rows[0] } });
      uploadedPhotoId = created.id;
    }
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    let photoNotification: PhotoNotificationQueueResult;
    try {
      if (!this.photoNotifications) throw new Error('Photo notification queue unavailable');
      photoNotification = await this.photoNotifications.enqueue(orderId, uploadedPhotoId);
    } catch {
      this.log.warn('Saved photo could not be queued for notification; the upload was retained.');
      photoNotification = { queued: false, error: 'enqueue_failed' };
    }
    return { ...mapOrder(order), uploadedPhotoId, photoNotification };
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
