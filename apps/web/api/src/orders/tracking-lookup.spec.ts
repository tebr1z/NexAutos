import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

const VIN = '1HGCM82633A004352';
const LOT = '12345678';
const PRIVATE_CODE = 'CUSTOMER-KEY';

function makeOrder(extra: Record<string, unknown> = {}) {
  return {
    id: 'private-order-id', trackingCode: PRIVATE_CODE, vin: VIN, auctionHouse: 'COPART',
    customerId: 'private-customer-id', customer: { name: 'PRIVATE CUSTOMER', phone: '994501234567' },
    vehicle: { make: 'Honda', model: 'Accord', year: 2020, lotNumber: LOT },
    currentStatus: 'SHIP_DEPARTED', deliveredAt: null,
    containerNumber: 'MSCU1234567', carrierCode: 'MSC', carrierName: 'MSC',
    carrierTrackingUrl: 'https://carrier.example/container/MSCU1234567',
    vesselName: 'Example vessel', voyageNumber: 'EX01', originCountry: 'USA',
    containerStatus: 'Sailing', originPort: 'Savannah', destinationPort: 'Poti',
    currentCountry: 'Turkey', currentPort: 'Istanbul', mapLat: 41.01, mapLng: 28.97,
    transitPorts: { stops: [{ place: 'Istanbul', occurredAt: '2026-11-10T08:00:00Z' }], currentIndex: 0 },
    eta: new Date('2026-11-20T08:00:00Z'), containerOpeningDate: '2026-11-22',
    reviewToken: 'a'.repeat(48), review: { rating: 5, comment: 'PRIVATE REVIEW', createdAt: new Date() },
    adminNotes: 'PRIVATE ADMIN NOTES', notes: 'PRIVATE ORDER NOTES', commissionUsd: 105,
    freightPaymentStatus: 'PARTIAL', documentMethod: 'SIGNIFY', documentStatus: 'PENDING', purchasePaymentPercent: 30,
    insuranceFirstName: 'PRIVATE INSURED', insuranceLastName: 'PRIVATE SURNAME', insuranceDocSeries: 'SECRET123',
    insuranceStatus: 'PROCESSING', insuranceReceiptToken: 'PRIVATE_RECEIPT', insuranceAmountAzn: '12345',
    contracts: [{ status: 'DRAFT', kind: 'SERVICE', token: 'PRIVATE_SIGNING_TOKEN' }],
    invoices: [{ number: 'PRIVATE_INVOICE', amountUsd: 12345, status: 'PAID' }],
    documents: [{ title: 'PRIVATE DOCUMENT', type: 'TITLE', url: 'https://private.example/document' }],
    photos: [
      { id: 'photo-1', url: 'r2:shipment/photo-1', category: 'terminal', caption: 'PRIVATE PHOTO CAPTION' },
      { id: 'photo-2', url: 'https://images.example/vehicle.jpg', category: 'auction', caption: 'PRIVATE PHOTO CAPTION' },
    ],
    events: [{ status: 'SHIP_DEPARTED', title: 'PRIVATE EVENT TITLE', description: 'PRIVATE EVENT NOTE',
      country: 'PRIVATE COUNTRY NOTE', port: 'PRIVATE PORT NOTE', occurredAt: new Date('2026-11-11T08:00:00Z') }],
    ...extra,
  };
}

