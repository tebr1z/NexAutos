import 'reflect-metadata';
import { normalizeCustomerWhatsAppPhone, NotifyService } from './notify.service';

const ENV_KEYS = ['VEXIRA_WHATSAPP_KEY', 'VEXIRA_WHATSAPP_URL', 'WHATSAPP_API_KEY', 'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'TWILIO_WHATSAPP_FROM', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'] as const;

describe('explicit customer WhatsApp delivery', () => {
  const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  let send: jest.SpiedFunction<typeof fetch>;
  const service = new NotifyService();
  const response = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    send = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({ success: true }));
  });
  afterEach(() => {
    send.mockRestore();
    for (const key of ENV_KEYS) original[key] === undefined ? delete process.env[key] : process.env[key] = original[key];
  });

  it.each([
    ['050 123 45 67', '994501234567'], ['+994 (50) 123-45-67', '994501234567'],
    ['00994501234567', '994501234567'], ['+15551234567', '15551234567'],
    ['994501234567 ext 1', null], ['994501234567\n994551234567', null],
    ['1234567890123456', null], ['+00000000000', null], ['n/a', null], ['+994+501234567', null],
  ])('validates an exact bounded phone %s', (raw, expected) => {
    expect(normalizeCustomerWhatsAppPhone(raw)).toBe(expected);
  });

  it('reports readiness only for usable credentials and never treats SMS-only as WhatsApp', () => {
    process.env.TWILIO_FROM = '+15551234567';
    expect(service.customerWhatsAppReady()).toBe(false);
    process.env.TWILIO_WHATSAPP_FROM = '+15551234567';
    expect(service.customerWhatsAppReady()).toBe(false);
    process.env.TWILIO_ACCOUNT_SID = 'ACprivate';
    process.env.TWILIO_AUTH_TOKEN = 'private';
    expect(service.customerWhatsAppReady()).toBe(true);
    delete process.env.TWILIO_AUTH_TOKEN;
    process.env.WHATSAPP_TOKEN = 'private';
    expect(service.customerWhatsAppReady()).toBe(false);
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234';
    expect(service.customerWhatsAppReady()).toBe(true);
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    process.env.VEXIRA_WHATSAPP_KEY = ' ';
    expect(service.customerWhatsAppReady()).toBe(false);
    process.env.WHATSAPP_API_KEY = 'private';
    expect(service.customerWhatsAppReady()).toBe(true);
  });

  it('sends the exact text to Vexira once with normalized recipient and no appended footer', async () => {
    process.env.VEXIRA_WHATSAPP_KEY = 'secret';
    process.env.WHATSAPP_TOKEN = 'meta';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234';
    const body = '  Salam, maşınınız yoldadır.\n\nSabah məlumat veriləcək.  ';
    expect(await service.sendCustomerWhatsApp('050 123 45 67', body)).toEqual({ sent: true, channel: 'whatsapp', outcome: 'accepted' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][1]?.body as string)).toEqual({ phone: '+994501234567', message: body });
    expect(send.mock.calls[0][1]?.redirect).toBe('error');
  });

  it.each([
    [{ success: false, message: 'secret provider info' }, 200, 'failed'],
    ['<html>proxy page</html>', 200, 'unknown'], [{}, 200, 'unknown'],
    [{ error: 'secret provider info' }, 400, 'failed'],
    [{ error: 'secret provider info' }, 429, 'failed'],
    [{ error: 'secret provider info' }, 500, 'unknown'],
    [{ error: 'secret provider info' }, 408, 'unknown'],
  ])('classifies Vexira response without provider/SMS fallback or raw error exposure %#', async (body, status, outcome) => {
    process.env.VEXIRA_WHATSAPP_KEY = 'secret';
    process.env.WHATSAPP_TOKEN = 'meta';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234';
    process.env.TWILIO_WHATSAPP_FROM = '+15551234567';
    process.env.TWILIO_FROM = '+15551234567';
    process.env.TWILIO_ACCOUNT_SID = 'ACsecret';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    send.mockResolvedValue(response(body, status));
    const result = await service.sendCustomerWhatsApp('994501234567', 'Mesaj');
    expect(result).toMatchObject({ sent: false, outcome });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain('vexira');
  });

  it('network uncertainty never falls back or exposes request credentials', async () => {
    process.env.VEXIRA_WHATSAPP_KEY = 'secret';
    process.env.TWILIO_FROM = '+15551234567';
    send.mockRejectedValue(new Error('https://provider.example?key=secret'));
    expect(await service.sendCustomerWhatsApp('994501234567', 'Mesaj')).toEqual({ sent: false, outcome: 'unknown', error: 'provider_uncertain' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('selects Meta directly if no usable Vexira key exists and requires a message id', async () => {
    process.env.VEXIRA_WHATSAPP_KEY = ' ';
    process.env.WHATSAPP_TOKEN = 'meta';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234';
    send.mockResolvedValueOnce(response({ messages: [{ id: 'wamid.test' }] })).mockResolvedValueOnce(response({ ok: true }));
    expect((await service.sendCustomerWhatsApp('994501234567', 'Salam\nMüştəri')).outcome).toBe('accepted');
    expect(send.mock.calls[0][0]).toContain('graph.facebook.com/v21.0/1234/messages');
    expect(JSON.parse(send.mock.calls[0][1]?.body as string)).toEqual({ messaging_product: 'whatsapp', to: '994501234567', type: 'text', text: { body: 'Salam\nMüştəri', preview_url: true } });
    expect((await service.sendCustomerWhatsApp('994501234567', 'Mesaj')).outcome).toBe('unknown');
  });

  it('selects only Twilio WhatsApp and does not claim queued means delivered', async () => {
    process.env.TWILIO_WHATSAPP_FROM = '+15551234567';
    process.env.TWILIO_FROM = '+16661234567';
    process.env.TWILIO_ACCOUNT_SID = 'ACsecret';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    send.mockResolvedValueOnce(response({ sid: 'SMtest', status: 'queued' })).mockResolvedValueOnce(response({ sid: 'SMtest', status: 'failed' }));
    expect(await service.sendCustomerWhatsApp('994501234567', '/literal\nMesaj')).toEqual({ sent: true, channel: 'whatsapp', outcome: 'accepted' });
    const body = send.mock.calls[0][1]?.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({ To: 'whatsapp:+994501234567', From: 'whatsapp:+15551234567', Body: '/literal\nMesaj' });
    expect((await service.sendCustomerWhatsApp('994501234567', 'Mesaj')).outcome).toBe('failed');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('returns unconfigured/invalid recipient without making any external request', async () => {
    expect(await service.sendCustomerWhatsApp('994501234567', 'Mesaj')).toMatchObject({ outcome: 'failed', error: 'not_configured' });
    process.env.VEXIRA_WHATSAPP_KEY = 'secret';
    expect(await service.sendCustomerWhatsApp('994501234567ext123', 'Mesaj')).toMatchObject({ outcome: 'failed', error: 'no_phone' });
    expect(await service.sendCustomerWhatsApp('994501234567', '   ')).toMatchObject({ outcome: 'failed', error: 'no_message' });
    expect(send).not.toHaveBeenCalled();
  });

  it('applies Twilio-specific length only when it is the selected provider', async () => {
    process.env.TWILIO_WHATSAPP_FROM = '+15551234567';
    process.env.TWILIO_ACCOUNT_SID = 'ACsecret';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    expect(service.customerWhatsAppTextLimit()).toBe(1600);
    expect(await service.sendCustomerWhatsApp('994501234567', 'a'.repeat(1601))).toMatchObject({ outcome: 'failed', error: 'message_too_long' });
    expect(send).not.toHaveBeenCalled();
    process.env.WHATSAPP_TOKEN = 'meta';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234';
    expect(service.customerWhatsAppTextLimit()).toBe(2000);
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    process.env.VEXIRA_WHATSAPP_KEY = 'vexira';
    expect(service.customerWhatsAppTextLimit()).toBe(2000);
    expect((await service.sendCustomerWhatsApp('994501234567', 'a'.repeat(2000))).outcome).toBe('accepted');
    expect(send).toHaveBeenCalledTimes(1);
    expect((await service.sendCustomerWhatsApp('994501234567', 'a'.repeat(2001))).error).toBe('message_too_long');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
