import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

const STATUS_AZ: Record<string, string> = {
  PURCHASED: 'Maşın alınıb',
  PAYMENT_RECEIVED: 'Pul şirkətin hesabına mədaxil olub',
  AUCTION_RELEASED: 'Hərracdan çıxarılıb',
  AUCTION_PAID: 'Hərrac ödənilib',
  PICKED_UP: 'Alındığı yerdən götürülüb',
  EXPORT_DOCUMENTS: 'Sənədləri hazırlanır',
  EXPORT_READY: 'İxrac sənədi hazırdır',
  TO_ORIGIN_PORT: 'Limana doğru yoldadır',
  ARRIVED_PORT: 'Limana çatıb',
  CONTAINER_LOADING: 'Konteynerə yüklənmə mərhələsindədir',
  LOADED_CONTAINER: 'Konteynerə yüklənib, yola çıxmağı gözləyir',
  VESSEL_WAITING: 'Gəminin limana yaxınlaşmasını gözləyir',
  VESSEL_LOADED: 'Gəmiyə yüklənib',
  SHIP_DEPARTED: 'Gəmi hərəkətdədir',
  IN_TRANSIT: 'Yoldadır',
  ISTANBUL_TO_POTI: 'İstanbuldan Poti istiqamətinə yola düşüb',
  DESTINATION_APPROACHING: 'Gəmi Poti və ya Batumi limanına yaxınlaşır',
  DESTINATION_PORT: 'Poti / Batumi limanına çatıb',
  CONTAINER_DISCHARGED: 'Konteyner boşaldılıb',
  CONTAINER_OPENING_PENDING: 'Konteyner açılışını gözləyir',
  CONTAINER_OPENED: 'Konteyner açılıb',
  TIR_LOADING_PENDING: 'TIR-a yüklənməyi gözləyir',
  TIR_LOADED: 'TIR yüklənib',
  CUSTOMS_DOCUMENTS: 'Bakı gömrüyü üçün sənədlər hazırlanır',
  CUSTOMS_DOCUMENTS_READY: 'Gömrük sənədləri hazırdır',
  TIR_DEPARTED: 'TIR yoldadır',
  TIR_GEORGIA_BORDER: 'TIR Gürcüstan sərhədindədir',
  TIR_BAKU_CUSTOMS: 'TIR Bakı gömrüyündədir',
  CUSTOMS_CLEARANCE: 'Gömrük rəsmiləşdirməsi',
  READY_FOR_DELIVERY: 'Maşınınız Bakı gömrüyündə boşaldılıb. Zəhmət olmasa təhvil götürün',
  DELIVERED: 'Təhvil verilib',
  CANCELLED: 'Ləğv edilib',
};

export type NotifyResult = { sent: boolean; channel?: string; error?: string };

// Accepted by the provider is not a delivery/read receipt. Unknown outcomes must
// never be retried automatically: the first request may already have been sent.
export type CustomerWhatsAppResult = NotifyResult & { outcome: 'accepted' | 'failed' | 'unknown' };

export type EmailResult = { sent: boolean; error?: string };

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (!lower || lower === 'n/a' || lower === '-' || lower === 'yox') return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = `994${digits.slice(1)}`;
  if (digits.length === 9 && /^[57]/.test(digits)) digits = `994${digits}`;
  if (digits.length === 12 && digits.startsWith('994')) return digits;
  if (digits.length < 11) return null;
  return digits;
}

export function e164Phone(digits: string) {
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function normalizeCustomerWhatsAppPhone(raw?: string | null): string | null {
  if (typeof raw !== 'string' || raw.length > 40 || !/^\+?[\d ().-]+$/.test(raw.trim())) return null;
  const digits = normalizePhone(raw);
  return digits && /^[1-9]\d{10,14}$/.test(digits) ? digits : null;
}

export function statusLabelAz(status: string) {
  return STATUS_AZ[status] ?? status.replaceAll('_', ' ');
}

const SMS_NOTIFY_STATUSES = new Set([
  'PURCHASED',
  'EXPORT_DOCUMENTS',
  'EXPORT_READY',
  'LOADED_CONTAINER',
  'SHIP_DEPARTED',
  'DESTINATION_PORT',
  'TIR_BAKU_CUSTOMS',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]);

export function shouldNotifyStatus(status: string) {
  return SMS_NOTIFY_STATUSES.has(status);
}

export function siteBase() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.CORS_ORIGIN ?? 'https://nex.autos').replace(/\/$/, '');
}

