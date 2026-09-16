import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

const STATUS_AZ: Record<string, string> = {
  PURCHASED: 'Alınıb',
  AUCTION_PAID: 'Hərrac ödənilib',
  PICKED_UP: 'Götürülüb',
  EXPORT_DOCUMENTS: 'İxrac sənədləri',
  ARRIVED_PORT: 'Limana çatıb',
  LOADED_CONTAINER: 'Konteynerə yüklənib',
  SHIP_DEPARTED: 'Gəmi yola düşüb',
  IN_TRANSIT: 'Yoldadır',
  DESTINATION_PORT: 'Təyinat limanı',
  CUSTOMS_CLEARANCE: 'Gömrük rəsmiləşdirməsi',
  READY_FOR_DELIVERY: 'Çatdırılmağa hazır',
  DELIVERED: 'Çatdırılıb',
  CANCELLED: 'Ləğv edilib',
};

export type NotifyResult = { sent: boolean; channel?: string; error?: string };

export type EmailResult = { sent: boolean; error?: string };

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (!lower || lower === 'n/a' || lower === '-' || lower === 'yox') return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = `994${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('5')) digits = `994${digits}`;
  if (digits.length < 11) return null;
  return digits;
}

export function e164Phone(digits: string) {
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function statusSmsBody(input: {
  trackingCode: string;
  status: string;
  make?: string | null;
  model?: string | null;
  siteUrl?: string;
}) {
  const label = STATUS_AZ[input.status] ?? input.status.replaceAll('_', ' ');
  const car = [input.make, input.model].filter(Boolean).join(' ');
  const site = (input.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.CORS_ORIGIN ?? 'https://nex.autos').replace(
    /\/$/,
    '',
  );
  return [
    `Auto Nex: maşınınızın hazırkı mərhələsi — ${label}.`,
    car ? `Avtomobil: ${car}` : null,
    `Kod: ${input.trackingCode}`,
    `İzləmə: ${site}/track/${input.trackingCode}`,
  ]
    .filter(Boolean)
    .join('\n');
}

@Injectable()
export class NotifyService {
  private readonly log = new Logger(NotifyService.name);

  async statusChanged(input: {
    phone?: string | null;
    trackingCode: string;
    status: string;
    make?: string | null;
    model?: string | null;
  }): Promise<NotifyResult> {
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

  private async sendVexira(to: string, body: string): Promise<NotifyResult> {
    const key = process.env.VEXIRA_WHATSAPP_KEY ?? process.env.WHATSAPP_API_KEY;
    if (!key) return { sent: false, error: 'not_configured' };
    const url = process.env.VEXIRA_WHATSAPP_URL ?? 'https://api.vexirahost.com/api/v1/whatsapp/messages';
    try {
      const res = await fetch(url, {
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
