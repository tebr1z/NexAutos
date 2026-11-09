import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TelegramActionsService } from './telegram-actions.service';
import { normalizeTelegramOrderChange, OrdersService } from '../orders/orders.service';

const version = '2026-11-09T10:00:00.000Z';
function makeOrder() {
  return {
    id: 'order1', trackingCode: 'TRACK-123', vin: '1HGCM82633A004352',
    customer: { name: 'Nümunə Müştəri', phone: '994501234567' },
    vehicle: { make: 'Honda', model: 'Accord', year: 2020 },
    containerNumber: null, carrierTrackingUrl: null, containerOpeningDate: null,
    currentStatus: 'PURCHASED', updatedAt: new Date(version),
    destinationPort: 'Poti', currentPort: 'Savannah', currentCountry: 'USA',
    mapLat: 32, mapLng: -81, deliveredAt: null, reviewToken: null,
  };
}

function harness() {
  const row = makeOrder();
  const account = { telegramUserId: '111', chatId: '111', user: { isActive: true, role: 'ADMIN' } };
  const config = { enabled: true };
  let action: any = null;
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
    telegramAccount: { findUnique: jest.fn(async () => account) },
    telegramBotConfig: { findUnique: jest.fn(async () => config) },
    telegramAction: {
      create: jest.fn(async ({ data }) => { action = { ...data, id: 'action1' }; return action; }),
      findFirst: jest.fn(async ({ where }) => action && ['id', 'userId', 'telegramUserId', 'chatId'].every((key) => action[key] === where[key]) ? action : null),
      updateMany: jest.fn(async ({ where, data }) => {
        const matches = action && ['id', 'userId', 'telegramUserId', 'chatId', 'state'].every((key) => action[key] === where[key]) && action.expiresAt > where.expiresAt.gt;
        if (!matches) return { count: 0 };
        Object.assign(action, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }) => { Object.assign(action, data); return action; }),
    },
    order: {
      findUnique: jest.fn(async () => row),
      findFirst: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([row]),
      update: jest.fn(async ({ data }) => { Object.assign(row, data); return row; }),
    },
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'customer1', name: row.customer.name, phone: row.customer.phone }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction.mockImplementation(async (fn) => {
    const before = action ? { ...action } : null;
    try { return await fn(prisma); }
    catch (err) { action = before; throw err; }
  });
  const orders = {
    applyTelegramChange: jest.fn(async (_tx, input) => {
      if (row.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new ConflictException('stale');
      return row;
    }),
    notifyTelegramStatus: jest.fn(async () => ({ sent: true, channel: 'whatsapp' })),
  };
  const service = new TelegramActionsService(prisma as never, orders as never);
  return { service, prisma, orders, account, config, row, action: () => action };
}

