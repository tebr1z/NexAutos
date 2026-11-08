import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto, CreateOrderReviewDto, UpdateVoyageDto } from './dto';
import { mapOrder } from './order.mapper';
import { OrdersService } from './orders.service';
import { shouldNotifyStatus, statusLabelAz } from '../notify/notify.service';

const token = 'a'.repeat(48);
const makeOrder = (extra: Record<string, unknown> = {}) => ({
  id: 'order', trackingCode: 'TRACK-123', vin: '1HGCM82633A004352', auctionHouse: 'COPART',
  customerId: 'customer', vehicleId: 'vehicle', customer: { name: 'Customer', phone: '' },
  vehicle: { id: 'vehicle', make: 'Honda', model: 'Accord', year: 2020, lotNumber: '12345678' },
  containerNumber: null, originPort: null, destinationPort: null, currentCountry: null, currentPort: null,
  eta: null, currentStatus: 'PURCHASED', deliveredAt: null, reviewToken: null, review: null,
  adminNotes: 'INTERNAL PRIVATE NOTES', events: [], documents: [], photos: [], invoices: [], contracts: [],
  ...extra,
});

function harness(extra: Record<string, unknown> = {}) {
  const order = makeOrder(extra);
  const prisma = {
    order: {
      findUnique: jest.fn().mockImplementation(async () => order),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => order),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn(async ({ data }) => { Object.assign(order, data); return { count: 1 }; }),
      update: jest.fn(async ({ data }) => ({ ...order, ...data, events: [] })),
      create: jest.fn(async ({ data }) => ({ ...order, ...data, events: [] })),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }) => ({ id: 'customer', ...data })),
    },
    vehicle: { upsert: jest.fn().mockResolvedValue(order.vehicle) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    orderReview: { create: jest.fn(async ({ data }) => ({ ...data, id: 'review', createdAt: new Date('2026-11-08T10:00:00Z') })) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  const notify = { statusChanged: jest.fn().mockResolvedValue({ sent: false, error: 'skipped' }) };
  const service = new OrdersService(prisma as never, {} as never, {} as never, notify as never, {} as never);
  return { order, prisma, service };
}

describe('Tracking workflow', () => {
  it('creates a minimal vehicle before logistics/customer details exist', async () => {
    const { prisma, service } = harness();
    prisma.order.findUnique.mockResolvedValue(null as never);
    const dto = { vin: '1hgcm82633a004352', make: 'Honda', model: 'Accord', year: 2020, lotNumber: '12345678', trackingCode: 'TRACK-123' };
    expect(await validate(plainToInstance(CreateOrderDto, dto))).toEqual([]);
    await service.create(dto, 'admin');
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({ where: { email: '1hgcm82633a004352@autonex.local' } });
    expect(prisma.customer.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: 'Müştəri təyin edilməyib' }) });
    expect(prisma.vehicle.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ year: 2020, lotNumber: '12345678' }) }));
    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      vin: '1HGCM82633A004352', events: { create: expect.objectContaining({ status: 'PURCHASED' }) },
    }) }));
    expect(prisma.order.create.mock.calls[0][0].data).not.toHaveProperty('commissionUsd');
  });

  it('uses a VIN-specific placeholder, not one shared customer for all unidentified buyers', async () => {
    const { prisma, service } = harness();
    prisma.order.findUnique.mockResolvedValue(null as never);
    await service.create({ vin: 'FIRSTVIN', trackingCode: 'TRACK-111' });
    await service.create({ vin: 'SECONDVIN', trackingCode: 'TRACK-222' });
    expect(prisma.customer.findFirst.mock.calls.map(([args]) => args.where.email)).toEqual(['firstvin@autonex.local', 'secondvin@autonex.local']);
  });

  it('updates logistics and actual vehicle fields, not browser-local overrides', async () => {
    const { prisma, service } = harness();
    await service.updateVoyage('order', {
      vin: '2HGCM82633A004352', make: 'Honda', model: 'Civic', year: 2021, lotNumber: '87654321',
      originCountry: 'USA', freightPaymentStatus: 'PARTIAL', documentMethod: 'SIGNIFY', documentStatus: 'PENDING',
      purchasePaymentPercent: 30, commissionUsd: 105, containerOpeningDate: '2026-11-15',
      carrierTrackingUrl: 'https://carrier.example/track?container=TEST123',
    });
    expect(prisma.vehicle.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { vin: '2HGCM82633A004352' }, update: expect.objectContaining({ year: 2021, lotNumber: '87654321' }) }));
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      vin: '2HGCM82633A004352', vehicleId: 'vehicle', originCountry: 'USA', purchasePaymentPercent: 30,
      commissionUsd: 105, containerOpeningDate: '2026-11-15', carrierTrackingUrl: 'https://carrier.example/track?container=TEST123',
    }) }));
  });

  it('clears optional values and keeps explicit zeroes', async () => {
    const { prisma, service } = harness();
    await service.updateVoyage('order', { carrierTrackingUrl: '', containerOpeningDate: '', commissionUsd: null, purchasePaymentPercent: null, originCountry: null });
    expect(prisma.order.update.mock.calls[0][0].data).toMatchObject({ carrierTrackingUrl: null, containerOpeningDate: null, commissionUsd: null, purchasePaymentPercent: null, originCountry: null });
    await service.updateVoyage('order', { commissionUsd: 0, purchasePaymentPercent: 0 });
    expect(prisma.order.update.mock.calls[1][0].data).toMatchObject({ commissionUsd: 0, purchasePaymentPercent: 0 });
  });

  it.each(['javascript:alert(1)', 'http://carrier.example', 'https://user:password@carrier.example', '//carrier.example', 'ftp://carrier.example'])('rejects unsafe carrier link %s', async (carrierTrackingUrl) => {
    const { prisma, service } = harness();
    await expect(service.updateVoyage('order', { carrierTrackingUrl })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it.each([
    { purchasePaymentPercent: 101 }, { purchasePaymentPercent: -1 }, { purchasePaymentPercent: 30.5 },
    { commissionUsd: -1 }, { commissionUsd: 1000001 }, { commissionUsd: 1.234 },
    { containerOpeningDate: '2026-02-30' }, { containerOpeningDate: 'tomorrow' }, { documentMethod: 'SIGNED_ELSEWHERE' },
  ])('rejects invalid workflow data %j', async (dto) => {
    const { service } = harness();
    await expect(service.updateVoyage('order', dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates inherited optional fields on both create and voyage DTOs', async () => {
    for (const Dto of [CreateOrderDto, UpdateVoyageDto]) {
      const dto = plainToInstance(Dto, { vin: 'VIN', year: 1949, commissionUsd: -1, containerOpeningDate: '2026-02-30' });
      expect((await validate(dto)).map((error) => error.property)).toEqual(expect.arrayContaining(['year', 'commissionUsd', 'containerOpeningDate']));
    }
    expect(await validate(plainToInstance(UpdateVoyageDto, { commissionUsd: null, purchasePaymentPercent: null, containerOpeningDate: '', carrierTrackingUrl: '' }))).toEqual([]);
  });

  it('exposes customer workflow values and review, but never admin notes or undelivered review tokens', async () => {
    const { service, order } = harness({ commissionUsd: '105.00', purchasePaymentPercent: 30, containerOpeningDate: '2026-11-15', reviewToken: token });
    const result = await service.findByCode('TRACK-123');
    expect(result).toMatchObject({ lotNumber: '12345678', commissionUsd: 105, purchasePaymentPercent: 30, containerOpeningDate: '2026-11-15' });
    expect(result).not.toHaveProperty('adminNotes');
    expect(result).not.toHaveProperty('reviewToken');
    expect(mapOrder(order as never)).toHaveProperty('adminNotes', 'INTERNAL PRIVATE NOTES');
  });

  it('accepts all new stages while retaining legacy enum values', async () => {
    const { service, prisma } = harness();
    expect(ShipmentStatus.AUCTION_PAID).toBe('AUCTION_PAID');
    expect(ShipmentStatus.IN_TRANSIT).toBe('IN_TRANSIT');
    for (const status of ['PAYMENT_RECEIVED', 'AUCTION_RELEASED', 'EXPORT_READY', 'TO_ORIGIN_PORT', 'CONTAINER_LOADING', 'VESSEL_WAITING', 'VESSEL_LOADED', 'ISTANBUL_TO_POTI', 'DESTINATION_APPROACHING', 'CONTAINER_DISCHARGED', 'CONTAINER_OPENING_PENDING', 'CONTAINER_OPENED', 'TIR_LOADING_PENDING', 'CUSTOMS_DOCUMENTS', 'CUSTOMS_DOCUMENTS_READY']) {
      await service.updateStatus('order', { status });
      expect(statusLabelAz(status)).not.toBe(status.replaceAll('_', ' '));
    }
    expect(prisma.order.update).toHaveBeenCalledTimes(15);
    await expect(service.updateStatus('order', { status: 'NOT_A_STAGE' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns an unpredictable review token on delivery', async () => {
    const { service, prisma } = harness();
    await service.updateStatus('order', { status: 'DELIVERED' });
    expect(prisma.order.update.mock.calls[0][0].data).toMatchObject({ deliveredAt: expect.any(Date), reviewToken: expect.stringMatching(/^[a-f0-9]{48}$/) });
  });

  it('notifies at the new export-ready milestone, matching the frontend policy', () => {
    expect(shouldNotifyStatus('EXPORT_READY')).toBe(true);
  });

  it('rejects invalid phone numbers before changing status or creating an event', async () => {
    const { service, prisma } = harness();
    await expect(service.updateStatus('order', { status: 'DELIVERED', phone: '123' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([null, '', '   '])('rejects null/blank VIN edits without partial customer or vehicle writes', async (vin) => {
    const { service, prisma } = harness();
    await expect(service.updateVoyage('order', { vin } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.vehicle.upsert).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it.each(['TIR_BAKU_CUSTOMS', 'CUSTOMS_CLEARANCE', 'READY_FOR_DELIVERY'])('persists Baku location at %s, not only in local browser state', async (status) => {
    const { service, prisma } = harness({ currentPort: 'Poti', currentCountry: 'Georgia' });
    await service.updateStatus('order', { status });
    expect(prisma.order.update.mock.calls[0][0].data).toMatchObject({ currentPort: 'Bakı gömrüyü', currentCountry: 'Azerbaijan' });
  });

  it('does not reset a manually reported road location to the destination port on truck departure', async () => {
    const { service, prisma } = harness({ destinationPort: 'Poti', currentPort: 'Tbilisi' });
    await service.updateStatus('order', { status: 'TIR_DEPARTED' });
    expect(prisma.order.update.mock.calls[0][0].data).not.toHaveProperty('currentPort');
  });

  it('clears stale Poti coordinates when advancing to Baku delivery readiness', async () => {
    const { service, prisma } = harness({ currentPort: 'Poti', currentCountry: 'Georgia', mapLat: 42.15, mapLng: 41.67 });
    await service.updateStatus('order', { status: 'READY_FOR_DELIVERY' });
    expect(prisma.order.update.mock.calls[0][0].data).toMatchObject({ currentPort: 'Bakı gömrüyü', currentCountry: 'Azerbaijan', mapLat: null, mapLng: null });
  });

  it('retains an explicit pin when the stage stays at the same reported place', async () => {
    const { service, prisma } = harness({ currentPort: 'Bakı gömrüyü', currentCountry: 'Azerbaijan', mapLat: 40.4, mapLng: 49.8 });
    await service.updateStatus('order', { status: 'READY_FOR_DELIVERY' });
    expect(prisma.order.update.mock.calls[0][0].data).not.toHaveProperty('mapLat');
    expect(prisma.order.update.mock.calls[0][0].data).not.toHaveProperty('mapLng');
  });
});

describe('Delivered service review', () => {
  it('returns a review token only after delivery and lazily covers legacy deliveries', async () => {
    const { service, prisma } = harness({ currentStatus: 'DELIVERED', deliveredAt: new Date() });
    const result = await service.findByCode('TRACK-123');
    expect(result).toHaveProperty('reviewToken', expect.stringMatching(/^[a-f0-9]{48}$/));
    expect(prisma.order.updateMany).toHaveBeenCalledWith({ where: { id: 'order', reviewToken: null, currentStatus: 'DELIVERED' }, data: { reviewToken: expect.any(String) } });
  });

  it('stores one private review with a flat response and no testimonial publication', async () => {
    const { service, prisma } = harness({ currentStatus: 'DELIVERED', deliveredAt: new Date(), reviewToken: token });
    const result = await service.createReview('TRACK-123', { reviewToken: token, rating: 5, comment: '  Çox yaxşı xidmət  ' });
    expect(result).toEqual({ rating: 5, comment: 'Çox yaxşı xidmət', createdAt: '2026-11-08T10:00:00.000Z' });
    expect(prisma.orderReview.create).toHaveBeenCalledWith({ data: { orderId: 'order', rating: 5, comment: 'Çox yaxşı xidmət' } });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('rejects reviews before delivery', async () => {
    const { service, prisma } = harness({ reviewToken: token });
    await expect(service.createReview('TRACK-123', { reviewToken: token, rating: 5 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.orderReview.create).not.toHaveBeenCalled();
  });

  it.each(['b'.repeat(48), 'a', '', '💥'.repeat(48)])('rejects missing or incorrect tokens', async (reviewToken) => {
    const { service, prisma } = harness({ currentStatus: 'DELIVERED', reviewToken: token });
    await expect(service.createReview('TRACK-123', { reviewToken, rating: 5 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.orderReview.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate reviews', async () => {
    const { service } = harness({ currentStatus: 'DELIVERED', reviewToken: token, review: { rating: 5, comment: null, createdAt: new Date() } });
    await expect(service.createReview('TRACK-123', { reviewToken: token, rating: 4 })).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: 5, comment: 'x'.repeat(2001) }])('validates review limits %j', async (values) => {
    const dto = plainToInstance(CreateOrderReviewDto, { reviewToken: token, ...values });
    expect((await validate(dto)).length).toBeGreaterThan(0);
    const { service } = harness({ currentStatus: 'DELIVERED', reviewToken: token });
    await expect(service.createReview('TRACK-123', dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
