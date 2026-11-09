import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { statusLabelAz } from '../notify/notify.service';
import { TelegramAccessService } from './telegram-access.service';
import { TelegramActionsService, type TelegramCar } from './telegram-actions.service';
import { TelegramHttpService } from './telegram-http.service';
import { TelegramMessagingService } from './telegram-messaging.service';
import type { TelegramUpdate } from './telegram.types';

type SearchMode = 'all' | 'customer' | 'container';
type EditKind = 'container' | 'carrier' | 'openingDate';
type Button = { text: string; callback_data?: string; url?: string };
type State = { nonce: string } & (
  | { mode: 'menu' }
  | { mode: 'search'; searchMode: SearchMode }
  | { mode: 'activeSearch' }
  | { mode: 'activeCustomers'; query: string; page: number; ids: string[]; hasMore: boolean }
  | { mode: 'customerCars'; customerId: string; query: string; customerPage: number; page: number; ids: string[]; hasMore: boolean }
  | { mode: 'results'; searchMode: SearchMode; query: string; page: number; ids: string[]; hasMore: boolean }
  | { mode: 'car'; orderId: string }
  | { mode: 'groups'; orderId: string }
  | { mode: 'stages'; orderId: string; group: number }
  | { mode: 'edit'; orderId: string; kind: EditKind }
  | { mode: 'confirm'; orderId: string; actionId: string }
  | { mode: 'whatsappDraft'; orderId: string }
  | { mode: 'whatsappConfirm'; orderId: string; actionId: string }
);
type Context = { token: string; chatId: string; telegramUserId: string; userId: string; botId?: string };

// Small, labelled groups keep every stage available without a 32-button keyboard.
const STAGE_GROUPS = [
  { title: 'Alış və ödəniş', statuses: ['PURCHASED', 'PAYMENT_RECEIVED', 'AUCTION_PAID', 'AUCTION_RELEASED'] },
  { title: 'Sənədlər və limana yol', statuses: ['EXPORT_DOCUMENTS', 'EXPORT_READY', 'PICKED_UP', 'TO_ORIGIN_PORT', 'ARRIVED_PORT'] },
  { title: 'Konteynerə yükləmə', statuses: ['CONTAINER_LOADING', 'LOADED_CONTAINER', 'VESSEL_WAITING'] },
  { title: 'Gəmi ilə daşınma', statuses: ['VESSEL_LOADED', 'SHIP_DEPARTED', 'IN_TRANSIT', 'ISTANBUL_TO_POTI', 'DESTINATION_APPROACHING'] },
  { title: 'Liman və konteyner açılışı', statuses: ['DESTINATION_PORT', 'CONTAINER_DISCHARGED', 'CONTAINER_OPENING_PENDING', 'CONTAINER_OPENED'] },
  { title: 'TIR və sənədlər', statuses: ['TIR_LOADING_PENDING', 'TIR_LOADED', 'CUSTOMS_DOCUMENTS', 'CUSTOMS_DOCUMENTS_READY', 'TIR_DEPARTED'] },
  { title: 'Bakı və təhvil', statuses: ['TIR_GEORGIA_BORDER', 'TIR_BAKU_CUSTOMS', 'CUSTOMS_CLEARANCE', 'READY_FOR_DELIVERY', 'DELIVERED'] },
  { title: 'Sifarişin ləğvi', statuses: ['CANCELLED'] },
] as const;
const SEARCH_MODES: SearchMode[] = ['all', 'customer', 'container'];
const EDIT_KINDS: EditKind[] = ['container', 'carrier', 'openingDate'];

function clip(value: unknown, length = 120, multiline = false) {
  const cleaned = String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
  const text = (multiline ? cleaned : cleaned.replace(/[\r\n\t]+/g, ' ')).trim();
  const letters = [...text];
  return letters.length > length ? `${letters.slice(0, length - 1).join('')}…` : text;
}

function nonce() { return randomBytes(8).toString('hex'); }
function integer(value: string | undefined, max: number) {
  if (!value || !/^\d{1,4}$/.test(value)) return null;
  const result = Number(value);
  return result >= 0 && result <= max ? result : null;
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}
function searchMode(value: unknown): value is SearchMode { return SEARCH_MODES.includes(value as SearchMode); }
function editKind(value: unknown): value is EditKind { return EDIT_KINDS.includes(value as EditKind); }
function pageNumber(value: unknown) { return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1000; }
function resultIds(value: unknown) { return Array.isArray(value) && value.length <= 8 && value.every(identifier); }
function conversation(value: unknown): State | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (typeof state.nonce !== 'string' || !/^[a-f0-9]{16}$/.test(state.nonce)) return null;
  switch (state.mode) {
    case 'menu': case 'activeSearch': return state as State;
    case 'activeCustomers': return typeof state.query === 'string' && state.query.length <= 100 && pageNumber(state.page)
      && resultIds(state.ids) && typeof state.hasMore === 'boolean' ? state as State : null;
    case 'customerCars': return identifier(state.customerId) && typeof state.query === 'string' && state.query.length <= 100
      && pageNumber(state.customerPage) && pageNumber(state.page) && resultIds(state.ids)
      && typeof state.hasMore === 'boolean' ? state as State : null;
    case 'search': return searchMode(state.searchMode) ? state as State : null;
    case 'results': return searchMode(state.searchMode) && typeof state.query === 'string' && state.query.length <= 100
      && Number.isInteger(state.page) && Number(state.page) >= 0 && Number(state.page) <= 1000
      && Array.isArray(state.ids) && state.ids.length <= 10 && state.ids.every(identifier)
      && typeof state.hasMore === 'boolean' ? state as State : null;
    case 'car': case 'groups': case 'whatsappDraft': return identifier(state.orderId) ? state as State : null;
    case 'stages': return identifier(state.orderId) && Number.isInteger(state.group)
      && Number(state.group) >= 0 && Number(state.group) < STAGE_GROUPS.length ? state as State : null;
    case 'edit': return identifier(state.orderId) && editKind(state.kind) ? state as State : null;
    case 'confirm': case 'whatsappConfirm': return identifier(state.orderId) && identifier(state.actionId) ? state as State : null;
    default: return null;
  }
}

