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
    expect(bandForPrice(3000.50).id).toBe('b');
    expect(bandForPrice(7000).id).toBe('b');
    expect(bandForPrice(7001).id).toBe('c');
    expect(bandForPrice(150000).id).toBe('c');

    const result = await service({ 'GA:IAAI:d': 490 }).quote({ ...quote, priceUsd: 20000 });
    expect(result.band.id).toBe('c');
    expect(result.oceanUsd).toBe(490);
  });

  it('returns a yard catalog filtered by auction and state', async () => {
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

  it('shows all states separately per auction, including missing and partial tariffs', async () => {
    const result = await service({
      'GA:IAAI:savannah:a': 1500,
      'FL:COPART:a': 1600, 'FL:COPART:b': 1650, 'FL:COPART:c': 1800,
      'CA:IAAI:los-angeles:a': null,
    }, { 'CA:IAAI:los-angeles': 'Los Angeles' }).overview();
    expect(result.groups).toHaveLength(102);
    expect(result.groups.find((row) => row.state === 'GA' && row.auction === 'IAAI')).toMatchObject({ missing: false, incomplete: 1 });
    expect(result.groups.find((row) => row.state === 'GA' && row.auction === 'COPART')).toMatchObject({ missing: true });
    expect(result.groups.find((row) => row.state === 'FL' && row.auction === 'COPART')).toMatchObject({
      missing: false, incomplete: 0, rows: [{ key: 'FL:COPART', slug: '', rates: { a: 1600, b: 1650, c: 1800 } }],
    });
    expect(result.groups.find((row) => row.state === 'CA' && row.auction === 'IAAI')).toMatchObject({
      missing: true, rows: [{ yard: 'Los Angeles' }],
    });
  });

  it('rejects invalid manual tariff keys and values', async () => {
    for (const cells of [{ 'ZZ:IAAI:a': 100 }, { 'GA:OTHER:a': 100 }, { 'GA:IAAI:d': 100 }, { 'GA:IAAI:a': -1 }, { 'GA:IAAI:a': NaN }]) {
      await expect(service({}).saveRates({ cells })).rejects.toThrow('Tarif üçün');
    }
  });

  it('persists manual tariffs without resetting other auctions or Poti–Baku', async () => {
    const prisma = { setting: {
      findUnique: jest.fn().mockResolvedValue({ value: { tirUsd: 250, cells: { 'GA:COPART:a': 1900 }, yards: {}, seedVersion: 'test' } }),
      upsert: jest.fn(),
    } };
    const shipping = new ShippingService(prisma as unknown as PrismaService);
    const saved = await shipping.saveRates({ cells: { 'GA:IAAI:savannah:a': 1500, 'GA:IAAI:savannah:b': 1550, 'GA:IAAI:savannah:c': 1700 } });
    expect(saved.tirUsd).toBe(250);
    expect(saved.cells['GA:COPART:a']).toBe(1900);
    prisma.setting.findUnique.mockResolvedValue({ value: saved });
    const quoted = await shipping.quote({ ...quote, priceUsd: 7000, auctionFeeUsd: 1050 });
    expect(quoted.oceanUsd).toBe(1700);
    expect(quoted.freightUsd).toBe(1950);
    expect(prisma.setting.upsert).toHaveBeenCalled();
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
