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
      findMany: jest.fn().mockResolvedValue([row]),
      update: jest.fn(async ({ data }) => { Object.assign(row, data); return row; }),
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