@Injectable()
export class TelegramConversationService {
  // Also serialize direct/re-entrant calls, not just the long-poll worker.
  private readonly chats = new Map<string, Promise<void>>();

  constructor(
    private readonly access: TelegramAccessService,
    private readonly http: TelegramHttpService,
    private readonly actions: TelegramActionsService,
    private readonly messaging: TelegramMessagingService,
  ) {}

  async handle(update: TelegramUpdate, token: string, botId?: string): Promise<void> {
    if (update.edited_message) return;
    const message = update.message ?? update.callback_query?.message;
    const sender = update.callback_query?.from ?? update.message?.from;
    // Do not accept edited messages, channels, groups, bot senders or inline callbacks.
    if (!message || !sender || sender.is_bot || message.chat.type !== 'private'
      || !Number.isSafeInteger(sender.id) || sender.id <= 0
      || !Number.isSafeInteger(message.chat.id) || message.chat.id !== sender.id) return;
    const chatId = String(message.chat.id);
    const previous = this.chats.get(chatId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => this.handlePrivate(update, token, chatId, String(sender.id), botId));
    this.chats.set(chatId, current);
    try { await current; }
    finally { if (this.chats.get(chatId) === current) this.chats.delete(chatId); }
  }

  private async handlePrivate(update: TelegramUpdate, token: string, chatId: string, telegramUserId: string, botId?: string) {
    const callback = update.callback_query;
    const rawText = update.message?.text ?? '';
    const text = rawText.trim();
    const start = /^\/start(?:@[A-Za-z0-9_]+)?\s+([A-Za-z0-9_-]{20,128})$/.exec(text);
    let account = await this.access.authorize(telegramUserId, chatId, botId);
    const previousState = conversation(account?.conversation);
    // A pasted pairing link must never become a customer message or silently
    // replace the operator account while composing a WhatsApp message.
    const composingWhatsApp = previousState?.mode === 'whatsappDraft' || previousState?.mode === 'whatsappConfirm';
    if (start && !callback && !composingWhatsApp) {
      const paired = await this.access.pair(start[1], telegramUserId, chatId, update.message?.from?.username, botId);
      if (!paired) {
        await this.send({ token, chatId }, 'Bu qoşulma linki etibarsızdır və ya vaxtı bitib. Admin paneldə Telegram bölməsindən yeni link yaradın.');
        return;
      }
      account = await this.access.authorize(telegramUserId, chatId, botId);
    }
    if (!account) {
      if (callback) await this.answer(token, callback.id, 'Bu hesabın idarəetmə icazəsi yoxdur.');
      else await this.send({ token, chatId }, '🔒 Bu bot yalnız icazəli Auto Nex əməkdaşları üçündür.\n\nHesabınızı qoşmaq üçün admin paneldə Telegram bölməsini açın və şəxsi qoşulma linkindən istifadə edin.');
      return;
    }
    const ctx: Context = { token, chatId, telegramUserId, userId: account.userId, botId };
    const state = conversation(account.conversation);
    if (callback) {
      const match = /^tg:([a-f0-9]{16}):([a-z]+)(?::([a-zA-Z0-9]+))?$/.exec(callback.data ?? '');
      if (!match || !state || match[1] !== state.nonce) {
        await this.answer(token, callback.id, 'Bu düymə köhnəlib. Son mesajdakı düymədən və ya /menu əmrindən istifadə edin.');
        return;
      }
      await this.answer(token, callback.id);
      await this.handleCallback(ctx, state, match[2], match[3]);
      return;
    }
    const command = /^\/([a-z]+)(?:@[A-Za-z0-9_]+)?(?:\s.*)?$/i.exec(text)?.[1]?.toLowerCase();
    if (state?.mode === 'whatsappDraft') {
      if (/^\/(?:cancel|menu|start)(?:@[A-Za-z0-9_]+)?(?=\s|$)/i.test(text)) {
        await this.menu(ctx, 'WhatsApp mesajı ləğv edildi. Heç bir mesaj göndərilmədi.\n\n');
      } else await this.proposeWhatsApp(ctx, state.orderId, rawText);
      return;
    }
    if (command) {
      if (command === 'active') await this.activeCustomers(ctx, '', 0);
      else if (command === 'search') await this.promptSearch(ctx, 'all');
      else if (command === 'customers') await this.promptSearch(ctx, 'customer');
      else if (command === 'containers') await this.promptSearch(ctx, 'container');
      else if (command === 'help') await this.help(ctx);
      else await this.menu(ctx, start ? '✅ Telegram hesabınız uğurla qoşuldu.\n\n' : command === 'cancel' ? 'Əməliyyat ləğv edildi. Heç bir dəyişiklik edilmədi.\n\n' : '');
      return;
    }
    if (state?.mode === 'activeSearch' || state?.mode === 'activeCustomers') {
      if (text.length < 2 || text.length > 100) await this.send(ctx, 'Aktiv müştərini tapmaq üçün 2–100 simvolluq ad və ya telefon yazın. Tam siyahı üçün /active.');
      else await this.activeCustomers(ctx, text, 0);
      return;
    }
    if (state?.mode === 'search') {
      if (text.length < 2 || text.length > 100) {
        await this.send(ctx, 'Axtarış üçün 2–100 simvol yazın. Ləğv etmək üçün /cancel.');
      } else await this.results(ctx, text, state.searchMode, 0);
      return;
    }
    if (state?.mode === 'edit') {
      if (!text || text === '-' || text.length > 2000) {
        await this.send(ctx, 'Dəyər boş, “-” və ya 2000 simvoldan uzun ola bilməz. Məlumatı yenidən yazın və ya /cancel seçin.');
        return;
      }
      const value = state.kind === 'container' ? text.replace(/\s/g, '').toUpperCase() : text;
      await this.propose(ctx, state.orderId, state.kind, value);
      return;
    }
    if (state?.mode === 'whatsappConfirm') {
      await this.send(ctx, 'Mesaj hələ göndərilməyib. Önizləməni yoxlayıb “✅ WhatsApp-a göndər” düyməsini basın və ya /cancel ilə ləğv edin.', this.whatsappConfirmationButtons(state));
      return;
    }
    await this.menu(ctx);
  }