export function trackSmsFooter(input: { trackingCode: string; make?: string | null; model?: string | null }) {
  const car = [input.make, input.model].filter(Boolean).join(' ');
  return [
    car ? `Avtomobil: ${car}` : null,
    `Kod: ${input.trackingCode}`,
    `İzləmə: ${siteBase()}/track/${input.trackingCode}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function statusSmsBody(input: {
  trackingCode: string;
  status: string;
  make?: string | null;
  model?: string | null;
  siteUrl?: string;
}) {
  const label = STATUS_AZ[input.status] ?? input.status.replaceAll('_', ' ');
  return [
    `Auto Nex: maşınınızın hazırkı mərhələsi — ${label}.`,
    trackSmsFooter(input),
  ].join('\n');
}

@Injectable()
export class NotifyService {
  private readonly log = new Logger(NotifyService.name);

  customerWhatsAppReady(): boolean {
    return Boolean((process.env.VEXIRA_WHATSAPP_KEY?.trim() || process.env.WHATSAPP_API_KEY?.trim())
      || (process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim())
      || (process.env.TWILIO_WHATSAPP_FROM?.trim() && process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim()));
  }

  customerWhatsAppTextLimit(): number {
    const firstProvider = process.env.VEXIRA_WHATSAPP_KEY?.trim() || process.env.WHATSAPP_API_KEY?.trim()
      || (process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
    return !firstProvider && process.env.TWILIO_WHATSAPP_FROM?.trim()
      && process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim() ? 1600 : 2000;
  }

  /** Explicit customer message: one WhatsApp provider, no SMS/provider fallback. */
  async sendCustomerWhatsApp(phone: string, body: string): Promise<CustomerWhatsAppResult> {
    const to = normalizeCustomerWhatsAppPhone(phone);
    if (!to) return { sent: false, outcome: 'failed', error: 'no_phone' };
    if (!body?.trim()) return { sent: false, outcome: 'failed', error: 'no_message' };
    if ([...body].length > this.customerWhatsAppTextLimit()) return { sent: false, outcome: 'failed', error: 'message_too_long' };
    const key = process.env.VEXIRA_WHATSAPP_KEY?.trim() || process.env.WHATSAPP_API_KEY?.trim();
    const token = process.env.WHATSAPP_TOKEN?.trim();
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    let url: string;
    let headers: Record<string, string>;
    let requestBody: string | URLSearchParams;
    let provider: 'vexira' | 'meta' | 'twilio';
    if (key) {
      provider = 'vexira';
      url = process.env.VEXIRA_WHATSAPP_URL?.trim() || 'https://api.vexirahost.com/api/v1/whatsapp/messages';
      headers = { 'Content-Type': 'application/json', 'X-API-Key': key };
      requestBody = JSON.stringify({ phone: e164Phone(to), message: body });
    } else if (token && phoneId) {
      provider = 'meta';
      url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
      headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      requestBody = JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: true } });
    } else if (from && sid && twilioToken) {
      provider = 'twilio';
      url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      headers = { Authorization: `Basic ${Buffer.from(`${sid}:${twilioToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' };
      requestBody = new URLSearchParams({ To: `whatsapp:+${to}`, From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`, Body: body });
    } else {
      return { sent: false, outcome: 'failed', error: 'not_configured' };
    }
    try {
      const response = await fetch(url, { method: 'POST', headers, body: requestBody, signal: AbortSignal.timeout(15000), redirect: 'error' });
      if (!response.ok) {
        // Do not log or return raw provider responses: they can contain keys,
        // recipient details or message contents. A 5xx may follow acceptance.
        const uncertain = response.status >= 500 || response.status === 408;
        return { sent: false, outcome: uncertain ? 'unknown' : 'failed', error: uncertain ? 'provider_uncertain' : 'provider_rejected' };
      }
      const text = await response.text();
      type ProviderPayload = { success?: boolean; messages?: { id?: string }[]; sid?: string; status?: string };
      let payload: ProviderPayload | null = null;
      try { payload = JSON.parse(text) as ProviderPayload; } catch { /* An unrecognized response cannot prove acceptance. */ }
      if ((provider === 'vexira' && payload?.success === false)
        || (provider === 'twilio' && ['failed', 'undelivered'].includes(payload?.status ?? ''))) {
        return { sent: false, outcome: 'failed', error: 'provider_rejected' };
      }
      const accepted = provider === 'vexira' ? payload?.success === true
        : provider === 'meta' ? typeof payload?.messages?.[0]?.id === 'string' && Boolean(payload.messages[0].id)
          : typeof payload?.sid === 'string' && Boolean(payload.sid);
      return accepted ? { sent: true, channel: 'whatsapp', outcome: 'accepted' }
        : { sent: false, outcome: 'unknown', error: 'provider_uncertain' };
    } catch {
      return { sent: false, outcome: 'unknown', error: 'provider_uncertain' };
    }
  }

  async statusChanged(input: {
    phone?: string | null;
    trackingCode: string;
    status: string;
    make?: string | null;
    model?: string | null;
  }): Promise<NotifyResult> {
    if (!shouldNotifyStatus(input.status)) return { sent: false, error: 'skipped' };
    const to = normalizePhone(input.phone);
    if (!to) return { sent: false, error: 'no_phone' };
    const body = statusSmsBody({ ...input, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.CORS_ORIGIN });
    try {
      const wa = await this.sendWhatsApp(to, body);
      if (wa.sent) return wa;
      const sms = await this.sendSms(to, body);
      if (sms.sent) return sms;
      return wa.error && wa.error !== 'not_configured' ? wa : sms;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'notify_failed';
      this.log.warn(`Status SMS failed for ${input.trackingCode}: ${error}`);
      return { sent: false, error };
    }
  }

  async insuranceReady(input: {
    phone?: string | null;
    trackingCode: string;
    make?: string | null;
    model?: string | null;
    statusLabel?: string;
    mustSign?: boolean;
    signUrl?: string;
  }): Promise<NotifyResult> {
    const to = normalizePhone(input.phone);
    if (!to) return { sent: false, error: 'no_phone' };
    const body = [
      input.mustSign
        ? 'Auto Nex: sığorta müqaviləsi imza gözləyir. İmzalamalısınız.'
        : 'Auto Nex: maşınınızın sığorta məlumatı yeniləndi.',
      input.statusLabel ? `Status: ${input.statusLabel}` : null,
      input.signUrl ? `İmza: ${input.signUrl}` : null,
      trackSmsFooter(input),
      `Sığorta: ${siteBase()}/insurance/${input.trackingCode}`,
    ]
      .filter(Boolean)
      .join('\n');
    return this.sendMessage(to, body);
  }

  async insurancePayout(input: {
    phone?: string | null;
    trackingCode: string;
    receiptUrl: string;
  }): Promise<NotifyResult> {
    const to = normalizePhone(input.phone);
    if (!to) return { sent: false, error: 'no_phone' };
    return this.sendMessage(
      to,
      `Auto Nex: pul sizə köçürülmüşdür.\nÇek: ${input.receiptUrl}`,
    );
  }

  async customerUpdate(input: {
    phone?: string | null;
    trackingCode: string;
    make?: string | null;
    model?: string | null;
    intro: string;
  }): Promise<NotifyResult> {
    const to = normalizePhone(input.phone);
    if (!to) return { sent: false, error: 'no_phone' };
    const body = [input.intro.trim() || 'Auto Nex: göndərişiniz haqqında yenilik.', trackSmsFooter(input)].join('\n');
    return this.sendMessage(to, body);
  }

  async sendMessage(phone?: string | null, body?: string): Promise<NotifyResult> {
    const to = normalizePhone(phone);
    if (!to || !body?.trim()) return { sent: false, error: 'no_phone' };
    try {
      const wa = await this.sendWhatsApp(to, body);
      if (wa.sent) return wa;
      const sms = await this.sendSms(to, body);
      if (sms.sent) return sms;
      return wa.error && wa.error !== 'not_configured' ? wa : sms;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'notify_failed';
      this.log.warn(`sendMessage failed: ${error}`);
      return { sent: false, error };
    }
  }

  async sendOtpCode(phone?: string | null, code?: string): Promise<NotifyResult> {
    const to = normalizePhone(phone);
    if (!to || !code) return { sent: false, error: 'no_phone' };
    const body = `Auto Nex: təsdiq kodu ${code}. Heç kimə verməyin. 10 dəqiqə keçərlidir.`;
    try {
      const wa = await this.sendWhatsApp(to, body);
      if (wa.sent) return wa;
      const sms = await this.sendSms(to, body);
      if (sms.sent) return sms;
      return wa.error && wa.error !== 'not_configured' ? wa : sms;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'otp_failed';
      this.log.warn(`OTP send failed: ${error}`);
      return { sent: false, error };
    }
  }

  async sendEmail(input: { to?: string | null; subject: string; text: string; html?: string }): Promise<EmailResult> {
    const to = input.to?.trim();
    if (!to || !to.includes('@') || to.endsWith('@autonex.local')) {
      return { sent: false, error: 'no_email' };
    }
    const host = process.env.SMTP_HOST;
    if (!host) return { sent: false, error: 'not_configured' };
    try {
      const transporter = nodemailer.createTransport({
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_PORT === '465',
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'Auto Nex <auto@nex.autos>',
        to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? input.text.replaceAll('\n', '<br/>'),
      });
      return { sent: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'email_failed';
      this.log.warn(`Email failed: ${error}`);
      return { sent: false, error };
    }
  }

  private async sendWhatsApp(to: string, body: string): Promise<NotifyResult> {
    const vexira = await this.sendVexira(to, body);
    if (vexira.sent) return vexira;

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (token && phoneId) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        signal: AbortSignal.timeout(15000),
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body, preview_url: true },
        }),
      });
      if (res.ok) return { sent: true, channel: 'whatsapp' };
      const text = await res.text();
      this.log.warn(`WhatsApp Cloud API ${res.status}: ${text.slice(0, 240)}`);
      if (vexira.error === 'not_configured') return { sent: false, error: `whatsapp_${res.status}` };
    }

    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (from) {
      return this.twilioMessage(
        `whatsapp:+${to}`,
        from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
        body,
        'whatsapp',
      );
    }

    return vexira.error && vexira.error !== 'not_configured' ? vexira : { sent: false, error: 'not_configured' };
  }

  async sendRadarWhatsApp(phone: string | null | undefined, text: string): Promise<NotifyResult> {
    const to = normalizePhone(phone);
    if (!to) return { sent: false, error: 'no_phone' };
    try { return await this.sendWhatsApp(to, text); }
    catch { return { sent: false, error: 'whatsapp_failed' }; }
  }

  private async sendVexira(to: string, body: string): Promise<NotifyResult> {
    const key = process.env.VEXIRA_WHATSAPP_KEY ?? process.env.WHATSAPP_API_KEY;
    if (!key) return { sent: false, error: 'not_configured' };
    const url = process.env.VEXIRA_WHATSAPP_URL ?? 'https://api.vexirahost.com/api/v1/whatsapp/messages';
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({ phone: e164Phone(to), message: body }),
      });
      const text = await res.text();
      let payload: { success?: boolean; message?: string; error?: string } | null = null;
      try {
        payload = JSON.parse(text) as { success?: boolean; message?: string; error?: string };
      } catch {
        payload = null;
      }
      if (!res.ok || payload?.success === false) {
        const detail = payload?.message || payload?.error || text.slice(0, 160) || res.statusText;
        this.log.warn(`Vexira WhatsApp ${res.status}: ${detail}`);
        return { sent: false, error: `vexira_${res.status}${detail ? `:${detail}` : ''}` };
      }
      return { sent: true, channel: 'whatsapp' };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'vexira_failed';
      this.log.warn(`Vexira WhatsApp failed: ${error}`);
      return { sent: false, error };
    }
  }

  private async sendSms(to: string, body: string): Promise<NotifyResult> {
    const from = process.env.TWILIO_FROM;
    if (!from) return { sent: false, error: 'not_configured' };
    return this.twilioMessage(`+${to}`, from, body, 'sms');
  }

  private async twilioMessage(to: string, from: string, body: string, channel: string): Promise<NotifyResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return { sent: false, error: 'not_configured' };
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) {
      const text = await res.text();
      this.log.warn(`Twilio ${channel} ${res.status}: ${text.slice(0, 240)}`);
      return { sent: false, error: `twilio_${res.status}` };
    }
    return { sent: true, channel };
  }
}
