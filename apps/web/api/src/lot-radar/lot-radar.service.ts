import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, type LotWatch } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotifyService, normalizePhone } from '../notify/notify.service';
import { CreateWatchDto, BrowserBatchDto, RadarPlanDto } from './dto';
import { blocked, listingLinks, matches, parseLot, radarMessage, RadarFilters, RadarLot, searchUrl } from './lot';
import { fetchRadarFeed } from './feed';

export const radarMonth = (date = new Date()) => new Date(date.getTime() + 4 * 3600000).toISOString().slice(0, 7);
const defaultPlan = { enabled: false, watchLimit: 3, monthlyAlertLimit: 100 };

@Injectable()
export class LotRadarService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly log = new Logger(LotRadarService.name);
  constructor(private db: PrismaService, private notify: NotifyService) {}
  onModuleInit() {
    if (process.env.LOT_RADAR_ENABLED !== 'true') return;
    this.timer = setInterval(() => void this.tick().catch(() => this.log.warn('Lot Radar yoxlaması alınmadı; DB/migrasiyanı yoxlayın.')), 60000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async plan(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!user) throw new NotFoundException('İstifadəçi tapılmadı.');
    const month = radarMonth();
    const [plan, usage, active] = await Promise.all([
      this.db.radarPlan.findUnique({ where: { userId } }),
      this.db.radarUsage.findUnique({ where: { userId_month: { userId, month } } }),
      this.db.lotWatch.count({ where: { userId, enabled: true } }),
    ]);
    const p = plan || defaultPlan;
    return { ...p, month, used: usage?.used || 0, remaining: Math.max(0, p.monthlyAlertLimit - (usage?.used || 0)), active, phone: user.phone };
  }
  async savePlan(userId: string, dto: RadarPlanDto) {
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (!await tx.user.findUnique({ where: { id: userId } })) throw new NotFoundException('İstifadəçi tapılmadı.');
      await tx.radarPlan.upsert({ where: { userId }, create: { userId, ...dto }, update: dto });
      const excess = await tx.lotWatch.findMany({ where: { userId, enabled: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: dto.enabled ? dto.watchLimit : 0, select: { id: true } });
      if (excess.length) await tx.lotWatch.updateMany({ where: { id: { in: excess.map(w => w.id) } }, data: { enabled: false, leaseUntil: null } });
    });
    return this.plan(userId);
  }
  private async checkPlan(userId: string) {
    const plan = await this.db.radarPlan.findUnique({ where: { userId } }) || defaultPlan;
    if (!plan.enabled || plan.watchLimit === 0) throw new ForbiddenException('Lot Radar admin tərəfindən dayandırılıb.');
    return plan;
  }
  private async own(userId: string, id: string) {
    const watch = await this.db.lotWatch.findFirst({ where: { id, userId } });
    if (!watch) throw new NotFoundException('Axtarış tapılmadı.'); return watch;
  }
  async list(userId: string) {
    const [watches, user, plan] = await Promise.all([
      this.db.lotWatch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { lots: { where: { isAlert: true } } } } } }),
      this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, phone: true } }),
      this.plan(userId),
    ]);
    return { plan, watches: watches.map(w => ({ ...w, searchUrl: searchUrl(w.filters as RadarFilters) })),
      delivery: { email: user.email, phone: user.phone, emailReady: !!process.env.SMTP_HOST, whatsappReady: !!(process.env.VEXIRA_WHATSAPP_KEY || process.env.WHATSAPP_API_KEY || (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) || (process.env.TWILIO_WHATSAPP_FROM && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)), serverMonitoring: process.env.LOT_RADAR_ENABLED === 'true' } };
  }
  async create(userId: string, dto: CreateWatchDto) {
    if (dto.yearFrom > dto.yearTo || (dto.engineMin && dto.engineMax && dto.engineMin > dto.engineMax)) throw new BadRequestException('Başlanğıc aralıq son dəyərdən böyük ola bilməz.');
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (dto.whatsappEnabled && !normalizePhone(user.phone)) throw new BadRequestException('WhatsApp üçün hesab profilinizdə düzgün telefon nömrəsi olmalıdır.');
    const { name, emailEnabled, whatsappEnabled, ...filters } = dto;
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const plan = await tx.radarPlan.findUnique({ where: { userId } }) || defaultPlan;
      if (!plan.enabled) throw new ForbiddenException('Lot Radar admin tərəfindən dayandırılıb.');
      if (await tx.lotWatch.count({ where: { userId, enabled: true } }) >= plan.watchLimit) throw new ForbiddenException(`Aktiv axtarış limitiniz ${plan.watchLimit}-dir. Adminlə əlaqə saxlayın.`);
      if (await tx.lotWatch.count({ where: { userId } }) >= 100) throw new BadRequestException('100 saxlanmış axtarış həddi dolub. Köhnə axtarışı silin.');
      return tx.lotWatch.create({ data: { userId, name: name.trim(), emailEnabled, whatsappEnabled, filters: filters as unknown as Prisma.InputJsonValue } });
    });
  }
  async toggle(userId: string, id: string, enabled: boolean) {
    await this.own(userId, id);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const plan = await tx.radarPlan.findUnique({ where: { userId } }) || defaultPlan;
      if (enabled && (!plan.enabled || await tx.lotWatch.count({ where: { userId, enabled: true, id: { not: id } } }) >= plan.watchLimit)) throw new ForbiddenException('Aktiv axtarış limiti dolub və ya xidmət dayandırılıb.');
      return tx.lotWatch.update({ where: { id }, data: { enabled, ...(!enabled ? { leaseUntil: null } : {}) } });
    });
  }
  async remove(userId: string, id: string) { await this.own(userId, id); await this.db.lotWatch.delete({ where: { id } }); return { removed: true }; }
  async inbox(userId: string) {
    return this.db.lotWatchLot.findMany({ where: { watch: { userId }, isAlert: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100, include: { watch: { select: { name: true } } } });
  }
  async read(userId: string, id: string) {
    await this.db.lotWatchLot.updateMany({ where: { id, watch: { userId } }, data: { readAt: new Date() } }); return { ok: true };
  }
  private async acquire(watch: LotWatch) {
    await this.checkPlan(watch.userId);
    if (!watch.enabled) throw new BadRequestException('Axtarış dayandırılıb.');
    const lease = new Date(Date.now() + 20 * 60000);
    const result = await this.db.lotWatch.updateMany({ where: { id: watch.id, enabled: true, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { leaseUntil: lease } });
    if (!result.count) throw new ConflictException('Bu axtarış artıq yoxlanır.');
    return lease;
  }
  async begin(userId: string, id: string) {
    const watch = await this.own(userId, id);
    if (watch.checkedAt && Date.now() - watch.checkedAt.getTime() < 60000) throw new ConflictException('Növbəti yoxlama üçün bir dəqiqə gözləyin.');
    const lease = await this.acquire(watch);
    const seen = await this.db.lotWatchLot.findMany({ where: { watchId: id }, select: { lotKey: true }, orderBy: { createdAt: 'desc' }, take: 10000 });
    return { lease: lease.toISOString(), url: searchUrl(watch.filters as RadarFilters), known: seen.map(r => r.lotKey) };
  }
  async finish(userId: string, id: string, dto: BrowserBatchDto) {
    const watch = await this.own(userId, id);
    if (!watch.enabled || !watch.leaseUntil || watch.leaseUntil.toISOString() !== dto.lease || watch.leaseUntil.getTime() < Date.now()) throw new ConflictException('Yoxlama sessiyası bitib.');
    try {
      if (dto.error) throw new Error(dto.error);
      const lots = dto.lots.map(row => parseLot(row.html, row.url));
      return await this.process(watch, lots, watch.leaseUntil);
    } catch (error) {
      await this.fail(watch.id, watch.leaseUntil, error); throw new BadRequestException(error instanceof Error ? error.message : 'Lot oxunmadı.');
    }
  }
  private async fail(id: string, lease: Date, error: unknown) {
    await this.db.lotWatch.updateMany({ where: { id, leaseUntil: lease }, data: { leaseUntil: null, lastError: (error instanceof Error ? error.message : 'Yoxlama alınmadı.').slice(0, 300), nextCheckAt: new Date(Date.now() + 5 * 60000) } });
  }
  private async process(watch: LotWatch, lots: RadarLot[], lease: Date) {
    const baseline = !watch.initializedAt;
    const filters = watch.filters as RadarFilters;
    const count = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${watch.userId} FOR UPDATE`;
      const plan = await tx.radarPlan.findUnique({ where: { userId: watch.userId } }) || defaultPlan;
      if (!plan.enabled) throw new ForbiddenException('Lot Radar dayandırılıb.');
      const month = radarMonth();
      const usage = await tx.radarUsage.upsert({ where: { userId_month: { userId: watch.userId, month } }, create: { userId: watch.userId, month }, update: {} });
      const claimed = await tx.lotWatch.updateMany({ where: { id: watch.id, enabled: true, leaseUntil: lease }, data: { checkedAt: new Date(), initializedAt: watch.initializedAt || new Date(), lastError: null, nextCheckAt: new Date(Date.now() + 5 * 60000), leaseUntil: null } });
      if (!claimed.count) throw new ConflictException('Axtarış dəyişib.');
      let added = 0;
      for (const lot of lots) {
        const eligible = !baseline && matches(filters, lot);
        const alert = eligible && usage.used + added < plan.monthlyAlertLimit;
        const created = await tx.lotWatchLot.createMany({ data: [{ watchId: watch.id, lotKey: lot.key, data: lot as unknown as Prisma.InputJsonValue, isAlert: alert, quotaBlocked: eligible && !alert }], skipDuplicates: true });
        if (created.count && alert) added++;
      }
      if (added) await tx.radarUsage.update({ where: { userId_month: { userId: watch.userId, month } }, data: { used: { increment: added } } });
      return added;
    });
    void this.deliver(watch.id).catch(() => this.log.warn('Lot Radar çatdırılma növbəsi növbəti yoxlamada təkrarlanacaq.'));
    return { newMatches: count, baseline, scanned: lots.length };
  }
  private async deliver(watchId: string) {
    const watch = await this.db.lotWatch.findUnique({ where: { id: watchId }, include: { user: true } });
    if (!watch?.enabled || !watch.user.isActive) return;
    const plan = await this.db.radarPlan.findUnique({ where: { userId: watch.userId } }) || defaultPlan;
    if (!plan.enabled) return;
    const queue = await this.db.lotWatchLot.findMany({ where: { watchId, isAlert: true, attempts: { lt: 5 }, OR: [...(watch.emailEnabled ? [{ emailSentAt: null }] : []), ...(watch.whatsappEnabled ? [{ whatsappSentAt: null }] : [])] }, orderBy: { createdAt: 'asc' }, take: 10 });
    for (const item of queue) {
      // Claim each delivery attempt once across server workers.
      const claimed = await this.db.lotWatchLot.updateMany({ where: { id: item.id, attempts: item.attempts, OR: [{ deliveryLeaseUntil: null }, { deliveryLeaseUntil: { lt: new Date() } }] }, data: { attempts: { increment: 1 }, deliveryLeaseUntil: new Date(Date.now() + 5 * 60000) } });
      if (!claimed.count) continue;
      const lot = item.data as unknown as RadarLot;
      const text = radarMessage(watch.name, lot);
      const updates: Prisma.LotWatchLotUpdateInput = {};
      if (watch.emailEnabled && !item.emailSentAt) {
        const r = await this.notify.sendEmail({ to: watch.user.email, subject: `Lot Radar: ${lot.title}`, text, html: text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)).replace(/\n/g, '<br/>') });
        updates.emailSentAt = r.sent ? new Date() : undefined; updates.emailError = r.sent ? null : r.error === 'not_configured' ? 'not_configured' : 'delivery_failed';
      }
      if (watch.whatsappEnabled && !item.whatsappSentAt) {
        const r = await this.notify.sendRadarWhatsApp(watch.user.phone, text);
        updates.whatsappSentAt = r.sent ? new Date() : undefined; updates.whatsappError = r.sent ? null : r.error === 'not_configured' ? 'not_configured' : 'delivery_failed';
      }
      await this.db.lotWatchLot.update({ where: { id: item.id }, data: { ...updates, deliveryLeaseUntil: null } });
    }
  }
  private async html(url: string) {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'text/html', 'Accept-Language': 'en' } });
    if (!response.ok) throw new Error(`BidCars cavabı ${response.status}; brauzer rejimində yoxlayın.`);
    const html = await response.text(); if (blocked(html)) throw new Error('BidCars Cloudflare yoxlaması tələb edir. Brauzer rejimini açın.'); return html;
  }
  async scan(userId: string, id: string) {
    const watch = await this.own(userId, id);
    if (!watch.userId) return;
    const lease = await this.acquire(watch);
    try {
      if (process.env.LOT_RADAR_FEED_URL) return await this.process(watch, await fetchRadarFeed(watch.filters as RadarFilters), lease);
      const html = await this.html(searchUrl(watch.filters as RadarFilters));
      const links = listingLinks(html);
      if (!links.length && !/No (?:vehicles|results|lots) found|0 vehicles found/i.test(html)) throw new Error('BidCars nəticələri oxunmadı; boş nəticə kimi qeydə alınmadı.');
      const seen = await this.db.lotWatchLot.findMany({ where: { watchId: watch.id }, select: { lotKey: true } });
      const known = new Set(seen.map(r => r.lotKey));
      const lots: RadarLot[] = [];
      for (const url of links) {
        const key = url.match(/\/lot\/([01]-\d+)/)![1];
        if (!known.has(key)) lots.push(parseLot(await this.html(url), url));
      }
      return await this.process(watch, lots, lease);
    } catch (error) { await this.fail(id, lease, error); throw new BadRequestException(error instanceof Error ? error.message : 'Yoxlama alınmadı.'); }
  }
  async requestScan(userId: string, id: string) {
    const watch = await this.own(userId, id);
    if (!watch.enabled) throw new BadRequestException('Axtarış dayandırılıb.');
    if (watch.leaseUntil && watch.leaseUntil > new Date()) throw new ConflictException('Yoxlama artıq gedir.');
    void this.scan(userId, id).catch(() => undefined);
    return { queued: true };
  }
  async tick() {
    if (this.running) return; this.running = true;
    try {
      const due = await this.db.lotWatch.findMany({ where: { enabled: true, nextCheckAt: { lte: new Date() }, user: { isActive: true, radarPlan: { enabled: true, watchLimit: { gt: 0 } } }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, orderBy: { nextCheckAt: 'asc' }, take: 5 });
      for (const watch of due) { await this.scan(watch.userId, watch.id).catch(() => undefined); await this.deliver(watch.id); }
    } finally { this.running = false; }
  }
}