  private async handleCallback(ctx: Context, state: State, verb: string, arg?: string) {
    if (verb === 'menu' || verb === 'cancel') { await this.menu(ctx); return; }
    if (verb === 'active') { await this.activeCustomers(ctx, '', 0); return; }
    if (verb === 'activefind' && state.mode === 'activeCustomers') {
      const next: State = { mode: 'activeSearch', nonce: nonce() };
      await this.save(ctx, next);
      await this.send(ctx, '👤 Aktiv müştərinin adını və ya telefon nömrəsini yazın.\n\nYalnız təhvil verilməmiş və ləğv olunmamış maşını olan müştərilər axtarılır.', [[this.button(next, '← Bütün aktiv müştərilər', 'active')], [this.button(next, 'Əsas menyu', 'menu')]]);
      return;
    }
    if (verb === 'activepage' && state.mode === 'activeCustomers') {
      const page = integer(arg, 1000);
      if (page !== null && (page === state.page - 1 || page === state.page + 1 && state.hasMore)) await this.activeCustomers(ctx, state.query, page);
      return;
    }
    if (verb === 'customer' && state.mode === 'activeCustomers') {
      const index = integer(arg, state.ids.length - 1);
      if (index !== null) await this.customerCars(ctx, state.ids[index], state.query, state.page, 0);
      return;
    }
    if (verb === 'customersback' && state.mode === 'customerCars') {
      await this.activeCustomers(ctx, state.query, state.customerPage); return;
    }
    if (verb === 'customerpage' && state.mode === 'customerCars') {
      const page = integer(arg, 1000);
      if (page !== null && (page === state.page - 1 || page === state.page + 1 && state.hasMore)) await this.customerCars(ctx, state.customerId, state.query, state.customerPage, page);
      return;
    }
    if (verb === 'activecar' && state.mode === 'customerCars') {
      const index = integer(arg, state.ids.length - 1);
      if (index !== null) {
        const car = await this.actions.activeCustomerCar(state.customerId, state.ids[index]);
        if (!car || car.status === 'DELIVERED' || car.status === 'CANCELLED') {
          await this.send(ctx, 'Bu maşın artıq aktiv siyahıda deyil. Müştərinin cari maşınları yenilənir.');
          await this.customerCars(ctx, state.customerId, state.query, state.customerPage, state.page);
        } else await this.car(ctx, car.id, car);
      }
      return;
    }
    if (verb === 'help' && state.mode === 'menu') { await this.help(ctx); return; }
    if (verb === 'search' && state.mode === 'menu' && searchMode(arg)) { await this.promptSearch(ctx, arg); return; }
    if (verb === 'page' && state.mode === 'results') {
      const page = integer(arg, 1000);
      if (page !== null && (page === state.page - 1 || page === state.page + 1 && state.hasMore)) {
        await this.results(ctx, state.query, state.searchMode, page);
      }
      return;
    }
    if (verb === 'car' && state.mode === 'results') {
      const index = integer(arg, state.ids.length - 1);
      if (index !== null) await this.car(ctx, state.ids[index]);
      return;
    }
    if (verb === 'back' && 'orderId' in state) { await this.car(ctx, state.orderId); return; }
    if ((verb === 'whatsapp' && state.mode === 'car')
      || (verb === 'whatsappedit' && state.mode === 'whatsappConfirm')) {
      if ('orderId' in state) await this.promptWhatsApp(ctx, state.orderId);
      return;
    }
    if (verb === 'whatsconfirm' && state.mode === 'whatsappConfirm') {
      // Consume the conversation keyboard before the durable one-use send.
      // WhatsApp sends are separate from shipment update actions.
      await this.save(ctx, { mode: 'menu', nonce: nonce() });
      let result: { text: string; orderId: string };
      try { result = await this.messaging.confirm(state.actionId, ctx.userId, ctx.telegramUserId, ctx.chatId); }
      catch {
        await this.send(ctx, 'WhatsApp göndərişi təsdiqlənmədi. Təsdiqin vaxtı bitmiş, müştərinin məlumatı dəyişmiş və ya icazə ləğv edilmiş ola bilər. Maşını və göndəriş tarixçəsini yoxlayın. Avtomatik təkrar göndərilmədi.');
        await this.car(ctx, state.orderId);
        return;
      }
      // Provider acceptance is not delivery/read confirmation. In particular,
      // a Telegram transport failure after sending must not retry WhatsApp.
      await this.send(ctx, result.text);
      await this.car(ctx, result.orderId);
      return;
    }
    if (verb === 'groups' && ['car', 'stages'].includes(state.mode) && 'orderId' in state) {
      await this.groups(ctx, state.orderId); return;
    }
    if (verb === 'group' && ['groups', 'stages'].includes(state.mode) && 'orderId' in state) {
      const group = integer(arg, STAGE_GROUPS.length - 1);
      if (group !== null) await this.stages(ctx, state.orderId, group);
      return;
    }
    if (verb === 'stage' && state.mode === 'stages') {
      const index = integer(arg, STAGE_GROUPS[state.group].statuses.length - 1);
      if (index !== null) await this.propose(ctx, state.orderId, 'status', STAGE_GROUPS[state.group].statuses[index]);
      return;
    }
    if (verb === 'edit' && state.mode === 'car' && editKind(arg)) {
      const next: State = { mode: 'edit', nonce: nonce(), orderId: state.orderId, kind: arg };
      await this.save(ctx, next);
      const prompt = arg === 'container'
        ? '📦 Konteyner nömrəsini yazın.\nFormat: 4 hərf + 7 rəqəm, məsələn MSCU4829130.\n\nBu dəyişiklik yalnız seçilmiş maşına tətbiq ediləcək.'
        : arg === 'carrier'
          ? '🔗 Daşıyıcının canlı izləmə linkini yazın.\nLink https:// ilə başlamalıdır. Müştəri onu izləmə səhifəsindən aça biləcək.'
          : '🗓 Konteynerin açılma tarixini yazın.\nFormat: YYYY-MM-DD, məsələn 2026-11-25.';
      await this.send(ctx, `${prompt}\n\nSonra dəyişiklik önizləməsi və təsdiq düyməsi göstəriləcək.`, [[this.button(next, '← Maşına qayıt', 'back')], [this.button(next, 'Ləğv et', 'cancel')]]);
      return;
    }
    if (verb === 'confirm' && state.mode === 'confirm') {
      // Invalidate this keyboard before invoking a durable, one-use server action.
      await this.save(ctx, { mode: 'menu', nonce: nonce() });
      let result: { text: string; orderId: string };
      try { result = await this.actions.confirm(state.actionId, ctx.userId, ctx.telegramUserId, ctx.chatId); }
      catch {
        await this.send(ctx, 'Yeniləmə təsdiqlənmədi. Məlumat başqa yerdən dəyişmiş və ya təsdiqin vaxtı bitmiş ola bilər. Maşını yenidən açıb yoxlayın.');
        await this.car(ctx, state.orderId);
        return;
      }
      // A failed Telegram delivery must not be reported as a failed database mutation.
      await this.send(ctx, clip(result.text, 3000, true));
      await this.car(ctx, result.orderId);
    }
  }

