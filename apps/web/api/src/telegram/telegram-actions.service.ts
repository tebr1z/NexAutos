import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OPERATIONS_ROLES } from '../common/access-roles';
import { normalizePhone, shouldNotifyStatus, statusLabelAz, type NotifyResult } from '../notify/notify.service';
import { normalizeTelegramOrderChange, OrdersService, type TelegramOrderChangeKind } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';

export type TelegramCar = {
  id: string;
  trackingCode: string;
  vin: string;
  make: string | null;
  model: string | null;
  year: number | null;
  customerName: string;
  customerPhone: string | null;
  containerNumber: string | null;
  carrierTrackingUrl: string | null;
  containerOpeningDate: string | null;
  status: string;
  updatedAt: string;
};

export type TelegramActionKind = TelegramOrderChangeKind;

export type TelegramActiveCustomer = {
  id: string;
  name: string;
  phone: string | null;
  activeCarCount: number;
};

const ACTIVE_ORDER_WHERE = {
  currentStatus: { notIn: ['DELIVERED', 'CANCELLED'] },
} satisfies Prisma.OrderWhereInput;

const ACTIVE_CUSTOMER_SELECT = {
  id: true, name: true, phone: true,
  _count: { select: { orders: { where: ACTIVE_ORDER_WHERE } } },
} satisfies Prisma.CustomerSelect;

const CAR_SELECT = {
  id: true, trackingCode: true, vin: true, containerNumber: true, carrierTrackingUrl: true,
  containerOpeningDate: true, currentStatus: true, updatedAt: true,
  customer: { select: { name: true, phone: true } },
  vehicle: { select: { make: true, model: true, year: true } },
} satisfies Prisma.OrderSelect;

type CarRow = Prisma.OrderGetPayload<{ select: typeof CAR_SELECT }>;
type ActionPayload = { orderId: string; expectedUpdatedAt: string; value: string };

function car(row: CarRow): TelegramCar {
  return {
    id: row.id, trackingCode: row.trackingCode, vin: row.vin,
    make: row.vehicle?.make ?? null, model: row.vehicle?.model ?? null, year: row.vehicle?.year ?? null,
    customerName: row.customer.name, customerPhone: row.customer.phone || null,
    containerNumber: row.containerNumber, carrierTrackingUrl: row.carrierTrackingUrl,
    containerOpeningDate: row.containerOpeningDate, status: row.currentStatus, updatedAt: row.updatedAt.toISOString(),
  };
}

const FIELD_LABEL: Record<TelegramActionKind, string> = {
  status: 'Mərhələ', container: 'Konteyner kodu', carrier: 'Daşıyıcının izləmə keçidi', openingDate: 'Konteyner açılma tarixi',
};

// Identity labels must stay on their own preview line, never imitate the next
// field or hide it with directional controls. Actual field values are not clipped.
function identityLabel(value: unknown, max: number): string {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
}

function readPayload(value: Prisma.JsonValue): ActionPayload {
  const p = value as Partial<ActionPayload> | null;
  if (!p || typeof p !== 'object' || typeof p.orderId !== 'string' || !p.orderId || p.orderId.length > 128
    || typeof p.expectedUpdatedAt !== 'string' || Number.isNaN(Date.parse(p.expectedUpdatedAt))
    || typeof p.value !== 'string') throw new BadRequestException('Təsdiq məlumatı etibarlı deyil. Əməliyyatı yenidən başladın.');
  return p as ActionPayload;
}

