import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { INTERNAL_ROLES, MANAGEMENT_ROLES } from '../common/access-roles';
import { BugReportDto, CalculatorPlanDto, PricingDto } from './dto';

const defaults = { monthlyLimit: null as number | null, allowSelfPricing: false, discountAUsd: 0, discountBUsd: 0, discountCUsd: 0, potiBakuUsd: null as number | null };
export function usageMonth(date = new Date()) {
  return new Date(date.getTime() + 4 * 3600000).toISOString().slice(0, 7);
}
export function adjustedFreight(ocean: number, tir: number, discount: number, override: number | null) {
  const oceanUsd = Math.max(0, Math.round((ocean - discount) * 100) / 100);
  return { oceanUsd, tirUsd: override ?? tir, discountUsd: ocean - oceanUsd, freightUsd: oceanUsd + (override ?? tir) };
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
    const settings = plan ?? defaults;
    return { ...settings, month, used, canManageRates: !!user && MANAGEMENT_ROLES.includes(user.role), remaining: settings.monthlyLimit == null ? null : Math.max(0, settings.monthlyLimit - used) };
  }

  async save(userId: string, dto: PricingDto | CalculatorPlanDto, actor?: { id: string; role: Role }) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target || !INTERNAL_ROLES.includes(target.role)) throw new NotFoundException('Hesab tapılmadı.');
    if (actor && target.role === 'SUPER_ADMIN' && actor.id !== userId) throw new ForbiddenException('Baş administrator hesabı qorunur.');
    if (actor && actor.role !== 'SUPER_ADMIN' && target.role === 'ADMIN' && actor.id !== userId) throw new ForbiddenException('Bu hesabı yalnız baş administrator dəyişə bilər.');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
      const current = await tx.calculatorPlan.findUnique({ where: { userId } });
      if (!actor && !current?.allowSelfPricing) throw new ForbiddenException('Fərdi qiymət dəyişmək üçün admin icazəsi lazımdır.');
      const data = { ...dto };
      for (const key of ['discountAUsd', 'discountBUsd', 'discountCUsd', 'allowSelfPricing'] as const) {
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
      const plan = await tx.calculatorPlan.findUnique({ where: { userId } }) ?? defaults;
      const month = usageMonth();
      const fingerprint = createHash('sha256').update(JSON.stringify([input, plan])).digest('hex');
      const recent = await tx.calculatorUse.findFirst({ where: { userId, month, fingerprint, createdAt: { gte: new Date(Date.now() - 600000) } } });
      let used = await tx.calculatorUse.count({ where: { userId, month } });
      if (!recent && plan.monthlyLimit != null && used >= plan.monthlyLimit) throw new ForbiddenException('Aylıq hesablama limitiniz bitib. Limiti artırmaq üçün Auto Nex ilə əlaqə saxlayın.');
      if (!quote.missing && quote.oceanUsd != null && !recent) {
        await tx.calculatorUse.create({ data: { userId, month, fingerprint } });
        used++;
      }
      const discount = quote.band.id === 'a' ? plan.discountAUsd : quote.band.id === 'b' ? plan.discountBUsd : plan.discountCUsd;
      const pricing = quote.oceanUsd == null ? null : adjustedFreight(quote.oceanUsd, quote.tirUsd, discount, plan.potiBakuUsd);
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