  private async menu(ctx: Context, prefix = '') {
    const state: State = { mode: 'menu', nonce: nonce() };
    await this.save(ctx, state);
    await this.send(ctx, `${prefix}🚘 Auto Nex · Daşınma idarəetməsi\n\n1. Müştəri, VIN, izləmə/lot kodu və ya konteynerlə maşını tapın.\n2. Dəqiq maşını seçin.\n3. Mərhələni və ya logistika məlumatını dəyişib təsdiqləyin. Müştəriyə WhatsApp mesajı da yaza bilərsiniz: yazın → önizləməni yoxlayın → göndərişi təsdiqləyin.\n\nDəyişiklik saytın izləmə səhifəsində görünəcək. Bütün əməliyyatlar sizin admin hesabınızla qeydə alınır.`, [
      [this.button(state, '🚚 Yolda olan aktiv müştərilər', 'active')],
      [this.button(state, '🔎 Avtomobil tap', 'search', 'all')],
      [this.button(state, '👤 Müştəriyə görə', 'search', 'customer'), this.button(state, '📦 Konteynerə görə', 'search', 'container')],
      [this.button(state, 'ℹ️ İstifadə qaydası', 'help')],
    ]);
  }

  private async help(ctx: Context) {
    const state: State = { mode: 'menu', nonce: nonce() };
    await this.save(ctx, state);
    await this.send(ctx, '💬 Müştəriyə WhatsApp mesajı\n\nMaşını seçin → “Müştəriyə WhatsApp yaz” → mesajı yazın → müştərinin adını, tam telefonunu, VIN-i və mesajı önizləmədə yoxlayın → “✅ WhatsApp-a göndər”.\n\nMesaj yalnız son təsdiqdən sonra göndərilir. Ən çox 2000 simvol, adi mətn; xidmətə görə daha aşağı limit yazma ekranında göstərilir. Abzaslar saxlanır. Yazarkən /cancel və /menu ləğv edir; /start də təhlükəsizlik üçün ləğv edir. Başqa / ilə başlayan mətnlər mesajın bir hissəsidir. Şəkil və səs dəstəklənmir.\n\nBu, yalnız WhatsApp göndərişidir; alınmasa SMS-ə avtomatik keçilmir. Xidmətin qəbulu çatdırılma və ya oxunma demək deyil. Nəticəsi qeyri-müəyyən olan göndərişi yoxlamadan təkrar göndərməyin.');
    await this.send(ctx, 'ℹ️ Necə istifadə etməli?\n\n/active — yolda/prosesdə olan aktiv müştərilər və onların maşınları\n/search — VIN, izləmə/lot kodu, marka/model və ya müştəri ilə axtarış\n/customers — müştərinin adı və ya telefonu ilə axtarış\n/containers — konteyner nömrəsi ilə axtarış\n/menu — əsas menyu\n/cancel — cari əməliyyatı ləğv et\n\nAktiv siyahı alışdan təhvilə qədər davam edən sifarişlərdir; təhvil verilmiş və ləğv edilmiş maşınlar daxil deyil.\n\nNəticədə maşının VIN-i, müştərisi və izləmə kodunu yoxlayın. Dəyişiklik yalnız “Təsdiqlə” düyməsindən sonra saxlanır. Bir konteynerdə bir neçə maşın varsa, hər maşın ayrıca seçilib yenilənir.\n\nMüştəri bildirişləri saytın mövcud mərhələ qaydalarına və aktiv WhatsApp/SMS xidmətinə bağlıdır. Bildiriş göndərilməsi saxlanma ilə eyni şey deyil.\n\nTəhlükəsizlik: botu şəxsi söhbətdə istifadə edin. Giriş admin paneldən ləğv edilə bilər; köhnə mesajlardakı düymələr yenidən istifadə edilmir.', [[this.button(state, '← Əsas menyu', 'menu')]]);
  }

