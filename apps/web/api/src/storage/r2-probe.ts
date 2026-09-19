import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { r2Ready, type R2Creds } from '../settings/r2-config';

export async function probeR2(c: R2Creds) {
  if (!r2Ready(c)) {
    return { ok: false, message: 'Access Key, Secret, endpoint və bucket yazın.' };
  }
  const client = new S3Client({
    region: 'auto',
    endpoint: c.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: c.bucket }));
    return { ok: true, message: `R2 qoşuldu · bucket ${c.bucket}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Access Denied';
    return { ok: false, message: `R2 rədd etdi: ${message}. S3 Access Key + Secret istifadə edin (API Token yox).` };
  }
}
