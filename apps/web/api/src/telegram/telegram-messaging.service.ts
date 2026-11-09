import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OPERATIONS_ROLES } from '../common/access-roles';
import { normalizeCustomerWhatsAppPhone, NotifyService, type CustomerWhatsAppResult } from '../notify/notify.service';
import { PrismaService } from '../prisma/prisma.service';

type MessagePayload = {
  orderId: string;
  customerId: string;
  expectedOrderUpdatedAt: string;
  expectedCustomerUpdatedAt: string;
  phoneNormalized: string;
  text: string;
  attemptedAt?: string;
  deliveryOutcome?: string;
};

const ORDER_SELECT = {
  id: true, customerId: true, updatedAt: true, vin: true, trackingCode: true,
  customer: { select: { id: true, name: true, phone: true, updatedAt: true } },
  vehicle: { select: { make: true, model: true, year: true } },
} satisfies Prisma.OrderSelect;

function label(value: unknown, max: number): string {
  const text = String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
}

function messageText(value: unknown): string {
  if (typeof value !== 'string' || [...value].length > 2000 || !value.replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, '')) {
    throw new BadRequestException('Mesajı 1–2000 simvol arasında yazın. Boş və ya yalnız görünməyən simvollardan ibarət mesaj göndərilmir.');
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)) throw new BadRequestException('Mesajda uyğun olmayan idarəetmə simvolları var.');
  // Keep exactly the previewed text, including paragraphs and outer whitespace.
  return value;
}

function phone(raw: string): string | null {
  return normalizeCustomerWhatsAppPhone(raw);
}

function payload(value: Prisma.JsonValue): MessagePayload {
  const p = value as Partial<MessagePayload> | null;
  const validId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
  if (!p || typeof p !== 'object' || !validId(p.orderId) || !validId(p.customerId)
    || typeof p.expectedOrderUpdatedAt !== 'string' || Number.isNaN(Date.parse(p.expectedOrderUpdatedAt))
    || typeof p.expectedCustomerUpdatedAt !== 'string' || Number.isNaN(Date.parse(p.expectedCustomerUpdatedAt))
    || typeof p.phoneNormalized !== 'string' || phone(p.phoneNormalized) !== p.phoneNormalized) {
    throw new BadRequestException('Mesajın təsdiqi etibarlı deyil. Mesajı yenidən hazırlayın.');
  }
  messageText(p.text);
  return p as MessagePayload;
}

function outcomeText(state: string, replay = false): string {
  const prefix = replay ? 'Bu təsdiq artıq istifadə olunub. Mesaj təkrar göndərilmir.\n' : '';
  if (state === 'SUCCEEDED') return `${prefix}WhatsApp xidməti mesajı göndərilmək üçün qəbul etdi. Bu, müştəriyə çatma və ya oxunma təsdiqi deyil.`;
  if (state === 'FAILED') return `${prefix}WhatsApp xidməti mesajı qəbul etmədi. SMS və ya başqa provayderlə təkrar göndərilmədi. Nömrəni və xidməti admin paneldən yoxlayın.`;
  return `${prefix}Göndərişin nəticəsi qeyri-müəyyəndir: mesaj artıq göndərilmiş ola bilər. Təkrar göndərilmir. Yeni mesaj hazırlamazdan əvvəl WhatsApp hesabından yoxlayın.`;
}

@Injectable()
export class TelegramMessagingService {
  constructor(private readonly prisma: PrismaService, private readonly notify: NotifyService) {}

  ready(): boolean { return this.notify.customerWhatsAppReady(); }

  maxTextLength(): number { return this.notify.customerWhatsAppTextLimit(); }

