import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryStorage } from '../storage/cloudinary.storage';

describe('Order photo uploads', () => {
  it('preserves a large gallery and returns the exact newly uploaded ID', async () => {
    const photos = Array.from({ length: 60 }, (_, index) => ({ id: `photo-${index}`, url: 'https://example.com/car.jpg', category: 'auction' }));
    const order = { id: 'order', vin: 'VIN', trackingCode: 'TRACK', customer: { name: 'Customer' }, invoices: [], documents: [], events: [], photos };
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order), findUniqueOrThrow: jest.fn(async () => order) },
      orderPhoto: { create: jest.fn(async ({ data }) => { const row = { ...data, id: 'new-photo' }; photos.push(row); return row; }) },
    };
    const cloud = { isEnabled: jest.fn().mockResolvedValue(false) };
    const service = new OrdersService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never, cloud as unknown as CloudinaryStorage);
    const result = await service.addPhoto('order', { url: `data:image/jpeg;base64,${Buffer.alloc(300_000, 1).toString('base64')}`, category: 'engine' });
    expect(result.uploadedPhotoId).toBe('new-photo');
    expect(result.photos).toHaveLength(61);
    expect(result.photos.find((photo) => photo.id === result.uploadedPhotoId)).toMatchObject({ category: 'engine', url: '/api/v1/media/photos/new-photo' });
  });
});
