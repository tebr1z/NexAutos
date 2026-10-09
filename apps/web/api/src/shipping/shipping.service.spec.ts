import { PrismaService } from '../prisma/prisma.service';
import { ShippingService } from './shipping.service';
import { bandForPrice } from './zones';

describe('ShippingService', () => {
  function service(cells: Record<string, number | null>) {
    const prisma = {
      setting: {
        findUnique: jest.fn().mockResolvedValue({ value: { tirUsd: 200, cells } }),
      },
    } as unknown as PrismaService;
    return new ShippingService(prisma);
  }

  const quote = {
    priceUsd: 5000,
    auction: 'IAAI',
    state: 'GA',
    yard: 'Savannah (GA)',
    titleKind: 'SALVAGE',
  };

  it('uses a yard-specific rate when it exists', async () => {
    const result = await service({
      'GA:IAAI:b': 270,
      'GA:IAAI:savannah:b': 315,
    }).quote(quote);

    expect(result.oceanUsd).toBe(315);
    expect(result.rateSource).toBe('yard');
  });

  it('falls back to the legacy state rate', async () => {
    const result = await service({ 'GA:IAAI:b': 270 }).quote(quote);

    expect(result.oceanUsd).toBe(270);
    expect(result.freightUsd).toBe(470);
    expect(result.rateSource).toBe('state');
    expect(result.cellKey).toBe('GA:IAAI:savannah:b');
  });

  it('uses exactly three price bands and preserves the old upper-band rate', async () => {
    expect(bandForPrice(0).id).toBe('a');
    expect(bandForPrice(3000).id).toBe('a');
    expect(bandForPrice(3001).id).toBe('b');
    expect(bandForPrice(7000).id).toBe('b');
    expect(bandForPrice(7001).id).toBe('c');
    expect(bandForPrice(150000).id).toBe('c');

    const result = await service({ 'GA:IAAI:d': 490 }).quote({ ...quote, priceUsd: 20000 });
    expect(result.band.id).toBe('c');
    expect(result.oceanUsd).toBe(490);
  });
});