  private async promptSearch(ctx: Context, mode: SearchMode) {
    const state: State = { mode: 'search', nonce: nonce(), searchMode: mode };
    await this.save(ctx, state);
    const prompt = mode === 'customer' ? '👤 Müştərinin adını və ya telefon nömrəsini yazın.'
      : mode === 'container' ? '📦 Konteyner nömrəsini və ya onun bir hissəsini yazın.'
        : '🔎 VIN, izləmə/lot kodu, müştəri adı/telefonu, konteyner və ya marka/model yazın.';
    await this.send(ctx, `${prompt}\n\nƏn azı 2 simvol. Nəticədən dəqiq maşını seçəcəksiniz.`, [[this.button(state, '← Əsas menyu', 'menu')]]);
  }

  private async activeCustomers(ctx: Context, query: string, page: number) {
    let result: Awaited<ReturnType<TelegramActionsService['activeCustomers']>>;
    try { result = await this.actions.activeCustomers(query, page); }
    catch { await this.send(ctx, 'Aktiv müştərilərin siyahısı hazırda alınmadı. /active ilə yenidən cəhd edin.'); return; }
    const state: State = { mode: 'activeCustomers', nonce: nonce(), query, page, ids: result.items.map(item => item.id), hasMore: result.hasMore };
    await this.save(ctx, state);
    const rows: Button[][] = result.items.map((item, index) => [this.button(state, `${index + 1}. ${clip(item.name, 38)} · ${item.activeCarCount} maşın`, 'customer', String(index))]);
    const navigation: Button[] = [];
    if (page > 0) navigation.push(this.button(state, '← Əvvəlki', 'activepage', String(page - 1)));
    if (result.hasMore && page < 1000) navigation.push(this.button(state, 'Növbəti →', 'activepage', String(page + 1)));
    if (navigation.length) rows.push(navigation);
    rows.push([this.button(state, '🔎 Ad və ya telefonla tap', 'activefind')]);
    if (query) rows.push([this.button(state, 'Bütün aktiv müştərilər', 'active')]);
    rows.push([this.button(state, '← Əsas menyu', 'menu')]);
    const details = result.items.map((item, index) => `${index + 1}. ${clip(item.name, 100)}\nTelefon: ${clip(item.phone || 'Qeyd olunmayıb', 35)} · Aktiv maşın: ${item.activeCarCount}`).join('\n\n');
    await this.send(ctx, `🚚 Yolda olan aktiv müştərilər · səhifə ${page + 1}\n\nAlışdan təhvilə qədər prosesi davam edən maşınlar göstərilir. Təhvil verilmiş və ləğv olunmuş sifarişlər daxil deyil.${query ? `\nAxtarış: ${clip(query, 100)}` : ''}\n\n${details || (query ? 'Bu axtarışa uyğun aktiv müştəri tapılmadı.' : 'Hazırda aktiv daşınması olan müştəri yoxdur.')}\n\nMüştərini seçərək yalnız onun aktiv maşınlarını görün.`, rows);
  }

