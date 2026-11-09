import { TelegramConversationService } from './telegram-conversation.service';
import type { TelegramUpdate } from './telegram.types';
import { ShipmentStatus } from '@prisma/client';
import { statusLabelAz } from '../notify/notify.service';

const car = {
  id: 'car-1', trackingCode: 'NEX-1234', vin: '1HGCM82633A004352', make: 'Honda', model: 'Accord', year: 2020,
  customerName: 'Test Müştəri', customerPhone: '+994501234567', containerNumber: null,
  carrierTrackingUrl: null, containerOpeningDate: null, status: 'PURCHASED', updatedAt: '2026-11-09T10:00:00Z',
};
const token = 'test-token-not-sent-to-users';
const customer = { id: 'customer-1', name: 'Test Müştəri', phone: '+994501234567', activeCarCount: 2 };
const message = (text: string, extra: Record<string, unknown> = {}) => ({
  update_id: 1,
  message: { message_id: 10, from: { id: 101, is_bot: false, username: 'admin_test' }, chat: { id: 101, type: 'private' }, text, ...extra },
}) as TelegramUpdate;
const callback = (data: string, extra: Record<string, unknown> = {}) => ({
  update_id: 2,
  callback_query: {
    id: 'callback-id', from: { id: 101, is_bot: false }, data,
    message: { message_id: 11, chat: { id: 101, type: 'private' } }, ...extra,
  },
}) as TelegramUpdate;

function harness() {
  let conversation: unknown = null;
  let authorized = true;
  const access = {
    authorize: jest.fn(async () => authorized ? { userId: 'admin-1', conversation } : null),
    pair: jest.fn().mockResolvedValue(true),
    saveConversation: jest.fn(async (_userId: string, state: unknown) => { conversation = state; }),
  };
  const http = { call: jest.fn().mockResolvedValue({}) };
  const actions = {
    search: jest.fn().mockResolvedValue({ items: [car], hasMore: false }),
    activeCustomers: jest.fn().mockResolvedValue({ items: [customer], hasMore: false }),
    activeCustomerCars: jest.fn().mockResolvedValue({ customer, items: [car], hasMore: false }),
    activeCustomerCar: jest.fn().mockResolvedValue(car),
    get: jest.fn().mockResolvedValue(car),
    propose: jest.fn().mockResolvedValue({ id: 'action-1', text: 'Honda Accord · NEX-1234\nMüştəri: Test Müştəri\nƏvvəl: Maşın alındı\nSonra: Gəmi yola düşüb' }),
    confirm: jest.fn().mockResolvedValue({ text: 'Dəyişiklik saxlanıldı. Bildiriş: göndərilmədi.', orderId: car.id }),
  };
  const messaging = {
    ready: jest.fn().mockReturnValue(true),
    maxTextLength: jest.fn().mockReturnValue(2000),
    propose: jest.fn().mockImplementation(async (_userId: string, _telegramUserId: string, _chatId: string, _orderId: string, text: string) => ({
      id: 'whatsapp-action-1', text: `Müştəri: ${car.customerName}\nWhatsApp: ${car.customerPhone}\nVIN: ${car.vin}\nİzləmə: ${car.trackingCode}\n\nMesaj:\n${text}`,
    })),
    confirm: jest.fn().mockResolvedValue({ text: 'WhatsApp xidməti mesajı qəbul etdi. Bu, çatdırılma və ya oxunma təsdiqi deyil.', orderId: car.id }),
  };
  const service = new TelegramConversationService(access as never, http as never, actions as never, messaging as never);
  const sent = () => http.call.mock.calls.filter(call => call[1] === 'sendMessage').map(call => call[2] as {
    text: string; parse_mode?: string; reply_markup?: { inline_keyboard: { text: string; callback_data: string }[][] };
  });
  const last = () => sent()[sent().length - 1];
  const button = (label: string) => {
    const found = last().reply_markup?.inline_keyboard.flat().find(button => button.text.includes(label));
    if (!found) throw new Error(`Missing button ${label}`);
    return found.callback_data;
  };
  const press = async (label: string) => service.handle(callback(button(label)), token);
  const selectCar = async () => {
    await service.handle(message('/search'), token);
    await service.handle(message('Honda'), token);
    await press('Test Müştəri');
  };
  return { service, access, http, actions, messaging, sent, last, button, press, selectCar, state: () => conversation as Record<string, unknown>, revoke: () => { authorized = false; } };
}