describe('Telegram confirmed order actions', () => {
  it('creates a bounded exact-car preview and stores the expected order version', async () => {
    const { service, prisma } = harness();
    const preview = await service.propose('admin', '111', '111', 'order1', 'container', ' mscu 1234567 ');
    expect(preview.text).toContain('Nümunə Müştəri');
    expect(preview.text).toContain('1HGCM82633A004352');
    expect(preview.text).toContain('MSCU1234567');
    expect(prisma.telegramAction.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'admin', telegramUserId: '111', chatId: '111', state: 'PENDING',
      payload: { orderId: 'order1', expectedUpdatedAt: version, value: 'MSCU1234567' }, expiresAt: expect.any(Date),
    }) });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('keeps untrusted identity labels on bounded preview lines without truncating carrier values', async () => {
    const h = harness();
    h.row.customer.name = `Müştəri\nYeni: saxta\u0000\u202e${'x'.repeat(180)}`;
    h.row.vehicle.make = 'Honda\r\nTəsdiqlənib';
    h.row.vehicle.model = `Accord\u2028VIN: saxta${'y'.repeat(90)}`;
    h.row.vin = 'VIN\nYeni: saxta';
    h.row.trackingCode = 'TRACK\u0085Müştəri: saxta';
    const before = `https://carrier.example/old?code=${'a'.repeat(1600)}`;
    const after = `https://carrier.example/new?code=${'b'.repeat(1600)}`;
    h.row.carrierTrackingUrl = before as never;
    const { text } = await h.service.propose('admin', '111', '111', 'order1', 'carrier', after);
    const lines = text.split('\n');
    expect(lines[1].startsWith('Müştəri: Müştəri Yeni: saxta')).toBe(true);
    expect([...lines[1]].length).toBeLessThanOrEqual('Müştəri: '.length + 120);
    expect([...lines[2]].length).toBeLessThanOrEqual('Maşın: '.length + 140);
    expect(lines[3]).toBe('VIN: VIN Yeni: saxta');
    expect(lines[4]).toBe('İzləmə kodu: TRACK Müştəri: saxta');
    expect(text).not.toMatch(/[\u0000\u0085\u2028\u202e]/);
    expect(text).toContain(`İndiki: ${before}`);
    expect(text).toContain(`Yeni: ${after}`);
    expect(h.action().payload.value).toBe(after);
  });

  it.each([
    ['inactive', (h) => { h.account.user.isActive = false; }],
    ['customer role', (h) => { h.account.user.role = 'CUSTOMER'; }],
    ['another Telegram user', (h) => { h.account.telegramUserId = '222'; }],
    ['another chat', (h) => { h.account.chatId = '-100222'; }],
    ['disabled bot', (h) => { h.config.enabled = false; }],
  ])('rechecks %s before proposing and confirming', async (_label, change: (h: ReturnType<typeof harness>) => void) => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'status', 'SHIP_DEPARTED');
    change(h);
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.service.propose('admin', '111', '111', 'order1', 'status', 'SHIP_DEPARTED')).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.orders.applyTelegramChange).not.toHaveBeenCalled();
    expect(h.orders.notifyTelegramStatus).not.toHaveBeenCalled();
  });

  it('does not accept another owner’s confirmation', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'status', 'SHIP_DEPARTED');
    await expect(h.service.confirm('action1', 'another-admin', '111', '111')).rejects.toBeInstanceOf(ConflictException);
    expect(h.orders.applyTelegramChange).not.toHaveBeenCalled();
  });

  it('claims an action and mutates in the same transaction, notifying only after commit', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'status', 'SHIP_DEPARTED');
    h.orders.notifyTelegramStatus.mockImplementation(async () => {
      expect(h.action().state).toBe('SUCCEEDED');
      return { sent: true, channel: 'whatsapp' };
    });
    const result = await h.service.confirm('action1', 'admin', '111', '111');
    expect(result.text).toContain('WhatsApp');
    expect(h.orders.applyTelegramChange).toHaveBeenCalledWith(h.prisma, {
      orderId: 'order1', expectedUpdatedAt: version, kind: 'status', value: 'SHIP_DEPARTED', userId: 'admin',
    });
    expect(h.action().state).toBe('SUCCEEDED');
  });

  it('replayed confirmation never changes an order or notifies twice', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'status', 'SHIP_DEPARTED');
    await h.service.confirm('action1', 'admin', '111', '111');
    const replay = await h.service.confirm('action1', 'admin', '111', '111');
    expect(replay.text).toContain('artıq icra edilib');
    expect(h.orders.applyTelegramChange).toHaveBeenCalledTimes(1);
    expect(h.orders.notifyTelegramStatus).toHaveBeenCalledTimes(1);
  });

  it('expired actions cannot mutate or send notifications', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'status', 'SHIP_DEPARTED');
    h.action().expiresAt = new Date(Date.now() - 1);
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toBeInstanceOf(ConflictException);
    expect(h.orders.applyTelegramChange).not.toHaveBeenCalled();
    expect(h.orders.notifyTelegramStatus).not.toHaveBeenCalled();
  });

  it('stale previews roll back the claim and never notify', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'status', 'SHIP_DEPARTED');
    h.row.updatedAt = new Date('2026-11-09T10:01:00.000Z');
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toBeInstanceOf(ConflictException);
    expect(h.action().state).toBe('PENDING');
    expect(h.orders.notifyTelegramStatus).not.toHaveBeenCalled();
  });

  it('metadata changes never send status notifications', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'openingDate', '2026-11-20');
    expect((await h.service.confirm('action1', 'admin', '111', '111')).text).toContain('göndərilmir');
    expect(h.orders.notifyTelegramStatus).not.toHaveBeenCalled();
  });

  it.each([
    [{ sent: false, error: 'no_phone' }, 'telefon'],
    [{ sent: false, error: 'not_configured' }, 'sazlanmayıb'],
    [{ sent: false, error: 'skipped' }, 'nəzərdə tutulmayıb'],
    [{ sent: false, error: 'provider_failure' }, 'göndərilmədi'],
  ])('reports notification outcome %j without falsely claiming delivery', async (outcome, phrase) => {
    const h = harness();
    h.orders.notifyTelegramStatus.mockResolvedValue(outcome as never);
    await h.service.propose('admin', '111', '111', 'order1', 'status', 'SHIP_DEPARTED');
    const result = await h.service.confirm('action1', 'admin', '111', '111');
    expect(result.text).toContain(phrase);
    expect(result.text).not.toContain('bildiriş göndərildi');
  });

  it('shows a saved change even if the postcommit notification provider throws', async () => {
    const h = harness();
    h.orders.notifyTelegramStatus.mockRejectedValue(new Error('provider secret') as never);
    await h.service.propose('admin', '111', '111', 'order1', 'status', 'SHIP_DEPARTED');
    const result = await h.service.confirm('action1', 'admin', '111', '111');
    expect(result.text).toContain('saxlanıldı');
    expect(result.text).not.toContain('provider secret');
    expect(h.action().state).toBe('SUCCEEDED');
  });

  it('lists active cars with a bounded page and no archive-deleting reads', async () => {
    const h = harness();
    h.prisma.order.findMany.mockResolvedValue(Array.from({ length: 9 }, (_, i) => ({ ...h.row, id: `car${i}` })));
    const result = await h.service.search('', 'all', 2);
    expect(result.items).toHaveLength(8);
    expect(result.hasMore).toBe(true);
    expect(h.prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 9, skip: 16, where: { currentStatus: { notIn: ['DELIVERED', 'CANCELLED'] } },
    }));
  });

  it('allows explicit customer search to find archived cars and never searches other customer fields', async () => {
    const h = harness();
    await h.service.search('Nümunə', 'customer');
    const args = h.prisma.order.findMany.mock.calls[0][0];
    expect(args.where).not.toHaveProperty('currentStatus');
    expect(JSON.stringify(args.where)).toContain('insensitive');
    expect(JSON.stringify(args.where)).not.toContain('vin');
  });

  it('searches formatted local phones without changing raw lot/VIN searches', async () => {
    const h = harness();
    await h.service.search('050 123 45 67', 'customer');
    expect(JSON.stringify(h.prisma.order.findMany.mock.calls[0][0].where)).toContain('994501234567');
    await h.service.search('00123456789123456', 'all');
    expect(JSON.stringify(h.prisma.order.findMany.mock.calls[1][0].where)).toContain('00123456789123456');
  });
});