function notificationText(result: NotifyResult) {
  if (result.channelResults) {
    const lines = (['whatsapp', 'sms'] as const).flatMap((channel) => {
      const outcome = result.channelResults?.[channel];
      if (!outcome) return [];
      if (channel === 'sms' && outcome.error === 'disabled') return [];
      const name = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
      if (outcome.sent) return [`${name}: xidmət bildirişi göndərilmək üçün qəbul etdi.`];
      if (outcome.outcome === 'unknown') return [`${name}: nəticə qeyri-müəyyəndir; avtomatik təkrar göndərilmir.`];
      if (outcome.error === 'not_configured') return [`${name}: xidmət sazlanmayıb, bu kanalla bildiriş getmədi.`];
      if (outcome.error === 'disabled') return [`${name}: bu kanal deaktivdir.`];
      return [`${name}: xidmət bildirişi qəbul etmədi; admin paneldən yoxlayın.`];
    });
    return `${lines.join('\n')}\nXidmətin qəbulu müştəriyə çatdırılma və ya oxunma təsdiqi deyil.`;
  }
  if (result.sent) return `${result.channel === 'whatsapp' ? 'WhatsApp' : result.channel === 'sms' ? 'SMS' : 'Bildiriş'} xidməti bildirişi göndərilmək üçün qəbul etdi. Bu, çatdırılma təsdiqi deyil.`;
  if (result.error === 'skipped') return 'Bu mərhələ üçün avtomatik müştəri bildirişi nəzərdə tutulmayıb.';
  if (result.error === 'no_phone') return 'Müştərinin düzgün telefon nömrəsi yoxdur; bildiriş göndərilmədi.';
  if (result.error === 'not_configured') return 'Bildiriş xidməti sazlanmayıb; müştəriyə bildiriş göndərilmədi.';
  return 'Məlumat saxlanıldı, amma müştəri bildirişi göndərilmədi. Admin paneldən yoxlayın.';
}

@Injectable()
export class TelegramActionsService {
  constructor(private readonly prisma: PrismaService, private readonly orders: OrdersService) {}

  async activeCustomers(query = '', page = 0): Promise<{ items: TelegramActiveCustomer[]; hasMore: boolean }> {
    if (typeof query !== 'string' || query.trim().length > 100) throw new BadRequestException('Axtarışı 100 simvoldan qısa yazın.');
    if (!Number.isInteger(page) || page < 0 || page > 1000) throw new BadRequestException('Axtarış səhifəsi düzgün deyil.');
    const text = query.trim();
    const contains = (term: string) => ({ contains: term, mode: 'insensitive' as const });
    const phoneDigits = text.replace(/\D/g, '');
    const terms: Prisma.CustomerWhereInput = {
      AND: text.split(/\s+/).slice(0, 10).map((term) => ({
        OR: [{ name: contains(term) }, { phone: contains(term.replace(/\D/g, '') || term) }],
      })),
    };
    const phoneSearch = /^[+\d\s().-]+$/.test(text) && phoneDigits.length >= 7;
    const matching: Prisma.CustomerWhereInput | null = !text ? null : phoneSearch
      ? { OR: [terms, { phone: contains(normalizePhone(text) ?? phoneDigits) }] }
      : terms;
    const where: Prisma.CustomerWhereInput = {
      orders: { some: ACTIVE_ORDER_WHERE },
      ...(matching ? { AND: [matching] } : {}),
    };
    // Fetch customers once, not one result per car. Count only their unfinished
    // shipments, and never require a login account for a physical customer.
    const rows = await this.prisma.customer.findMany({
      where, select: ACTIVE_CUSTOMER_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: page * 8, take: 9,
    });
    return {
      items: rows.slice(0, 8).map((row) => ({ id: row.id, name: row.name, phone: row.phone || null, activeCarCount: row._count.orders })),
      hasMore: rows.length > 8,
    };
  }