  private async customerCars(ctx: Context, customerId: string, query: string, customerPage: number, page: number) {
    let result: Awaited<ReturnType<TelegramActionsService['activeCustomerCars']>>;
    try { result = await this.actions.activeCustomerCars(customerId, page); }
    catch { await this.send(ctx, 'Müştərinin maşınları hazırda alınmadı. /active ilə yenidən cəhd edin.'); return; }
    if (!result.customer) { await this.activeCustomers(ctx, query, customerPage); return; }
    const state: State = { mode: 'customerCars', nonce: nonce(), customerId, query, customerPage, page, ids: result.items.map(item => item.id), hasMore: result.hasMore };
    await this.save(ctx, state);
    const rows: Button[][] = result.items.map((item, index) => [this.button(state, `${index + 1}. ${clip(this.vehicle(item), 32)} · ${clip(item.trackingCode, 20)}`, 'activecar', String(index))]);
    const navigation: Button[] = [];
    if (page > 0) navigation.push(this.button(state, '← Əvvəlki maşınlar', 'customerpage', String(page - 1)));
    if (result.hasMore && page < 1000) navigation.push(this.button(state, 'Növbəti maşınlar →', 'customerpage', String(page + 1)));
    if (navigation.length) rows.push(navigation);
    rows.push([this.button(state, '← Aktiv müştərilərə qayıt', 'customersback')], [this.button(state, 'Əsas menyu', 'menu')]);
    const details = result.items.map((item, index) => `${index + 1}. ${this.vehicle(item)}\nVIN: ${clip(item.vin, 32)} · Kod: ${clip(item.trackingCode, 40)}\nMərhələ: ${clip(statusLabelAz(item.status), 140)}\nKonteyner: ${clip(item.containerNumber || 'Əlavə edilməyib', 25)}`).join('\n\n');
    await this.send(ctx, `👤 ${clip(result.customer.name, 120)}\n📞 ${clip(result.customer.phone || 'Telefon qeyd olunmayıb', 35)}\n🚘 Aktiv maşınlar · səhifə ${page + 1}\n\n${details || 'Bu səhifədə aktiv maşın yoxdur. Siyahını yeniləyin və ya əvvəlki səhifəyə qayıdın.'}\n\nYeniləmək üçün dəqiq maşını seçin.`, rows);
  }

  private async results(ctx: Context, query: string, mode: SearchMode, page: number) {
    let result: { items: TelegramCar[]; hasMore: boolean };
    try { result = await this.actions.search(query, mode, page); }
    catch {
      await this.send(ctx, 'Axtarış hazırda alınmadı. Bir qədər sonra yenidən yazın və ya /menu ilə başdan başlayın.');
      return;
    }
    const cars = result.items.slice(0, 10);
    const state: State = { mode: 'results', nonce: nonce(), searchMode: mode, query, page, ids: cars.map(car => car.id), hasMore: result.hasMore };
    await this.save(ctx, state);
    const rows: Button[][] = cars.map((car, index) => [this.button(state, `${index + 1}. ${clip(car.customerName, 20)} · ${clip(this.vehicle(car), 32)}`, 'car', String(index))]);
    const navigation: Button[] = [];
    if (page > 0) navigation.push(this.button(state, '← Əvvəlki', 'page', String(page - 1)));
    if (result.hasMore && page < 1000) navigation.push(this.button(state, 'Növbəti →', 'page', String(page + 1)));
    if (navigation.length) rows.push(navigation);
    rows.push([this.button(state, '← Əsas menyu / yeni axtarış', 'menu')]);
    const details = cars.map((car, index) => `${index + 1}. ${clip(car.customerName, 70)} · ${this.vehicle(car)}\nVIN: ${clip(car.vin, 32)} · Kod: ${clip(car.trackingCode, 45)}\nKonteyner: ${clip(car.containerNumber || 'Əlavə edilməyib', 30)}`).join('\n\n');
    await this.send(ctx, cars.length
      ? `🔎 “${clip(query, 100)}” · səhifə ${page + 1}\n\n${details}\n\nDəqiq maşını aşağıdakı düymədən seçin.`
      : `“${clip(query, 100)}” üçün maşın tapılmadı.\n\nMəlumatın bir hissəsi ilə və ya başqa VIN/müştəri/konteynerlə yenidən axtarın.`, rows);
  }

  private async car(ctx: Context, orderId: string, selected?: TelegramCar) {
    const car = selected ?? await this.actions.get(orderId);
    if (!car) { await this.menu(ctx, 'Bu maşın artıq mövcud deyil. Yenidən axtarın.\n\n'); return; }
    const state: State = { mode: 'car', nonce: nonce(), orderId };
    await this.save(ctx, state);
    const rows = [
      [this.button(state, '📍 Mərhələni yenilə', 'groups')],
      [this.button(state, '📦 Konteyner nömrəsi', 'edit', 'container'), this.button(state, '🔗 Canlı izləmə linki', 'edit', 'carrier')],
      [this.button(state, '🗓 Konteyner açılma tarixi', 'edit', 'openingDate')],
      [this.button(state, '💬 Müştəriyə WhatsApp yaz', 'whatsapp')],
      [this.button(state, '🚚 Aktiv müştərilər', 'active')],
      [this.button(state, '← Əsas menyu / yeni axtarış', 'menu')],
    ];
    await this.send(ctx, `🚘 ${this.vehicle(car)}\n👤 Müştəri: ${clip(car.customerName, 150)}\n📞 Telefon: ${clip(car.customerPhone || 'Əlavə edilməyib', 35)}\n🔢 VIN: ${clip(car.vin, 32)}\n🔎 İzləmə kodu: ${clip(car.trackingCode, 80)}\n📍 Mərhələ: ${clip(statusLabelAz(car.status), 180)}\n📦 Konteyner: ${clip(car.containerNumber || 'Əlavə edilməyib', 40)}\n🗓 Açılma tarixi: ${clip(car.containerOpeningDate || 'Əlavə edilməyib', 40)}\n🔗 Daşıyıcı linki: ${clip(car.carrierTrackingUrl || 'Əlavə edilməyib', 900)}\n\nNəyi yeniləmək istəyirsiniz? Dəyişiklik yalnız bu maşına tətbiq olunur.`, rows);
  }

