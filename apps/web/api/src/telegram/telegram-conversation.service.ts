import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { statusLabelAz } from '../notify/notify.service';
import { TelegramAccessService } from './telegram-access.service';
import { TelegramActionsService, type TelegramCar } from './telegram-actions.service';
import { TelegramHttpService } from './telegram-http.service';
import type { TelegramUpdate } from './telegram.types';

type SearchMode = 'all' | 'customer' | 'container';
type EditKind = 'container' | 'carrier' | 'openingDate';
type Button = { text: string; callback_data?: string; url?: string };
type State = { nonce: string } & (
  | { mode: 'menu' }
  | { mode: 'search'; searchMode: SearchMode }
  | { mode: 'results'; searchMode: SearchMode; query: string; page: number; ids: string[]; hasMore: boolean }
  | { mode: 'car'; orderId: string }
  | { mode: 'groups'; orderId: string }
  | { mode: 'stages'; orderId: string; group: number }
  | { mode: 'edit'; orderId: string; kind: EditKind }
  | { mode: 'confirm'; orderId: string; actionId: string }
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
function conversation(value: unknown): State | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (typeof state.nonce !== 'string' || !/^[a-f0-9]{16}$/.test(state.nonce)) return null;
  switch (state.mode) {
    case 'menu': return state as State;
    case 'search': return searchMode(state.searchMode) ? state as State : null;
    case 'results': return searchMode(state.searchMode) && typeof state.query === 'string' && state.query.length <= 100
      && Number.isInteger(state.page) && Number(state.page) >= 0 && Number(state.page) <= 1000
      && Array.isArray(state.ids) && state.ids.length <= 10 && state.ids.every(identifier)
      && typeof state.hasMore === 'boolean' ? state as State : null;
    case 'car': case 'groups': return identifier(state.orderId) ? state as State : null;
    case 'stages': return identifier(state.orderId) && Number.isInteger(state.group)
      && Number(state.group) >= 0 && Number(state.group) < STAGE_GROUPS.length ? state as State : null;
    case 'edit': return identifier(state.orderId) && editKind(state.kind) ? state as State : null;
    case 'confirm': return identifier(state.orderId) && identifier(state.actionId) ? state as State : null;
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
    const text = update.message?.text?.trim() ?? '';
    const start = /^\/start(?:@[A-Za-z0-9_]+)?\s+([A-Za-z0-9_-]{20,128})$/.exec(text);
    if (start && !callback) {
      const paired = await this.access.pair(start[1], telegramUserId, chatId, update.message?.from?.username, botId);
      if (!paired) {
        await this.send({ token, chatId }, 'Bu qoşulma linki etibarsızdır və ya vaxtı bitib. Admin paneldə Telegram bölməsindən yeni link yaradın.');
        return;
      }
    }
    const account = await this.access.authorize(telegramUserId, chatId, botId);
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
    if (command) {
      if (command === 'search') await this.promptSearch(ctx, 'all');
      else if (command === 'customers') await this.promptSearch(ctx, 'customer');
      else if (command === 'containers') await this.promptSearch(ctx, 'container');
      else if (command === 'help') await this.help(ctx);
      else await this.menu(ctx, start ? '✅ Telegram hesabınız uğurla qoşuldu.\n\n' : command === 'cancel' ? 'Əməliyyat ləğv edildi. Heç bir dəyişiklik edilmədi.\n\n' : '');
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
    await this.menu(ctx);
  }

  private async handleCallback(ctx: Context, state: State, verb: string, arg?: string) {
    if (verb === 'menu' || verb === 'cancel') { await this.menu(ctx); return; }
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
    await this.send(ctx, `${prefix}🚘 Auto Nex · Daşınma idarəetməsi\n\n1. Müştəri, VIN, izləmə/lot kodu və ya konteynerlə maşını tapın.\n2. Dəqiq maşını seçin.\n3. Mərhələni və ya logistika məlumatını dəyişib təsdiqləyin.\n\nDəyişiklik saytın izləmə səhifəsində görünəcək. Bütün əməliyyatlar sizin admin hesabınızla qeydə alınır.`, [
      [this.button(state, '🔎 Avtomobil tap', 'search', 'all')],
      [this.button(state, '👤 Müştəriyə görə', 'search', 'customer'), this.button(state, '📦 Konteynerə görə', 'search', 'container')],
      [this.button(state, 'ℹ️ İstifadə qaydası', 'help')],
    ]);
  }

  private async help(ctx: Context) {
    const state: State = { mode: 'menu', nonce: nonce() };
    await this.save(ctx, state);
    await this.send(ctx, 'ℹ️ Necə istifadə etməli?\n\n/search — VIN, izləmə/lot kodu, marka/model və ya müştəri ilə axtarış\n/customers — müştərinin adı və ya telefonu ilə axtarış\n/containers — konteyner nömrəsi ilə axtarış\n/menu — əsas menyu\n/cancel — cari əməliyyatı ləğv et\n\nNəticədə maşının VIN-i, müştərisi və izləmə kodunu yoxlayın. Dəyişiklik yalnız “Təsdiqlə” düyməsindən sonra saxlanır. Bir konteynerdə bir neçə maşın varsa, hər maşın ayrıca seçilib yenilənir.\n\nMüştəri bildirişləri saytın mövcud mərhələ qaydalarına və aktiv WhatsApp/SMS xidmətinə bağlıdır. Bildiriş göndərilməsi saxlanma ilə eyni şey deyil.\n\nTəhlükəsizlik: botu şəxsi söhbətdə istifadə edin. Giriş admin paneldən ləğv edilə bilər; köhnə mesajlardakı düymələr yenidən istifadə edilmir.', [[this.button(state, '← Əsas menyu', 'menu')]]);
  }

  private async promptSearch(ctx: Context, mode: SearchMode) {
    const state: State = { mode: 'search', nonce: nonce(), searchMode: mode };
    await this.save(ctx, state);
    const prompt = mode === 'customer' ? '👤 Müştərinin adını və ya telefon nömrəsini yazın.'
      : mode === 'container' ? '📦 Konteyner nömrəsini və ya onun bir hissəsini yazın.'
        : '🔎 VIN, izləmə/lot kodu, müştəri adı/telefonu, konteyner və ya marka/model yazın.';
    await this.send(ctx, `${prompt}\n\nƏn azı 2 simvol. Nəticədən dəqiq maşını seçəcəksiniz.`, [[this.button(state, '← Əsas menyu', 'menu')]]);
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

  private async car(ctx: Context, orderId: string) {
    const car = await this.actions.get(orderId);
    if (!car) { await this.menu(ctx, 'Bu maşın artıq mövcud deyil. Yenidən axtarın.\n\n'); return; }
    const state: State = { mode: 'car', nonce: nonce(), orderId };
    await this.save(ctx, state);
    const rows = [
      [this.button(state, '📍 Mərhələni yenilə', 'groups')],
      [this.button(state, '📦 Konteyner nömrəsi', 'edit', 'container'), this.button(state, '🔗 Canlı izləmə linki', 'edit', 'carrier')],
      [this.button(state, '🗓 Konteyner açılma tarixi', 'edit', 'openingDate')],
      [this.button(state, '← Əsas menyu / yeni axtarış', 'menu')],
    ];
    await this.send(ctx, `🚘 ${this.vehicle(car)}\n👤 Müştəri: ${clip(car.customerName, 150)}\n📞 Telefon: ${clip(car.customerPhone || 'Əlavə edilməyib', 35)}\n🔢 VIN: ${clip(car.vin, 32)}\n🔎 İzləmə kodu: ${clip(car.trackingCode, 80)}\n📍 Mərhələ: ${clip(statusLabelAz(car.status), 180)}\n📦 Konteyner: ${clip(car.containerNumber || 'Əlavə edilməyib', 40)}\n🗓 Açılma tarixi: ${clip(car.containerOpeningDate || 'Əlavə edilməyib', 40)}\n🔗 Daşıyıcı linki: ${clip(car.carrierTrackingUrl || 'Əlavə edilməyib', 900)}\n\nNəyi yeniləmək istəyirsiniz? Dəyişiklik yalnız bu maşına tətbiq olunur.`, rows);
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
  private send(ctx: Pick<Context, 'token' | 'chatId'>, text: string, keyboard?: Button[][]) {
    return this.http.call(ctx.token, 'sendMessage', {
      chat_id: ctx.chatId, text: clip(text, 4096, true), link_preview_options: { is_disabled: true },
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }
  private answer(token: string, id: string, text?: string) {
    // Telegram can reject an expired acknowledgement while the bound action is
    // still valid. It is only a spinner acknowledgement, never an authorization.
    return this.http.call(token, 'answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) }).catch(() => undefined);
  }
}
