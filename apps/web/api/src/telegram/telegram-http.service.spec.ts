import 'reflect-metadata';
import { TelegramApiError, TelegramHttpService } from './telegram-http.service';

describe('Telegram HTTP boundary', () => {
  const token = '123456789:FAKE_TEST_TOKEN_DO_NOT_USE_1234567';
  const service = new TelegramHttpService();
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => { fetchMock = jest.spyOn(globalThis, 'fetch'); });
  afterEach(() => { fetchMock.mockRestore(); });

  it('uses the fixed TLS origin, POST body and no redirects', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { id: 123 } }), { status: 200 }));
    expect(await service.call(token, 'sendMessage', { chat_id: '111', text: 'test' })).toEqual({ id: 123 });
    expect(fetchMock).toHaveBeenCalledWith(`https://api.telegram.org/bot${token}/sendMessage`, expect.objectContaining({
      method: 'POST', redirect: 'error', body: JSON.stringify({ chat_id: '111', text: 'test' }), signal: expect.any(AbortSignal),
    }));
  });

  it.each(['https://attacker.example', '../getMe', 'getFile', 'deleteWebhook'])('rejects non-allowlisted method %s without network access', async (method) => {
    await expect(service.call(token, method)).rejects.toBeInstanceOf(TelegramApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['bad', 'https://example.com/token', '123456789:bad/../x'])('rejects malformed tokens without network access', async (badToken) => {
    await expect(service.call(badToken, 'getMe')).rejects.toBeInstanceOf(TelegramApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never includes token-bearing fetch failure details', async () => {
    fetchMock.mockRejectedValue(new Error(`request failed https://api.telegram.org/bot${token}/getMe`));
    const error = await service.call(token, 'getMe').catch((err) => err);
    expect(error).toBeInstanceOf(TelegramApiError);
    expect(error.message).not.toContain(token);
    expect(error.message).not.toContain('https://');
  });

  it('does not expose Telegram descriptions and bounds retry delays', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error_code: 429, description: token, parameters: { retry_after: 9000 } }), { status: 429 }));
    const error = await service.call(token, 'getMe').catch((err) => err);
    expect(error.code).toBe(429);
    expect(error.retryAfter).toBe(300);
    expect(error.message).not.toContain(token);
  });

  it('handles non-JSON failure pages without leaking their body', async () => {
    fetchMock.mockResolvedValue(new Response(`server error ${token}`, { status: 502 }));
    const error = await service.call(token, 'getMe').catch((err) => err);
    expect(error).toBeInstanceOf(TelegramApiError);
    expect(error.message).not.toContain(token);
  });

  it('accepts a boolean result and combines caller cancellation with a deadline', async () => {
    const abort = new AbortController();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: true }), { status: 200 }));
    expect(await service.call(token, 'answerCallbackQuery', { callback_query_id: 'callback' }, abort.signal)).toBe(true);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    abort.abort();
    expect(signal?.aborted).toBe(true);
  });
});
