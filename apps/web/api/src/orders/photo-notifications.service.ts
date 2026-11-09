import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotifyService, type NotifyChannelResult, type NotifyResult } from '../notify/notify.service';

// Settings has no generic API: only the fixed AIS/Cloudinary settings are exposed.
// These private rows are a durable outbox, not a scan of pre-existing galleries.
export const PHOTO_NOTIFICATION_PREFIX = '_private_photo_notification_v1:';
export const PHOTO_NOTIFICATION_DEBOUNCE_MS = 45_000;
export const PHOTO_NOTIFICATION_MAX_WAIT_MS = 180_000;
export const PHOTO_NOTIFICATION_MAX_IDS = 1000;
const PROCESSING_WINDOW_MS = 60_000;

type StoredBatch = {
  version: 1;
  orderId: string;
  pendingIds: string[];
  recentClaimedIds: string[];
  firstQueuedAt: number | null;
  dueAt: number | null;
  active: { id: string; startedAt: number } | null;
  last: { outcome: 'processing' | 'accepted' | 'failed' | 'unknown' | 'skipped'; at: number; count: number } | null;
};

export type PhotoNotificationQueueResult = {
  queued: boolean;
  pendingPhotos?: number;
  dueAt?: string;
  error?: 'enqueue_failed';
};

function emptyBatch(orderId: string): StoredBatch {
  return { version: 1, orderId, pendingIds: [], recentClaimedIds: [], firstQueuedAt: null, dueAt: null, active: null, last: null };
}

function parseBatch(value: Prisma.JsonValue, orderId: string): StoredBatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid photo batch');
  const row = value as Record<string, Prisma.JsonValue>;
  if (row.version !== 1 || row.orderId !== orderId || !Array.isArray(row.pendingIds) || !Array.isArray(row.recentClaimedIds)
    || row.pendingIds.length > PHOTO_NOTIFICATION_MAX_IDS || row.recentClaimedIds.length > PHOTO_NOTIFICATION_MAX_IDS
    || [...row.pendingIds, ...row.recentClaimedIds].some((id) => typeof id !== 'string' || id.length > 128 || !id)) {
    throw new Error('Invalid photo batch');
  }
  const timestamp = (raw: unknown): raw is number => typeof raw === 'number' && Number.isFinite(raw) && raw >= 0;
  if ((row.firstQueuedAt !== null && !timestamp(row.firstQueuedAt)) || (row.dueAt !== null && !timestamp(row.dueAt))
    || (row.pendingIds.length > 0 && (row.firstQueuedAt === null || row.dueAt === null))) throw new Error('Invalid photo batch time');
  if (row.active !== null) {
    if (!row.active || typeof row.active !== 'object' || Array.isArray(row.active)
      || typeof row.active.id !== 'string' || !row.active.id || row.active.id.length > 128 || !timestamp(row.active.startedAt)) throw new Error('Invalid photo claim');
  }
  if (row.last !== null) {
    if (!row.last || typeof row.last !== 'object' || Array.isArray(row.last) || !timestamp(row.last.at)
      || !['processing', 'accepted', 'failed', 'unknown', 'skipped'].includes(String(row.last.outcome))
      || typeof row.last.count !== 'number' || !Number.isInteger(row.last.count) || row.last.count < 0 || row.last.count > PHOTO_NOTIFICATION_MAX_IDS) throw new Error('Invalid photo result');
  }
  return value as unknown as StoredBatch;
}

export function safeShipmentNotifyResult(result: NotifyResult): NotifyResult {
  const safeChannel = (channel: NotifyChannelResult): NotifyChannelResult => ({
    sent: channel.sent === true,
    ...(['accepted', 'failed', 'unknown'].includes(channel.outcome ?? '') ? { outcome: channel.outcome } : {}),
    ...(channel.error ? { error: /^[a-z][a-z0-9_]{0,63}$/.test(channel.error) ? channel.error : 'notify_failed' } : {}),
  });
  return {
    sent: result.sent === true,
    ...(typeof result.channel === 'string' && /^[a-z+_]{1,40}$/.test(result.channel) ? { channel: result.channel } : {}),
    ...(result.error ? { error: /^[a-z][a-z0-9_]{0,63}$/.test(result.error) ? result.error : 'notify_failed' } : {}),
    ...(result.channelResults ? { channelResults: {
      whatsapp: safeChannel(result.channelResults.whatsapp), sms: safeChannel(result.channelResults.sms),
    } } : {}),
  };
}

