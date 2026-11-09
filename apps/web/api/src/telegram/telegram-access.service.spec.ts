import 'reflect-metadata';
import { createHash } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { TelegramAccessService } from './telegram-access.service';

const secret = 'a'.repeat(32);
const secretHash = createHash('sha256').update(secret).digest('hex');

function harness() {
  const config = { id: 'main', enabled: true, botId: 'bot1', botUsername: 'AutoNexTestBot' };
  const users = {
    admin: { id: 'admin', role: 'ADMIN', isActive: true },
    staff: { id: 'staff', role: 'STAFF', isActive: true },
    customer: { id: 'customer', role: 'CUSTOMER', isActive: true },
  };
  const account: any = {
    userId: 'admin', telegramUserId: null, chatId: null, username: null,
    pairingTokenHash: secretHash, pairingExpiresAt: new Date(Date.now() + 600000),
    conversation: null, linkedAt: null, user: users.admin,
  };
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(async ({ where }) => users[where.id] ?? null) },
    telegramBotConfig: { findUnique: jest.fn(async () => config) },
    telegramAccount: {
      findUnique: jest.fn(async ({ where }) => {
        if (where.userId !== undefined && where.userId !== account.userId) return null;
        if (where.telegramUserId !== undefined && where.telegramUserId !== account.telegramUserId) return null;
        if (where.pairingTokenHash !== undefined && where.pairingTokenHash !== account.pairingTokenHash) return null;
        return account;
      }),
      upsert: jest.fn(async ({ update }) => { Object.assign(account, update); return account; }),
      updateMany: jest.fn(async ({ where, data }) => {
        if (where?.userId !== undefined && where.userId !== account.userId) return { count: 0 };
        if (typeof where?.telegramUserId === 'string' && where.telegramUserId !== account.telegramUserId) return { count: 0 };
        if (where?.telegramUserId?.not === null && account.telegramUserId === null) return { count: 0 };
        if (where?.chatId !== undefined && where.chatId !== account.chatId) return { count: 0 };
        if (where?.pairingTokenHash !== undefined && where.pairingTokenHash !== account.pairingTokenHash) return { count: 0 };
        if (where?.pairingExpiresAt?.gt && !(account.pairingExpiresAt > where.pairingExpiresAt.gt)) return { count: 0 };
        if (where?.user && (!users.admin.isActive || !where.user.role.in.includes(users.admin.role))) return { count: 0 };
        Object.assign(account, data);
        return { count: 1 };
      }),
    },
    telegramAction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  return { service: new TelegramAccessService(prisma as never), prisma, config, users, account };
}

