import { Injectable } from '@nestjs/common';

const METHODS = new Set(['getMe', 'getWebhookInfo', 'getUpdates', 'sendMessage', 'editMessageReplyMarkup', 'answerCallbackQuery', 'setMyCommands']);

// Never propagate fetch errors or Telegram descriptions: either can contain the secret URL.
export class TelegramApiError extends Error {
  constructor(public readonly code: number, public readonly retryAfter = 0) {
    super(code === 401 || code === 404
      ? 'Telegram tokeni etibarsızdır. BotFather-dən alınmış tokeni yoxlayın.'
      : code === 409
        ? 'Bot başqa sistemdə işləyir və ya webhook aktivdir. Həmin bağlantını dayandırın.'
        : code === 429
          ? 'Telegram sorğu limiti dolub. Bir qədər sonra yenidən yoxlanacaq.'
          : 'Telegram ilə əlaqə alınmadı. Şəbəkəni və bot ayarlarını yoxlayın.');
  }
}

@Injectable()
export class TelegramHttpService {
  async call<T>(token: string, method: string, payload: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
    if (!/^\d{5,16}:[A-Za-z0-9_-]{20,100}$/.test(token) || !METHODS.has(method)) throw new TelegramApiError(400);
    const deadline = AbortSignal.timeout(method === 'getUpdates' ? 40_000 : 12_000);
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
        redirect: 'error',
      });
      const body = await response.json() as { ok?: boolean; result?: T; error_code?: number; parameters?: { retry_after?: number } };
      if (!response.ok || !body.ok || body.result === undefined) {
        throw new TelegramApiError(Number(body.error_code) || response.status, Math.max(0, Math.min(300, Number(body.parameters?.retry_after) || 0)));
      }
      return body.result;
    } catch (error) {
      if (error instanceof TelegramApiError) throw error;
      throw new TelegramApiError(0);
    }
  }
}
