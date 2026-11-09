import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramConfigService } from './telegram-config.service';
import { TelegramConversationService } from './telegram-conversation.service';
import { TelegramApiError, TelegramHttpService } from './telegram-http.service';
import type { TelegramUpdate } from './telegram.types';

@Injectable()
export class TelegramPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollerService.name);
  private readonly owner = randomUUID();
  private readonly shutdown = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: TelegramConfigService,
    private readonly http: TelegramHttpService,
    private readonly conversation: TelegramConversationService,
  ) {}

  onModuleInit() { this.schedule(1500); }

  private schedule(delay: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.run();
      void this.running;
    }, delay);
    this.timer.unref?.();
  }

  private async run() {
    let next = 5000;
    try { next = await this.cycle(); }
    catch {
      // Do not leak database connection strings or token-bearing fetch errors into logs.
      this.logger.warn('Telegram worker unavailable; retrying safely.');
      next = 15000;
    } finally { this.schedule(next); }
  }

  private async cycle(): Promise<number> {
    const row = await this.prisma.telegramBotConfig.findUnique({ where: { id: 'main' } });
    if (!row?.enabled || !row.tokenCiphertext || this.stopped) return 5000;
    const fence = { id: 'main', enabled: true, tokenCiphertext: row.tokenCiphertext, leaseOwner: this.owner };
    const claim = await this.prisma.telegramBotConfig.updateMany({
      where: {
        id: 'main', enabled: true, tokenCiphertext: row.tokenCiphertext,
        OR: [{ leaseOwner: this.owner }, { leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
      },
      data: { leaseOwner: this.owner, leaseUntil: new Date(Date.now() + 90_000) },
    });
    if (!claim.count) return 10000;
    try {
      // The lease may have changed hands since our initial read. Never rewind a
      // cursor another worker already committed while we waited for the claim.
      const current = await this.prisma.telegramBotConfig.findFirst({ where: fence, select: { cursor: true, botId: true } });
      if (!current) return 1000;
      const token = this.config.token(row.tokenCiphertext);
      const offset = Number(current.cursor);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid cursor');
      const updates = await this.http.call<TelegramUpdate[]>(token, 'getUpdates', {
        offset, timeout: 25, limit: 10, allowed_updates: ['message', 'callback_query'],
      }, this.shutdown.signal);
      if (this.stopped) return 5000;
      if (!Array.isArray(updates)) throw new Error('Invalid update response');
      const healthy = await this.prisma.telegramBotConfig.updateMany({
        where: fence, data: { lastPollAt: new Date(), lastError: null, leaseUntil: new Date(Date.now() + 90_000) },
      });
      if (!healthy.count) return 1000;
      let cursor = offset;
      for (const update of updates.sort((a, b) => a.update_id - b.update_id)) {
        if (this.stopped) break;
        if (!Number.isSafeInteger(update.update_id) || update.update_id < cursor || update.update_id >= Number.MAX_SAFE_INTEGER) continue;
        const renewed = await this.prisma.telegramBotConfig.updateMany({ where: fence, data: { leaseUntil: new Date(Date.now() + 90_000) } });
        if (!renewed.count) break;
        // Handler errors do not poison the queue. Confirmed writes are durable/idempotent,
        // so delivery retries or a crash before saving the cursor cannot repeat a mutation.
        try { await this.conversation.handle(update, token, current.botId ?? undefined); }
        catch { this.logger.warn('Telegram update could not be answered; no automatic mutation retry.'); }
        cursor = update.update_id + 1;
        const advanced = await this.prisma.telegramBotConfig.updateMany({
          where: { ...fence, cursor: { lte: BigInt(cursor) } }, data: { cursor: BigInt(cursor), leaseUntil: new Date(Date.now() + 90_000) },
        });
        if (!advanced.count) break;
      }
      return 100;
    } catch (error) {
      if (this.stopped) return 5000;
      const message = error instanceof TelegramApiError ? error.message : 'Botun şifrələmə açarı və ya bağlantısı yoxlanmalıdır. Tokeni yenidən yadda saxlayın.';
      await this.prisma.telegramBotConfig.updateMany({ where: fence, data: { lastError: message } });
      return error instanceof TelegramApiError && error.retryAfter ? Math.max(5000, error.retryAfter * 1000) : 15000;
    }
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.shutdown.abort();
    await this.running;
    await this.prisma.telegramBotConfig.updateMany({
      where: { id: 'main', leaseOwner: this.owner }, data: { leaseOwner: null, leaseUntil: null },
    }).catch(() => undefined);
  }
}
