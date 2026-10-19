import { ForbiddenException } from '@nestjs/common';
import { CalculatorService, accessExpired, adjustedFreight, usageMonth } from './calculator.service';
import { PrismaService } from '../prisma/prisma.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CalculatorPlanDto, PricingDto } from './dto';

const plan = { monthlyLimit: 1 as number | null, allowSelfPricing: false, accessUntil: null as string | null, profitMarginUsd: 0, surchargeAUsd: 0, surchargeBUsd: 0, surchargeCUsd: 0, discountAUsd: 0, discountBUsd: 50, discountCUsd: 200, potiBakuUsd: 0 };
const quote = { oceanUsd: 1640, tirUsd: 200, auctionFeeUsd: 1050, priceUsd: 7000, band: { id: 'c' }, missing: false };
function setup(used = 0, recent = false, customPlan: Partial<typeof plan> = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
    calculatorPlan: { findUnique: jest.fn().mockResolvedValue({ ...plan, ...customPlan }) },
    calculatorUse: { count: jest.fn().mockResolvedValue(used), findFirst: jest.fn().mockResolvedValue(recent ? { id: 'prior' } : null), create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = { $transaction: jest.fn((cb) => cb(tx)) } as unknown as PrismaService;
  return { service: new CalculatorService(prisma), tx };
}
describe('Calculator account pricing and quota', () => {
  it('switches month at midnight Baku time', () => {
    expect(usageMonth(new Date('2026-10-31T19:59:59Z'))).toBe('2026-10');
    expect(usageMonth(new Date('2026-10-31T20:00:00Z'))).toBe('2026-11');
  });
  it('applies the matching discount and permits zero Poti–Baku', async () => {
    const { service, tx } = setup();
    const result = await service.finalize(quote, 'user', { price: 7000 });
    expect(result).toMatchObject({ oceanUsd: 1440, tirUsd: 0, freightUsd: 1440, totalUsd: 2490, discountUsd: 200, usage: { used: 1, remaining: 0 } });
    expect(tx.calculatorUse.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalled();
  });
  it('rejects a different calculation once the limit is used', async () => {
    const { service, tx } = setup(1);
    await expect(service.finalize(quote, 'user', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.calculatorUse.create).not.toHaveBeenCalled();
  });
  it('allows a recent repeat without charging at the limit', async () => {
    const { service, tx } = setup(1, true);
    expect(await service.finalize(quote, 'user', {})).toMatchObject({ usage: { used: 1 } });
    expect(tx.calculatorUse.create).not.toHaveBeenCalled();
  });
  it('does not charge for missing tariffs', async () => {
    const { service, tx } = setup();
    await service.finalize({ ...quote, oceanUsd: null, missing: true }, 'user', {});
    expect(tx.calculatorUse.create).not.toHaveBeenCalled();
  });
  it('supports unlimited accounts and blocks zero-limit accounts', async () => {
    await expect(setup(5000, false, { monthlyLimit: null }).service.finalize(quote, 'user', {})).resolves.toMatchObject({ usage: { remaining: null } });
    await expect(setup(0, false, { monthlyLimit: 0 }).service.finalize(quote, 'user', {})).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('caps discounts at freight and supports a markup', () => {
    expect(adjustedFreight(100, 200, 500, null)).toMatchObject({ oceanUsd: 0, tirUsd: 200, discountUsd: 100, freightUsd: 200 });
    expect(adjustedFreight(100, 200, -50, null).freightUsd).toBe(350);
  });
  it('does not accept quota or permission fields from self-service requests', async () => {
    const dto = plainToInstance(PricingDto, { monthlyLimit: null, allowSelfPricing: true, accessUntil: null, surchargeAUsd: 0, potiBakuUsd: 0 });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((e) => e.property).sort()).toEqual(['accessUntil', 'allowSelfPricing', 'monthlyLimit', 'potiBakuUsd', 'surchargeAUsd']);
  });
  it('enforces self-pricing permission again on the server', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), calculatorPlan: { findUnique: jest.fn().mockResolvedValue(plan), upsert: jest.fn() } };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ role: 'FREIGHT_USER' }) }, $transaction: jest.fn((cb) => cb(tx)) } as unknown as PrismaService;
    await expect(new CalculatorService(prisma).save('user', { discountAUsd: 50 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.calculatorPlan.upsert).not.toHaveBeenCalled();
  });
  it('saves allowed personal pricing without altering quota fields', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), calculatorPlan: { findUnique: jest.fn().mockResolvedValue({ ...plan, allowSelfPricing: true }), upsert: jest.fn().mockResolvedValue({}) } };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ role: 'FREIGHT_USER' }) }, $transaction: jest.fn((cb) => cb(tx)) } as unknown as PrismaService;
    const service = new CalculatorService(prisma);
    jest.spyOn(service, 'profile').mockResolvedValue({ ...plan, expired: false, accessMessage: null, allowSelfPricing: true, month: '2026-10', used: 0, remaining: 1, canManageRates: false });
    await service.save('user', { discountAUsd: 50, profitMarginUsd: 10 });
    expect(tx.calculatorPlan.upsert).toHaveBeenCalledWith({ where: { userId: 'user' }, create: { userId: 'user', discountAUsd: 50, profitMarginUsd: 10 }, update: { discountAUsd: 50, profitMarginUsd: 10 } });
  });

  it('includes the selected end date until midnight Baku time', () => {
    expect(accessExpired('2026-10-30', new Date('2026-10-30T19:59:59Z'))).toBe(false);
    expect(accessExpired('2026-10-30', new Date('2026-10-30T20:00:00Z'))).toBe(true);
    expect(accessExpired(null)).toBe(false);
  });
  it('blocks expired accounts even with unlimited quota and a cached calculation', async () => {
    const { service, tx } = setup(0, true, { monthlyLimit: null, accessUntil: '2000-01-01' });
    await expect(service.finalize(quote, 'user', {})).rejects.toThrow('VexiraLabs');
    expect(tx.calculatorUse.create).not.toHaveBeenCalled();
  });
  it('adds the account-specific band surcharge and personal margin exactly once', async () => {
    for (const [id, extra] of [['a', 25], ['b', 50], ['c', 100]] as const) {
      const { service } = setup(0, false, { discountAUsd: 50, discountBUsd: 50, discountCUsd: 50, surchargeAUsd: 25, surchargeBUsd: 50, surchargeCUsd: 100, profitMarginUsd: 10 });
      const result = await service.finalize({ ...quote, band: { id } }, 'user', {});
      expect(result).toMatchObject({ surchargeUsd: extra, profitMarginUsd: 10, freightUsd: 1640 - 50 + extra + 10 });
    }
    expect(adjustedFreight(100, 200, 1000, null, 50, 10).freightUsd).toBe(260);
  });
  it('validates end dates and nonnegative margins', async () => {
    expect(await validate(plainToInstance(CalculatorPlanDto, { accessUntil: '2026-02-30' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(CalculatorPlanDto, { accessUntil: '2026-10-30' }))).toHaveLength(0);
    expect(await validate(plainToInstance(CalculatorPlanDto, { accessUntil: null }))).toHaveLength(0);
    expect(await validate(plainToInstance(PricingDto, { profitMarginUsd: -10 }))).not.toHaveLength(0);
  });
  it('does not apply one account margin to another account', async () => {
    const plans: Record<string, typeof plan> = {
      alice: { ...plan, monthlyLimit: null, profitMarginUsd: 10 },
      bob: { ...plan, monthlyLimit: null, profitMarginUsd: 0 },
    };
    const { tx } = setup();
    tx.calculatorPlan.findUnique.mockImplementation(async ({ where }: { where: { userId: string } }) => plans[where.userId]);
    const service = new CalculatorService({ $transaction: (cb: (value: typeof tx) => unknown) => cb(tx) } as unknown as PrismaService);
    const alice = await service.finalize(quote, 'alice', {});
    const bob = await service.finalize(quote, 'bob', {});
    expect(alice.freightUsd! - bob.freightUsd!).toBe(10);
    expect(bob.profitMarginUsd).toBe(0);
  });
  it('rejects self-service edits after expiry without writing the plan', async () => {
    const { tx } = setup(0, false, { accessUntil: '2000-01-01', allowSelfPricing: true });
    const upsert = jest.fn();
    const transaction = { ...tx, calculatorPlan: { ...tx.calculatorPlan, upsert } };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ role: 'FREIGHT_USER' }) }, $transaction: (cb: (value: typeof transaction) => unknown) => cb(transaction) } as unknown as PrismaService;
    await expect(new CalculatorService(prisma).save('alice', { profitMarginUsd: 10 })).rejects.toThrow('VexiraLabs');
    expect(upsert).not.toHaveBeenCalled();
  });
});
