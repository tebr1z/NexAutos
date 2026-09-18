import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { probeAisKey, resetAisstreamBackoff } from '../vessels/ais';

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