  private async promptWhatsApp(ctx: Context, orderId: string) {
    if (!this.messaging.ready()) {
      await this.send(ctx, 'WhatsApp göndərişi hazırda aktiv deyil. Admin paneldə WhatsApp bildiriş xidmətini yoxlayın və məsul administratora müraciət edin. Heç bir mesaj göndərilmədi.');
      return;
    }
    const car = await this.actions.get(orderId);
    if (!car) { await this.menu(ctx, 'Maşın tapılmadı. Heç bir mesaj göndərilmədi.\n\n'); return; }
    if (!car.customerPhone?.trim()) {
      await this.send(ctx, 'Bu müştərinin telefon nömrəsi qeyd olunmayıb. Əvvəl admin paneldə müştərinin düzgün WhatsApp nömrəsini əlavə edin. Heç bir mesaj göndərilmədi.');
      return;
    }
    const state: State = { mode: 'whatsappDraft', nonce: nonce(), orderId };
    await this.save(ctx, state);
    await this.send(ctx, `💬 Müştəriyə WhatsApp mesajı\n\n👤 ${clip(car.customerName, 150)}\n📞 ${clip(car.customerPhone, 80)}\n🚘 ${this.vehicle(car)}\nVIN: ${clip(car.vin, 32)}\nİzləmə kodu: ${clip(car.trackingCode, 80)}\n\nGöndərmək istədiyiniz mesajı bir mətn olaraq yazın (1–${this.whatsappTextLimit()} simvol). Abzaslar saxlanır; şəkil/səs göndərilmir. Yalnız WhatsApp mesajına razılıq vermiş müştəriyə göndərin.\n\nHələ heç nə göndərilmir: əvvəl tam önizləmə, sonra ayrıca təsdiq olacaq. /cancel və /menu ləğv edir; /start də təhlükəsizlik üçün ləğv edir. Digər / ilə başlayan mətn mesaj sayılır.`, [
      [this.button(state, '← Mesaj yazmadan maşına qayıt', 'back')],
      [this.button(state, 'Ləğv et', 'cancel')],
    ]);
  }

  private async proposeWhatsApp(ctx: Context, orderId: string, text: string) {
    const limit = this.whatsappTextLimit();
    if (!text.trim() || [...text].length > limit) {
      await this.send(ctx, `WhatsApp üçün 1–${limit} simvolluq adi mətn yazın. Şəkil, səs və boş mesaj qəbul edilmir. Yenidən yazın və ya /cancel ilə ləğv edin.`);
      return;
    }
    let proposal: { id: string; text: string };
    try { proposal = await this.messaging.propose(ctx.userId, ctx.telegramUserId, ctx.chatId, orderId, text); }
    catch {
      await this.send(ctx, `WhatsApp önizləməsi hazırlana bilmədi. Müştərinin telefonunu və WhatsApp xidmətini admin paneldə yoxlayın. Mesaj 1–${limit} simvolluq adi mətn olmalıdır. Heç bir mesaj göndərilmədi. Yenidən yazın və ya /cancel ilə ləğv edin.`);
      return;
    }
    const state: State = { mode: 'whatsappConfirm', nonce: nonce(), orderId, actionId: proposal.id };
    await this.save(ctx, state);
    const keyboard = this.whatsappConfirmationButtons(state);
    const preview = `💬 WhatsApp göndərişinin tam önizləməsi\n\n${proposal.text}`;
    const instruction = 'Müştərini, tam telefon nömrəsini, VIN-i və mesajın hamısını yoxlayın. Yalnız WhatsApp mesajına razılıq vermiş müştəriyə göndərin. Yalnız “✅ WhatsApp-a göndər” düyməsi mesajı göndərir. SMS-ə avtomatik keçilmir.';
    if (preview.length + instruction.length + 2 <= 4096) {
      await this.send(ctx, `${preview}\n\n${instruction}`, keyboard, true);
    } else {
      // Telegram uses UTF-16 entities. Keep each message below even that stricter
      // limit, without splitting emoji or trimming a message-body boundary.
      let part = '';
      for (const character of preview) {
        if (part.length + character.length > 3900) {
          await this.send(ctx, part, undefined, true);
          part = '';
        }
        part += character;
      }
      if (part) await this.send(ctx, part, undefined, true);
      await this.send(ctx, `Yuxarıdakı tam WhatsApp önizləməsini yoxlayın.\n\n${instruction}`, keyboard);
    }
  }

