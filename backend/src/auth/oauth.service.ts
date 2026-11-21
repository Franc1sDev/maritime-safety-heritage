import { Injectable, Logger } from '@nestjs/common';
import { createPublicKey, JsonWebKey, verify } from 'crypto';
import { AppError, fail } from '../common/messages';
import { config } from '../config/config';

export type Provider = 'google' | 'apple';

interface Jwk extends JsonWebKey { kid?: string; alg?: string; use?: string }
export interface Claims { picture?: string; iss: string; aud: string | string[]; sub: string; exp: number; iat?: number; email?: string; email_verified?: boolean | string; name?: string; given_name?: string; family_name?: string; nonce?: string }

export const PROVIDERS: Record<Provider, { name: string; issuers: string[]; jwks: string; column: 'google_sub' | 'apple_sub'; clientIds: () => string[] }> = {
  google: {
    name: 'Google', issuers: ['https://accounts.google.com', 'accounts.google.com'],
    jwks: 'https://www.googleapis.com/oauth2/v3/certs', column: 'google_sub', clientIds: () => config.oauth.googleClientIds,
  },
  apple: {
    name: 'Apple', issuers: ['https://appleid.apple.com'],
    jwks: 'https://appleid.apple.com/auth/keys', column: 'apple_sub', clientIds: () => config.oauth.appleClientIds,
  },
};

const b64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Sign in with Google or Apple (OpenID Connect). The app or website gets a signed ID token from Google or Apple;
 * this checks the signature directly against their published keys before any session is created.
 */
@Injectable()
export class OAuthService {
  private readonly log = new Logger('OAuth');
  private readonly keys = new Map<Provider, { at: number; keys: Jwk[] }>();

  enabled(p: Provider) { return PROVIDERS[p].clientIds().length > 0; }

  /** What the website and app need to show the buttons (client ids are public by design). */
  publicConfig() {
    return {
      google: this.enabled('google') ? { clientId: config.oauth.googleClientIds[0] } : null,
      apple: this.enabled('apple') ? { clientId: config.oauth.appleClientIds[0], redirectUri: `${config.siteUrl}/api/v1/auth/oauth/apple/callback` } : null,
    };
  }

  /** Lets the automated tests use their own signing keys. */
  useKeysForTesting(p: Provider, keys: Jwk[]) { this.keys.set(p, { at: Date.now() + 365 * 86400_000, keys }); }

  private async keySet(p: Provider, refresh = false): Promise<Jwk[]> {
    const cached = this.keys.get(p);
    if (cached && !refresh && Date.now() - cached.at < 3600_000) return cached.keys;
    if (cached && cached.at > Date.now()) return cached.keys; // test keys
    try {
      const res = await fetch(PROVIDERS[p].jwks, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const keys = ((await res.json()) as { keys: Jwk[] }).keys;
      this.keys.set(p, { at: Date.now(), keys });
      return keys;
    } catch (e) {
      this.log.error(`Could not load ${PROVIDERS[p].name} keys: ${(e as Error).message}`);
      if (cached) return cached.keys;
      return fail(503, 'sign_in_failed');
    }
  }

  /** Checks an ID token from Google or Apple and returns what it says about the person. */
  async verify(p: Provider, token: string): Promise<Claims> {
    const bad = () => new AppError(401, 'sign_in_failed');
    const parts = (token ?? '').split('.');
    if (parts.length !== 3) throw bad();
    let header: { alg?: string; kid?: string };
    let claims: Claims;
    try { header = JSON.parse(b64(parts[0]).toString('utf8')); claims = JSON.parse(b64(parts[1]).toString('utf8')); } catch { throw bad(); }
    if (header.alg !== 'RS256' || !header.kid) throw bad();
    let jwk = (await this.keySet(p)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await this.keySet(p, true)).find((k) => k.kid === header.kid); // keys rotate
    if (!jwk) throw bad();
    const ok = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), b64(parts[2]));
    if (!ok) throw bad();
    const now = Date.now() / 1000;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!PROVIDERS[p].issuers.includes(claims.iss) || !aud.some((a) => PROVIDERS[p].clientIds().includes(a))) throw bad();
    if (!claims.exp || claims.exp < now - 60 || (claims.iat && claims.iat > now + 300) || !claims.sub) throw bad();
    return claims;
  }
}
