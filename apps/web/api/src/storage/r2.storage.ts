import { Injectable, Logger } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { SettingsService } from '../settings/settings.service';
import { r2Ready, type R2Creds } from '../settings/r2-config';

@Injectable()
export class R2Storage {
  private readonly log = new Logger(R2Storage.name);
  private client: S3Client | null = null;
  private clientFp = '';
  private bucketReady = false;
  private publicBase = '';

  constructor(private settings: SettingsService) {}

  async isEnabled() {
    return r2Ready(await this.settings.resolveR2());
  }

  private async creds(): Promise<R2Creds> {
    const next = await this.settings.resolveR2();
    const fp = [next.accessKeyId, next.secretAccessKey, next.endpoint, next.bucket].join('|');
    if (fp !== this.clientFp) {
      this.client = null;
      this.bucketReady = false;
      this.publicBase = next.publicUrl.replace(/\/$/, '');
      this.clientFp = fp;
    }
    return next;
  }

  private s3(c: R2Creds) {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: c.endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: c.accessKeyId,
          secretAccessKey: c.secretAccessKey,
        },
      });
    }
    return this.client;
  }

  async put(key: string, body: Buffer, mime: string) {
    const c = await this.creds();
    await this.ensureBucket(c);
    await this.s3(c).send(
      new PutObjectCommand({
        Bucket: c.bucket,
        Key: key,
        Body: body,
        ContentType: mime,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    const pub = this.publicBase || c.publicUrl.replace(/\/$/, '');
    if (pub) return `${pub}/${key}`;
    return `r2:${key}`;
  }

  async get(key: string): Promise<{ mime: string; buf: Buffer } | null> {
    const c = await this.creds();
    if (!r2Ready(c)) return null;
    try {
      const obj = await this.s3(c).send(new GetObjectCommand({ Bucket: c.bucket, Key: key }));
      const bytes = obj.Body ? await obj.Body.transformToByteArray() : new Uint8Array();
      return { mime: obj.ContentType || 'image/jpeg', buf: Buffer.from(bytes) };
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    const c = await this.creds();
    if (!r2Ready(c) || !key) return;
    try {
      await this.s3(c).send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
    } catch {
      /* ignore missing */
    }
  }

  keyFromUrl(url: string) {
    if (url.startsWith('r2:')) return url.slice(3);
    const pub = this.publicBase.replace(/\/$/, '');
    if (pub && url.startsWith(`${pub}/`)) return url.slice(pub.length + 1);
    const marker = `.r2.dev/`;
    const idx = url.indexOf(marker);
    if (idx >= 0) return url.slice(idx + marker.length);
    return '';
  }

  private async ensureBucket(c: R2Creds) {
    if (this.bucketReady) return;
    try {
      await this.s3(c).send(new HeadBucketCommand({ Bucket: c.bucket }));
    } catch {
      try {
        await this.s3(c).send(new CreateBucketCommand({ Bucket: c.bucket }));
      } catch (err) {
        this.log.warn(`R2 bucket ${c.bucket} could not be created: ${(err as Error).message}`);
      }
    }
    await this.enablePublic(c);
    this.bucketReady = true;
  }

  private async enablePublic(c: R2Creds) {
    if (c.publicUrl) {
      this.publicBase = c.publicUrl.replace(/\/$/, '');
      return;
    }
    if (!c.accountId || !c.apiToken) return;
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${c.accountId}/r2/buckets/${c.bucket}/domains/managed`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${c.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled: true }),
        },
      );
      const json = (await res.json()) as { success?: boolean; result?: { domain?: string } };
      const domain = json?.result?.domain?.trim();
      if (json?.success && domain) {
        this.publicBase = `https://${domain.replace(/^https?:\/\//, '')}`;
        this.log.log(`R2 public host ${this.publicBase}`);
      }
    } catch (err) {
      this.log.warn(`R2 public domain skipped: ${(err as Error).message}`);
    }
  }
}