function harness(options: {
  publicOrders?: ReturnType<typeof makeOrder>[];
  privateOrder?: ReturnType<typeof makeOrder> | null;
  legacyOrders?: { id: string; trackingCode: string }[];
  contracts?: Record<string, unknown>[];
} = {}) {
  const prisma = {
    order: {
      findUnique: jest.fn(async ({ where }) => {
        if (options.privateOrder && (where.trackingCode === options.privateOrder.trackingCode || where.id === options.privateOrder.id)) {
          return options.privateOrder;
        }
        return null;
      }),
      findMany: jest.fn(async ({ select }) => select.vin
        ? options.publicOrders ?? [] : options.legacyOrders ?? []),
      deleteMany: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
    },
    contract: { findMany: jest.fn().mockResolvedValue(options.contracts ?? []), findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(),
  };
  const service = new OrdersService(prisma as never, {} as never, {} as never, {} as never, {} as never);
  return { service, prisma };
}

function publicQueries(prisma: ReturnType<typeof harness>['prisma']) {
  return prisma.order.findMany.mock.calls.map(([query]) => query).filter((query) => query.select.vin);
}

describe('Public tracking by exact VIN and auction lot', () => {
  it('finds an exact full VIN after normalizing input case and whitespace', async () => {
    const { service, prisma } = harness({ publicOrders: [makeOrder()] });
    const result = await service.findByCode(' 1hgc m82633a004352 ');
    expect(result).toMatchObject({ lookupType: 'vin', trackingCode: VIN, vin: VIN, make: 'Honda', lotNumber: LOT });
    expect(publicQueries(prisma)[0]).toMatchObject({
      where: { AND: [{ OR: [{ vin: VIN }, { vehicle: { lotNumber: { equals: VIN, mode: 'insensitive' } } }] }, expect.any(Object)] },
      take: 2,
    });
  });

  it.each([LOT, ' 1234 5678 '])('finds a normalized exact numeric lot %s', async (input) => {
    const { service, prisma } = harness({ publicOrders: [makeOrder()] });
    expect(await service.findByCode(input)).toMatchObject({ lookupType: 'lot', trackingCode: LOT, vin: VIN });
    expect(publicQueries(prisma)[0].where.AND[0]).toEqual({
      OR: [{ vehicle: { lotNumber: { equals: LOT, mode: 'insensitive' } } }],
    });
  });

  it('supports exact alphanumeric and hyphenated auction lots', async () => {
    const { service, prisma } = harness({ publicOrders: [makeOrder({ vehicle: { make: 'Honda', model: 'Accord', year: 2020, lotNumber: 'AB-123456' } })] });
    expect(await service.findByCode(' ab-123456 ')).toMatchObject({ lookupType: 'lot', trackingCode: 'AB-123456' });
    expect(publicQueries(prisma)[0].where.AND[0]).toEqual({
      OR: [{ vehicle: { lotNumber: { equals: 'AB-123456', mode: 'insensitive' } } }],
    });
  });

  it('queries shipments only and never scans vehicle galleries or uses partial matches', async () => {
    const { service, prisma } = harness({ publicOrders: [makeOrder()] });
    await service.findByCode(LOT);
    const query = publicQueries(prisma)[0];
    expect(query).not.toHaveProperty('include');
    expect(JSON.stringify(query)).not.toMatch(/contains|startsWith|endsWith/);
    expect(query.select.trackingCode).toBe(true); // Internal URL screening only, never a response field.
    for (const field of ['customer', 'customerId', 'documents', 'invoices', 'contracts', 'review', 'reviewToken', 'adminNotes', 'insuranceReceiptToken']) {
      expect(query.select).not.toHaveProperty(field);
    }
    expect(query.select.events.select).toEqual({ status: true, occurredAt: true });
    expect(query.select.photos.select).not.toHaveProperty('caption');
  });

  it('exposes shipment progress, map and photos without personal or privileged fields', async () => {
    const { service } = harness({ publicOrders: [makeOrder()] });
    const result = await service.findByCode(VIN);
    expect(result).toMatchObject({
      customerName: '', currentStatus: 'SHIP_DEPARTED', containerNumber: 'MSCU1234567',
      currentCountry: 'Turkey', currentPort: 'Istanbul', lat: 41.01, lng: 28.97,
      eta: '2026-11-20T08:00:00.000Z', containerOpeningDate: '2026-11-22',
      transitPorts: [{ place: 'Istanbul', occurredAt: '2026-11-10T08:00:00Z' }], currentTransitIndex: 0,
      photos: [{ id: 'photo-1', url: '/api/v1/media/photos/photo-1', category: 'terminal' },
        { id: 'photo-2', url: 'https://images.example/vehicle.jpg', category: 'auction' }],
      documents: [],
      events: [{ status: 'SHIP_DEPARTED', title: expect.any(String), occurredAt: '2026-11-11T08:00:00.000Z' }],
    });
    for (const field of ['id', 'customerId', 'customerPhone', 'adminNotes', 'notes', 'review', 'reviewToken',
      'insurance', 'hasInsurance', 'insuranceReceiptToken', 'invoice', 'contract', 'commissionUsd',
      'freightPaymentStatus', 'purchasePaymentPercent', 'documentMethod', 'documentStatus']) {
      expect(result).not.toHaveProperty(field);
    }
    expect(JSON.stringify(result)).not.toContain(PRIVATE_CODE);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(result.events[0]).not.toHaveProperty('description');
    expect(result.events[0]).not.toHaveProperty('country');
    expect(result.events[0]).not.toHaveProperty('port');
    expect(result.photos[0]).not.toHaveProperty('caption');
  });

  it.each([
    'https://nex.autos/track/CUSTOMER-KEY',
    'https://www.nex.autos/track/ANOTHER-CODE',
    'https://api.nex.autos/api/v1/tracking/ANOTHER-CODE',
    'https://carrier.example/track/customer-key',
    'https://carrier.example/track/CuStOmErKeY',
    'https://carrier.example/track/C-U-S-T-O-M-E-R-K-E-Y',
    'https://carrier.example/track/%43%55%53%54%4f%4d%45%52%2d%4b%45%59',
    'https://carrier.example/track/%2543%2555%2553%2554%254f%254d%2545%2552%252d%254b%2545%2559',
    'https://carrier.example/track/%ZZ/%43%55%53%54%4f%4d%45%52%2d%4b%45%59',
    'http://carrier.example/track/container',
    'javascript:alert(1)',
    'https://user:password@carrier.example/track/container',
    'https://localhost/track/container',
    'https://services.internal/track/container',
    'https://127.0.0.1/track/container',
    'https://10.0.0.1/track/container',
    'https://[::1]/track/container',
  ])('does not expose a private or unsafe carrier link %s', async (carrierTrackingUrl) => {
    const { service } = harness({ publicOrders: [makeOrder({ carrierTrackingUrl })] });
    expect((await service.findByCode(VIN)).carrierTrackingUrl).toBeUndefined();
  });

  it('keeps legitimate HTTPS carrier tracking links', async () => {
    const url = 'https://www.msc.com/en/track-a-shipment?containerNumber=MSCU1234567';
    const { service } = harness({ publicOrders: [makeOrder({ carrierTrackingUrl: url })] });
    expect((await service.findByCode(VIN)).carrierTrackingUrl).toBe(url);
  });

  it('drops photo rows with private-code URLs instead of returning broken or secret-bearing links', async () => {
    const { service } = harness({ publicOrders: [makeOrder({ photos: [
      { id: 'private-raw', url: 'https://images.example/customer-key/photo.jpg' },
      { id: 'private-encoded', url: 'https://images.example/%43%55%53%54%4f%4d%45%52%4b%45%59/photo.jpg' },
      { id: 'private-separated', url: 'https://images.example/C-U-S-T-O-M-E-R-K-E-Y.jpg' },
      { id: 'private-same-site', url: 'https://nex.autos/contract/another-secret' },
      { id: 'unsafe', url: 'javascript:alert(1)' },
      { id: 'stored', url: 'r2:private/customer-key.jpg', category: 'terminal' },
      { id: 'relative', url: '/api/v1/media/photos/relative', category: 'terminal' },
      { id: 'same-site-media', url: 'https://nex.autos/api/v1/media/photos/same-site-media', category: 'terminal' },
      { id: 'external', url: 'https://images.example/public.jpg', category: 'auction' },
    ] })] });
    const result = await service.findByCode(VIN);
    expect(result.photos).toEqual([
      { id: 'stored', url: '/api/v1/media/photos/stored', category: 'terminal' },
      { id: 'relative', url: '/api/v1/media/photos/relative', category: 'terminal' },
      { id: 'same-site-media', url: 'https://nex.autos/api/v1/media/photos/same-site-media', category: 'terminal' },
      { id: 'external', url: 'https://images.example/public.jpg', category: 'auction' },
    ]);
    expect(JSON.stringify(result).toLowerCase()).not.toContain('customer-key');
  });

  it('screens canonical keys in logistics text without disturbing transit indices', async () => {
    const { service } = harness({ publicOrders: [makeOrder({
      carrierName: `Carrier ${PRIVATE_CODE}`, vesselName: 'customerkey vessel', currentPort: 'Customer_Key port',
      transitPorts: { stops: [{ place: `Port ${PRIVATE_CODE}` }, { place: 'Istanbul' }], currentIndex: 1 },
    })] });
    const result = await service.findByCode(VIN);
    expect(result.carrierName).toBeUndefined();
    expect(result.vesselName).toBeUndefined();
    expect(result.currentPort).toBeUndefined();
    expect(result.transitPorts).toEqual([{ place: '—', occurredAt: undefined }, { place: 'Istanbul', occurredAt: undefined }]);
    expect(result.currentTransitIndex).toBe(1);
  });

  it.each([VIN, LOT])('returns generic 409 for duplicate shipments matching %s', async (identifier) => {
    const { service } = harness({ publicOrders: [makeOrder(), makeOrder({ id: 'other-customer-order' })] });
    await expect(service.findByCode(identifier)).rejects.toBeInstanceOf(ConflictException);
    try { await service.findByCode(identifier); } catch (error) {
      const response = JSON.stringify((error as ConflictException).getResponse());
      expect(response).toContain('Şəxsi izləmə kodunu');
      expect(response).not.toContain('PRIVATE');
      expect(response).not.toContain('other-customer-order');
    }
  });

  it('rejects a VIN/lot cross-namespace collision rather than choosing the VIN first', async () => {
    const { service } = harness({ publicOrders: [makeOrder(), makeOrder({
      id: 'other-order', vin: '2HGCM82633A004352', vehicle: { make: 'Honda', model: 'Civic', year: 2020, lotNumber: VIN },
    })] });
    await expect(service.findByCode(VIN)).rejects.toBeInstanceOf(ConflictException);
  });

  it('classifies a VIN-shaped lot as lot when its shipment VIN differs', async () => {
    const { service } = harness({ publicOrders: [makeOrder({
      vin: '2HGCM82633A004352', vehicle: { make: 'Honda', model: 'Civic', year: 2020, lotNumber: VIN },
    })] });
    expect(await service.findByCode(VIN)).toMatchObject({ lookupType: 'lot', trackingCode: VIN, vin: '2HGCM82633A004352' });
  });

  it('keeps actual tracking-code precedence even when the code is also another order VIN', async () => {
    const { service, prisma } = harness({ privateOrder: makeOrder({ trackingCode: VIN, vin: '2HGCM82633A004352' }), publicOrders: [makeOrder()] });
    const result = await service.findByCode(VIN);
    expect(result).not.toHaveProperty('lookupType');
    expect(result).toMatchObject({ trackingCode: VIN, vin: '2HGCM82633A004352', customerName: 'PRIVATE CUSTOMER' });
    expect(publicQueries(prisma)).toEqual([]);
  });

  it('keeps compact legacy tracking-code matching ahead of lot lookup', async () => {
    const order = makeOrder();
    const { service, prisma } = harness({ privateOrder: order, legacyOrders: [{ id: order.id, trackingCode: PRIVATE_CODE }] });
    expect(await service.findByCode('CUSTOMERKEY')).toMatchObject({ trackingCode: PRIVATE_CODE, customerName: 'PRIVATE CUSTOMER' });
    expect(publicQueries(prisma)).toEqual([]);
  });

  it('keeps legacy standalone contract code behavior ahead of an identical lot', async () => {
    const { service, prisma } = harness({ contracts: [{ trackingCode: LOT, customerName: 'Existing code customer',
      vin: VIN, make: 'Honda', model: 'Accord', year: 2020, status: 'DRAFT', token: 'existing-contract-token' }], publicOrders: [makeOrder()] });
    const result = await service.findByCode(LOT);
    expect(result).not.toHaveProperty('lookupType');
    expect(result).toMatchObject({ trackingCode: LOT, customerName: 'Existing code customer' });
    expect(publicQueries(prisma)).toEqual([]);
  });

  it('returns 404 for an exact identifier with no shipment; it never returns a gallery vehicle', async () => {
    const { service } = harness();
    await expect(service.findByCode(VIN)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findByCode(LOT)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejects empty or excessive input before database calls', async (identifier) => {
    const { service, prisma } = harness();
    await expect(service.findByCode(identifier)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.order.findMany).not.toHaveBeenCalled();
    expect(prisma.contract.findMany).not.toHaveBeenCalled();
  });

  it.each(['123', '1234/5678', '12%345678', '12_345678', '1HGCM82633A00435💥', 'x'.repeat(51)])('does not query public identifiers for invalid input %s', async (identifier) => {
    const { service, prisma } = harness();
    await expect(service.findByCode(identifier)).rejects.toBeInstanceOf(NotFoundException);
    expect(publicQueries(prisma)).toEqual([]);
  });

  it.each(['I', 'O', 'Q'])('does not treat a 17-character string containing %s as a VIN', async (invalidChar) => {
    const identifier = `${invalidChar}${VIN.slice(1)}`;
    const { service, prisma } = harness();
    await expect(service.findByCode(identifier)).rejects.toBeInstanceOf(NotFoundException);
    expect(publicQueries(prisma)[0].where.AND[0]).toEqual({
      OR: [{ vehicle: { lotNumber: { equals: identifier, mode: 'insensitive' } } }],
    });
  });

  it('excludes delivered shipments older than the archive window without deleting them', async () => {
    const { service, prisma } = harness();
    const before = Date.now() - 30 * 86400000;
    await expect(service.findByCode(VIN)).rejects.toBeInstanceOf(NotFoundException);
    const archiveFilter = publicQueries(prisma)[0].where.AND[1];
    expect(archiveFilter).toEqual({ OR: [{ currentStatus: { not: 'DELIVERED' } }, { deliveredAt: null }, { deliveredAt: { gte: expect.any(Date) } }] });
    const cutoff = archiveFilter.OR[2].deliveredAt.gte.getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before);
    expect(cutoff).toBeLessThanOrEqual(Date.now() - 30 * 86400000);
    expect(prisma.order.deleteMany).not.toHaveBeenCalled();
  });

  it('still returns 404 for an archived private tracking code without falling through or deleting', async () => {
    const { service, prisma } = harness({ privateOrder: makeOrder({ currentStatus: 'DELIVERED', deliveredAt: new Date(Date.now() - 31 * 86400000) }) });
    await expect(service.findByCode(PRIVATE_CODE)).rejects.toBeInstanceOf(NotFoundException);
    expect(publicQueries(prisma)).toEqual([]);
    expect(prisma.order.deleteMany).not.toHaveBeenCalled();
  });

  it('does not create review tokens or mutate a delivered shipment found by VIN/lot', async () => {
    const { service, prisma } = harness({ publicOrders: [makeOrder({ currentStatus: 'DELIVERED', deliveredAt: new Date(), reviewToken: null })] });
    expect(await service.findByCode(VIN)).not.toHaveProperty('reviewToken');
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.order.deleteMany).not.toHaveBeenCalled();
  });

  it.each([VIN, LOT])('does not widen insurance or review routes to accept %s', async (identifier) => {
    const { service, prisma } = harness({ publicOrders: [makeOrder()] });
    await expect(service.findInsuranceByCode(identifier)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.createReview(identifier, { rating: 5, reviewToken: 'a'.repeat(48) })).rejects.toBeInstanceOf(NotFoundException);
    expect(publicQueries(prisma)).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
