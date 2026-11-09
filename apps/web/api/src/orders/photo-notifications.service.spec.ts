import { Logger } from '@nestjs/common';
import { PHOTO_NOTIFICATION_DEBOUNCE_MS, PHOTO_NOTIFICATION_MAX_IDS, PHOTO_NOTIFICATION_MAX_WAIT_MS, PHOTO_NOTIFICATION_PREFIX, PhotoNotificationsService } from './photo-notifications.service';

const orderId = 'order-1';
const key = `${PHOTO_NOTIFICATION_PREFIX}${orderId}`;

function harness() {
  const rows = new Map<string, { key: string; value: any }>();
  const photos = new Map<string, { id: string; orderId: string; url: string }>();
  let order: any = { trackingCode: 'TRACK', customer: { phone: '0501234567' }, vehicle: { make: 'Honda', model: 'Civic' } };
  let transactionActive = false;
  let tail: Promise<unknown> = Promise.resolve();
  const prisma = {
    setting: {
      upsert: jest.fn(async ({ where, create }) => {
        if (!rows.has(where.key)) rows.set(where.key, structuredClone(create));
        return structuredClone(rows.get(where.key));
      }),
      findUnique: jest.fn(async ({ where }) => structuredClone(rows.get(where.key) ?? null)),
      update: jest.fn(async ({ where, data }) => {
        rows.set(where.key, { key: where.key, value: structuredClone(data.value) });
        return structuredClone(rows.get(where.key));
      }),
      delete: jest.fn(async ({ where }) => { rows.delete(where.key); return {}; }),
      findMany: jest.fn(async ({ where, take }) => [...rows.values()]
        .filter((row) => row.key.startsWith(where.key.startsWith) && typeof row.value.dueAt === 'number' && row.value.dueAt >= where.value.gte && row.value.dueAt <= where.value.lte)
        .sort((a, b) => a.key.localeCompare(b.key)).slice(0, take).map((row) => ({ key: row.key }))),
    },
    orderPhoto: { findFirst: jest.fn(async ({ where }) => {
      const photo = photos.get(where.id);
      return photo?.orderId === where.orderId ? structuredClone(photo) : null;
    }) },
    order: { findUnique: jest.fn(async ({ select }) => order ? {
      ...structuredClone(order), photos: [...photos.values()].filter((photo) => select.photos.where.id.in.includes(photo.id)),
    } : null) },
    auditLog: { create: jest.fn(async () => ({})) },
    $executeRaw: jest.fn(async (_sql, id, value) => {
      if (!rows.has(id)) rows.set(id, { key: id, value: JSON.parse(value) });
      return 1;
    }),
    $queryRaw: jest.fn(async () => []),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn) => {
    const next = tail.then(async () => {
      const snapshot = structuredClone([...rows]);
      transactionActive = true;
      try { return await fn(prisma); }
      catch (error) { rows.clear(); for (const [id, row] of snapshot) rows.set(id, row); throw error; }
      finally { transactionActive = false; }
    });
    tail = next.catch(() => undefined);
    return next;
  });
  const notify = { photosAdded: jest.fn(async () => {
    expect(transactionActive).toBe(false);
    return { sent: true, channel: 'whatsapp' };
  }) };
  const service = new PhotoNotificationsService(prisma as never, notify as never);
  function addPhoto(id: string, url = `https://example.com/${id}.jpg`) { photos.set(id, { id, orderId, url }); }
  return { service, prisma, notify, rows, photos, addPhoto, setOrder: (next: any) => { order = next; }, row: () => rows.get(key)?.value };
}

