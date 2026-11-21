import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'crypto';
import { config } from '../config/config';

/** Sensitive fields (ID numbers, MFA secrets) are encrypted separately from the database disk, with AES-256-GCM. */
const key = Buffer.from(hkdfSync('sha256', config.media.encryptionKey, 'msh-field-salt', 'sensitive-fields-v1', 32));

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}
export function decryptField(stored: string | null | undefined): string {
  if (!stored) return '';
  const [v, iv, tag, body] = stored.split('.');
  if (v !== 'v1') return '';
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}
/** A stable stand-in for a user in analytics, so events cannot be traced back to an account from the analytics tables alone. */
export const pseudonym = (id: string) => createHmac('sha256', key).update(`analytics:${id}`).digest('base64url').slice(0, 22);
export const maskId = (v: string) => (v.length <= 4 ? '••••' : `${'•'.repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`);
