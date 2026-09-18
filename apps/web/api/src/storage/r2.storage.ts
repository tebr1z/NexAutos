import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class R2Storage {
  private readonly log = new Logger(R2Storage.name);
  private client: S3Client | null = null;
  private bucketReady = false;
  private publicBase = '';

  constructor(private config: ConfigService) {}

  enabled() {
    return Boolean(this.accessKey() && this.secret() && this.bucket() && this.endpoint());
  }

  private accessKey() {
    return this.config.get<string>('R2_ACCESS_KEY_ID')?.trim() || '';
  }

  private secret() {
    return this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim() || '';
  }

  private bucket() {
    return this.config.get<string>('R2_BUCKET')?.trim() || 'nex-autos';
  }

  private endpoint() {
    return this.config.get<string>('R2_ENDPOINT')?.trim() || '';
  }

  private accountId() {
    return this.config.get<string>('R2_ACCOUNT_ID')?.trim() || '';
  }

  private apiToken() {
    return this.config.get<string>('R2_API_TOKEN')?.trim() || '';
  }

  private s3() {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: this.endpoint(),
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.accessKey(),
          secretAccessKey: this.secret(),
        },
      });
    }
    return this.client;
  }

  async put(key: string, body: Buffer, mime: string) {
    await this.ensureBucket();
    await this.s3().send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        Body: body,
        ContentType: mime,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    const pub = this.publicBase || this.config.get<string>('R2_PUBLIC_URL')?.trim() || '';
    if (pub) return `${pub.replace(/\/$/, '')}/${key}`;
    return `r2:${key}`;
  }

  async get(key: string): Promise<{ mime: string; buf: Buffer } | null> {
    if (!this.enabled()) return null;
    try {
      const obj = await this.s3().send(new GetObjectCommand({ Bucket: this.bucket(), Key: key }));
      const bytes = obj.Body ? await obj.Body.transformToByteArray() : new Uint8Array();
      return { mime: obj.ContentType || 'image/jpeg', buf: Buffer.from(bytes) };
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    if (!this.enabled() || !key) return;
    try {
      await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }));
    } catch {
      /* ignore missing */
    }
  }

  keyFromUrl(url: string) {
    if (url.startsWith('r2:')) return url.slice(3);
    const pub = (this.publicBase || this.config.get<string>('R2_PUBLIC_URL')?.trim() || '').replace(/\/$/, '');
    if (pub && url.startsWith(`${pub}/`)) return url.slice(pub.length + 1);
    const marker = `.r2.dev/`;
    const idx = url.indexOf(marker);
    if (idx >= 0) return url.slice(idx + marker.length);
    return '';
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    const name = this.bucket();
    try {
      await this.s3().send(new HeadBucketCommand({ Bucket: name }));
    } catch {
      try {
        await this.s3().send(new CreateBucketCommand({ Bucket: name }));
      } catch (err) {
        this.log.warn(`R2 bucket ${name} could not be created: ${(err as Error).message}`);
      }
    }
    await this.enablePublic();
    this.bucketReady = true;
  }

  private async enablePublic() {
    const envPub = this.config.get<string>('R2_PUBLIC_URL')?.trim();
    if (envPub) {
      this.publicBase = envPub.replace(/\/$/, '');
      return;
    }
    const account = this.accountId();
    const token = this.apiToken();
    if (!account || !token) return;
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${this.bucket()}/domains/managed`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
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
