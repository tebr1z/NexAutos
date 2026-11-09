import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { FULL_ACCESS_ROLES } from '../common/access-roles';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramAccessService } from './telegram-access.service';
import { TelegramApiError, TelegramHttpService } from './telegram-http.service';
import { decryptTelegramToken, encryptTelegramToken, telegramEncryptionKey } from './telegram-secrets';
import type { TelegramIdentity } from './telegram.types';

@Injectable()
export class TelegramConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly access: TelegramAccessService,
    private readonly http: TelegramHttpService,
  ) {}

  private encryptionKey() {
    return telegramEncryptionKey(this.config.get<string>('TELEGRAM_ENCRYPTION_KEY'), this.config.get<string>('JWT_SECRET'));
  }

  token(ciphertext: string): string {
    const key = this.encryptionKey();
    if (!key) throw new Error('Telegram encryption not configured');
    return decryptTelegramToken(ciphertext, key);
  }

  async status(userId: string) {
    const user = await this.access.requireOperator(userId);
    const canManage = FULL_ACCESS_ROLES.includes(user.role);
    const [config, linked, accounts] = await Promise.all([
      this.prisma.telegramBotConfig.findUnique({ where: { id: 'main' } }),
      this.prisma.telegramAccount.findUnique({ where: { userId } }),
      canManage ? this.prisma.telegramAccount.findMany({
        where: { telegramUserId: { not: null } }, orderBy: { linkedAt: 'desc' },
        select: { userId: true, telegramUserId: true, username: true, linkedAt: true, user: { select: { name: true, email: true, role: true, isActive: true } } },
      }) : Promise.resolve([]),
    ]);
    const accountView = (a: { userId: string; telegramUserId: string | null; username: string | null; linkedAt: Date | null }) => ({
      userId: a.userId, telegramUserId: a.telegramUserId, username: a.username, linkedAt: a.linkedAt?.toISOString() ?? null,
    });
    return {
      configured: Boolean(config?.tokenCiphertext), enabled: config?.enabled ?? false,
      botUsername: config?.botUsername ?? null, botName: config?.botName ?? null,
      encryptionReady: Boolean(this.encryptionKey()), canManage,
      lastPollAt: config?.lastPollAt?.toISOString() ?? null, lastError: config?.lastError ?? null,
      linkedAccount: linked?.telegramUserId ? accountView(linked) : null,
      ...(canManage ? { accounts: accounts.map((a) => ({ ...accountView(a), ...a.user })) } : {}),
    };
  }

  async save(userId: string, input: { token?: string; enabled?: boolean; clear?: boolean }) {
    await this.access.requireOperator(userId, true);
    if (input.clear && (input.token || input.enabled)) throw new BadRequestException('Silmə əməliyyatını ayrıca təsdiqləyin.');
    const token = input.token?.trim();
    if (input.token !== undefined && !token) throw new BadRequestException('BotFather tokenini yazın.');
    let identity: TelegramIdentity | undefined;
    let encrypted: string | undefined;
    if (token) {
      if (!/^\d{5,16}:[A-Za-z0-9_-]{20,100}$/.test(token)) throw new BadRequestException('BotFather tokeninin formatı düzgün deyil.');
      const key = this.encryptionKey();
      if (!key) throw new BadRequestException('Serverdə təhlükəsiz şifrələmə açarı sazlanmayıb. Administratora müraciət edin.');
      try {
        identity = await this.http.call<TelegramIdentity>(token, 'getMe');
        if (!identity.is_bot || !identity.username || !/^[A-Za-z0-9_]{5,32}$/.test(identity.username)) throw new BadRequestException('Telegram bot hesabını təsdiqləmək mümkün olmadı.');
        const webhook = await this.http.call<{ url: string }>(token, 'getWebhookInfo');
        if (webhook.url) throw new BadRequestException('Bu botun başqa sistemdə webhook bağlantısı var. Ayrı bot yaradın və ya əvvəl həmin bağlantını dayandırın.');
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException(error instanceof TelegramApiError ? error.message : 'Telegram tokenini yoxlamaq mümkün olmadı.');
      }
      encrypted = encryptTelegramToken(token, key);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.telegramBotConfig.upsert({ where: { id: 'main' }, create: { id: 'main' }, update: {} });
      await tx.$queryRaw`SELECT "id" FROM "TelegramBotConfig" WHERE "id" = 'main' FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR SHARE`;
      const requester = await tx.user.findUnique({ where: { id: userId }, select: { isActive: true, role: true } });
      if (!requester?.isActive || !FULL_ACCESS_ROLES.includes(requester.role)) throw new BadRequestException('İdarəetmə icazəniz artıq etibarlı deyil.');
      const previous = await tx.telegramBotConfig.findUniqueOrThrow({ where: { id: 'main' } });
      if (input.enabled && !encrypted && !previous.tokenCiphertext) throw new BadRequestException('Əvvəl bot tokenini yadda saxlayın.');
      if (input.enabled && !this.encryptionKey()) throw new BadRequestException('Serverdə şifrələmə açarı sazlanmayıb.');
      // Only a different bot identity invalidates account bindings. Rotating the same bot token is safe.
      const changedBot = Boolean(identity && String(identity.id) !== previous.botId);
      if (input.clear || changedBot) {
        await tx.telegramAccount.deleteMany({});
      } else if (input.enabled === false || encrypted) {
        await tx.telegramAccount.updateMany({ data: { conversation: Prisma.DbNull, pairingTokenHash: null, pairingExpiresAt: null } });
      }
      if (input.clear || changedBot || encrypted || input.enabled === false) {
        await tx.telegramAction.updateMany({ where: { state: 'PENDING' }, data: { state: 'CANCELLED' } });
      }
      await tx.telegramBotConfig.update({
        where: { id: 'main' },
        data: input.clear ? {
          tokenCiphertext: null, botId: null, botUsername: null, botName: null, enabled: false,
          cursor: 0, lastPollAt: null, lastError: null, leaseOwner: null, leaseUntil: null,
        } : {
          ...(encrypted && identity ? { tokenCiphertext: encrypted, botId: String(identity.id), botUsername: identity.username, botName: identity.first_name?.slice(0, 128) || null } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(encrypted || input.enabled === true ? { lastPollAt: null } : {}),
          ...(changedBot ? { cursor: 0, lastPollAt: null, enabled: input.enabled ?? false } : {}),
          lastError: null,
        },
      });
      await tx.auditLog.create({ data: { userId, action: input.clear ? 'TELEGRAM_CONFIG_CLEARED' : 'TELEGRAM_CONFIG_UPDATED', entity: 'TelegramBotConfig', entityId: 'main', meta: { tokenChanged: Boolean(token), enabled: input.clear ? false : input.enabled ?? previous.enabled } } });
    });
    return this.status(userId);
  }
}