describe('Telegram active customer reads', () => {
  const active = { currentStatus: { notIn: ['DELIVERED', 'CANCELLED'] } };

  it('paginates unique customers with a filtered active-car count and no full order fetch', async () => {
    const h = harness();
    h.prisma.customer.findMany.mockResolvedValue(Array.from({ length: 9 }, (_, i) => ({
      id: `customer${i}`, name: `Müştəri ${i}`, phone: i ? '994501234567' : '', _count: { orders: i + 1 },
    })));
    const result = await h.service.activeCustomers('', 2);
    expect(result.items).toHaveLength(8);
    expect(result.hasMore).toBe(true);
    expect(result.items[0]).toEqual({ id: 'customer0', name: 'Müştəri 0', phone: null, activeCarCount: 1 });
    expect(result.items[7].activeCarCount).toBe(8);
    expect(h.prisma.customer.findMany).toHaveBeenCalledWith({
      where: { orders: { some: active } },
      select: { id: true, name: true, phone: true, _count: { select: { orders: { where: active } } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: 16, take: 9,
    });
    expect(h.prisma.order.findMany).not.toHaveBeenCalled();
    expect(h.orders.applyTelegramChange).not.toHaveBeenCalled();
  });

  it('includes an unregistered customer once, counts only active cars, and excludes terminal-only history', async () => {
    const h = harness();
    const customers = [
      { id: 'mixed', name: 'Eyni Ad', phone: '', userId: null, orders: ['PURCHASED', 'SHIP_DEPARTED', 'DELIVERED', 'CANCELLED'] },
      { id: 'history', name: 'Köhnə müştəri', phone: '', userId: null, orders: ['DELIVERED', 'CANCELLED'] },
      { id: 'other', name: 'Eyni Ad', phone: '994501234567', userId: 'registered', orders: ['EXPORT_DOCUMENTS'] },
    ];
    h.prisma.customer.findMany.mockImplementation(async ({ where, select }) => {
      const excluded = where.orders.some.currentStatus.notIn;
      const countExcluded = select._count.select.orders.where.currentStatus.notIn;
      return customers.filter((customer) => customer.orders.some((status) => !excluded.includes(status)))
        .map((customer) => ({ ...customer, _count: { orders: customer.orders.filter((status) => !countExcluded.includes(status)).length } }));
    });
    const result = await h.service.activeCustomers();
    expect(result).toEqual({
      items: [
        { id: 'mixed', name: 'Eyni Ad', phone: null, activeCarCount: 2 },
        { id: 'other', name: 'Eyni Ad', phone: '994501234567', activeCarCount: 1 },
      ],
      hasMore: false,
    });
    expect(JSON.stringify(h.prisma.customer.findMany.mock.calls[0][0].where)).not.toMatch(/userId|isActive/);
  });

  it('keeps the active filter outside all customer-name search alternatives', async () => {
    const h = harness();
    await h.service.activeCustomers('  Ali Hasan  ');
    expect(h.prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        orders: { some: active },
        AND: [{ AND: [
          { OR: [{ name: { contains: 'Ali', mode: 'insensitive' } }, { phone: { contains: 'Ali', mode: 'insensitive' } }] },
          { OR: [{ name: { contains: 'Hasan', mode: 'insensitive' } }, { phone: { contains: 'Hasan', mode: 'insensitive' } }] },
        ] }],
      },
    }));
    expect(JSON.stringify(h.prisma.customer.findMany.mock.calls[0][0].where)).not.toMatch(/vin|trackingCode|vehicle/);
  });

  it.each(['050 123 45 67', '50 123 45 67', '+994 (50) 123-45-67', '00994 50 123 45 67'])('normalizes formatted customer phones: %s', async (query) => {
    const h = harness();
    await h.service.activeCustomers(query);
    const where = h.prisma.customer.findMany.mock.calls[0][0].where;
    expect(where.orders).toEqual({ some: active });
    expect(where.AND).toEqual([expect.objectContaining({
      OR: expect.arrayContaining([{ phone: { contains: '994501234567', mode: 'insensitive' } }]),
    })]);
  });

  it('keeps punctuation-only input from becoming a broad phone alternative', async () => {
    const h = harness();
    await h.service.activeCustomers('---');
    const where = h.prisma.customer.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([{ AND: [{ OR: [
      { name: { contains: '---', mode: 'insensitive' } }, { phone: { contains: '---', mode: 'insensitive' } },
    ] }] }]);
  });

  it.each([-1, 1001, 0.5, NaN, Infinity, null, '1'])('rejects invalid page %p before any database read', async (page) => {
    const h = harness();
    await expect(h.service.activeCustomers('', page as number)).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.service.activeCustomerCars('customer1', page as number)).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.customer.findMany).not.toHaveBeenCalled();
    expect(h.prisma.customer.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.order.findMany).not.toHaveBeenCalled();
  });

  it.each(['x'.repeat(101), null, {}, 12])('rejects invalid or overlong query %p', async (query) => {
    const h = harness();
    await expect(h.service.activeCustomers(query as string)).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('accepts the final bounded page and exact 100-character search', async () => {
    const h = harness();
    await h.service.activeCustomers('x'.repeat(100), 1000);
    await h.service.activeCustomerCars('customer1', 1000);
    expect(h.prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 8000, take: 9 }));
    expect(h.prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 8000, take: 9 }));
  });

  it('selects cars by exact customer ID with the same active filter and bounded lookahead', async () => {
    const h = harness();
    h.prisma.order.findMany.mockResolvedValue(Array.from({ length: 9 }, (_, i) => ({ ...h.row, id: `car${i}` })));
    const result = await h.service.activeCustomerCars('customer1', 1);
    expect(result.customer).toEqual({ id: 'customer1', name: 'Nümunə Müştəri', phone: '994501234567' });
    expect(result.items).toHaveLength(8);
    expect(result.hasMore).toBe(true);
    expect(result.items[0]).toEqual(expect.objectContaining({ id: 'car0', status: 'PURCHASED', updatedAt: version }));
    expect(h.prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { id: 'customer1' }, select: { id: true, name: true, phone: true },
    });
    expect(h.prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'customer1', ...active }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: 8, take: 9,
      select: expect.objectContaining({ customer: { select: { name: true, phone: true } }, vehicle: { select: { make: true, model: true, year: true } } }),
    }));
    expect(h.prisma.order.update).not.toHaveBeenCalled();
    expect(h.orders.applyTelegramChange).not.toHaveBeenCalled();
  });

  it('never maps terminal cars in mixed customer history', async () => {
    const h = harness();
    h.prisma.order.findMany.mockImplementation(async ({ where }) => ['PURCHASED', 'DELIVERED', 'CANCELLED', 'EXPORT_DOCUMENTS']
      .filter((status) => !where.currentStatus.notIn.includes(status))
      .map((currentStatus, i) => ({ ...h.row, id: `car${i}`, currentStatus })));
    const result = await h.service.activeCustomerCars('customer1');
    expect(result.items.map((item) => item.status)).toEqual(['PURCHASED', 'EXPORT_DOCUMENTS']);
  });

  it('keeps an existing customer identity when its last active car has become terminal', async () => {
    const h = harness();
    h.prisma.customer.findUnique.mockResolvedValue({ id: 'customer1', name: 'Müştəri', phone: '' });
    h.prisma.order.findMany.mockResolvedValue([]);
    expect(await h.service.activeCustomerCars('customer1')).toEqual({
      customer: { id: 'customer1', name: 'Müştəri', phone: null }, items: [], hasMore: false,
    });
  });

  it.each([null, 123, '', '   ', ' customer1 ', 'x'.repeat(129)])('does not query invalid customer ID %p', async (id) => {
    const h = harness();
    expect(await h.service.activeCustomerCars(id as string)).toEqual({ customer: null, items: [], hasMore: false });
    expect(h.prisma.customer.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.order.findMany).not.toHaveBeenCalled();
  });

  it('returns a missing customer without searching any car or changing data', async () => {
    const h = harness();
    h.prisma.customer.findUnique.mockResolvedValue(null);
    expect(await h.service.activeCustomerCars('missing-customer')).toEqual({ customer: null, items: [], hasMore: false });
    expect(h.prisma.order.findMany).not.toHaveBeenCalled();
    expect(h.prisma.order.update).not.toHaveBeenCalled();
  });

  it('looks up the selected active car by exact customer and order in a single read', async () => {
    const h = harness();
    expect(await h.service.activeCustomerCar('customer1', 'order1')).toEqual(expect.objectContaining({
      id: 'order1', status: 'PURCHASED', customerName: 'Nümunə Müştəri', updatedAt: version,
    }));
    expect(h.prisma.order.findFirst).toHaveBeenCalledTimes(1);
    expect(h.prisma.order.findFirst).toHaveBeenCalledWith({
      where: { id: 'order1', customerId: 'customer1', ...active },
      select: expect.objectContaining({ id: true, currentStatus: true, customer: { select: { name: true, phone: true } } }),
    });
    expect(h.prisma.order.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.customer.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.order.update).not.toHaveBeenCalled();
  });

  it('returns null if the selected car was reassigned, delivered, cancelled or deleted', async () => {
    const h = harness();
    h.prisma.order.findFirst.mockResolvedValue(null);
    expect(await h.service.activeCustomerCar('customer1', 'order1')).toBeNull();
    expect(h.prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order1', customerId: 'customer1', ...active },
    }));
  });

  it('maps nullable vehicle and logistics fields on a selected active car', async () => {
    const h = harness();
    h.prisma.order.findFirst.mockResolvedValue({ ...h.row, vehicle: null, customer: { name: 'Müştəri', phone: '' } });
    expect(await h.service.activeCustomerCar('customer1', 'order1')).toEqual(expect.objectContaining({
      make: null, model: null, year: null, customerPhone: null,
      containerNumber: null, containerOpeningDate: null, carrierTrackingUrl: null,
    }));
  });

  it('rejects invalid customer or order identities before querying the selected car', async () => {
    const h = harness();
    for (const invalid of [null, undefined, 123, '', '   ', ' identity ', 'x'.repeat(129)]) {
      expect(await h.service.activeCustomerCar(invalid as string, 'order1')).toBeNull();
      expect(await h.service.activeCustomerCar('customer1', invalid as string)).toBeNull();
    }
    expect(h.prisma.order.findFirst).not.toHaveBeenCalled();
    expect(h.prisma.order.findUnique).not.toHaveBeenCalled();
  });
});

