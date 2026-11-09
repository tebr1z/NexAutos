import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { TelegramAccessService } from './telegram-access.service';
import { TelegramConfigService } from './telegram-config.service';

const fakeToken = '123456789:FAKE_TEST_TOKEN_DO_NOT_USE_1234567';
const jwtSecret = 'test-secret-'.repeat(6);

function harness() {
  const user = { id: 'admin', isActive: true, role: 'ADMIN' };
  const config = {
    id: 'main', tokenCiphertext: 'private-encrypted-token', botId: '123456789', botUsername: 'AutoNexTestBot',
    botName: 'Test Bot', enabled: true, cursor: 14n, leaseOwner: 'worker1', leaseUntil: new Date(), lastPollAt: null, lastError: null,
  };
  const linked = { userId: 'admin', telegramUserId: '111', username: 'operator', linkedAt: new Date(), pairingTokenHash: 'secret-hash', conversation: { private: true } };
  const prisma = {
    $transaction: jest.fn(), $queryRaw: jest.fn().mockResolvedValue([]),
    user: { findUnique: jest.fn(async () => user) },
    telegramBotConfig: {
      findUnique: jest.fn(async () => config), findUniqueOrThrow: jest.fn(async () => config),
      upsert: jest.fn(async () => config), update: jest.fn(async ({ data }) => { Object.assign(config, data); return config; }),
    },
    telegramAccount: {
      findUnique: jest.fn(async () => linked), findMany: jest.fn(async () => [{ ...linked, user: { ...user, name: 'Operator', email: 'operator@example.test' } }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    telegramAction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  const env = { get: jest.fn((name: string) => name === 'JWT_SECRET' ? jwtSecret : undefined) };
  const access = new TelegramAccessService(prisma as never);
  const http = { call: jest.fn(async (_token: string, method: string) => method === 'getMe'
    ? { id: 123456789, is_bot: true, username: 'AutoNexTestBot', first_name: 'Test Bot' }
    : { url: '' }) };
  return { service: new TelegramConfigService(prisma as never, env as never, access, http as never), prisma, user, config, http };
}

describe('Telegram admin configuration', () => {
  it('never returns encrypted tokens, pairing hashes or conversation state in status', async () => {
    const h = harness();
    const result = await h.service.status('admin');
    expect(result.configured).toBe(true);
    const json = JSON.stringify(result);
    expect(json).not.toContain('private-encrypted-token');
    expect(json).not.toContain('secret-hash');
    expect(json).not.toContain('conversation');
    expect(json).not.toContain('leaseOwner');
    expect(result.accounts).toHaveLength(1);
  });

  it('hides the global account list from an operator without full access', async () => {
    const h = harness();
    h.user.role = 'STAFF';
    const result = await h.service.status('admin');
    expect(result.canManage).toBe(false);
    expect(result).not.toHaveProperty('accounts');
    expect(h.prisma.telegramAccount.findMany).not.toHaveBeenCalled();
  });

  it('verifies the Telegram bot, encrypts the saved token, and never audits plaintext', async () => {
    const h = harness();
    await h.service.save('admin', { token: fakeToken });
    expect(h.http.call).toHaveBeenCalledWith(fakeToken, 'getMe');
    expect(h.http.call).toHaveBeenCalledWith(fakeToken, 'getWebhookInfo');
    expect(h.config.tokenCiphertext).toMatch(/^v1\./);
    expect(h.service.token(h.config.tokenCiphertext)).toBe(fakeToken);
    expect(JSON.stringify(h.prisma.auditLog.create.mock.calls)).not.toContain(fakeToken);
    expect(h.prisma.telegramAccount.deleteMany).not.toHaveBeenCalled();
    expect(h.prisma.telegramAccount.updateMany).toHaveBeenCalled();
    expect(h.prisma.telegramAction.updateMany).toHaveBeenCalled();
  });

  it('rejects a bot already connected by webhook without removing that webhook', async () => {
    const h = harness();
    h.http.call.mockImplementation(async (_token, method) => method === 'getMe'
      ? { id: 123456789, is_bot: true, username: 'AutoNexTestBot', first_name: 'Test Bot' }
      : { url: 'https://other.example/webhook' });
    await expect(h.service.save('admin', { token: fakeToken })).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.http.call.mock.calls.map((call) => call[1])).not.toContain('deleteWebhook');
  });

  it('changes bot identity by invalidating all pairings and pending actions and resetting its cursor', async () => {
    const h = harness();
    h.config.botId = 'older-bot';
    await h.service.save('admin', { token: fakeToken });
    expect(h.prisma.telegramAccount.deleteMany).toHaveBeenCalledWith({});
    expect(h.prisma.telegramAction.updateMany).toHaveBeenCalledWith({ where: { state: 'PENDING' }, data: { state: 'CANCELLED' } });
    expect(h.config.cursor).toBe(0);
    expect(h.config.enabled).toBe(false);
  });

  it('rechecks the requester role after the network checks and before changing settings', async () => {
    const h = harness();
    h.http.call.mockImplementation(async (_token, method) => {
      h.user.role = 'CUSTOMER';
      return method === 'getMe' ? { id: 123456789, is_bot: true, username: 'AutoNexTestBot', first_name: 'Test Bot' } : { url: '' };
    });
    await expect(h.service.save('admin', { token: fakeToken, enabled: false })).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.telegramBotConfig.update).not.toHaveBeenCalled();
    expect(h.prisma.telegramAccount.deleteMany).not.toHaveBeenCalled();
    expect(h.prisma.telegramAccount.updateMany).not.toHaveBeenCalled();
  });

  it('clear invalidates links, pending actions, worker lease and token', async () => {
    const h = harness();
    await h.service.save('admin', { clear: true });
    expect(h.config).toMatchObject({ tokenCiphertext: null, botId: null, enabled: false, cursor: 0, leaseOwner: null, leaseUntil: null });
    expect(h.prisma.telegramAccount.deleteMany).toHaveBeenCalledWith({});
    expect(h.prisma.telegramAction.updateMany).toHaveBeenCalled();
  });

  it('cannot enable a bot without a saved token', async () => {
    const h = harness();
    h.config.tokenCiphertext = null as never;
    await expect(h.service.save('admin', { enabled: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.telegramBotConfig.update).not.toHaveBeenCalled();
  });

  it('sanitizes unexpected token-verification errors instead of echoing secret URLs', async () => {
    const h = harness();
    h.http.call.mockRejectedValue(new Error(`fetch failed for /bot${fakeToken}/getMe`) as never);
    const err = await h.service.save('admin', { token: fakeToken }).catch((error) => error);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).not.toContain(fakeToken);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
});