  async activeCustomerCars(customerId: string, page = 0): Promise<{
    customer: { id: string; name: string; phone: string | null } | null;
    items: TelegramCar[];
    hasMore: boolean;
  }> {
    if (!Number.isInteger(page) || page < 0 || page > 1000) throw new BadRequestException('Axtarış səhifəsi düzgün deyil.');
    if (typeof customerId !== 'string' || !customerId || customerId.length > 128 || customerId.trim() !== customerId) {
      return { customer: null, items: [], hasMore: false };
    }
    const row = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, phone: true } });
    if (!row) return { customer: null, items: [], hasMore: false };
    // Use exact identity, never an ambiguous name. Direct Prisma reads avoid
    // OrdersService helpers whose archived-order reads can delete old records.
    const rows = await this.prisma.order.findMany({
      where: { customerId, ...ACTIVE_ORDER_WHERE }, select: CAR_SELECT,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: page * 8, take: 9,
    });
    return {
      customer: { id: row.id, name: row.name, phone: row.phone || null },
      items: rows.slice(0, 8).map(car), hasMore: rows.length > 8,
    };
  }

  async activeCustomerCar(customerId: string, orderId: string): Promise<TelegramCar | null> {
    const validId = (value: unknown): value is string => typeof value === 'string'
      && value.length > 0 && value.length <= 128 && value.trim() === value;
    if (!validId(customerId) || !validId(orderId)) return null;
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, customerId, ...ACTIVE_ORDER_WHERE }, select: CAR_SELECT,
    });
    return row ? car(row) : null;
  }

  async search(query: string, mode: 'all' | 'customer' | 'container' = 'all', page = 0): Promise<{ items: TelegramCar[]; hasMore: boolean }> {
    if (!['all', 'customer', 'container'].includes(mode)) throw new BadRequestException('Axtarış növü düzgün deyil.');
    const text = String(query ?? '').trim();
    if (text.length > 100) throw new BadRequestException('Axtarışı 100 simvoldan qısa yazın.');
    if (!Number.isInteger(page) || page < 0 || page > 1000) throw new BadRequestException('Axtarış səhifəsi düzgün deyil.');
    const contains = (term: string) => ({ contains: term, mode: 'insensitive' as const });
    const phoneDigits = text.replace(/\D/g, '');
    const terms = text.split(/\s+/).slice(0, 10);
    const filters: Prisma.OrderWhereInput = {
      AND: terms.map((term) => {
        const fields: Prisma.OrderWhereInput[] = [];
        if (mode !== 'container') fields.push({ customer: { name: contains(term) } }, { customer: { phone: contains(term.replace(/\D/g, '') || term) } });
        if (mode !== 'customer') fields.push({ containerNumber: contains(term) });
        if (mode === 'all') fields.push(
          { vin: contains(term) }, { trackingCode: contains(term) }, { vehicle: { lotNumber: contains(term) } },
          { vehicle: { make: contains(term) } }, { vehicle: { model: contains(term) } },
        );
        if (mode === 'all' && /^(19|20)\d{2}$/.test(term)) fields.push({ vehicle: { year: Number(term) } });
        return { OR: fields };
      }),
    };
    const phoneSearch = mode !== 'container' && /^[+\d\s().-]+$/.test(text) && phoneDigits.length >= 7;
    const where: Prisma.OrderWhereInput = text
      ? phoneSearch ? { OR: [filters, { customer: { phone: contains(normalizePhone(text) ?? phoneDigits) } }] } : filters
      : { currentStatus: { notIn: ['DELIVERED', 'CANCELLED'] } };
    // Deliberately do not use OrdersService read helpers: those run archive deletion.
    const rows = await this.prisma.order.findMany({
      where, select: CAR_SELECT, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: page * 8, take: 9,
    });
    return { items: rows.slice(0, 8).map(car), hasMore: rows.length > 8 };
  }

  async get(id: string): Promise<TelegramCar | null> {
    if (typeof id !== 'string' || !id || id.length > 128) return null;
    const row = await this.prisma.order.findUnique({ where: { id }, select: CAR_SELECT });
    return row ? car(row) : null;
  }

  private async authorize(tx: Prisma.TransactionClient, userId: string, telegramUserId: string, chatId: string) {
    // A revoke or role change cannot commit between these checks and the mutation.
    await tx.$queryRaw`SELECT "id" FROM "TelegramBotConfig" WHERE "id" = 'main' FOR SHARE`;
    const config = await tx.telegramBotConfig.findUnique({ where: { id: 'main' }, select: { enabled: true } });
    if (!config?.enabled) throw new ForbiddenException('Telegram botu deaktiv edilib.');
    await tx.$queryRaw`SELECT "userId" FROM "TelegramAccount" WHERE "userId" = ${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR SHARE`;
    const account = await tx.telegramAccount.findUnique({
      where: { userId },
      select: { telegramUserId: true, chatId: true, user: { select: { isActive: true, role: true } } },
    });
    if (!account || account.telegramUserId !== telegramUserId || account.chatId !== chatId || !account.user.isActive
      || !OPERATIONS_ROLES.includes(account.user.role)) throw new ForbiddenException('Telegram bağlantısı və ya idarəetmə icazəsi artıq etibarlı deyil. Admin paneldən yenidən yoxlayın.');
  }

  async propose(userId: string, telegramUserId: string, chatId: string, orderId: string, kind: TelegramActionKind, rawValue: string): Promise<{ id: string; text: string }> {
    const value = normalizeTelegramOrderChange(kind, rawValue);
    return this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, userId, telegramUserId, chatId);
      const row = await tx.order.findUnique({ where: { id: orderId }, select: CAR_SELECT });
      if (!row) throw new NotFoundException('Maşın tapılmadı.');
      const current = car(row);
      const before = kind === 'status' ? current.status : kind === 'container' ? current.containerNumber : kind === 'carrier' ? current.carrierTrackingUrl : current.containerOpeningDate;
      if (before === value) throw new BadRequestException('Bu dəyər artıq qeyd olunub. Dəyişiklik edilmədi.');
      const action = await tx.telegramAction.create({
        data: {
          userId, telegramUserId, chatId, kind, state: 'PENDING', expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          payload: { orderId, expectedUpdatedAt: current.updatedAt, value },
        },
      });
      const format = (v: string | null) => v ? (kind === 'status' ? statusLabelAz(v) : v) : 'Qeyd olunmayıb';
      return {
        id: action.id,
        text: [
          'Dəyişikliyi təsdiqləyin', `Müştəri: ${identityLabel(current.customerName, 120) || 'Məlumat yoxdur'}`,
          `Maşın: ${identityLabel([identityLabel(current.make, 60), identityLabel(current.model, 60), identityLabel(current.year, 8)].filter(Boolean).join(' '), 140) || 'Məlumat yoxdur'}`,
          `VIN: ${identityLabel(current.vin, 32)}`, `İzləmə kodu: ${identityLabel(current.trackingCode, 48)}`,
          `${FIELD_LABEL[kind]}:`, `İndiki: ${format(before)}`, `Yeni: ${format(value)}`,
          kind === 'status'
            ? shouldNotifyStatus(value) ? 'Saxlandıqdan sonra mövcud WhatsApp/SMS xidməti ilə müştəriyə bildiriş göndərilməsinə cəhd ediləcək.' : 'Bu mərhələ müştərinin izləmə səhifəsində görünəcək; avtomatik WhatsApp/SMS göndərilmir.'
            : 'Yenilənən məlumat müştərinin izləmə səhifəsində görünəcək. Avtomatik WhatsApp/SMS göndərilmir.',
          'Təsdiq 10 dəqiqə etibarlıdır. Yalnız bu maşın yenilənəcək.',
        ].join('\n'),
      };
    });
  }

  async confirm(actionId: string, userId: string, telegramUserId: string, chatId: string): Promise<{ text: string; orderId: string }> {
    if (typeof actionId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(actionId)) throw new BadRequestException('Təsdiq etibarlı deyil.');
    const committed = await this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, userId, telegramUserId, chatId);
      const owner = { id: actionId, userId, telegramUserId, chatId };
      const claimed = await tx.telegramAction.updateMany({
        where: { ...owner, state: 'PENDING', expiresAt: { gt: new Date() } }, data: { state: 'PROCESSING' },
      });
      const action = await tx.telegramAction.findFirst({ where: owner });
      if (!claimed.count) {
        if (action?.state === 'SUCCEEDED') {
          return { replay: true as const, orderId: readPayload(action.payload).orderId };
        }
        throw new ConflictException('Təsdiqin vaxtı bitib, ləğv edilib və ya etibarlı deyil. Maşını yenidən açın.');
      }
      if (!action) throw new ConflictException('Təsdiq tapılmadı.');
      if (!Object.hasOwn(FIELD_LABEL, action.kind)) throw new BadRequestException('Əməliyyat növü etibarlı deyil.');
      const payload = readPayload(action.payload);
      const order = await this.orders.applyTelegramChange(tx, { ...payload, kind: action.kind as TelegramActionKind, userId });
      await tx.telegramAction.update({ where: { id: action.id }, data: { state: 'SUCCEEDED' } });
      return { replay: false as const, orderId: order.id, kind: action.kind, order };
    });
    if (committed.replay) return { orderId: committed.orderId, text: 'Bu təsdiq artıq icra edilib. Dəyişiklik təkrar tətbiq edilmir, müştəri bildirişi yenidən göndərilmir.' };
    // No retry on callback replay: one committed confirmation gets at most one send attempt.
    let delivery = 'Məlumat müştərinin izləmə səhifəsində yeniləndi. Avtomatik müştəri bildirişi göndərilmir.';
    if (committed.kind === 'status') {
      let result: NotifyResult;
      try { result = await this.orders.notifyTelegramStatus(committed.order); }
      catch { result = { sent: false, error: 'notify_failed' }; }
      delivery = notificationText(result);
    }
    return { orderId: committed.orderId, text: `Dəyişiklik saxlanıldı.\nİzləmə kodu: ${identityLabel(committed.order.trackingCode, 48)}\n${delivery}` };
  }
}
