import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { probeAisKey, resetAisstreamBackoff } from '../vessels/ais';
import { probeR2 } from '../storage/r2-probe';
import {
  emptyR2,
  isMaskedSecret,
  maskSecret,
  r2Ready,
  R2_SETTING,
  type R2Creds,
} from './r2-config';

export const AIS_KEY_SETTING = 'aisstream_api_key';

export type AisKeyStatus = {
  configured: boolean;
  preview: string | null;
  source: 'admin' | 'env' | 'none';
};

@Injectable()
export class SettingsService {
  private cached: { at: number; key: string } | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  envAisKey() {
    return (
      this.config.get<string>('AISSTREAM_API_KEY')?.trim() ||
      this.config.get<string>('AIS_API_KEY')?.trim() ||
      ''
    );
  }

  async storedAisKey(): Promise<string> {
    if (this.cached && Date.now() - this.cached.at < 15_000) return this.cached.key;
    const row = await this.prisma.setting.findUnique({ where: { key: AIS_KEY_SETTING } });
    const value = row?.value as { key?: unknown } | null;
    const key = typeof value?.key === 'string' ? value.key.trim() : '';
    this.cached = { at: Date.now(), key };
    return key;
  }

  async resolveAisKey(): Promise<string> {
    return (await this.storedAisKey()) || this.envAisKey();
  }

  async aisStatus(): Promise<AisKeyStatus> {
    const adminKey = await this.storedAisKey();
    if (adminKey) {
      return { configured: true, preview: maskKey(adminKey), source: 'admin' };
    }
    const envKey = this.envAisKey();
    if (envKey) {
      return { configured: true, preview: maskKey(envKey), source: 'env' };
    }
    return { configured: false, preview: null, source: 'none' };
  }

  async saveAisKey(raw?: string): Promise<AisKeyStatus> {
    const key = String(raw ?? '').trim();
    if (!key || isMaskedPlaceholder(key)) {
      await this.prisma.setting.deleteMany({ where: { key: AIS_KEY_SETTING } });
      this.cached = { at: Date.now(), key: '' };
    } else {
      await this.prisma.setting.upsert({
        where: { key: AIS_KEY_SETTING },
        update: { value: { key } },
        create: { key: AIS_KEY_SETTING, value: { key } },
      });
      this.cached = { at: Date.now(), key };
    }
    resetAisstreamBackoff();
    return this.aisStatus();
  }

  envR2(): R2Creds {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim() || '';
    const endpoint =
      this.config.get<string>('R2_ENDPOINT')?.trim() ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
    return {
      accountId,
      endpoint,
      accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID')?.trim() || '',
      secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim() || '',
      apiToken: this.config.get<string>('R2_API_TOKEN')?.trim() || '',
      bucket: this.config.get<string>('R2_BUCKET')?.trim() || 'nex-autos',
      publicUrl: this.config.get<string>('R2_PUBLIC_URL')?.trim() || '',
    };
  }

  async storedR2(): Promise<R2Creds | null> {
    const row = await this.prisma.setting.findUnique({ where: { key: R2_SETTING } });
    const value = row?.value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const pick = (name: string) => (typeof raw[name] === 'string' ? String(raw[name]).trim() : '');
    const accountId = pick('accountId');
    const creds: R2Creds = {
      accountId,
      endpoint: pick('endpoint') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''),
      accessKeyId: pick('accessKeyId'),
      secretAccessKey: pick('secretAccessKey'),
      apiToken: pick('apiToken'),
      bucket: pick('bucket') || 'nex-autos',
      publicUrl: pick('publicUrl'),
    };
    return r2Ready(creds) || creds.accountId ? creds : null;
  }

  async resolveR2(): Promise<R2Creds> {
    return (await this.storedR2()) || this.envR2();
  }

  async r2Status() {
    const admin = await this.storedR2();
    const env = this.envR2();
    const active = admin && r2Ready(admin) ? admin : r2Ready(env) ? env : admin || env;
    const source = admin && r2Ready(admin) ? 'admin' : r2Ready(env) ? 'env' : 'none';
    return {
      configured: r2Ready(active),
      source,
      accountId: active.accountId,
      endpoint: active.endpoint,
      bucket: active.bucket,
      publicUrl: active.publicUrl,
      accessKeyPreview: maskSecret(active.accessKeyId),
      secretPreview: maskSecret(active.secretAccessKey),
      tokenPreview: maskSecret(active.apiToken),
    };
  }

  async saveR2(input: Partial<R2Creds> & { clear?: boolean }) {
    if (input.clear) {
      await this.prisma.setting.deleteMany({ where: { key: R2_SETTING } });
      return this.r2Status();
    }
    const prev = (await this.storedR2()) || this.envR2() || emptyR2();
    const take = (next: string | undefined, current: string) => {
      const value = String(next ?? '').trim();
      if (!value || isMaskedSecret(value)) return current;
      return value;
    };
    const accountId = take(input.accountId, prev.accountId);
    const creds: R2Creds = {
      accountId,
      endpoint:
        take(input.endpoint, prev.endpoint) ||
        (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''),
      accessKeyId: take(input.accessKeyId, prev.accessKeyId),
      secretAccessKey: take(input.secretAccessKey, prev.secretAccessKey),
      apiToken: take(input.apiToken, prev.apiToken),
      bucket: take(input.bucket, prev.bucket) || 'nex-autos',
      publicUrl: take(input.publicUrl, prev.publicUrl),
    };
    await this.prisma.setting.upsert({
      where: { key: R2_SETTING },
      update: { value: creds },
      create: { key: R2_SETTING, value: creds },
    });
    return this.r2Status();
  }

  async testR2(input?: Partial<R2Creds>) {
    const saved = await this.resolveR2();
    const take = (next: string | undefined, current: string) => {
      const value = String(next ?? '').trim();
      if (!value || isMaskedSecret(value)) return current;
      return value;
    };
    return probeR2({
      accountId: take(input?.accountId, saved.accountId),
      endpoint: take(input?.endpoint, saved.endpoint),
      accessKeyId: take(input?.accessKeyId, saved.accessKeyId),
      secretAccessKey: take(input?.secretAccessKey, saved.secretAccessKey),
      apiToken: take(input?.apiToken, saved.apiToken),
      bucket: take(input?.bucket, saved.bucket) || 'nex-autos',
      publicUrl: take(input?.publicUrl, saved.publicUrl),
    });
  }

  async testAis(raw?: string) {
    const typed = String(raw ?? '').trim();
    const key = typed && !isMaskedPlaceholder(typed) ? typed : await this.resolveAisKey();
    if (!key) return { ok: false, message: 'Əvvəl AIS açarını yazın və yadda saxlayın.' };
    return probeAisKey(key);
  }
}

function maskKey(key: string) {
  if (key.length < 8) return '••••';
  return `••••${key.slice(-4)}`;
}

function isMaskedPlaceholder(value: string) {
  return /^[•*xX.]+[A-Za-z0-9]{0,8}$/.test(value) && value.includes('•');
}
