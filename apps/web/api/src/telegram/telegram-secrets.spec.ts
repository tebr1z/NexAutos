import { randomBytes } from 'crypto';
import { decryptTelegramToken, encryptTelegramToken, telegramEncryptionKey } from './telegram-secrets';

describe('Telegram token encryption', () => {
  const token = '123456789:FAKE_TEST_TOKEN_DO_NOT_USE_1234567';

  it('uses fresh nonces and round-trips without storing plaintext', () => {
    const key = randomBytes(32);
    const first = encryptTelegramToken(token, key);
    const second = encryptTelegramToken(token, key);
    expect(first).not.toBe(second);
    expect(first).not.toContain(token);
    expect(decryptTelegramToken(first, key)).toBe(token);
    expect(decryptTelegramToken(second, key)).toBe(token);
  });

  it('rejects a changed key or authentication tag', () => {
    const key = randomBytes(32);
    const encrypted = encryptTelegramToken(token, key);
    expect(() => decryptTelegramToken(encrypted, randomBytes(32))).toThrow();
    const parts = encrypted.split('.');
    const tag = Buffer.from(parts[2], 'base64url');
    tag[0] ^= 1;
    parts[2] = tag.toString('base64url');
    expect(() => decryptTelegramToken(parts.join('.'), key)).toThrow();
  });

  it.each(['', 'v2.a.b.c', 'v1.a.b.c', 'v1.a.b.c.extra'])('rejects malformed ciphertext %s', (encrypted) => {
    expect(() => decryptTelegramToken(encrypted, randomBytes(32))).toThrow();
  });

  it('accepts a 32-byte explicit key and rejects invalid explicit keys rather than falling back', () => {
    const key = randomBytes(32);
    expect(telegramEncryptionKey(key.toString('base64'))).toEqual(key);
    expect(telegramEncryptionKey('bad-key', 'a'.repeat(64))).toBeNull();
    expect(telegramEncryptionKey(randomBytes(16).toString('base64'))).toBeNull();
  });

  it('requires adequate fallback material and domain-separates it from JWT bytes', () => {
    expect(telegramEncryptionKey(undefined, 'short')).toBeNull();
    expect(telegramEncryptionKey()).toBeNull();
    const secret = 'a'.repeat(64);
    const key = telegramEncryptionKey(undefined, secret);
    expect(key?.length).toBe(32);
    expect(key).toEqual(telegramEncryptionKey(undefined, secret));
    expect(key).not.toEqual(Buffer.from(secret.slice(0, 32)));
  });
});
