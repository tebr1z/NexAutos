import 'reflect-metadata';
import { NotifyService, shouldNotifyStatus } from './notify.service';

const ENV_KEYS = [
  'VEXIRA_WHATSAPP_KEY', 'VEXIRA_WHATSAPP_URL', 'WHATSAPP_API_KEY',
  'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'TWILIO_WHATSAPP_FROM',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM',
  'SHIPMENT_SMS_ENABLED', 'NEXT_PUBLIC_SITE_URL', 'CORS_ORIGIN',
] as const;

const IMPORTANT_STATUSES = [
  'PURCHASED', 'PAYMENT_RECEIVED', 'PICKED_UP', 'EXPORT_DOCUMENTS', 'EXPORT_READY',
  'LOADED_CONTAINER', 'SHIP_DEPARTED', 'DESTINATION_PORT', 'CONTAINER_OPENED',
  'TIR_LOADED', 'TIR_DEPARTED', 'CUSTOMS_DOCUMENTS_READY', 'TIR_BAKU_CUSTOMS',
  'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
];

describe('important shipment notifications', () => {
  const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const input = { phone: '050 123 45 67', trackingCode: 'TRACK-123', make: 'Honda', model: 'Accord', status: 'PAYMENT_RECEIVED' };
  const response = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  let service: NotifyService;
  let send: jest.SpiedFunction<typeof fetch>;

  function configure() {
    process.env.VEXIRA_WHATSAPP_KEY = 'private-whatsapp';
    process.env.SHIPMENT_SMS_ENABLED = 'true';
    process.env.TWILIO_ACCOUNT_SID = 'ACprivate';
    process.env.TWILIO_AUTH_TOKEN = 'private-sms';
    process.env.TWILIO_FROM = '+15551234567';
  }

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.NEXT_PUBLIC_SITE_URL = 'https://nex.autos';
    service = new NotifyService();
    send = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('vexira')
      ? response({ success: true }) : response({ sid: 'SMtest', status: 'queued', error_code: null }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of ENV_KEYS) original[key] === undefined ? delete process.env[key] : process.env[key] = original[key];
  });

  it.each(IMPORTANT_STATUSES)('independently attempts WhatsApp and SMS for important stage %s', async (status) => {
    configure();
    expect(shouldNotifyStatus(status)).toBe(true);
    expect(await service.statusChanged({ ...input, status })).toEqual({
      sent: true, channel: 'whatsapp+sms',
      channelResults: {
        whatsapp: { sent: true, outcome: 'accepted' },
        sms: { sent: true, outcome: 'accepted' },
      },
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each([
    'AUCTION_PAID', 'AUCTION_RELEASED', 'TO_ORIGIN_PORT', 'ARRIVED_PORT', 'CONTAINER_LOADING',
    'VESSEL_WAITING', 'VESSEL_LOADED', 'IN_TRANSIT', 'ISTANBUL_TO_POTI', 'DESTINATION_APPROACHING',
    'CONTAINER_DISCHARGED', 'CONTAINER_OPENING_PENDING', 'TIR_LOADING_PENDING', 'CUSTOMS_DOCUMENTS',
    'TIR_GEORGIA_BORDER', 'CUSTOMS_CLEARANCE', 'NOT_A_STAGE',
  ])('does not send messages for noncritical stage %s', async (status) => {
    configure();
    expect(shouldNotifyStatus(status)).toBe(false);
    expect(await service.statusChanged({ ...input, status })).toEqual({ sent: false, error: 'skipped' });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends SMS to an ordinary telephone number, with a tracking link and safe request options', async () => {
    configure();
    await service.statusChanged(input);
    const [url, request] = send.mock.calls.find(([url]) => String(url).includes('twilio'))!;
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACprivate/Messages.json');
    expect(request).toEqual(expect.objectContaining({ method: 'POST', redirect: 'error', signal: expect.any(AbortSignal) }));
    const fields = Object.fromEntries(request?.body as URLSearchParams);
    expect(fields).toMatchObject({ To: '+994501234567', From: '+15551234567' });
    expect(fields.Body).toContain('Pul şirkətin hesabına mədaxil olub');
    expect(fields.Body).toContain('Honda Accord');
    expect(fields.Body).toContain('https://nex.autos/track/TRACK-123');
    expect(fields.To).not.toContain('whatsapp:');
  });

  it('reports WhatsApp acceptance separately when SMS is not configured', async () => {
    process.env.VEXIRA_WHATSAPP_KEY = 'private-whatsapp';
    process.env.SHIPMENT_SMS_ENABLED = 'true';
    expect(await service.statusChanged(input)).toEqual({
      sent: true, channel: 'whatsapp',
      channelResults: {
        whatsapp: { sent: true, outcome: 'accepted' },
        sms: { sent: false, outcome: 'failed', error: 'not_configured' },
      },
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('can send SMS without a WhatsApp provider', async () => {
    configure();
    delete process.env.VEXIRA_WHATSAPP_KEY;
    expect(await service.statusChanged(input)).toEqual({
      sent: true, channel: 'sms',
      channelResults: {
        whatsapp: { sent: false, outcome: 'failed', error: 'not_configured' },
        sms: { sent: true, outcome: 'accepted' },
      },
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(['false', 'FALSE', ' false '])('honors explicit shipment SMS disablement %s', async (value) => {
    configure();
    process.env.SHIPMENT_SMS_ENABLED = value;
    expect(await service.statusChanged(input)).toMatchObject({
      sent: true, channel: 'whatsapp',
      channelResults: { sms: { sent: false, outcome: 'failed', error: 'disabled' } },
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(String(send.mock.calls[0][0])).toContain('vexira');
  });

  it('keeps ordinary shipment SMS off by default even when valid SMS credentials exist', async () => {
    configure();
    delete process.env.SHIPMENT_SMS_ENABLED;
    expect(await service.statusChanged(input)).toMatchObject({
      sent: true, channel: 'whatsapp',
      channelResults: { sms: { sent: false, outcome: 'failed', error: 'disabled' } },
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(String(send.mock.calls[0][0])).toContain('vexira');
  });

  it.each(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'] as const)('never requests SMS with missing %s', async (key) => {
    configure();
    delete process.env[key];
    expect((await service.statusChanged(input)).channelResults?.sms).toEqual({ sent: false, outcome: 'failed', error: 'not_configured' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('still attempts SMS if the WhatsApp method unexpectedly throws', async () => {
    configure();
    jest.spyOn(service, 'sendCustomerWhatsApp').mockRejectedValue(new Error('private-whatsapp and customer text'));
    expect(await service.statusChanged(input)).toEqual({
      sent: true, channel: 'sms',
      channelResults: {
        whatsapp: { sent: false, outcome: 'unknown', error: 'provider_uncertain' },
        sms: { sent: true, outcome: 'accepted' },
      },
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('begins SMS independently without waiting for the WhatsApp response', async () => {
    configure();
    let completeWhatsApp!: (value: Response) => void;
    send.mockImplementation(async (url) => String(url).includes('vexira')
      ? new Promise<Response>((resolve) => { completeWhatsApp = resolve; })
      : response({ sid: 'SMtest', status: 'queued' }));
    const pending = service.statusChanged(input);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.some(([url]) => String(url).includes('twilio'))).toBe(true);
    completeWhatsApp(response({ success: true }));
    expect((await pending).channel).toBe('whatsapp+sms');
  });

  it.each([
    [{ success: false, message: 'private provider detail' }, 200, 'failed'],
    ['<html>private proxy error</html>', 200, 'unknown'],
    [{}, 200, 'unknown'],
    [{ message: 'private provider detail' }, 400, 'failed'],
    [{ message: 'private provider detail' }, 500, 'unknown'],
  ])('does not let a WhatsApp failure or unproven acceptance suppress SMS %#', async (body, status, outcome) => {
    configure();
    send.mockImplementation(async (url) => String(url).includes('vexira')
      ? response(body, status) : response({ sid: 'SMtest', status: 'queued' }));
    const result = await service.statusChanged(input);
    expect(result).toMatchObject({ sent: true, channel: 'sms', channelResults: { whatsapp: { sent: false, outcome }, sms: { sent: true, outcome: 'accepted' } } });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ sid: 'SMtest', status: 'failed' }, 200, 'failed', 'provider_rejected'],
    [{ sid: 'SMtest', status: 'undelivered' }, 200, 'failed', 'provider_rejected'],
    [{ sid: 'SMtest', status: 'canceled' }, 200, 'failed', 'provider_rejected'],
    [{ sid: 'SMtest', status: 'queued', error_code: 21610 }, 200, 'failed', 'provider_rejected'],
    [{ message: 'private provider detail' }, 400, 'failed', 'provider_rejected'],
    [{ message: 'private provider detail' }, 429, 'failed', 'provider_rejected'],
    [{ message: 'private provider detail' }, 500, 'unknown', 'provider_uncertain'],
    [{ message: 'private provider detail' }, 408, 'unknown', 'provider_uncertain'],
    ['<html>private proxy error</html>', 200, 'unknown', 'provider_uncertain'],
    [{ status: 'queued' }, 200, 'unknown', 'provider_uncertain'],
    [{ sid: '  ', status: 'queued' }, 200, 'unknown', 'provider_uncertain'],
    [null, 200, 'unknown', 'provider_uncertain'],
  ])('classifies SMS provider response honestly and safely %#', async (body, status, outcome, error) => {
    configure();
    send.mockImplementation(async (url) => String(url).includes('vexira')
      ? response({ success: true }) : response(body, status));
    const result = await service.statusChanged(input);
    expect(result).toMatchObject({
      sent: true, channel: 'whatsapp', channelResults: { sms: { sent: false, outcome, error } },
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not automatically retry uncertain SMS requests', async () => {
    configure();
    send.mockImplementation(async (url) => {
      if (String(url).includes('vexira')) return response({ success: true });
      throw new Error('private-sms request recipient and text');
    });
    const result = await service.statusChanged(input);
    expect(result).toMatchObject({
      sent: true, channel: 'whatsapp', channelResults: { sms: { sent: false, outcome: 'unknown', error: 'provider_uncertain' } },
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('preserves both rejected outcomes instead of claiming a notification was sent', async () => {
    configure();
    send.mockResolvedValue(response({ message: 'private response' }, 400));
    expect(await service.statusChanged(input)).toEqual({
      sent: false, error: 'provider_rejected',
      channelResults: {
        whatsapp: { sent: false, outcome: 'failed', error: 'provider_rejected' },
        sms: { sent: false, outcome: 'failed', error: 'provider_rejected' },
      },
    });
  });

  it('preserves overall uncertainty when neither channel proves acceptance', async () => {
    configure();
    send.mockImplementation(async (url) => String(url).includes('vexira') ? response({}, 200) : response({}, 400));
    expect(await service.statusChanged(input)).toMatchObject({
      sent: false, error: 'provider_uncertain',
      channelResults: { whatsapp: { outcome: 'unknown' }, sms: { outcome: 'failed' } },
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('reports both unconfigured channels without an external request', async () => {
    process.env.SHIPMENT_SMS_ENABLED = 'true';
    expect(await service.statusChanged(input)).toEqual({
      sent: false, error: 'not_configured',
      channelResults: {
        whatsapp: { sent: false, outcome: 'failed', error: 'not_configured' },
        sms: { sent: false, outcome: 'failed', error: 'not_configured' },
      },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', 'n/a', '123', '994501234567ext2', '1234567890123456'])('does not send either channel without an exact usable recipient %#', async (phone) => {
    configure();
    expect(await service.statusChanged({ ...input, phone })).toEqual({ sent: false, error: 'no_phone' });
    expect(send).not.toHaveBeenCalled();
  });

  it('notifies about new photos with the same important two-channel policy and gallery link', async () => {
    configure();
    expect((await service.photosAdded(input)).channel).toBe('whatsapp+sms');
    const whatsApp = JSON.parse(send.mock.calls.find(([url]) => String(url).includes('vexira'))![1]?.body as string);
    const sms = Object.fromEntries(send.mock.calls.find(([url]) => String(url).includes('twilio'))![1]?.body as URLSearchParams);
    expect(whatsApp.phone).toBe('+994501234567');
    expect(whatsApp.message).toContain('yeni şəkillər əlavə olundu');
    expect(whatsApp.message).toContain('Honda Accord');
    expect(whatsApp.message).toContain('https://nex.autos/track/TRACK-123');
    expect(sms.Body).toBe(whatsApp.message);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not send a photo alert to an invalid phone', async () => {
    configure();
    expect(await service.photosAdded({ ...input, phone: '-' })).toEqual({ sent: false, error: 'no_phone' });
    expect(send).not.toHaveBeenCalled();
  });

  it('guards the SMS body limit without suppressing a supported WhatsApp text', async () => {
    configure();
    const result = await service.photosAdded({ ...input, make: 'a'.repeat(1700) });
    expect(result).toMatchObject({
      sent: true, channel: 'whatsapp', channelResults: { sms: { sent: false, outcome: 'failed', error: 'message_too_long' } },
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(String(send.mock.calls[0][0])).toContain('vexira');
  });

  it('does not change explicit Telegram WhatsApp messages into dual-channel sends', async () => {
    configure();
    expect(await service.sendCustomerWhatsApp(input.phone, 'Yalnız bu mesaj')).toEqual({ sent: true, channel: 'whatsapp', outcome: 'accepted' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][1]?.body as string).message).toBe('Yalnız bu mesaj');
  });

  it('leaves the existing custom-message fallback policy unchanged', async () => {
    configure();
    expect(await service.sendMessage(input.phone, 'Mövcud mesaj')).toEqual({ sent: true, channel: 'whatsapp' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