describe('Telegram order input validation and transactional writes', () => {
  it.each([
    ['carrier', 'javascript:alert(1)'], ['carrier', 'http://example.com'], ['carrier', 'https://user:pass@example.com'],
    ['openingDate', '2026-02-30'], ['openingDate', 'tomorrow'], ['openingDate', '-'],
    ['container', 'BAD'], ['status', 'INVALID'], ['status', ''],
  ])('rejects invalid %s: %s', (kind, value) => {
    expect(() => normalizeTelegramOrderChange(kind as never, value)).toThrow(BadRequestException);
  });

  it('normalizes HTTPS and container input', () => {
    expect(normalizeTelegramOrderChange('container', 'mscu 1234567')).toBe('MSCU1234567');
    expect(normalizeTelegramOrderChange('carrier', 'https://EXAMPLE.com')).toBe('https://example.com/');
  });

  it('writes the stage, map correction, event and audit within the provided transaction', async () => {
    const h = harness();
    const realOrders = new OrdersService({} as never, {} as never, {} as never, {} as never, {} as never);
    await realOrders.applyTelegramChange(h.prisma as never, {
      orderId: 'order1', kind: 'status', value: 'TIR_BAKU_CUSTOMS', expectedUpdatedAt: version, userId: 'admin',
    });
    expect(h.prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      currentStatus: 'TIR_BAKU_CUSTOMS', currentPort: 'Bakı gömrüyü', currentCountry: 'Azerbaijan', mapLat: null, mapLng: null,
      events: { create: expect.objectContaining({ status: 'TIR_BAKU_CUSTOMS' }) },
    }) }));
    expect(h.prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'admin', action: 'STATUS_UPDATE', meta: expect.objectContaining({ source: 'telegram', field: 'currentStatus' }),
    }) });
  });

  it('preserves delivery semantics with an unpredictable review capability', async () => {
    const h = harness();
    const realOrders = new OrdersService({} as never, {} as never, {} as never, {} as never, {} as never);
    await realOrders.applyTelegramChange(h.prisma as never, {
      orderId: 'order1', kind: 'status', value: 'DELIVERED', expectedUpdatedAt: version, userId: 'admin',
    });
    expect(h.prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      deliveredAt: expect.any(Date), reviewToken: expect.stringMatching(/^[a-f0-9]{48}$/),
    }) }));
  });

  it('rejects a changed version before creating an event or audit entry', async () => {
    const h = harness();
    const realOrders = new OrdersService({} as never, {} as never, {} as never, {} as never, {} as never);
    await expect(realOrders.applyTelegramChange(h.prisma as never, {
      orderId: 'order1', kind: 'status', value: 'DELIVERED', expectedUpdatedAt: '2026-11-09T09:00:00.000Z', userId: 'admin',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(h.prisma.order.update).not.toHaveBeenCalled();
    expect(h.prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
