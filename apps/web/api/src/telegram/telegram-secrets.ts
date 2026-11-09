import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export function telegramEncryptionKey(explicit?: string, jwtSecret?: string): Buffer | null {
  if (explicit?.trim()) {
    const raw = explicit.trim();
    if (!/^[A-Za-z0-9+/]{43}=$/.test(raw)) return null;
    const key = Buffer.from(raw, 'base64');
    return key.length === 32 ? key : null;
  }
  // Domain separation keeps this key distinct from JWT signing material.
  if (!jwtSecret || jwtSecret.length < 32) return null;
  return createHash('sha256').update('nexautos:telegram-token:v1\0').update(jwtSecret).digest();
}

export function encryptTelegramToken(token: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('nexautos:telegram-token:v1'));
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptTelegramToken(value: string, key: Buffer): string {
  const [version, rawIv, rawTag, rawCiphertext, extra] = value.split('.');
  if (version !== 'v1' || !rawIv || !rawTag || !rawCiphertext || extra) throw new Error('Invalid Telegram ciphertext');
  const iv = Buffer.from(rawIv, 'base64url');
  const tag = Buffer.from(rawTag, 'base64url');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid Telegram ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from('nexautos:telegram-token:v1'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(rawCiphertext, 'base64url')), decipher.final()]).toString('utf8');
}
