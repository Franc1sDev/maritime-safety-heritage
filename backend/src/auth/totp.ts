import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function fromBase32(s: string): Buffer {
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const i = ALPHABET.indexOf(ch); if (i < 0) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
export const newTotpSecret = () => base32(randomBytes(20));

/** Time-based one-time code (RFC 6238: SHA-1, 30 seconds, 6 digits), as used by authenticator apps. */
export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac('sha1', fromBase32(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, '0');
}
/** Accepts the current code and the ones just before and after, to allow for clock drift. */
export function verifyTotp(secret: string, code: string): boolean {
  const given = Buffer.from(String(code).replace(/\s/g, '').padStart(6, '0'));
  return [-1, 0, 1].some((w) => { const exp = Buffer.from(totp(secret, Date.now() + w * 30_000)); return exp.length === given.length && timingSafeEqual(exp, given); });
}
export const otpauthUrl = (secret: string, account: string) =>
  `otpauth://totp/${encodeURIComponent('Remembering the Waters')}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent('Remembering the Waters')}&algorithm=SHA1&digits=6&period=30`;