  private whatsappTextLimit(): number {
    const limit = this.messaging.maxTextLength();
    return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 2000) : 2000;
  }

  private whatsappConfirmationButtons(state: Extract<State, { mode: 'whatsappConfirm' }>): Button[][] {
    return [
      [this.button(state, '✅ WhatsApp-a göndər', 'whatsconfirm')],
      [this.button(state, '✏️ Mesajı yenidən yaz', 'whatsappedit')],
      [this.button(state, '← Göndərmədən maşına qayıt', 'back')],
      [this.button(state, 'Ləğv et', 'cancel')],
    ];
  }

  private async groups(ctx: Context, orderId: string) {
    const car = await this.actions.get(orderId);
    if (!car) { await this.menu(ctx, 'Maşın tapılmadı.\n\n'); return; }
    const state: State = { mode: 'groups', nonce: nonce(), orderId };
    await this.save(ctx, state);
    await this.send(ctx, `📍 ${this.vehicle(car)} · ${clip(car.trackingCode, 80)}\n👤 ${clip(car.customerName, 100)}\nHazırda: ${clip(statusLabelAz(car.status), 180)}\n\nMərhələ qrupunu seçin. Növbəti addımda dəqiq mərhələ və dəyişiklik təsdiqi göstəriləcək.`, [
      ...STAGE_GROUPS.map((group, index) => [this.button(state, `${index + 1}. ${group.title}`, 'group', String(index))]),
      [this.button(state, '← Maşına qayıt', 'back')],
    ]);
  }

  private async stages(ctx: Context, orderId: string, groupIndex: number) {
    const car = await this.actions.get(orderId);
    if (!car) { await this.menu(ctx, 'Maşın tapılmadı.\n\n'); return; }
    const group = STAGE_GROUPS[groupIndex];
    const state: State = { mode: 'stages', nonce: nonce(), orderId, group: groupIndex };
    await this.save(ctx, state);
    const choices = group.statuses.map((status, index) => `${index + 1}. ${status === car.status ? '✓ ' : ''}${statusLabelAz(status)}`).join('\n');
    const rows: Button[][] = group.statuses.map((status, index) => [this.button(state, `${status === car.status ? '✓ ' : ''}${index + 1}. ${clip(statusLabelAz(status), 52)}`, 'stage', String(index))]);
    const navigation: Button[] = [];
    if (groupIndex > 0) navigation.push(this.button(state, '← Əvvəlki qrup', 'group', String(groupIndex - 1)));
    if (groupIndex < STAGE_GROUPS.length - 1) navigation.push(this.button(state, 'Növbəti qrup →', 'group', String(groupIndex + 1)));
    rows.push(navigation, [this.button(state, 'Bütün mərhələ qrupları', 'groups')], [this.button(state, '← Maşına qayıt', 'back')]);
    await this.send(ctx, `📍 ${group.title} · ${groupIndex + 1}/${STAGE_GROUPS.length}\n🚘 ${this.vehicle(car)} · ${clip(car.trackingCode, 80)}\n👤 ${clip(car.customerName, 100)}\n\n${choices}\n\nMərhələni seçin; hələ heç nə saxlanılmayıb.`, rows);
  }

  private async propose(ctx: Context, orderId: string, kind: 'status' | EditKind, value: string) {
    let proposal: { id: string; text: string };
    try { proposal = await this.actions.propose(ctx.userId, ctx.telegramUserId, ctx.chatId, orderId, kind, value); }
    catch {
      await this.send(ctx, kind === 'container'
        ? 'Konteyner nömrəsi qəbul edilmədi. 4 hərf + 7 rəqəmdən ibarət düzgün nömrə yazın və ya maşına qayıdın.'
        : kind === 'carrier'
          ? 'Link qəbul edilmədi. İstifadəçi adı və parol daşımayan düzgün https:// izləmə linki yazın.'
          : kind === 'openingDate'
            ? 'Tarix qəbul edilmədi. Mövcud tarixi YYYY-MM-DD formatında yazın, məsələn 2026-11-25.'
            : 'Mərhələ dəyişikliyi hazırlana bilmədi. Maşını yenidən açıb cari məlumatı yoxlayın.');
      return;
    }
    const state: State = { mode: 'confirm', nonce: nonce(), orderId, actionId: proposal.id };
    await this.save(ctx, state);
    const keyboard = [
      [this.button(state, '✅ Təsdiqlə və saxla', 'confirm')],
      [this.button(state, '← Saxlamadan maşına qayıt', 'back')],
      [this.button(state, 'Ləğv et', 'cancel')],
    ];
    const preview = `🔎 Dəyişiklik önizləməsi\n\n${proposal.text}`;
    const instruction = 'Dəqiq maşını və məlumatı yoxlayın. Saxlamaq üçün təsdiqləyin.';
    if ([...preview].length + instruction.length + 2 <= 4096) {
      await this.send(ctx, `${preview}\n\n${instruction}`, keyboard);
    } else {
      // Both old and new carrier URLs may be 2000 characters. Never hide a
      // truncated value behind a confirmation button; deliver the full preview.
      const letters = [...preview];
      for (let start = 0; start < letters.length; start += 3900) {
        await this.send(ctx, letters.slice(start, start + 3900).join(''));
      }
      await this.send(ctx, `Yuxarıdakı dəyişiklik önizləməsini yoxlayın.\n\n${instruction}`, keyboard);
    }
  }

  private vehicle(car: TelegramCar) {
    return clip([car.make, car.model, car.year].filter(Boolean).join(' ') || 'Avtomobil', 100);
  }
  private button(state: State, text: string, verb: string, arg?: string): Button {
    return { text: clip(text, 64), callback_data: `tg:${state.nonce}:${verb}${arg === undefined ? '' : `:${arg}`}` };
  }
  private save(ctx: Context, state: State) {
    return this.access.saveConversation(ctx.userId, state as unknown as Prisma.InputJsonValue, ctx.telegramUserId, ctx.chatId, ctx.botId);
  }
  private send(ctx: Pick<Context, 'token' | 'chatId'>, text: string, keyboard?: Button[][], preservePreview = false) {
    return this.http.call(ctx.token, 'sendMessage', {
      chat_id: ctx.chatId, text: preservePreview ? text : clip(text, 4096, true), link_preview_options: { is_disabled: true },
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }
  private answer(token: string, id: string, text?: string) {
    // Telegram can reject an expired acknowledgement while the bound action is
    // still valid. It is only a spinner acknowledgement, never an authorization.
    return this.http.call(token, 'answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) }).catch(() => undefined);
  }
}
