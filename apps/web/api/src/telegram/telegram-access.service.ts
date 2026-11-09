import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { FULL_ACCESS_ROLES, OPERATIONS_ROLES } from '../common/access-roles';
import { PrismaService } from '../prisma/prisma.service';

const validIdentity = (value: string) => /^[1-9]\d{0,15}$/.test(value);

@Injectable()
export class TelegramAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireOperator(userId: string, full = false) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, role: true } });
    if (!user?.isActive || !(full ? FULL_ACCESS_ROLES : OPERATIONS_ROLES).includes(user.role)) {
      throw new ForbiddenException('Bu əməliyyat üçün idarəetmə icazəniz yoxdur.');
    }
    return user;
  }

  async authorize(telegramUserId: string, chatId: string, expectedBotId?: string) {
    if (!validIdentity(telegramUserId) || chatId !== telegramUserId) return null;
    const config = await this.prisma.telegramBotConfig.findUnique({ where: { id: 'main' }, select: { enabled: true, botId: true } });
    if (!config?.enabled || (expectedBotId !== undefined && config.botId !== expectedBotId)) return null;
    const account = await this.prisma.telegramAccount.findUnique({
      where: { telegramUserId }, include: { user: { select: { isActive: true, role: true } } },
    });
    if (!account || account.chatId !== chatId || !account.user.isActive || !OPERATIONS_ROLES.includes(account.user.role)) return null;
    return account;
  }

  async createPair(userId: string) {
    await this.requireOperator(userId);
    const secret = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const tokenHash = createHash('sha256').update(secret).digest('hex');
    const username = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TelegramBotConfig" WHERE "id" = 'main' FOR SHARE`;
      const config = await tx.telegramBotConfig.findUnique({ where: { id: 'main' }, select: { enabled: true, botUsername: true } });
      if (!config?.enabled || !config.botUsername) throw new BadRequestException('Əvvəl botu sazlayın və aktiv edin.');
      await tx.$queryRaw`SELECT "userId" FROM "TelegramAccount" WHERE "userId" = ${userId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR SHARE`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { isActive: true, role: true } });
      if (!user?.isActive || !OPERATIONS_ROLES.includes(user.role)) throw new ForbiddenException('İdarəetmə icazəniz artıq etibarlı deyil.');
      await tx.telegramAccount.upsert({
        where: { userId },
        create: { userId, pairingTokenHash: tokenHash, pairingExpiresAt: expiresAt },
        update: { pairingTokenHash: tokenHash, pairingExpiresAt: expiresAt },
      });
      return config.botUsername;
    });
    return { url: `https://t.me/${username}?start=${secret}`, expiresAt: expiresAt.toISOString() };
  }

  async pair(secret: string, telegramUserId: string, chatId: string, username?: string, expectedBotId?: string): Promise<boolean> {
    if (!/^[A-Za-z0-9_-]{32}$/.test(secret) || !validIdentity(telegramUserId) || chatId !== telegramUserId) return false;
    const hash = createHash('sha256').update(secret).digest('hex');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "TelegramBotConfig" WHERE "id" = 'main' FOR SHARE`;
        const config = await tx.telegramBotConfig.findUnique({ where: { id: 'main' }, select: { enabled: true, botId: true } });
        if (!config?.enabled || (expectedBotId !== undefined && config.botId !== expectedBotId)) return false;
        // Lock order matches confirmed changes: config -> account -> user -> actions.
        await tx.$queryRaw`SELECT "userId" FROM "TelegramAccount" WHERE "pairingTokenHash" = ${hash} FOR UPDATE`;
        const account = await tx.telegramAccount.findUnique({ where: { pairingTokenHash: hash } });
        if (!account || !account.pairingExpiresAt || account.pairingExpiresAt.getTime() <= Date.now()) return false;
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${account.userId} FOR SHARE`;
        const user = await tx.user.findUnique({ where: { id: account.userId }, select: { isActive: true, role: true } });
        if (!user?.isActive || !OPERATIONS_ROLES.includes(user.role)) return false;
        const claimed = await tx.telegramAccount.updateMany({
          where: { userId: account.userId, pairingTokenHash: hash, pairingExpiresAt: { gt: new Date() } },
          data: {
            telegramUserId, chatId, username: username?.slice(0, 64) || null,
            pairingTokenHash: null, pairingExpiresAt: null, conversation: Prisma.DbNull, linkedAt: new Date(),
          },
        });
        if (!claimed.count) return false;
        await tx.telegramAction.updateMany({ where: { userId: account.userId, state: 'PENDING' }, data: { state: 'CANCELLED' } });
        await tx.auditLog.create({ data: { userId: account.userId, action: 'TELEGRAM_LINKED', entity: 'User', entityId: account.userId, meta: { telegramUserId } } });
        return true;
      });
    } catch {
      // Includes a Telegram account already linked elsewhere; do not reveal whose account.
      return false;
    }
  }

  async saveConversation(userId: string, state: Prisma.InputJsonValue | null, telegramUserId: string, chatId: string, expectedBotId?: string) {
    if (!validIdentity(telegramUserId) || telegramUserId !== chatId) throw new ForbiddenException('Telegram hesabı etibarlı deyil.');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TelegramBotConfig" WHERE "id" = 'main' FOR SHARE`;
      const config = await tx.telegramBotConfig.findUnique({ where: { id: 'main' }, select: { enabled: true, botId: true } });
      if (!config?.enabled || (expectedBotId !== undefined && config.botId !== expectedBotId)) throw new ForbiddenException('Bot bağlantısı dəyişib və ya dayandırılıb.');
      await tx.$queryRaw`SELECT "userId" FROM "TelegramAccount" WHERE "userId" = ${userId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR SHARE`;
      const saved = await tx.telegramAccount.updateMany({
        where: { userId, telegramUserId, chatId, user: { isActive: true, role: { in: OPERATIONS_ROLES } } },
        data: { conversation: state === null ? Prisma.DbNull : state },
      });
      if (!saved.count) throw new ForbiddenException('Telegram bağlantısı və ya idarəetmə icazəsi artıq etibarlı deyil.');
    });
  }

  async revoke(requesterId: string, targetId = requesterId) {
    await this.requireOperator(requesterId, targetId !== requesterId);
    if (!targetId || targetId.length > 128) throw new BadRequestException('İstifadəçi düzgün deyil.');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "userId" FROM "TelegramAccount" WHERE "userId" = ${targetId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${requesterId} FOR SHARE`;
      const requester = await tx.user.findUnique({ where: { id: requesterId }, select: { isActive: true, role: true } });
      if (!requester?.isActive || !(targetId !== requesterId ? FULL_ACCESS_ROLES : OPERATIONS_ROLES).includes(requester.role)) throw new ForbiddenException('İdarəetmə icazəniz artıq etibarlı deyil.');
      await tx.telegramAccount.updateMany({
        where: { userId: targetId },
        data: { telegramUserId: null, chatId: null, username: null, pairingTokenHash: null, pairingExpiresAt: null, conversation: Prisma.DbNull, linkedAt: null },
      });
      await tx.telegramAction.updateMany({ where: { userId: targetId, state: 'PENDING' }, data: { state: 'CANCELLED' } });
      await tx.auditLog.create({ data: { userId: requesterId, action: 'TELEGRAM_REVOKED', entity: 'User', entityId: targetId } });
    });
    return { ok: true };
  }
}
