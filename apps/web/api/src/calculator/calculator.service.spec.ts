import { ForbiddenException } from '@nestjs/common';
import { CalculatorService, adjustedFreight, usageMonth } from './calculator.service';
import { PrismaService } from '../prisma/prisma.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PricingDto } from './dto';

const plan = { monthlyLimit: 1 as number | null, allowSelfPricing: false, discountAUsd: 0, discountBUsd: 50, discountCUsd: 200, potiBakuUsd: 0 };
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
    expect(adjustedFreight(100, 200, 500, null)).toEqual({ oceanUsd: 0, tirUsd: 200, discountUsd: 100, freightUsd: 200 });
    expect(adjustedFreight(100, 200, -50, null).freightUsd).toBe(350);
  });
  it('does not accept quota or permission fields from self-service requests', async () => {
    const dto = plainToInstance(PricingDto, { monthlyLimit: null, allowSelfPricing: true });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((e) => e.property).sort()).toEqual(['allowSelfPricing', 'monthlyLimit']);
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
    jest.spyOn(service, 'profile').mockResolvedValue({ ...plan, userId: 'user', allowSelfPricing: true, month: '2026-10', used: 0, remaining: 1, canManageRates: false });
    await service.save('user', { discountAUsd: 50, potiBakuUsd: 0 });
    expect(tx.calculatorPlan.upsert).toHaveBeenCalledWith({ where: { userId: 'user' }, create: { userId: 'user', discountAUsd: 50, potiBakuUsd: 0 }, update: { discountAUsd: 50, potiBakuUsd: 0 } });
  });
});
