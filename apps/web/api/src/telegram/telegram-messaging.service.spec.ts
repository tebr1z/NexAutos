import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TelegramMessagingService } from './telegram-messaging.service';

const version = '2026-11-09T10:00:00.000Z';
function harness() {
  const row = {
    id: 'order1', customerId: 'customer1', trackingCode: 'TRACK-123', vin: '1HGCM82633A004352', updatedAt: new Date(version),
    customer: { id: 'customer1', name: 'Nümunə Müştəri', phone: '050 123 45 67', updatedAt: new Date(version) },
    vehicle: { make: 'Honda', model: 'Accord', year: 2020 },
  };
  const account = { telegramUserId: '111', chatId: '111', user: { isActive: true, role: 'ADMIN' } };
  const config = { enabled: true };
  let actions = new Map<string, any>();
  let inTransaction = false;
  let tail = Promise.resolve();
  const matches = (item: any, where: any) => item && Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'expiresAt') return item.expiresAt > value.gt;
    if (key === 'updatedAt') return item.updatedAt >= value.gte;
    if (key === 'payload') return item.payload[value.path[0]] === value.equals;
    if (key === 'state' && typeof value === 'object') return value.in.includes(item.state);
    return item[key] === value;
  });
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([]), $transaction: jest.fn(),
    telegramAccount: { findUnique: jest.fn(async () => account) },
    telegramBotConfig: { findUnique: jest.fn(async () => config) },
    telegramAction: {
      create: jest.fn(async ({ data }) => {
        const item = { ...data, id: `action${actions.size + 1}`, createdAt: new Date(), updatedAt: new Date() };
        actions.set(item.id, item); return item;
      }),
      findFirst: jest.fn(async ({ where }) => [...actions.values()].find((item) => matches(item, where)) ?? null),
      count: jest.fn(async ({ where }) => [...actions.values()].filter((item) => matches(item, where)).length),
      updateMany: jest.fn(async ({ where, data }) => {
        const found = [...actions.values()].filter((item) => matches(item, where));
        for (const item of found) Object.assign(item, data, { updatedAt: new Date() });
        return { count: found.length };
      }),
      update: jest.fn(async ({ where, data }) => { const item = actions.get(where.id); Object.assign(item, data, { updatedAt: new Date() }); return item; }),
    },
    order: { findUnique: jest.fn(async () => row), update: jest.fn(), findMany: jest.fn() },
    customer: { update: jest.fn() }, auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction.mockImplementation(async (fn) => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const before = new Map([...actions].map(([key, item]) => [key, structuredClone(item)]));
    inTransaction = true;
    try { return await fn(prisma); }
    catch (error) { actions = before; throw error; }
    finally { inTransaction = false; release(); }
  });
  const notify = {
    customerWhatsAppReady: jest.fn(() => true),
    customerWhatsAppTextLimit: jest.fn(() => 2000),
    sendCustomerWhatsApp: jest.fn(async (_phone: string, _text: string) => {
      return { sent: true, channel: 'whatsapp', outcome: 'accepted' };
    }),
  };
  const service = new TelegramMessagingService(prisma as never, notify as never);
  return { service, prisma, notify, row, account, config, inTransaction: () => inTransaction, action: (id = 'action1') => actions.get(id), seed: (item: any) => actions.set(item.id, item) };
}

