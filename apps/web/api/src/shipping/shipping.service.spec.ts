import { PrismaService } from '../prisma/prisma.service';
import { ShippingService } from './shipping.service';
import { bandForPrice } from './zones';

describe('ShippingService', () => {
  function service(cells: Record<string, number | null>, yards: Record<string, string> = {}) {
    const prisma = {
      setting: {
        findUnique: jest.fn().mockResolvedValue({ value: { tirUsd: 200, cells, yards, seedVersion: 'test' } }),
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

  it('selects the freight band from vehicle price plus auction fee', async () => {
    const result = await service({
      'GA:IAAI:b': 1290,
      'GA:IAAI:c': 1440,
    }).quote({ ...quote, priceUsd: 7000, auctionFeeUsd: 1050 });

    expect(result.invoiceUsd).toBe(8050);
    expect(result.bandBasisUsd).toBe(8050);
    expect(result.band.id).toBe('c');
    expect(result.oceanUsd).toBe(1440);
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

  it('returns a public yard catalog filtered by auction and state', async () => {
    const result = await service(
      {
        'GA:IAAI:savannah:a': 1240,
        'GA:IAAI:savannah:b': 1290,
        'GA:IAAI:savannah:c': 1440,
        'GA:COPART:savannah:a': 1339,
      },
      { 'GA:IAAI:savannah': 'Savannah' },
    ).catalog('IAAI', 'GA');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      auction: 'IAAI',
      state: 'GA',
      yard: 'Savannah',
      rates: { a: 1240, b: 1290, c: 1440 },
    });
    expect(result.tirUsd).toBe(200);
  });

  it('matches a BidCars directional yard to the seeded base yard', async () => {
    const result = await service(
      {
        'FL:IAAI:orlando:a': 1583,
        'FL:IAAI:orlando:b': 1633,
        'FL:IAAI:orlando:c': 1783,
        'FL:IAAI:orlando-north:c': 1802,
      },
      {
        'FL:IAAI:orlando': 'Orlando',
        'FL:IAAI:orlando-north': 'Orlando-North',
      },
    ).quote({
      priceUsd: 8000,
      auction: 'IAAI',
      state: 'FL',
      yard: 'Orlando South (FL)',
      titleKind: 'SALVAGE',
    });

    expect(result.oceanUsd).toBe(1783);
    expect(result.rateSource).toBe('yard-alias');
    expect(result.matchedYard).toBe('Orlando');
    expect(result.missing).toBe(false);
  });
});
