import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FULL_ACCESS_ROLES, INTERNAL_ROLES } from '../common/access-roles';
import { BugReportDto, CalculatorPlanDto, PricingDto } from './dto';

const defaults = { monthlyLimit: null as number | null, allowSelfPricing: true, brandName: null as string | null, accessUntil: null as string | null, profitMarginUsd: 0, surchargeAUsd: 0, surchargeBUsd: 0, surchargeCUsd: 0, discountAUsd: 0, discountBUsd: 0, discountCUsd: 0, potiBakuUsd: null as number | null };
const EXPIRED_MESSAGE = 'Kalkulyatordan istifadə müddətiniz bitib. VexiraLabs ilə əlaqə qurun.';
export function accessExpired(accessUntil: string | null | undefined, date = new Date()) {
  return !!accessUntil && new Date(date.getTime() + 4 * 3600000).toISOString().slice(0, 10) > accessUntil;
}
export function usageMonth(date = new Date()) {
  return new Date(date.getTime() + 4 * 3600000).toISOString().slice(0, 7);
}
export function adjustedFreight(ocean: number, tir: number, discount: number, override: number | null, surcharge = 0, margin = 0) {
  const discounted = Math.max(0, Math.round((ocean - discount) * 100) / 100);
  const adjusted = Math.max(0, Math.round((discounted + surcharge) * 100) / 100);
  const oceanUsd = Math.round((adjusted + margin) * 100) / 100;
  return { oceanUsd, tirUsd: override ?? tir, discountUsd: Math.round((ocean - discounted) * 100) / 100,
    surchargeUsd: Math.round((adjusted - discounted) * 100) / 100, profitMarginUsd: margin, freightUsd: Math.round((oceanUsd + (override ?? tir)) * 100) / 100 };
}

@Injectable()
export class CalculatorService {
  constructor(private prisma: PrismaService) {}