  private async authorize(tx: Prisma.TransactionClient, userId: string, telegramUserId: string, chatId: string) {
    if (!/^[1-9]\d{0,15}$/.test(telegramUserId) || chatId !== telegramUserId) throw new ForbiddenException('Mesaj yalnız bağlı şəxsi Telegram hesabından göndərilə bilər.');
    await tx.$queryRaw`SELECT "id" FROM "TelegramBotConfig" WHERE "id" = 'main' FOR SHARE`;
    const config = await tx.telegramBotConfig.findUnique({ where: { id: 'main' }, select: { enabled: true } });
    if (!config?.enabled) throw new ForbiddenException('Telegram botu deaktiv edilib.');
    await tx.$queryRaw`SELECT "userId" FROM "TelegramAccount" WHERE "userId" = ${userId} FOR SHARE`;
    // All send claims by one operator serialize here, including different cars.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const account = await tx.telegramAccount.findUnique({
      where: { userId }, select: { telegramUserId: true, chatId: true, user: { select: { isActive: true, role: true } } },
    });
    if (!account || account.telegramUserId !== telegramUserId || account.chatId !== chatId || !account.user.isActive || !OPERATIONS_ROLES.includes(account.user.role)) {
      throw new ForbiddenException('Telegram bağlantısı və ya idarəetmə icazəsi artıq etibarlı deyil.');
    }
  }

  async propose(userId: string, telegramUserId: string, chatId: string, orderId: string, rawText: string): Promise<{ id: string; text: string }> {
    const text = messageText(rawText);
    if (typeof orderId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) throw new BadRequestException('Maşın düzgün deyil.');
    return this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, userId, telegramUserId, chatId);
      if (!this.ready()) throw new BadRequestException('WhatsApp xidməti sazlanmayıb. Admin paneldən WhatsApp bağlantısını yoxlayın.');
      if ([...text].length > this.maxTextLength()) throw new BadRequestException(`Aktiv WhatsApp xidməti üçün mesaj ən çox ${this.maxTextLength()} simvol ola bilər.`);
      const order = await tx.order.findUnique({ where: { id: orderId }, select: ORDER_SELECT });
      if (!order) throw new NotFoundException('Maşın tapılmadı.');
      const recipient = phone(order.customer.phone);
      if (!recipient) throw new BadRequestException('Müştərinin düzgün WhatsApp telefon nömrəsi yoxdur. Admin paneldən nömrəni düzəldin.');
      const snapshot: MessagePayload = {
        orderId: order.id, customerId: order.customerId, expectedOrderUpdatedAt: order.updatedAt.toISOString(),
        expectedCustomerUpdatedAt: order.customer.updatedAt.toISOString(), phoneNormalized: recipient, text,
      };
      const action = await tx.telegramAction.create({ data: {
        userId, telegramUserId, chatId, kind: 'whatsapp', state: 'PENDING',
        payload: snapshot, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      } });
      return { id: action.id, text: [
        'WhatsApp mesajını təsdiqləyin', `Müştəri: ${label(order.customer.name, 120) || 'Məlumat yoxdur'}`,
        `Nömrə: +${recipient}`, `Maşın: ${label([order.vehicle?.make, order.vehicle?.model, order.vehicle?.year].filter(Boolean).join(' '), 140) || 'Məlumat yoxdur'}`,
        `VIN: ${label(order.vin, 32)}`, `İzləmə kodu: ${label(order.trackingCode, 48)}`,
        'Aşağıdakı mətn olduğu kimi yalnız bu müştərinin WhatsApp nömrəsinə göndəriləcək. SMS göndərilmir.',
        'Təsdiq 10 dəqiqə etibarlıdır. Göndəriş nəticəsi çatma və ya oxunma təsdiqi deyil.',
        '──────── Mesajın tam mətni ────────', text,
      ].join('\n') };
    });
  }

  async confirm(actionId: string, userId: string, telegramUserId: string, chatId: string): Promise<{ text: string; orderId: string }> {
    if (typeof actionId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(actionId)) throw new BadRequestException('Təsdiq etibarlı deyil.');
    const claimed = await this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, userId, telegramUserId, chatId);
      await tx.$queryRaw`SELECT "id" FROM "TelegramAction" WHERE "id" = ${actionId} FOR UPDATE`;
      const owner = { id: actionId, userId, telegramUserId, chatId, kind: 'whatsapp' };
      const action = await tx.telegramAction.findFirst({ where: owner });
      if (!action) throw new ConflictException('Mesajın təsdiqi etibarlı deyil və ya sizə aid deyil.');
      const snapshot = payload(action.payload);
      if (['SUCCEEDED', 'FAILED', 'UNKNOWN', 'PROCESSING'].includes(action.state)) return { snapshot, replay: true as const, state: action.state };
      if (action.state !== 'PENDING' || action.expiresAt.getTime() <= Date.now()) {
        if (action.state === 'PENDING') await tx.telegramAction.update({ where: { id: action.id }, data: { state: 'CANCELLED' } });
        return { snapshot, rejection: 'Təsdiqin vaxtı bitib və ya ləğv edilib. Mesajı yenidən hazırlayın.' };
      }
      if (!this.ready()) throw new BadRequestException('WhatsApp xidməti sazlanmayıb. Mesaj göndərilmədi.');
      if ([...snapshot.text].length > this.maxTextLength()) throw new BadRequestException(`Aktiv WhatsApp xidməti dəyişib. Mesajı ən çox ${this.maxTextLength()} simvolla yenidən hazırlayın. Heç bir mesaj göndərilmədi.`);
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${snapshot.orderId} FOR SHARE`;
      // Serialize the same-customer quota across different operators and cars.
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${snapshot.customerId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: snapshot.orderId }, select: ORDER_SELECT });
      if (!order || order.customerId !== snapshot.customerId || order.customer.id !== snapshot.customerId
        || order.updatedAt.toISOString() !== snapshot.expectedOrderUpdatedAt
        || order.customer.updatedAt.toISOString() !== snapshot.expectedCustomerUpdatedAt
        || phone(order.customer.phone) !== snapshot.phoneNormalized) {
        await tx.telegramAction.update({ where: { id: action.id }, data: { state: 'CANCELLED' } });
        return { snapshot, rejection: 'Müştəri, nömrə və ya maşının məlumatları dəyişib. Yanlış ünvana mesaj göndərməmək üçün maşını yenidən açıb mesajı hazırlayın.' };
      }
      const attemptedAt = new Date();
      const window = new Date(attemptedAt.getTime() - 10 * 60 * 1000);
      const attempts = { kind: 'whatsapp', state: { in: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'UNKNOWN'] }, updatedAt: { gte: window } };
      if (await tx.telegramAction.count({ where: { ...attempts, userId } }) >= 10) throw new BadRequestException('10 dəqiqədə ən çox 10 WhatsApp göndərişinə icazə verilir. Bir qədər gözləyin.');
      if (await tx.telegramAction.count({ where: { ...attempts, payload: { path: ['customerId'], equals: snapshot.customerId } } }) >= 3) throw new BadRequestException('Bu müştəriyə 10 dəqiqədə ən çox 3 WhatsApp göndərişinə icazə verilir. Bir qədər gözləyin.');
      const data = { ...snapshot, attemptedAt: attemptedAt.toISOString() };
      const taken = await tx.telegramAction.updateMany({ where: { ...owner, state: 'PENDING', expiresAt: { gt: attemptedAt } }, data: { state: 'PROCESSING', payload: data } });
      if (!taken.count) throw new ConflictException('Bu mesaj artıq təsdiqlənib və ya təsdiqin vaxtı bitib. Təkrar göndərilmir.');
      await tx.auditLog.create({ data: { userId, action: 'TELEGRAM_WHATSAPP_ATTEMPT', entity: 'Order', entityId: snapshot.orderId, meta: { actionId, customerId: snapshot.customerId, telegramUserId, channel: 'whatsapp' } } });
      return { snapshot: data, replay: false as const, state: 'PROCESSING' };
    });
    if ('rejection' in claimed) throw new ConflictException(claimed.rejection);
    if (claimed.replay) return { orderId: claimed.snapshot.orderId, text: outcomeText(claimed.state, true) };
    // The durable claim commits before any external side effect. A crash from
    // this point on leaves PROCESSING, which replays treat as uncertain, not retryable.
    let result: CustomerWhatsAppResult;
    try { result = await this.notify.sendCustomerWhatsApp(claimed.snapshot.phoneNormalized, claimed.snapshot.text); }
    catch { result = { sent: false, outcome: 'unknown', error: 'provider_uncertain' }; }
    const state = result.outcome === 'accepted' && result.sent ? 'SUCCEEDED' : result.outcome === 'failed' ? 'FAILED' : 'UNKNOWN';
    try {
      await this.prisma.$transaction(async (tx) => {
        const saved = await tx.telegramAction.updateMany({ where: { id: actionId, userId, telegramUserId, chatId, kind: 'whatsapp', state: 'PROCESSING' }, data: { state, payload: { ...claimed.snapshot, deliveryOutcome: state } } });
        if (saved.count) await tx.auditLog.create({ data: { userId, action: `TELEGRAM_WHATSAPP_${state}`, entity: 'Order', entityId: claimed.snapshot.orderId, meta: { actionId, customerId: claimed.snapshot.customerId, channel: 'whatsapp', outcome: state } } });
      });
    } catch { /* The durable claim still prevents retry if outcome persistence fails. */ }
    return { orderId: claimed.snapshot.orderId, text: outcomeText(state) };
  }
}
