import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryStorage } from '../storage/cloudinary.storage';
import { Logger } from '@nestjs/common';

function uploadHarness(cloudEnabled = false) {
  const photos: any[] = [];
  const order = { id: 'order', vin: 'VIN', trackingCode: 'TRACK', customer: { name: 'Customer' }, invoices: [], documents: [], events: [], photos };
  const prisma = {
    order: { findUnique: jest.fn(async () => order), findUniqueOrThrow: jest.fn(async () => order) },
    orderPhoto: {
      create: jest.fn(async ({ data }) => { const row = { ...data, id: 'new-photo' }; photos.push(row); return row; }),
      update: jest.fn(async ({ where, data }) => { const row = photos.find((photo) => photo.id === where.id); Object.assign(row, data); return row; }),
      findMany: jest.fn(async () => photos), deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  const cloud = { isEnabled: jest.fn(async () => cloudEnabled), put: jest.fn(async () => 'https://example.com/saved.jpg'), remove: jest.fn() };
  const queue = {
    enqueue: jest.fn(async () => {
      expect(photos[0].url).not.toBe('pending');
      return { queued: true, pendingPhotos: 1, dueAt: '2026-11-09T00:00:45.000Z' };
    }),
    flush: jest.fn(async () => ({ sent: true, channel: 'whatsapp' })),
  };
  const notify = { customerUpdate: jest.fn() };
  const service = new OrdersService(prisma as never, {} as never, {} as never, notify as never, cloud as never, queue as never);
  return { service, prisma, cloud, queue, photos, notify };
}

describe('Order photo uploads', () => {
  it('preserves a large gallery and returns the exact newly uploaded ID', async () => {
    const photos = Array.from({ length: 60 }, (_, index) => ({ id: `photo-${index}`, url: 'https://example.com/car.jpg', category: 'auction' }));
    const order = { id: 'order', vin: 'VIN', trackingCode: 'TRACK', customer: { name: 'Customer' }, invoices: [], documents: [], events: [], photos };
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order), findUniqueOrThrow: jest.fn(async () => order) },
      orderPhoto: { create: jest.fn(async ({ data }) => { const row = { ...data, id: 'new-photo' }; photos.push(row); return row; }) },
    };
    const cloud = { isEnabled: jest.fn().mockResolvedValue(false) };
    const queue = { enqueue: jest.fn().mockResolvedValue({ queued: true }) };
    const service = new OrdersService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never, cloud as unknown as CloudinaryStorage, queue as never);
    const result = await service.addPhoto('order', { url: `data:image/jpeg;base64,${Buffer.alloc(300_000, 1).toString('base64')}`, category: 'engine' });
    expect(result.uploadedPhotoId).toBe('new-photo');
    expect(result.photos).toHaveLength(61);
    expect(result.photos.find((photo) => photo.id === result.uploadedPhotoId)).toMatchObject({ category: 'engine', url: '/api/v1/media/photos/new-photo' });
    expect(result.photoNotification).toEqual({ queued: true });
    expect(queue.enqueue).toHaveBeenCalledWith('order', 'new-photo');
  });

  it('enqueues only after successful cloud storage has replaced its pending URL', async () => {
    const h = uploadHarness(true);
    const saved = await h.service.addPhoto('order', { url: 'data:image/jpeg;base64,AQID', category: 'engine' });
    expect(h.photos[0].url).toBe('https://example.com/saved.jpg');
    expect(h.queue.enqueue).toHaveBeenCalledWith('order', 'new-photo');
    expect(saved.photoNotification.queued).toBe(true);
  });

  it('still queues an uploaded photo when cloud failure falls back to persisted database storage', async () => {
    const h = uploadHarness(true);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      h.cloud.put.mockRejectedValueOnce(new Error('storage failed'));
      const saved = await h.service.addPhoto('order', { url: 'data:image/jpeg;base64,AQID' });
      expect(h.photos[0].url).toBe('data:image/jpeg;base64,AQID');
      expect(saved.photoNotification.queued).toBe(true);
    } finally { error.mockRestore(); }
  });

  it('retains a committed photo and reports enqueue_failed if the notification database fails', async () => {
    const h = uploadHarness();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      h.queue.enqueue.mockRejectedValueOnce(new Error('private database details'));
      const saved = await h.service.addPhoto('order', { url: 'data:image/jpeg;base64,AQID' });
      expect(saved.uploadedPhotoId).toBe('new-photo');
      expect(saved.photoNotification).toEqual({ queued: false, error: 'enqueue_failed' });
      expect(h.photos).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(expect.not.stringContaining('private database details'));
    } finally { warn.mockRestore(); }
  });

  it('does not enqueue invalid uploads or prune-only saves', async () => {
    const h = uploadHarness();
    await expect(h.service.addPhoto('order', { url: 'not-an-image' })).rejects.toThrow();
    await h.service.prunePhotos('order');
    expect(h.queue.enqueue).not.toHaveBeenCalled();
    expect(h.queue.flush).not.toHaveBeenCalled();
  });

  it('routes manual photo messages through the same pending-only claim without calling legacy customerUpdate', async () => {
    const h = uploadHarness();
    await h.service.sendCustomerSms('order', { kind: 'photos' }, 'admin');
    expect(h.queue.flush).toHaveBeenCalledWith('order', true, 'admin');
    expect(h.notify.customerUpdate).not.toHaveBeenCalled();
  });
});
