import { PrismaService } from '../prisma/prisma.service';
import { ShippingService } from './shipping.service';

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
});
