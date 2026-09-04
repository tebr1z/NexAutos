import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContainersService } from '../containers/containers.service';
import { VesselsService } from '../vessels/vessels.service';
import { attachPortCoords } from '../containers/registry';
import { CreateOrderDto, UpdateStatusDto, UpdateVoyageDto } from './dto';
import { generateTrackingCode, mapOrder, ORDER_INCLUDE, parseTransitRoute } from './order.mapper';
import { NotifyService } from '../notify/notify.service';

function opt(value?: string) {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t === '' ? null : t;
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

function normalizeImo(raw?: string) {
  if (raw === undefined) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length !== 7) throw new BadRequestException('IMO must be 7 digits.');
  return digits;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private containers: ContainersService,
    private vessels: VesselsService,
    private notify: NotifyService,
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

    const ocean = dto.containerNumber ? await this.containers.lookup(dto.containerNumber) : null;

    const order = await this.prisma.order.create({
      data: {
        trackingCode,
        customerId: customer.id,
        vehicleId: vehicle.id,
        vin: dto.vin.toUpperCase(),
        auctionHouse: dto.auctionHouse ?? 'OTHER',
        containerNumber: ocean?.formatted ?? dto.containerNumber,
        carrierCode: ocean?.carrierCode,
        carrierName: ocean?.carrierName,
        vesselName: opt(dto.vesselName) ?? ocean?.vesselName,
        vesselImo: normalizeImo(dto.vesselImo),
        voyageNumber: ocean?.voyageNumber,
        containerStatus: ocean?.containerStatus,
        originPort: opt(dto.originPort) ?? ocean?.originPort,
        destinationPort: opt(dto.destinationPort) ?? ocean?.destinationPort,
        currentCountry: opt(dto.currentCountry) ?? ocean?.currentCountry,
        currentPort: opt(dto.currentPort) ?? ocean?.currentPort,
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

  async findByCode(code: string) {
    await this.purgeExpiredArchive();
    const raw = code.toUpperCase();
    const order = await this.prisma.order.findFirst({
      where: { trackingCode: raw },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Göndəriş tapılmadı');
    const deliveredAt = (order as { deliveredAt?: Date | null }).deliveredAt;
    if (order.currentStatus === 'DELIVERED' && deliveredAt && Date.now() - deliveredAt.getTime() > ARCHIVE_MS) {
      throw new NotFoundException('Göndəriş tapılmadı');
    }
    return this.withLivePin(order);
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
        events: {
          create: {
            status: existing.currentStatus,
            title: 'Voyage update',
            description:
              dto.note?.trim() ||
              [
                vesselName ? `Vessel ${vesselName}` : null,
                vesselImo ? `IMO ${vesselImo}` : null,
                currentPort ? `at ${currentPort}` : null,
                originPort && destinationPort ? `${originPort} → ${destinationPort}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Shipment location updated',
            port: currentPort ?? existing.currentPort,
            country: currentCountry ?? existing.currentCountry,
            occurredAt: new Date(),
          },
        },
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
    return this.withLivePin(order);
  }

  private async withLivePin(order: Parameters<typeof mapOrder>[0] & {
    vesselImo?: string | null;
    containerNumber: string | null;
  }) {
    const mapped = mapOrder(order);
    const pin = await this.resolvePin(order);
    if (!order.containerNumber) return { ...mapped, ...pin };

    try {
      const ocean = await this.containers.lookup(order.containerNumber);
      return {
        ...mapped,
        vesselName: mapped.vesselName || ocean.vesselName,
        voyageNumber: mapped.voyageNumber || ocean.voyageNumber,
        carrierName: mapped.carrierName || ocean.carrierName,
        carrierCode: mapped.carrierCode || ocean.carrierCode,
        currentPort: mapped.currentPort || ocean.currentPort,
        currentCountry: mapped.currentCountry || ocean.currentCountry,
        originPort: mapped.originPort || ocean.originPort,
        destinationPort: mapped.destinationPort || ocean.destinationPort,
        containerStatus: mapped.containerStatus || ocean.containerStatus,
        eta: mapped.eta || ocean.eta,
        lat: pin.lat ?? ocean.lat,
        lng: pin.lng ?? ocean.lng,
      };
    } catch {
      return { ...mapped, ...pin };
    }
  }

  private async resolvePin(order: {
    vesselImo?: string | null;
    vesselName?: string | null;
    currentPort?: string | null;
    destinationPort?: string | null;
    originPort?: string | null;
    containerNumber?: string | null;
  }) {
    if (order.vesselImo) {
      try {
        const pos = await this.vessels.positionByImo(order.vesselImo);
        if (pos?.hasCoordinates) return { lat: pos.latitude ?? undefined, lng: pos.longitude ?? undefined };
      } catch {
        /* IMO AIS optional */
      }
    }
    if (order.vesselName) {
      try {
        const pos = await this.vessels.positionByName(order.vesselName);
        if (pos?.hasCoordinates) return { lat: pos.latitude ?? undefined, lng: pos.longitude ?? undefined };
      } catch {
        /* name AIS optional */
      }
    }
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
    const order = await this.prisma.order.update({
      where: { id },
      data: {
        currentStatus: status,
        ...(status === 'DELIVERED'
          ? { deliveredAt: (existing as { deliveredAt?: Date | null }).deliveredAt ?? new Date() }
          : {}),
        ...(packed ? { transitPorts: packed } : {}),
        events: {
          create: {
            status,
            title: status.replaceAll('_', ' '),
            description: dto.note || `Hazırkı mərhələ: ${status}`,
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
}