describe('Telegram customer WhatsApp messages', () => {
  it('delegates availability without making a delivery request', () => {
    const h = harness();
    expect(h.service.ready()).toBe(true);
    h.notify.customerWhatsAppReady.mockReturnValue(false);
    expect(h.service.ready()).toBe(false);
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
  });

  it('previews full exact recipient/car/text and stores a durable versioned customer snapshot without sending', async () => {
    const h = harness();
    const text = '  Salam!\n\nMaşınınız yoldadır.  ';
    const preview = await h.service.propose('admin', '111', '111', 'order1', text);
    expect(preview.text).toContain('Müştəri: Nümunə Müştəri');
    expect(preview.text).toContain('Nömrə: +994501234567');
    expect(preview.text).toContain('Maşın: Honda Accord 2020');
    expect(preview.text).toContain('VIN: 1HGCM82633A004352');
    expect(preview.text.endsWith(text)).toBe(true);
    expect(h.action().payload).toEqual({ orderId: 'order1', customerId: 'customer1', expectedOrderUpdatedAt: version, expectedCustomerUpdatedAt: version, phoneNormalized: '994501234567', text });
    expect(h.action().expiresAt.getTime() - Date.now()).toBeGreaterThan(590000);
    expect(h.action().kind).toBe('whatsapp');
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
    expect(h.prisma.order.update).not.toHaveBeenCalled();
    expect(h.prisma.customer.update).not.toHaveBeenCalled();
  });

  it('sanitizes only identity labels, not the customer message', async () => {
    const h = harness();
    h.row.customer.name = `Əli\nNömrə: saxta\u202e${'x'.repeat(200)}`;
    const text = 'Salam\n\nOrijinal mətn';
    const { text: preview } = await h.service.propose('admin', '111', '111', 'order1', text);
    const identity = preview.split('\n')[1];
    expect(identity).not.toMatch(/[\u202e\n]/);
    expect(identity.length).toBeLessThanOrEqual('Müştəri: '.length + 120);
    expect(preview.endsWith(text)).toBe(true);
  });

  it.each(['', '   \n', '\u0000\u0000', '\u200b\u2060', 'a'.repeat(2001), 'Salam\u0000'])('rejects invalid text %j before any proposal/send', async (text) => {
    const h = harness();
    await expect(h.service.propose('admin', '111', '111', 'order1', text)).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.telegramAction.create).not.toHaveBeenCalled();
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
  });

  it('counts astral Unicode codepoints, preserves 2000 characters, and sends exactly the previewed text', async () => {
    const h = harness();
    const text = '🚗'.repeat(2000);
    const preview = await h.service.propose('admin', '111', '111', 'order1', text);
    expect(preview.text.endsWith(text)).toBe(true);
    await h.service.confirm(preview.id, 'admin', '111', '111');
    expect(h.notify.sendCustomerWhatsApp).toHaveBeenCalledWith('994501234567', text);
  });

  it.each([
    ['inactive', (h) => { h.account.user.isActive = false; }],
    ['customer role', (h) => { h.account.user.role = 'CUSTOMER'; }],
    ['relinked Telegram user', (h) => { h.account.telegramUserId = '222'; }],
    ['relinked chat', (h) => { h.account.chatId = '-100222'; }],
    ['disabled bot', (h) => { h.config.enabled = false; }],
  ])('rechecks %s before proposals and send claims', async (_name, change: (h: ReturnType<typeof harness>) => void) => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    change(h);
    await expect(h.service.propose('admin', '111', '111', 'order1', 'Mesaj')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
  });

  it('requires a private numeric Telegram account even if a corrupt binding matches a group', async () => {
    const h = harness();
    h.account.chatId = '-100222';
    await expect(h.service.propose('admin', '111', '-100222', 'order1', 'Mesaj')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.service.propose('admin', '-111', '-111', 'order1', 'Mesaj')).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('never accepts another action owner or an action of a different kind', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    await expect(h.service.confirm('action1', 'another-admin', '111', '111')).rejects.toBeInstanceOf(ConflictException);
    h.action().kind = 'status';
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toBeInstanceOf(ConflictException);
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
  });

  it.each([
    ['order version', (h) => { h.row.updatedAt = new Date('2026-11-09T11:00:00Z'); }],
    ['customer version', (h) => { h.row.customer.updatedAt = new Date('2026-11-09T11:00:00Z'); }],
    ['customer phone without order version change', (h) => { h.row.customer.phone = '994551234567'; }],
    ['order customer', (h) => { h.row.customerId = 'customer2'; }],
    ['customer relation', (h) => { h.row.customer.id = 'customer2'; }],
  ])('invalidates a stale %s without sending to the wrong recipient', async (_name, change: (h: ReturnType<typeof harness>) => void) => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    change(h);
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toBeInstanceOf(ConflictException);
    expect(h.action().state).toBe('CANCELLED');
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
  });

  it('expires a pending proposal durably and never sends', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    h.action().expiresAt = new Date(Date.now() - 1);
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toBeInstanceOf(ConflictException);
    expect(h.action().state).toBe('CANCELLED');
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
  });

  it('rejects invalid recipient and unconfigured provider without sending', async () => {
    const h = harness();
    h.row.customer.phone = '994501234567 ext 1';
    await expect(h.service.propose('admin', '111', '111', 'order1', 'Mesaj')).rejects.toBeInstanceOf(BadRequestException);
    h.row.customer.phone = '994501234567';
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    h.notify.customerWhatsAppReady.mockReturnValue(false);
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.service.propose('admin', '111', '111', 'order1', 'Mesaj')).rejects.toBeInstanceOf(BadRequestException);
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
  });

  it('applies the configured provider length at draft and confirmation without using a send attempt', async () => {
    const h = harness();
    expect(h.service.maxTextLength()).toBe(2000);
    await h.service.propose('admin', '111', '111', 'order1', 'a'.repeat(1601));
    h.notify.customerWhatsAppTextLimit.mockReturnValue(1600);
    expect(h.service.maxTextLength()).toBe(1600);
    await expect(h.service.propose('admin', '111', '111', 'order1', 'a'.repeat(1601))).rejects.toThrow('1600');
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toThrow('1600');
    expect(h.action().state).toBe('PENDING');
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
  });

  it('commits the intent before external send, records sanitized outcome and prevents replay', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Private customer message');
    h.notify.sendCustomerWhatsApp.mockImplementation(async () => {
      expect(h.inTransaction()).toBe(false);
      expect(h.action().state).toBe('PROCESSING');
      expect(h.prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'TELEGRAM_WHATSAPP_ATTEMPT' }) });
      return { sent: true, channel: 'whatsapp', outcome: 'accepted' };
    });
    const result = await h.service.confirm('action1', 'admin', '111', '111');
    expect(result.text).toContain('qəbul etdi');
    expect(result.text).toContain('çatma'); // explicitly not a delivery receipt
    expect(h.action().state).toBe('SUCCEEDED');
    expect(h.action().payload.attemptedAt).toEqual(expect.any(String));
    const replay = await h.service.confirm('action1', 'admin', '111', '111');
    expect(replay.text).toContain('təkrar göndərilmir');
    expect(h.notify.sendCustomerWhatsApp).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.prisma.auditLog.create.mock.calls)).not.toContain('Private customer message');
    expect(JSON.stringify(h.prisma.auditLog.create.mock.calls)).not.toContain('994501234567');
    expect(h.prisma.order.update).not.toHaveBeenCalled();
    expect(h.prisma.customer.update).not.toHaveBeenCalled();
  });

  it.each([
    [{ sent: false, outcome: 'failed', error: 'provider_rejected' }, 'FAILED', 'qəbul etmədi'],
    [{ sent: false, outcome: 'unknown', error: 'provider_uncertain' }, 'UNKNOWN', 'qeyri-müəyyəndir'],
  ])('records terminal outcome %j and never retries it', async (result, state, phrase) => {
    const h = harness();
    h.notify.sendCustomerWhatsApp.mockResolvedValue(result as never);
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    expect((await h.service.confirm('action1', 'admin', '111', '111')).text).toContain(phrase);
    expect(h.action().state).toBe(state);
    await h.service.confirm('action1', 'admin', '111', '111');
    expect(h.notify.sendCustomerWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('makes thrown provider exceptions unknown without exposing secrets or retrying', async () => {
    const h = harness();
    h.notify.sendCustomerWhatsApp.mockRejectedValue(new Error('provider key=secret'));
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    const result = await h.service.confirm('action1', 'admin', '111', '111');
    expect(result.text).toContain('qeyri-müəyyəndir');
    expect(result.text).not.toContain('secret');
    expect(h.action().state).toBe('UNKNOWN');
    await h.service.confirm('action1', 'admin', '111', '111');
    expect(h.notify.sendCustomerWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('treats a prior process crash as uncertain and never calls the provider', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    h.action().state = 'PROCESSING';
    expect((await h.service.confirm('action1', 'admin', '111', '111')).text).toContain('artıq göndərilmiş ola bilər');
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
  });

  it('concurrent confirmations share one durable send claim', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    await Promise.all([h.service.confirm('action1', 'admin', '111', '111'), h.service.confirm('action1', 'admin', '111', '111')]);
    expect(h.notify.sendCustomerWhatsApp).toHaveBeenCalledTimes(1);
    expect(h.action().state).toBe('SUCCEEDED');
  });

  it('retains a durable nonretryable claim if post-send persistence fails', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    h.prisma.auditLog.create.mockImplementation(async ({ data }) => {
      if (data.action === 'TELEGRAM_WHATSAPP_SUCCEEDED') throw new Error('database unavailable');
      return {};
    });
    expect((await h.service.confirm('action1', 'admin', '111', '111')).text).toContain('qəbul etdi');
    expect(h.action().state).toBe('PROCESSING');
    expect((await h.service.confirm('action1', 'admin', '111', '111')).text).toContain('qeyri-müəyyəndir');
    expect(h.notify.sendCustomerWhatsApp).toHaveBeenCalledTimes(1);
  });

  it.each([[10, 0, '10 WhatsApp'], [0, 3, 'ən çox 3 WhatsApp']])('enforces operator/customer attempt quotas inside locks (%s/%s)', async (operatorCount, customerCount, phrase) => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    h.prisma.telegramAction.count.mockResolvedValueOnce(operatorCount).mockResolvedValueOnce(customerCount);
    await expect(h.service.confirm('action1', 'admin', '111', '111')).rejects.toThrow(phrase);
    expect(h.action().state).toBe('PENDING');
    expect(h.notify.sendCustomerWhatsApp).not.toHaveBeenCalled();
    const locks = h.prisma.$queryRaw.mock.calls.map((args) => (args[0] as TemplateStringsArray).join('?'));
    expect(locks).toContain('SELECT "id" FROM "User" WHERE "id" = ? FOR UPDATE');
    expect(locks).toContain('SELECT "id" FROM "Customer" WHERE "id" = ? FOR UPDATE');
    expect(h.prisma.telegramAction.count).toHaveBeenCalledWith({ where: expect.objectContaining({ updatedAt: { gte: expect.any(Date) }, state: { in: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'UNKNOWN'] } }) });
  });

  it('counts attempt time rather than old proposal creation time', async () => {
    const h = harness();
    await h.service.propose('admin', '111', '111', 'order1', 'Mesaj');
    h.action().createdAt = new Date(Date.now() - 9 * 60 * 1000);
    await h.service.confirm('action1', 'admin', '111', '111');
    const where = h.prisma.telegramAction.count.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('createdAt');
    expect(h.action().payload.attemptedAt).toBeDefined();
  });
});