@Injectable()
export class PhotoNotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PhotoNotificationsService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;

  constructor(private readonly prisma: PrismaService, private readonly notify: NotifyService) {}

  onModuleInit() { this.schedule(10_000); }

  private schedule(delay: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.tick().catch(() => {
        this.log.warn('Photo notification worker unavailable; queued photos are retained.');
      }).finally(() => this.schedule(10_000));
    }, delay);
    this.timer.unref?.();
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }

  private key(orderId: string) { return `${PHOTO_NOTIFICATION_PREFIX}${orderId}`; }

  private async lock(tx: Prisma.TransactionClient, orderId: string, create: boolean): Promise<StoredBatch | null> {
    const key = this.key(orderId);
    if (create) {
      // Prisma may implement an empty-update upsert as SELECT + INSERT. A native
      // conflict-safe insert handles simultaneous first uploads before row locking.
      const initial = JSON.stringify(emptyBatch(orderId));
      await tx.$executeRaw`INSERT INTO "Setting" ("key", "value") VALUES (${key}, ${initial}::jsonb) ON CONFLICT ("key") DO NOTHING`;
    }
    await tx.$queryRaw`SELECT "key" FROM "Setting" WHERE "key" = ${key} FOR UPDATE`;
    const row = await tx.setting.findUnique({ where: { key } });
    return row ? parseBatch(row.value, orderId) : null;
  }

  private async save(tx: Prisma.TransactionClient, row: StoredBatch) {
    await tx.setting.update({ where: { key: this.key(row.orderId) }, data: { value: row as unknown as Prisma.InputJsonValue } });
  }

  /** Only called for a photo that this request has fully persisted. No network I/O. */
  async enqueue(orderId: string, photoId: string): Promise<PhotoNotificationQueueResult> {
    if (!orderId || !photoId || orderId.length > 128 || photoId.length > 128) throw new Error('Invalid photo reference');
    return this.prisma.$transaction(async (tx) => {
      const batch = (await this.lock(tx, orderId, true))!;
      const photo = await tx.orderPhoto.findFirst({ where: { id: photoId, orderId }, select: { id: true, url: true } });
      if (!photo?.url?.trim() || photo.url === 'pending') throw new Error('Photo is not persisted');
      if (batch.recentClaimedIds.includes(photoId)) return { queued: false };
      if (!batch.pendingIds.includes(photoId)) {
        // Never silently drop IDs. The upload still succeeds, but its response
        // explicitly reports enqueue_failed if this exceptional bound is reached.
        if (batch.pendingIds.length >= PHOTO_NOTIFICATION_MAX_IDS) throw new Error('Photo notification batch is full');
        batch.pendingIds.push(photoId);
      }
      const now = Date.now();
      batch.firstQueuedAt ??= now;
      batch.dueAt = Math.min(now + PHOTO_NOTIFICATION_DEBOUNCE_MS, batch.firstQueuedAt + PHOTO_NOTIFICATION_MAX_WAIT_MS);
      await this.save(tx, batch);
      return { queued: true, pendingPhotos: batch.pendingIds.length, dueAt: new Date(batch.dueAt).toISOString() };
    });
  }

  /** Read-only operational check. It never sends, claims or changes a batch. */
  async status(orderId: string) {
    const row = await this.prisma.setting.findUnique({ where: { key: this.key(orderId) } });
    if (!row) return { pendingPhotos: 0, processing: false, dueAt: null, lastOutcome: null };
    const batch = parseBatch(row.value, orderId);
    return {
      pendingPhotos: batch.pendingIds.length,
      processing: Boolean(batch.active && batch.active.startedAt + PROCESSING_WINDOW_MS > Date.now()),
      dueAt: batch.dueAt === null ? null : new Date(batch.dueAt).toISOString(),
      lastOutcome: batch.last?.outcome ?? null,
    };
  }

  async tick() {
    const rows = await this.prisma.setting.findMany({
      where: { key: { startsWith: PHOTO_NOTIFICATION_PREFIX }, value: { path: ['dueAt'], gte: 0, lte: Date.now() } },
      orderBy: { key: 'asc' }, take: 25, select: { key: true },
    });
    for (const row of rows) {
      if (this.stopped) break;
      try { await this.flush(row.key.slice(PHOTO_NOTIFICATION_PREFIX.length), false); }
      catch { this.log.warn('Photo notification batch unavailable; no automatic send retry was made.'); }
    }
  }

  /** Manual and automatic sends share the same durable, pending-only claim. */
  async flush(orderId: string, manual = true, userId?: string): Promise<NotifyResult> {
    const claim = await this.prisma.$transaction(async (tx) => {
      const batch = await this.lock(tx, orderId, false);
      if (!batch) return { result: { sent: false, error: 'no_new_photos' } as NotifyResult };
      const now = Date.now();
      if (batch.active && batch.active.startedAt + PROCESSING_WINDOW_MS > now) {
        return { result: { sent: false, error: 'in_progress' } as NotifyResult };
      }
      if (!batch.pendingIds.length) return { result: { sent: false, error: 'already_processed' } as NotifyResult };
      if (!manual && (batch.dueAt === null || batch.dueAt > now)) return { result: { sent: false, error: 'photos_not_due' } as NotifyResult };
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          trackingCode: true, customer: { select: { phone: true } }, vehicle: { select: { make: true, model: true } },
          photos: { where: { id: { in: batch.pendingIds } }, select: { id: true, url: true } },
        },
      });
      if (!order) {
        await tx.setting.delete({ where: { key: this.key(orderId) } });
        return { result: { sent: false, error: 'photos_order_missing' } as NotifyResult };
      }
      const ids = batch.pendingIds;
      const photoCount = order.photos.filter((photo) => photo.url.trim() && photo.url !== 'pending').length;
      batch.pendingIds = [];
      batch.firstQueuedAt = null;
      batch.dueAt = null;
      batch.recentClaimedIds = [...new Set([...batch.recentClaimedIds, ...ids])].slice(-PHOTO_NOTIFICATION_MAX_IDS);
      if (!photoCount) {
        batch.active = null;
        batch.last = { outcome: 'skipped', at: now, count: 0 };
        await this.save(tx, batch);
        return { result: { sent: false, error: 'no_new_photos' } as NotifyResult };
      }
      const batchId = randomUUID();
      batch.active = { id: batchId, startedAt: now };
      batch.last = { outcome: 'processing', at: now, count: photoCount };
      await this.save(tx, batch);
      await tx.auditLog.create({ data: {
        userId, action: 'PHOTO_NOTIFICATION_CLAIM', entity: 'Order', entityId: orderId,
        meta: { batchId, photoCount, source: manual ? 'manual' : 'automatic' },
      } });
      return { batchId, photoCount, order };
    });
    if ('result' in claim) return claim.result!;

    // A committed claim is never returned to pending, including a process crash
    // or ambiguous provider response. New photos can form a separate later batch.
    let result: NotifyResult;
    let threw = false;
    try {
      result = await this.notify.photosAdded({
        phone: claim.order.customer.phone, trackingCode: claim.order.trackingCode,
        make: claim.order.vehicle?.make, model: claim.order.vehicle?.model,
      });
    } catch {
      threw = true;
      result = { sent: false, error: 'notify_failed' };
    }
    const safe = safeShipmentNotifyResult(result);
    const outcome = safe.sent ? 'accepted' : threw || /uncertain|unknown/.test(safe.error ?? '') ? 'unknown' : 'failed';
    try {
      await this.prisma.$transaction(async (tx) => {
        const batch = await this.lock(tx, orderId, false);
        if (batch?.active?.id === claim.batchId) {
          batch.active = null;
          batch.last = { outcome, at: Date.now(), count: claim.photoCount };
          await this.save(tx, batch);
        }
        await tx.auditLog.create({ data: {
          userId, action: 'PHOTO_NOTIFICATION_RESULT', entity: 'Order', entityId: orderId,
          meta: { batchId: claim.batchId, photoCount: claim.photoCount, outcome, notify: safe },
        } });
      });
    } catch { this.log.warn('Photo notification result could not be recorded; its durable claim prevents a repeat.'); }
    return result;
  }
}