  async profile(userId: string) {
    const month = usageMonth();
    const [plan, used, user] = await Promise.all([
      this.prisma.calculatorPlan.findUnique({ where: { userId } }),
      this.prisma.calculatorUse.count({ where: { userId, month } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);
    const settings = { ...defaults, ...plan };
    const expired = accessExpired(settings.accessUntil);
    return { ...settings, expired, accessMessage: expired ? EXPIRED_MESSAGE : null, month, used, canManageRates: !!user && FULL_ACCESS_ROLES.includes(user.role), remaining: settings.monthlyLimit == null ? null : Math.max(0, settings.monthlyLimit - used) };
  }

  async assertAccess(userId?: string) {
    if (!userId) return; // Internal collector has separate credentials, not a customer plan.
    const plan = await this.prisma.calculatorPlan.findUnique({ where: { userId } });
    if (accessExpired(plan?.accessUntil)) throw new ForbiddenException(EXPIRED_MESSAGE);
  }

  async save(userId: string, dto: PricingDto | CalculatorPlanDto, actor?: { id: string; role: Role }) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target || !INTERNAL_ROLES.includes(target.role)) throw new NotFoundException('Hesab tapılmadı.');
    if (actor && target.role === 'SUPER_ADMIN' && actor.id !== userId) throw new ForbiddenException('Baş administrator hesabı qorunur.');
    if (actor && actor.role !== 'SUPER_ADMIN' && target.role === 'ADMIN' && actor.id !== userId) throw new ForbiddenException('Bu hesabı yalnız baş administrator dəyişə bilər.');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
      const current = await tx.calculatorPlan.findUnique({ where: { userId } });
      if (!actor && accessExpired(current?.accessUntil)) throw new ForbiddenException(EXPIRED_MESSAGE);
      const data: CalculatorPlanDto = { ...dto };
      if (!actor && Object.keys(data).some((key) => !['brandName', 'discountAUsd', 'discountBUsd', 'discountCUsd', 'profitMarginUsd'].includes(key))) {
        throw new ForbiddenException('Bu ayarı yalnız administrator dəyişə bilər.');
      }
      const changesPersonalPricing = Object.keys(data).some((key) => ['discountAUsd', 'discountBUsd', 'discountCUsd', 'profitMarginUsd'].includes(key));
      if (!actor && changesPersonalPricing && !(current?.allowSelfPricing ?? defaults.allowSelfPricing)) throw new ForbiddenException('Fərdi qiymət dəyişmək üçün admin icazəsi lazımdır.');
      if ('brandName' in data) data.brandName = data.brandName?.replace(/\s+/g, ' ').trim() || null;
      for (const key of ['discountAUsd', 'discountBUsd', 'discountCUsd', 'profitMarginUsd', 'surchargeAUsd', 'surchargeBUsd', 'surchargeCUsd', 'allowSelfPricing'] as const) {
        if (key in data && data[key] === null) throw new BadRequestException('Endirim və icazə boş ola bilməz.');
      }
      await tx.calculatorPlan.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    });
    return this.profile(userId);
  }

  async finalize<T extends { oceanUsd: number | null; tirUsd: number; auctionFeeUsd: number; priceUsd: number; band: { id: string }; missing: boolean }>(quote: T, userId: string | undefined, input: unknown) {
    if (!userId) return { ...quote, pricingApplied: true }; // authenticated internal collector
    return this.prisma.$transaction(async (tx) => {
      // Serialize concurrent requests and admin edits for the same account.
      await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
      const plan = { ...defaults, ...await tx.calculatorPlan.findUnique({ where: { userId } }) };
      if (accessExpired(plan.accessUntil)) throw new ForbiddenException(EXPIRED_MESSAGE);
      const month = usageMonth();
      const fingerprint = createHash('sha256').update(JSON.stringify([input, plan])).digest('hex');
      const recent = await tx.calculatorUse.findFirst({ where: { userId, month, fingerprint, createdAt: { gte: new Date(Date.now() - 600000) } } });
      let used = await tx.calculatorUse.count({ where: { userId, month } });
      if (!recent && plan.monthlyLimit != null && used >= plan.monthlyLimit) throw new ForbiddenException('Aylıq hesablama limitiniz bitib. VexiraLabs ilə əlaqə qurun.');
      if (!quote.missing && quote.oceanUsd != null && !recent) {
        await tx.calculatorUse.create({ data: { userId, month, fingerprint } });
        used++;
      }
      const discount = quote.band.id === 'a' ? plan.discountAUsd : quote.band.id === 'b' ? plan.discountBUsd : plan.discountCUsd;
      const surcharge = quote.band.id === 'a' ? plan.surchargeAUsd : quote.band.id === 'b' ? plan.surchargeBUsd : plan.surchargeCUsd;
      const pricing = quote.oceanUsd == null ? null : adjustedFreight(quote.oceanUsd, quote.tirUsd, discount, plan.potiBakuUsd, surcharge, plan.profitMarginUsd);
      return { ...quote, ...pricing, baseOceanUsd: quote.oceanUsd, baseTirUsd: quote.tirUsd,
        totalUsd: pricing ? pricing.freightUsd + quote.auctionFeeUsd : null,
        pricingApplied: true, usage: { month, used, monthlyLimit: plan.monthlyLimit, remaining: plan.monthlyLimit == null ? null : Math.max(0, plan.monthlyLimit - used) } };
    });
  }

  report(userId: string, dto: BugReportDto) {
    const message = dto.message.trim();
    if (message.length < 5) throw new BadRequestException('Xətanı ən azı 5 simvolla izah edin.');
    return this.prisma.calculatorBugReport.create({ data: { userId, message, pageUrl: dto.pageUrl, version: dto.version } });
  }
  reports() {
    return this.prisma.calculatorBugReport.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { user: { select: { name: true, email: true } } } });
  }
  resolve(id: string, status: string) {
    return this.prisma.calculatorBugReport.update({ where: { id }, data: { status } });
  }
}