describe('Telegram private conversation', () => {
  it('ignores groups, channels, bots, edited messages, inline callbacks and mismatched private senders', async () => {
    const { service, access, http, actions } = harness();
    await service.handle(message('/search', { chat: { id: 101, type: 'group' } }), token);
    await service.handle(message('/search', { from: { id: 101, is_bot: true } }), token);
    await service.handle(message('/search', { chat: { id: 999, type: 'private' } }), token);
    await service.handle({ update_id: 3, edited_message: { text: '/search' } } as unknown as TelegramUpdate, token);
    await service.handle({ update_id: 4, channel_post: { text: '/search' } } as unknown as TelegramUpdate, token);
    await service.handle(callback('anything', { message: undefined }), token);
    expect(access.authorize).not.toHaveBeenCalled();
    expect(actions.search).not.toHaveBeenCalled();
    expect(http.call).not.toHaveBeenCalled();
  });

  it('never exposes customer information to an unlinked account', async () => {
    const h = harness(); h.revoke();
    await h.service.handle(message('/search'), token);
    await h.service.handle(callback('tg:aaaaaaaaaaaaaaaa:confirm'), token);
    expect(h.actions.search).not.toHaveBeenCalled();
    expect(h.actions.get).not.toHaveBeenCalled();
    expect(h.actions.confirm).not.toHaveBeenCalled();
    expect(h.last().text).toContain('yalnız icazəli');
    expect(JSON.stringify(h.sent())).not.toContain(car.customerName);
    expect(h.http.call).toHaveBeenLastCalledWith(token, 'answerCallbackQuery', expect.objectContaining({ text: 'Bu hesabın idarəetmə icazəsi yoxdur.' }));
  });

  it('pairs only through a one-use start secret and does not echo the secret', async () => {
    const h = harness();
    const secret = 'a'.repeat(43);
    await h.service.handle(message(`/start ${secret}`), token);
    expect(h.access.pair).toHaveBeenCalledWith(secret, '101', '101', 'admin_test', undefined);
    expect(h.last().text).toContain('uğurla qoşuldu');
    expect(JSON.stringify(h.sent())).not.toContain(secret);
    h.access.pair.mockResolvedValueOnce(false);
    await h.service.handle(message(`/start ${secret}`), token);
    expect(h.last().text).toContain('etibarsızdır');
  });

  it('uses plain text, short server-scoped callbacks and a clear menu', async () => {
    const h = harness();
    await h.service.handle(message('/menu'), token);
    expect(h.last().text).toContain('Dəqiq maşını seçin');
    expect(h.last().parse_mode).toBeUndefined();
    const buttons = h.last().reply_markup!.inline_keyboard.flat();
    expect(buttons.length).toBe(5);
    for (const button of buttons) {
      expect(Buffer.byteLength(button.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      expect(button.callback_data).toMatch(/^tg:[a-f0-9]{16}:/);
    }
  });

  it('opens active customers from the menu, then exact customer cars without mutating anything', async () => {
    const h = harness();
    await h.service.handle(message('/menu'), token);
    await h.press('Yolda olan aktiv');
    expect(h.actions.activeCustomers).toHaveBeenCalledWith('', 0);
    expect(h.last().text).toContain('Aktiv maşın: 2');
    expect(h.last().text).toContain('Alışdan təhvilə');
    expect(h.last().text).toContain('Təhvil verilmiş və ləğv olunmuş');
    await h.press('Test Müştəri');
    expect(h.actions.activeCustomerCars).toHaveBeenCalledWith('customer-1', 0);
    expect(h.last().text).toContain(car.vin);
    expect(h.last().text).toContain(statusLabelAz(car.status));
    await h.press('Honda');
    expect(h.state()).toMatchObject({ mode: 'car', orderId: car.id });
    expect(h.actions.activeCustomerCar).toHaveBeenCalledWith('customer-1', car.id);
    expect(h.actions.get).not.toHaveBeenCalled();
    expect(h.actions.propose).not.toHaveBeenCalled();
    expect(h.actions.confirm).not.toHaveBeenCalled();
  });

  it('filters active customers by text and preserves the filter and pagination when going back', async () => {
    const h = harness();
    h.actions.activeCustomers.mockResolvedValue({ items: [customer], hasMore: true });
    h.actions.activeCustomerCars.mockResolvedValue({ customer, items: [car], hasMore: true });
    await h.service.handle(message('/active'), token);
    await h.press('Ad və ya telefonla');
    await h.service.handle(message('Test Müştəri'), token);
    expect(h.actions.activeCustomers).toHaveBeenLastCalledWith('Test Müştəri', 0);
    await h.press('Növbəti');
    expect(h.actions.activeCustomers).toHaveBeenLastCalledWith('Test Müştəri', 1);
    await h.press('Test Müştəri');
    await h.press('Növbəti maşınlar');
    expect(h.actions.activeCustomerCars).toHaveBeenLastCalledWith('customer-1', 1);
    await h.press('Aktiv müştərilərə qayıt');
    expect(h.actions.activeCustomers).toHaveBeenLastCalledWith('Test Müştəri', 1);
    await h.press('Bütün aktiv');
    expect(h.actions.activeCustomers).toHaveBeenLastCalledWith('', 0);
    expect(h.actions.search).not.toHaveBeenCalled();
  });

  it('supports direct typing while browsing active customers and validates search input', async () => {
    const h = harness();
    await h.service.handle(message('/active'), token);
    await h.service.handle(message('x'), token);
    expect(h.actions.activeCustomers).toHaveBeenCalledTimes(1);
    await h.service.handle(message('050 123 45 67'), token);
    expect(h.actions.activeCustomers).toHaveBeenLastCalledWith('050 123 45 67', 0);
  });

  it('does not execute forged, out-of-range or stale active customer callbacks', async () => {
    const h = harness();
    await h.service.handle(message('/active'), token);
    const old = h.button('Test Müştəri');
    const current = h.state().nonce;
    await h.service.handle(callback(`tg:${current}:customer:8`), token);
    await h.service.handle(callback(`tg:${current}:activepage:10`), token);
    expect(h.actions.activeCustomerCars).not.toHaveBeenCalled();
    await h.press('Test Müştəri');
    await h.service.handle(callback(old), token);
    const carsNonce = h.state().nonce;
    await h.service.handle(callback(`tg:${carsNonce}:activecar:8`), token);
    await h.service.handle(callback(`tg:${carsNonce}:customerpage:1`), token);
    expect(h.actions.activeCustomerCars).toHaveBeenCalledTimes(1);
    expect(h.actions.get).not.toHaveBeenCalled();
  });

  it.each(['DELIVERED', 'CANCELLED'])('refreshes a stale active car selection that is now %s', async status => {
    const h = harness();
    await h.service.handle(message('/active'), token);
    await h.press('Test Müştəri');
    h.actions.activeCustomerCar.mockResolvedValueOnce({ ...car, status });
    h.actions.activeCustomerCars.mockResolvedValueOnce({ customer, items: [], hasMore: false });
    await h.press('Honda');
    expect(h.state()).toMatchObject({ mode: 'customerCars', ids: [] });
    expect(h.sent().some(item => item.text.includes('artıq aktiv siyahıda deyil'))).toBe(true);
    expect(h.actions.propose).not.toHaveBeenCalled();
  });

  it('shows honest empty states and hides active query infrastructure failures', async () => {
    const h = harness();
    h.actions.activeCustomers.mockResolvedValueOnce({ items: [], hasMore: false });
    await h.service.handle(message('/active'), token);
    expect(h.last().text).toContain('aktiv daşınması olan müştəri yoxdur');
    h.actions.activeCustomers.mockRejectedValueOnce(new Error('database password secret'));
    await h.service.handle(message('/active'), token);
    expect(h.last().text).toContain('hazırda alınmadı');
    expect(JSON.stringify(h.sent())).not.toContain('database password');
    await h.service.handle(message('/active'), token);
    h.actions.activeCustomerCars.mockResolvedValueOnce({ customer: null as never, items: [], hasMore: false });
    await h.press('Test Müştəri');
    expect(h.state()).toMatchObject({ mode: 'activeCustomers' });
  });

  it('never exposes active customers after authorization is revoked', async () => {
    const h = harness();
    await h.service.handle(message('/active'), token);
    const selected = h.button('Test Müştəri');
    h.revoke();
    await h.service.handle(callback(selected), token);
    await h.service.handle(message('/active'), token);
    expect(h.actions.activeCustomerCars).not.toHaveBeenCalled();
    expect(h.actions.activeCustomers).toHaveBeenCalledTimes(1);
  });

  it('keeps eight long active customer/car results within Telegram size and callback byte limits', async () => {
    const h = harness();
    h.actions.activeCustomers.mockResolvedValue({ items: Array.from({ length: 8 }, (_, i) => ({ ...customer, id: `customer-${i}`, name: '<\n>' + 'Ə'.repeat(300) })), hasMore: true });
    h.actions.activeCustomerCars.mockResolvedValue({ customer, items: Array.from({ length: 8 }, (_, i) => ({ ...car, id: `car-${i}`, make: 'M'.repeat(200), model: 'N'.repeat(200) })), hasMore: true });
    await h.service.handle(message('/active'), token);
    const selected = h.last().reply_markup!.inline_keyboard[0][0].callback_data;
    await h.service.handle(callback(selected), token);
    expect(h.last().text).toContain('8.');
    for (const sent of h.sent()) {
      expect([...sent.text].length).toBeLessThanOrEqual(4096);
      expect(sent.parse_mode).toBeUndefined();
      for (const button of sent.reply_markup?.inline_keyboard.flat() ?? []) expect(Buffer.byteLength(button.callback_data)).toBeLessThanOrEqual(64);
    }
  });

  it('searches by customer and selects a precise car with identifying details', async () => {
    const h = harness();
    await h.service.handle(message('/customers'), token);
    await h.service.handle(message('Test Müştəri'), token);
    expect(h.actions.search).toHaveBeenCalledWith('Test Müştəri', 'customer', 0);
    expect(h.last().text).toContain(car.vin);
    expect(h.last().text).toContain(car.trackingCode);
    await h.press('Test Müştəri');
    expect(h.actions.get).toHaveBeenCalledWith(car.id);
    expect(h.last().text).toContain('Dəyişiklik yalnız bu maşına tətbiq olunur');
    expect(h.last().text).toContain('Əlavə edilməyib');
    expect(h.state()).toMatchObject({ mode: 'car', orderId: car.id });
  });

  it('supports container search without suggesting bulk updates', async () => {
    const h = harness();
    await h.service.handle(message('/containers'), token);
    await h.service.handle(message('MSCU4829130'), token);
    expect(h.actions.search).toHaveBeenCalledWith('MSCU4829130', 'container', 0);
    await h.service.handle(message('/help'), token);
    expect(h.last().text).toContain('hər maşın ayrıca seçilib yenilənir');
  });

  it('rejects invalid search length and does not execute forged result selections', async () => {
    const h = harness();
    await h.service.handle(message('/search'), token);
    await h.service.handle(message('x'), token);
    expect(h.actions.search).not.toHaveBeenCalled();
    await h.service.handle(message('Honda'), token);
    const currentNonce = h.state().nonce;
    await h.service.handle(callback(`tg:${currentNonce}:car:9`), token);
    await h.service.handle(callback(`tg:${currentNonce}:confirm`), token);
    await h.service.handle(callback(`tg:${currentNonce}:page:9999`), token);
    expect(h.actions.get).not.toHaveBeenCalled();
    expect(h.actions.confirm).not.toHaveBeenCalled();
    expect(h.actions.search).toHaveBeenCalledTimes(1);
  });

  it('invalidates every older keyboard when navigating to a newer screen', async () => {
    const h = harness();
    await h.service.handle(message('/menu'), token);
    const old = h.button('Avtomobil tap');
    await h.selectCar();
    const currentState = h.state();
    await h.service.handle(callback(old), token);
    expect(h.state()).toEqual(currentState);
    expect(h.http.call).toHaveBeenLastCalledWith(token, 'answerCallbackQuery', expect.objectContaining({ text: expect.stringContaining('köhnəlib') }));
    expect(h.actions.search).toHaveBeenCalledTimes(1);
  });

  it('groups all stages and requires explicit confirmation before applying a stage', async () => {
    const h = harness();
    await h.selectCar();
    await h.press('Mərhələni yenilə');
    expect(h.last().reply_markup!.inline_keyboard).toHaveLength(9);
    await h.press('Gəmi ilə daşınma');
    expect(h.last().text).toContain('4/8');
    await h.press('2.');
    expect(h.actions.propose).toHaveBeenCalledWith('admin-1', '101', '101', car.id, 'status', 'SHIP_DEPARTED');
    expect(h.actions.confirm).not.toHaveBeenCalled();
    const confirm = h.button('Təsdiqlə');
    expect(h.last().text).toContain('Önizləmə'.toLowerCase());
    await h.service.handle(callback(confirm), token);
    await h.service.handle(callback(confirm), token);
    expect(h.actions.confirm).toHaveBeenCalledTimes(1);
    expect(h.actions.confirm).toHaveBeenCalledWith('action-1', 'admin-1', '101', '101');
    expect(h.sent().some(item => item.text.includes('Bildiriş: göndərilmədi'))).toBe(true);
  });

  it('normalizes container input and previews without immediately writing', async () => {
    const h = harness();
    await h.selectCar();
    await h.press('Konteyner nömrəsi');
    await h.service.handle(message('mscu 4829130'), token);
    expect(h.actions.propose).toHaveBeenCalledWith('admin-1', '101', '101', car.id, 'container', 'MSCU4829130');
    expect(h.actions.confirm).not.toHaveBeenCalled();
    expect(h.state()).toMatchObject({ mode: 'confirm', orderId: car.id, actionId: 'action-1' });
  });

  it('does not clear existing fields through empty or dash input', async () => {
    const h = harness();
    await h.selectCar();
    await h.press('Canlı izləmə linki');
    await h.service.handle(message('-'), token);
    expect(h.actions.propose).not.toHaveBeenCalled();
    expect(h.last().text).toContain('Dəyər boş');
    expect(h.state()).toMatchObject({ mode: 'edit', kind: 'carrier' });
  });

  it('offers strict date entry and safely hides infrastructure exceptions', async () => {
    const h = harness();
    await h.selectCar();
    await h.press('Konteyner açılma tarixi');
    expect(h.last().text).toContain('YYYY-MM-DD');
    h.actions.propose.mockRejectedValueOnce(new Error(`https://api.telegram.org/bot${token}/sendMessage database password`));
    await h.service.handle(message('2026-11-31'), token);
    expect(h.last().text).toContain('Tarix qəbul edilmədi');
    expect(JSON.stringify(h.sent())).not.toContain(token);
    expect(JSON.stringify(h.sent())).not.toContain('database password');
    expect(h.state()).toMatchObject({ mode: 'edit', kind: 'openingDate' });
  });

  it('cancels a pending confirmation and prevents replaying its old button', async () => {
    const h = harness();
    await h.selectCar();
    await h.press('Konteyner nömrəsi');
    await h.service.handle(message('MSCU4829130'), token);
    const confirm = h.button('Təsdiqlə');
    await h.service.handle(message('/cancel'), token);
    await h.service.handle(callback(confirm), token);
    expect(h.actions.confirm).not.toHaveBeenCalled();
    expect(h.state()).toMatchObject({ mode: 'menu' });
  });

  it('rechecks authorization before a previously valid confirmation', async () => {
    const h = harness();
    await h.selectCar();
    await h.press('Konteyner nömrəsi');
    await h.service.handle(message('MSCU4829130'), token);
    const confirm = h.button('Təsdiqlə');
    h.revoke();
    await h.service.handle(callback(confirm), token);
    expect(h.actions.confirm).not.toHaveBeenCalled();
    expect(h.http.call).toHaveBeenLastCalledWith(token, 'answerCallbackQuery', expect.objectContaining({ text: 'Bu hesabın idarəetmə icazəsi yoxdur.' }));
  });

  it('handles expired server-side proposals without reporting success or revealing errors', async () => {
    const h = harness();
    await h.selectCar();
    await h.press('Konteyner nömrəsi');
    await h.service.handle(message('MSCU4829130'), token);
    h.actions.confirm.mockRejectedValueOnce(new Error('secret database connection'));
    await h.press('Təsdiqlə');
    expect(h.sent().some(item => item.text.includes('Yeniləmə təsdiqlənmədi'))).toBe(true);
    expect(JSON.stringify(h.sent())).not.toContain('secret database');
    expect(h.state()).toMatchObject({ mode: 'car', orderId: car.id });
  });

  it('does not let an expired callback acknowledgement block an authorized action', async () => {
    const h = harness();
    await h.selectCar();
    const stages = h.button('Mərhələni yenilə');
    h.http.call.mockImplementation(async (_token: string, method: string) => {
      if (method === 'answerCallbackQuery') throw new Error('query too old');
      return {};
    });
    await expect(h.service.handle(callback(stages), token)).resolves.toBeUndefined();
    expect(h.state()).toMatchObject({ mode: 'groups', orderId: car.id });
  });

  it('does not misreport a committed mutation as failed when Telegram delivery fails', async () => {
    const h = harness();
    await h.selectCar();
    await h.press('Konteyner nömrəsi');
    await h.service.handle(message('MSCU4829130'), token);
    const confirm = h.button('Təsdiqlə');
    h.http.call.mockImplementation(async (_token: string, method: string) => {
      if (method === 'sendMessage') throw new Error('temporary Telegram failure');
      return {};
    });
    await expect(h.service.handle(callback(confirm), token)).rejects.toThrow('temporary Telegram failure');
    expect(h.actions.confirm).toHaveBeenCalledTimes(1);
    const messages = h.sent();
    expect(messages.some(item => item.text.includes('Yeniləmə təsdiqlənmədi'))).toBe(false);
  });

  it('delivers every old and new URL character before offering confirmation', async () => {
    const h = harness();
    await h.selectCar();
    await h.press('Canlı izləmə linki');
    const old = `https://carrier.example/old?value=${'a'.repeat(1950)}`;
    const next = `https://carrier.example/new?value=${'b'.repeat(1950)}`;
    const preview = `Müştəri: Test Müştəri\n${'Başlıq '.repeat(20)}\nƏvvəl: ${old}\nSonra: ${next}\nEND-OF-FULL-PREVIEW`;
    h.actions.propose.mockResolvedValueOnce({ id: 'long-action', text: preview });
    const previousCount = h.sent().length;
    await h.service.handle(message(next), token);
    const delivered = h.sent().slice(previousCount);
    expect(delivered).toHaveLength(3);
    expect(delivered[0].reply_markup).toBeUndefined();
    expect(delivered[1].reply_markup).toBeUndefined();
    expect(delivered.slice(0, -1).map(item => item.text).join('')).toContain('END-OF-FULL-PREVIEW');
    expect(h.last().reply_markup!.inline_keyboard.flat().some(item => item.text.includes('Təsdiqlə'))).toBe(true);
    expect(h.actions.confirm).not.toHaveBeenCalled();
    for (const item of delivered) expect([...item.text].length).toBeLessThanOrEqual(4096);
  });

  it('safely handles unavailable search without leaking the cause', async () => {
    const h = harness();
    await h.service.handle(message('/search'), token);
    h.actions.search.mockRejectedValueOnce(new Error('database credentials'));
    await h.service.handle(message('Honda'), token);
    expect(h.last().text).toContain('Axtarış hazırda alınmadı');
    expect(JSON.stringify(h.sent())).not.toContain('database credentials');
    expect(h.state()).toMatchObject({ mode: 'search' });
  });

  it('binds authorization, pairing and screen persistence to the current bot identity', async () => {
    const h = harness();
    const secret = 'a'.repeat(32);
    await h.service.handle(message(`/start ${secret}`), token, 'bot-123');
    expect(h.access.pair).toHaveBeenCalledWith(secret, '101', '101', 'admin_test', 'bot-123');
    expect(h.access.authorize).toHaveBeenCalledWith('101', '101', 'bot-123');
    expect(h.access.saveConversation).toHaveBeenCalledWith('admin-1', expect.objectContaining({ mode: 'menu' }), '101', '101', 'bot-123');
  });

  it('makes every shipment stage reachable and keeps callbacks below Telegram byte limits', async () => {
    const h = harness();
    const screens: string[] = [];
    for (let groupIndex = 0; groupIndex < 8; groupIndex += 1) {
      await h.selectCar();
      await h.press('Mərhələni yenilə');
      const group = h.last().reply_markup!.inline_keyboard[groupIndex][0].callback_data;
      await h.service.handle(callback(group), token);
      screens.push(h.last().text);
    }
    for (const status of Object.values(ShipmentStatus)) expect(screens.join('\n')).toContain(statusLabelAz(status));
    for (const sent of h.sent()) {
      for (const button of sent.reply_markup?.inline_keyboard.flat() ?? []) {
        expect(Buffer.byteLength(button.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }
    expect(h.actions.confirm).not.toHaveBeenCalled();
  });

  describe('customer WhatsApp compose and confirmation', () => {
    const compose = async (h: ReturnType<typeof harness>) => {
      await h.selectCar();
      await h.press('Müştəriyə WhatsApp yaz');
    };

    it('requires a selected car, exact recipient preview and a separate explicit send confirmation', async () => {
      const h = harness();
      await h.service.handle(message('/menu'), token);
      await h.service.handle(callback(`tg:${h.state().nonce}:whatsapp`), token);
      expect(h.messaging.ready).not.toHaveBeenCalled();
      await compose(h);
      expect(h.state()).toMatchObject({ mode: 'whatsappDraft', orderId: car.id });
      expect(h.last().text).toContain(car.customerName);
      expect(h.last().text).toContain(car.customerPhone);
      expect(h.last().text).toContain(car.vin);
      expect(h.last().text).toContain('razılıq vermiş müştəriyə');
      expect(h.messaging.propose).not.toHaveBeenCalled();
      expect(h.messaging.confirm).not.toHaveBeenCalled();
      const body = 'Salam, maşınınız limana çatıb.\n\nƏlavə məlumat üçün bizə yazın.';
      await h.service.handle(message(body), token);
      expect(h.messaging.propose).toHaveBeenCalledWith('admin-1', '101', '101', car.id, body);
      expect(h.state()).toMatchObject({ mode: 'whatsappConfirm', orderId: car.id, actionId: 'whatsapp-action-1' });
      expect(h.last().text).toContain(body);
      expect(h.last().text).toContain(car.customerPhone);
      expect(h.last().text).toContain(car.vin);
      expect(h.last().parse_mode).toBeUndefined();
      expect(h.messaging.confirm).not.toHaveBeenCalled();
      await h.service.handle(message('Bu əlavə mətn avtomatik göndərilməsin'), token);
      expect(h.messaging.propose).toHaveBeenCalledTimes(1);
      expect(h.messaging.confirm).not.toHaveBeenCalled();
      expect(h.state().mode).toBe('whatsappConfirm');
      // The previously displayed confirmation remains the only valid send button.
      const confirmation = h.sent().flatMap(item => item.reply_markup?.inline_keyboard.flat() ?? []).find(item => item.text.includes('WhatsApp-a göndər'))!.callback_data;
      await h.service.handle(callback(confirmation), token);
      expect(h.messaging.confirm).toHaveBeenCalledWith('whatsapp-action-1', 'admin-1', '101', '101');
      expect(h.actions.confirm).not.toHaveBeenCalled();
      expect(h.actions.propose).not.toHaveBeenCalled();
      expect(h.sent().some(item => item.text.includes('xidməti mesajı qəbul etdi'))).toBe(true);
      expect(h.sent().some(item => item.text.includes('çatdırılma və ya oxunma təsdiqi deyil'))).toBe(true);
    });

    it('blocks compose if WhatsApp is disabled or the customer has no phone', async () => {
      const h = harness();
      await h.selectCar();
      h.messaging.ready.mockReturnValueOnce(false);
      await h.press('Müştəriyə WhatsApp yaz');
      expect(h.state().mode).toBe('car');
      expect(h.last().text).toContain('Admin paneldə');
      expect(h.messaging.propose).not.toHaveBeenCalled();
      await h.selectCar();
      h.actions.get.mockResolvedValueOnce({ ...car, customerPhone: '' });
      await h.press('Müştəriyə WhatsApp yaz');
      expect(h.state().mode).toBe('car');
      expect(h.last().text).toContain('telefon nömrəsi qeyd olunmayıb');
      expect(h.messaging.confirm).not.toHaveBeenCalled();
    });

    it('preserves the exact draft text, including CRLF, tabs and outer whitespace', async () => {
      const h = harness();
      await compose(h);
      const body = '  Salam\r\n\r\nMaşınınız\tlimana çatıb.  \r\n';
      await h.service.handle(message(body), token);
      expect(h.messaging.propose).toHaveBeenCalledWith('admin-1', '101', '101', car.id, body);
      expect(h.last().text).toContain(`Mesaj:\n${body}`);
      expect(h.last().text).toContain('razılıq vermiş müştəriyə');
      expect(h.last().parse_mode).toBeUndefined();
      expect(h.messaging.confirm).not.toHaveBeenCalled();
    });

    it('displays and enforces a lower provider-specific limit without clipping the draft', async () => {
      const h = harness();
      h.messaging.maxTextLength.mockReturnValue(1600);
      await compose(h);
      expect(h.last().text).toContain('1–1600 simvol');
      await h.service.handle(message('Ə'.repeat(1601)), token);
      expect(h.messaging.propose).not.toHaveBeenCalled();
      expect(h.state().mode).toBe('whatsappDraft');
      expect(h.last().text).toContain('1–1600');
      const body = 'Ə'.repeat(1600);
      await h.service.handle(message(body), token);
      expect(h.messaging.propose).toHaveBeenCalledWith('admin-1', '101', '101', car.id, body);
      expect(h.last().text).toContain(body);
      expect(h.messaging.confirm).not.toHaveBeenCalled();
    });

    it('does not forward a forged shipment confirm or a WhatsApp confirm from the wrong state', async () => {
      const h = harness();
      await compose(h);
      await h.service.handle(callback(`tg:${h.state().nonce}:whatsconfirm`), token);
      await h.service.handle(message('Salam'), token);
      await h.service.handle(callback(`tg:${h.state().nonce}:confirm`), token);
      expect(h.messaging.confirm).not.toHaveBeenCalled();
      expect(h.actions.confirm).not.toHaveBeenCalled();
    });

    it.each(['/cancel', '/menu', '/start secretPairingValueThatMustNotBeForwarded', '/start secretPairingValueThatMustNotBeForwarded\nYeni sətir'])('cancels composing safely via %s', async command => {
      const h = harness();
      await compose(h);
      await h.service.handle(message(command), token);
      expect(h.state().mode).toBe('menu');
      expect(h.messaging.propose).not.toHaveBeenCalled();
      expect(h.messaging.confirm).not.toHaveBeenCalled();
      expect(h.access.pair).not.toHaveBeenCalled();
      expect(h.last().text).toContain('Heç bir mesaj göndərilmədi');
      expect(JSON.stringify(h.sent())).not.toContain('secretPairingValue');
    });

    it.each(['/help', '/search məlumat', '/custom-code'])('preserves slash-leading draft text %s without invoking a bot command', async body => {
      const h = harness();
      await compose(h);
      const beforeSearch = h.actions.search.mock.calls.length;
      await h.service.handle(message(body), token);
      expect(h.messaging.propose).toHaveBeenCalledWith('admin-1', '101', '101', car.id, body);
      expect(h.actions.search).toHaveBeenCalledTimes(beforeSearch);
      expect(h.last().text).toContain(body);
      expect(h.messaging.confirm).not.toHaveBeenCalled();
    });

    it('validates Unicode code points and remains in draft for empty, non-text or oversized inputs', async () => {
      const h = harness();
      await compose(h);
      await h.service.handle(message('   '), token);
      await h.service.handle(message('', { text: undefined, photo: [] }), token);
      await h.service.handle(message('🚘'.repeat(2001)), token);
      expect(h.messaging.propose).not.toHaveBeenCalled();
      expect(h.state().mode).toBe('whatsappDraft');
      const body = '🚘'.repeat(2000);
      await h.service.handle(message(body), token);
      expect(h.messaging.propose).toHaveBeenCalledWith('admin-1', '101', '101', car.id, body);
      expect(h.messaging.confirm).not.toHaveBeenCalled();
      for (const item of h.sent()) expect(item.text.length).toBeLessThanOrEqual(4096);
      const previewParts = h.sent().filter(item => item.text.includes('tam önizləməsi') || item.text.includes('🚘🚘'));
      expect(previewParts.map(item => item.text).join('')).toContain(body);
    });

    it('shows the entire preview, including whitespace at split boundaries, before offering send', async () => {
      const h = harness();
      await compose(h);
      const preview = `Müştəri: ${car.customerName}\nTelefon: ${car.customerPhone}\nVIN: ${car.vin}\n${'x'.repeat(3700)}\n \n${'🚗'.repeat(170)}\nEND-OF-WHATSAPP-PREVIEW`;
      h.messaging.propose.mockResolvedValueOnce({ id: 'long-wa', text: preview });
      const previousCount = h.sent().length;
      await h.service.handle(message('Salam'), token);
      const delivered = h.sent().slice(previousCount);
      expect(delivered.length).toBeGreaterThan(2);
      expect(delivered.slice(0, -1).every(item => item.reply_markup === undefined)).toBe(true);
      expect(delivered.slice(0, -1).map(item => item.text).join('')).toBe(`💬 WhatsApp göndərişinin tam önizləməsi\n\n${preview}`);
      expect(h.last().reply_markup!.inline_keyboard.flat().some(item => item.text.includes('WhatsApp-a göndər'))).toBe(true);
      for (const item of delivered) expect(item.text.length).toBeLessThanOrEqual(4096);
      expect(h.messaging.confirm).not.toHaveBeenCalled();
    });

    it('cancels or rewrites a preview without sending and rejects its stale keyboard', async () => {
      const h = harness();
      await compose(h);
      await h.service.handle(message('Birinci mesaj'), token);
      const oldSend = h.button('WhatsApp-a göndər');
      await h.press('Mesajı yenidən yaz');
      expect(h.state().mode).toBe('whatsappDraft');
      await h.service.handle(callback(oldSend), token);
      expect(h.messaging.confirm).not.toHaveBeenCalled();
      await h.service.handle(message('Yeni mesaj'), token);
      const newSend = h.button('WhatsApp-a göndər');
      await h.press('Göndərmədən maşına qayıt');
      await h.service.handle(callback(newSend), token);
      expect(h.messaging.confirm).not.toHaveBeenCalled();
      expect(h.state().mode).toBe('car');
    });

    it('rechecks authorization for typed messages and confirmation', async () => {
      const draft = harness();
      await compose(draft);
      draft.revoke();
      await draft.service.handle(message('Salam'), token);
      expect(draft.messaging.propose).not.toHaveBeenCalled();
      const confirmed = harness();
      await compose(confirmed);
      await confirmed.service.handle(message('Salam'), token);
      const send = confirmed.button('WhatsApp-a göndər');
      confirmed.revoke();
      await confirmed.service.handle(callback(send), token);
      expect(confirmed.messaging.confirm).not.toHaveBeenCalled();
    });

    it('consumes a send keyboard once, including concurrent or replayed presses', async () => {
      const h = harness();
      await compose(h);
      await h.service.handle(message('Salam'), token);
      const send = h.button('WhatsApp-a göndər');
      await Promise.all([h.service.handle(callback(send), token), h.service.handle(callback(send), token)]);
      expect(h.messaging.confirm).toHaveBeenCalledTimes(1);
      expect(h.state().mode).toBe('car');
    });

    it.each([
      'WhatsApp xidməti sorğunu rədd etdi. Mesaj göndərilmədi; SMS-ə keçilmədi.',
      'WhatsApp göndərişinin nəticəsi qeyri-müəyyəndir. Avtomatik təkrar göndərilmədi. Provayderdə yoxlayın.',
    ])('reports the safe provider outcome verbatim without claiming delivery: %s', async text => {
      const h = harness();
      await compose(h);
      await h.service.handle(message('Salam'), token);
      h.messaging.confirm.mockResolvedValueOnce({ text, orderId: car.id });
      await h.press('WhatsApp-a göndər');
      expect(h.sent().some(item => item.text === text)).toBe(true);
      expect(h.messaging.confirm).toHaveBeenCalledTimes(1);
      expect(h.actions.confirm).not.toHaveBeenCalled();
    });

    it('hides proposal/confirmation infrastructure errors and never automatically retries', async () => {
      const h = harness();
      await compose(h);
      h.messaging.propose.mockRejectedValueOnce(new Error('secret provider token'));
      await h.service.handle(message('Salam'), token);
      expect(h.state().mode).toBe('whatsappDraft');
      expect(h.last().text).toContain('Heç bir mesaj göndərilmədi');
      await h.service.handle(message('Salam'), token);
      h.messaging.confirm.mockRejectedValueOnce(new Error('secret provider token'));
      await h.press('WhatsApp-a göndər');
      expect(h.sent().some(item => item.text.includes('WhatsApp göndərişi təsdiqlənmədi'))).toBe(true);
      expect(JSON.stringify(h.sent())).not.toContain('secret provider');
      expect(h.messaging.confirm).toHaveBeenCalledTimes(1);
      expect(h.state().mode).toBe('car');
    });

    it('does not misreport or resend WhatsApp if its result cannot be delivered to Telegram', async () => {
      const h = harness();
      await compose(h);
      await h.service.handle(message('Salam'), token);
      const send = h.button('WhatsApp-a göndər');
      h.http.call.mockImplementation(async (_token: string, method: string) => {
        if (method === 'sendMessage') throw new Error('Telegram transport unavailable');
        return {};
      });
      await expect(h.service.handle(callback(send), token)).rejects.toThrow('Telegram transport unavailable');
      expect(h.messaging.confirm).toHaveBeenCalledTimes(1);
      expect(h.state().mode).toBe('menu');
      await h.service.handle(callback(send), token);
      expect(h.messaging.confirm).toHaveBeenCalledTimes(1);
      expect(h.sent().some(item => item.text.includes('WhatsApp göndərişi təsdiqlənmədi'))).toBe(false);
    });
  });
});