describe('Telegram pairing and operator access', () => {
  it('creates a short-lived deep link but persists only its SHA-256 hash', async () => {
    const h = harness();
    const result = await h.service.createPair('admin');
    const raw = new URL(result.url).searchParams.get('start')!;
    expect(raw).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(result.url).toMatch(/^https:\/\/t.me\/AutoNexTestBot\?start=/);
    expect(h.account.pairingTokenHash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(JSON.stringify(h.prisma.telegramAccount.upsert.mock.calls)).not.toContain(raw);
    expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now());
    expect(Date.parse(result.expiresAt)).toBeLessThanOrEqual(Date.now() + 600000);
  });

  it('consumes one pairing token and binds only a private numeric Telegram identity', async () => {
    const h = harness();
    expect(await h.service.pair(secret, '111', '111', 'operator', 'bot1')).toBe(true);
    expect(h.account.telegramUserId).toBe('111');
    expect(h.account.chatId).toBe('111');
    expect(h.account.pairingTokenHash).toBeNull();
    expect(h.account.pairingExpiresAt).toBeNull();
    expect(await h.service.pair(secret, '222', '222', 'other', 'bot1')).toBe(false);
    expect(h.account.telegramUserId).toBe('111');
    expect(h.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(h.prisma.telegramAction.updateMany).toHaveBeenCalledWith({ where: { userId: 'admin', state: 'PENDING' }, data: { state: 'CANCELLED' } });
  });

  it.each([
    ['111', '-100222'], ['0', '0'], ['-1', '-1'], ['operator', 'operator'], ['01', '01'], ['90071992547409920', '90071992547409920'],
  ])('rejects invalid/group identity %s / %s before database access', async (tgId, chatId) => {
    const h = harness();
    expect(await h.service.pair(secret, tgId, chatId)).toBe(false);
    expect(await h.service.authorize(tgId, chatId)).toBeNull();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.prisma.telegramBotConfig.findUnique).not.toHaveBeenCalled();
  });

  it.each(['expired', 'inactive', 'demoted', 'disabled', 'wrong bot'])('rejects %s pairing without binding', async (condition) => {
    const h = harness();
    if (condition === 'expired') h.account.pairingExpiresAt = new Date(Date.now() - 1);
    if (condition === 'inactive') h.users.admin.isActive = false;
    if (condition === 'demoted') h.users.admin.role = 'CUSTOMER';
    if (condition === 'disabled') h.config.enabled = false;
    expect(await h.service.pair(secret, '111', '111', 'operator', condition === 'wrong bot' ? 'oldbot' : 'bot1')).toBe(false);
    expect(h.account.telegramUserId).toBeNull();
    expect(h.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not disclose uniqueness/database errors while pairing', async () => {
    const h = harness();
    h.prisma.telegramAccount.updateMany.mockRejectedValue(new Error('private database secret') as never);
    expect(await h.service.pair(secret, '111', '111')).toBe(false);
  });

  it('authorizes a linked active operator, not an inactive/demoted/wrong-bot account', async () => {
    const h = harness();
    h.account.telegramUserId = h.account.chatId = '111';
    expect(await h.service.authorize('111', '111', 'bot1')).toBe(h.account);
    expect(await h.service.authorize('111', '111', 'oldbot')).toBeNull();
    h.users.admin.isActive = false;
    expect(await h.service.authorize('111', '111', 'bot1')).toBeNull();
    h.users.admin.isActive = true;
    h.users.admin.role = 'CUSTOMER';
    expect(await h.service.authorize('111', '111', 'bot1')).toBeNull();
  });

  it('does not allow customer accounts or staff to revoke somebody else', async () => {
    const h = harness();
    await expect(h.service.requireOperator('customer')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.service.revoke('staff', 'admin')).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.telegramAccount.updateMany).not.toHaveBeenCalled();
  });

  it('revocation clears binding, pending pairing, conversation and pending actions', async () => {
    const h = harness();
    h.account.telegramUserId = h.account.chatId = '111';
    await h.service.revoke('admin');
    expect(h.account).toMatchObject({ telegramUserId: null, chatId: null, pairingTokenHash: null, pairingExpiresAt: null, linkedAt: null });
    expect(h.prisma.telegramAction.updateMany).toHaveBeenCalledWith({ where: { userId: 'admin', state: 'PENDING' }, data: { state: 'CANCELLED' } });
    expect(h.prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'TELEGRAM_REVOKED', userId: 'admin' }) });
  });

  it('rechecks a privileged revoker after authorization changes before the transaction', async () => {
    const h = harness();
    h.prisma.user.findUnique.mockResolvedValueOnce({ ...h.users.admin });
    h.users.admin.isActive = false;
    await expect(h.service.revoke('admin', 'other')).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.telegramAccount.updateMany).not.toHaveBeenCalled();
  });
});

describe('Telegram conversation origin fence', () => {
  it('persists conversation state only for its exact current origin identity', async () => {
    const h = harness();
    h.account.telegramUserId = h.account.chatId = '111';
    await h.service.saveConversation('admin', { mode: 'menu', nonce: '123' }, '111', '111', 'bot1');
    expect(h.account.conversation).toEqual({ mode: 'menu', nonce: '123' });
  });

  it.each(['relinked', 'disabled', 'demoted', 'wrong bot'])('rejects stale state after %s without overwriting it', async (condition) => {
    const h = harness();
    h.account.telegramUserId = h.account.chatId = condition === 'relinked' ? '222' : '111';
    h.account.conversation = { mode: 'menu', nonce: 'new-account-state' };
    if (condition === 'disabled') h.config.enabled = false;
    if (condition === 'demoted') h.users.admin.role = 'CUSTOMER';
    await expect(h.service.saveConversation('admin', { mode: 'edit', nonce: 'old-account-state' }, '111', '111', condition === 'wrong bot' ? 'oldbot' : 'bot1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.account.conversation).toEqual({ mode: 'menu', nonce: 'new-account-state' });
  });
});