describe('Durable automatic photo notifications', () => {
  let now = 1_800_000_000_000;
  let clock: jest.SpyInstance;
  let warning: jest.SpyInstance;
  beforeEach(() => {
    now = 1_800_000_000_000;
    clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => { clock.mockRestore(); warning.mockRestore(); });

  it('queues only the new persisted IDs and sends nothing while uploading', async () => {
    const h = harness();
    h.addPhoto('old'); h.addPhoto('new');
    expect(await h.service.enqueue(orderId, 'new')).toEqual({ queued: true, pendingPhotos: 1, dueAt: new Date(now + PHOTO_NOTIFICATION_DEBOUNCE_MS).toISOString() });
    expect(h.row().pendingIds).toEqual(['new']);
    expect(h.notify.photosAdded).not.toHaveBeenCalled();
    expect(h.prisma.$queryRaw).toHaveBeenCalled();
  });

  it.each(['pending', ''])('rejects an incompletely saved image %s', async (url) => {
    const h = harness(); h.addPhoto('new', url);
    await expect(h.service.enqueue(orderId, 'new')).rejects.toThrow('Photo is not persisted');
    expect(h.rows.size).toBe(0);
    expect(h.notify.photosAdded).not.toHaveBeenCalled();
  });

  it('rejects missing or foreign photos rather than notifying the wrong customer', async () => {
    const h = harness(); h.addPhoto('new');
    await expect(h.service.enqueue('another-order', 'new')).rejects.toThrow();
    await expect(h.service.enqueue(orderId, 'missing')).rejects.toThrow();
    expect(h.notify.photosAdded).not.toHaveBeenCalled();
  });

  it('debounces sequential and concurrent multi-image uploads into one notification', async () => {
    const h = harness();
    for (let i = 0; i < 60; i++) h.addPhoto(`new-${i}`);
    await Promise.all([...h.photos.keys()].map((id) => h.service.enqueue(orderId, id)));
    expect(h.row().pendingIds).toHaveLength(60);
    now += PHOTO_NOTIFICATION_DEBOUNCE_MS - 1;
    await h.service.tick();
    expect(h.notify.photosAdded).not.toHaveBeenCalled();
    now += 1;
    await h.service.tick();
    expect(h.notify.photosAdded).toHaveBeenCalledTimes(1);
    expect(h.row().pendingIds).toEqual([]);
    await h.service.tick();
    expect(h.notify.photosAdded).toHaveBeenCalledTimes(1);
  });

  it('extends trailing debounce but never exceeds the maximum batch wait', async () => {
    const h = harness(); const first = now;
    for (let i = 0; i < 6; i++) {
      h.addPhoto(`new-${i}`);
      await h.service.enqueue(orderId, `new-${i}`);
      now += 35_000;
    }
    expect(h.row().dueAt).toBe(first + PHOTO_NOTIFICATION_MAX_WAIT_MS);
    await h.service.tick();
    expect(h.notify.photosAdded).toHaveBeenCalledTimes(1);
  });

  it('survives worker restart and only dispatches the explicitly queued batch', async () => {
    const h = harness(); h.addPhoto('old'); h.addPhoto('new');
    await h.service.enqueue(orderId, 'new');
    const restarted = new PhotoNotificationsService(h.prisma as never, h.notify as never);
    now += PHOTO_NOTIFICATION_DEBOUNCE_MS;
    await restarted.tick();
    expect(h.notify.photosAdded).toHaveBeenCalledTimes(1);
    expect(h.row().recentClaimedIds).toEqual(['new']);
  });

  it('manual flush, automatic flush, and repeated callbacks share one claim', async () => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new');
    now += PHOTO_NOTIFICATION_DEBOUNCE_MS;
    const results = await Promise.all([h.service.flush(orderId), h.service.flush(orderId, false), h.service.flush(orderId)]);
    expect(results.filter((result) => result.sent)).toHaveLength(1);
    expect(h.notify.photosAdded).toHaveBeenCalledTimes(1);
    expect((await h.service.flush(orderId)).error).toBe('already_processed');
    expect((await h.service.enqueue(orderId, 'new')).queued).toBe(false);
  });

  it('does not send old galleries on startup, manual flush, or read-only status', async () => {
    const h = harness(); h.addPhoto('old');
    await h.service.tick();
    expect(await h.service.flush(orderId)).toEqual({ sent: false, error: 'no_new_photos' });
    expect(await h.service.status(orderId)).toEqual({ pendingPhotos: 0, processing: false, dueAt: null, lastOutcome: null });
    expect(h.prisma.setting.upsert).not.toHaveBeenCalled();
    expect(h.prisma.$executeRaw).not.toHaveBeenCalled();
    expect(h.notify.photosAdded).not.toHaveBeenCalled();
  });

  it('excludes completed null-due rows so they cannot starve a later pending batch', async () => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new');
    for (let i = 0; i < 30; i++) h.rows.set(`${PHOTO_NOTIFICATION_PREFIX}a-${i}`, {
      key: `${PHOTO_NOTIFICATION_PREFIX}a-${i}`, value: { dueAt: null },
    });
    now += PHOTO_NOTIFICATION_DEBOUNCE_MS;
    await h.service.tick();
    expect(h.prisma.setting.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ value: { path: ['dueAt'], gte: 0, lte: now } }),
    }));
    expect(h.notify.photosAdded).toHaveBeenCalledTimes(1);
  });

  it('reloads the current recipient and vehicle at dispatch rather than queue time', async () => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new');
    h.setOrder({ trackingCode: 'UPDATED', customer: { phone: '0707654321' }, vehicle: { make: 'Toyota', model: 'Camry' } });
    await h.service.flush(orderId);
    expect(h.notify.photosAdded).toHaveBeenCalledWith({ phone: '0707654321', trackingCode: 'UPDATED', make: 'Toyota', model: 'Camry' });
    expect(JSON.stringify(h.row())).not.toContain('0707654321');
  });

  it('skips a batch whose photos were pruned or became pending', async () => {
    const h = harness(); h.addPhoto('removed'); h.addPhoto('pending');
    await h.service.enqueue(orderId, 'removed'); await h.service.enqueue(orderId, 'pending');
    h.photos.delete('removed'); h.photos.get('pending')!.url = 'pending';
    expect((await h.service.flush(orderId)).error).toBe('no_new_photos');
    expect(h.row().last.outcome).toBe('skipped');
    expect(h.notify.photosAdded).not.toHaveBeenCalled();
  });

  it('removes an orphan queue without sending after its order is deleted', async () => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new'); h.setOrder(null);
    expect((await h.service.flush(orderId)).sent).toBe(false);
    expect(h.rows.size).toBe(0);
    expect(h.notify.photosAdded).not.toHaveBeenCalled();
  });

  it('retains newer uploads queued while an earlier provider request is in progress', async () => {
    const h = harness(); h.addPhoto('first'); await h.service.enqueue(orderId, 'first');
    let resolve!: (value: any) => void;
    h.notify.photosAdded.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const first = h.service.flush(orderId);
    while (!resolve) await Promise.resolve();
    h.addPhoto('second'); await h.service.enqueue(orderId, 'second');
    expect((await h.service.flush(orderId)).error).toBe('in_progress');
    resolve({ sent: true, channel: 'whatsapp' }); await first;
    expect(h.row().pendingIds).toEqual(['second']);
    now += PHOTO_NOTIFICATION_DEBOUNCE_MS;
    await h.service.tick();
    expect(h.notify.photosAdded).toHaveBeenCalledTimes(2);
    expect(h.row().recentClaimedIds).toEqual(['first', 'second']);
  });

  it.each([{ sent: false, error: 'provider_uncertain' }, { sent: false, error: 'provider_rejected' }, { sent: false, error: 'no_phone' }])('never retries already claimed photos after %j', async (result) => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new');
    h.notify.photosAdded.mockResolvedValueOnce(result as never);
    expect(await h.service.flush(orderId)).toEqual(result);
    now += 300_000; await h.service.tick(); await h.service.flush(orderId);
    expect(h.notify.photosAdded).toHaveBeenCalledTimes(1);
  });

  it('claims before external I/O and never retries if outcome recording fails', async () => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new');
    h.notify.photosAdded.mockImplementationOnce(async () => {
      expect(h.row().pendingIds).toEqual([]);
      expect(h.row().active.id).toBeTruthy();
      h.prisma.auditLog.create.mockRejectedValueOnce(new Error('private provider/phone data'));
      return { sent: true, channel: 'whatsapp' };
    });
    expect((await h.service.flush(orderId)).sent).toBe(true);
    now += 300_000; await h.service.tick(); await h.service.flush(orderId);
    expect(h.notify.photosAdded).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(expect.not.stringContaining('private provider/phone data'));
  });

  it('does not send if claiming/auditing fails before commit', async () => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new');
    h.prisma.auditLog.create.mockRejectedValueOnce(new Error('database down'));
    await expect(h.service.flush(orderId)).rejects.toThrow();
    expect(h.row().pendingIds).toEqual(['new']);
    expect(h.notify.photosAdded).not.toHaveBeenCalled();
  });

  it('sanitizes persisted outcome metadata and never logs a raw provider exception', async () => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new');
    h.notify.photosAdded.mockRejectedValueOnce(new Error('SECRET +994501234567 private text'));
    await h.service.flush(orderId);
    expect(h.row().last.outcome).toBe('unknown');
    expect(JSON.stringify(h.prisma.auditLog.create.mock.calls)).not.toContain('SECRET');
    expect(warning).not.toHaveBeenCalled();
  });

  it('keeps safe per-channel failure evidence even when the other channel is accepted', async () => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new');
    h.notify.photosAdded.mockResolvedValueOnce({
      sent: true, channel: 'whatsapp', channelResults: {
        whatsapp: { sent: true, outcome: 'accepted' }, sms: { sent: false, outcome: 'failed', error: 'sms_not_configured' },
      },
    } as never);
    await h.service.flush(orderId);
    expect(h.prisma.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      meta: expect.objectContaining({ notify: expect.objectContaining({ channelResults: {
        whatsapp: { sent: true, outcome: 'accepted' }, sms: { sent: false, outcome: 'failed', error: 'sms_not_configured' },
      } }) }),
    }) }));
  });

  it.each([{ dueAt: 'yesterday' }, { firstQueuedAt: -1 }, { active: { id: 'claim', startedAt: 'bad' } }, { last: { outcome: 'accepted', at: 1, count: -1 } }])('fails closed for corrupted private batch state %j', async (bad) => {
    const h = harness(); h.addPhoto('new'); await h.service.enqueue(orderId, 'new');
    Object.assign(h.rows.get(key)!.value, bad);
    await expect(h.service.flush(orderId)).rejects.toThrow();
    expect(h.notify.photosAdded).not.toHaveBeenCalled();
  });

  it('fails explicitly at its bounded ID limit without silently dropping any queued image', async () => {
    const h = harness(); h.addPhoto('first'); await h.service.enqueue(orderId, 'first');
    const batch = h.rows.get(key)!;
    batch.value.pendingIds = Array.from({ length: PHOTO_NOTIFICATION_MAX_IDS }, (_, i) => `photo-${i}`);
    h.addPhoto('overflow');
    await expect(h.service.enqueue(orderId, 'overflow')).rejects.toThrow('batch is full');
    expect(h.row().pendingIds).toHaveLength(PHOTO_NOTIFICATION_MAX_IDS);
    expect(h.row().pendingIds).not.toContain('overflow');
  });

  it('clears its unrefed lifecycle timer without sending or touching customer data', async () => {
    jest.useFakeTimers();
    try {
      const h = harness(); h.service.onModuleInit();
      expect(jest.getTimerCount()).toBe(1);
      await h.service.onModuleDestroy();
      expect(jest.getTimerCount()).toBe(0);
      expect(h.notify.photosAdded).not.toHaveBeenCalled();
      expect(h.prisma.setting.findMany).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });
});
