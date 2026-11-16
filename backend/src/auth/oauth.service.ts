import { ForbiddenException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createPublicKey, JsonWebKey, randomBytes, verify } from 'crypto';
import { Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { hashPassword } from '../common/crypto';
import { RequestMeta } from '../common/decorators';
import { config } from '../config/config';
import { User } from '../database/entities';
import { AuthService, Session } from './auth.service';

export type Provider = 'google' | 'apple';

interface Jwk extends JsonWebKey { kid?: string; alg?: string; use?: string }
interface Claims { iss: string; aud: string | string[]; sub: string; exp: number; iat?: number; email?: string; email_verified?: boolean | string; name?: string; given_name?: string; family_name?: string; nonce?: string }

const PROVIDERS: Record<Provider, { name: string; issuers: string[]; jwks: string; column: 'googleSub' | 'appleSub'; clientIds: () => string[] }> = {
  google: {
    name: 'Google', issuers: ['https://accounts.google.com', 'accounts.google.com'],
    jwks: 'https://www.googleapis.com/oauth2/v3/certs', column: 'googleSub', clientIds: () => config.oauth.googleClientIds,
  },
  apple: {
    name: 'Apple', issuers: ['https://appleid.apple.com'],
    jwks: 'https://appleid.apple.com/auth/keys', column: 'appleSub', clientIds: () => config.oauth.appleClientIds,
  },
};

const b64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Sign in with Google or Apple. The app or website gets a signed ID token from Google or Apple; this checks the
 * signature against their published keys, then signs the person in to the matching account (by their Google or
 * Apple id, otherwise by verified email), or creates one. No extra password to remember.
 */
@Injectable()
export class OAuthService {
  private readonly log = new Logger('OAuth');
  private readonly keys = new Map<Provider, { at: number; keys: Jwk[] }>();

  constructor(
    private readonly auth: AuthService,
    private readonly activity: ActivityService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

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
      throw new ServiceUnavailableException(`Sign in with ${PROVIDERS[p].name} is not available right now. Try again, or use your email and password.`);
    }
  }

  /** Checks an ID token from Google or Apple and returns what it says about the person. */
  async verify(p: Provider, token: string): Promise<Claims> {
    const bad = () => new UnauthorizedException(`${PROVIDERS[p].name} sign-in did not go through. Try again.`);
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

  async signIn(p: Provider, idToken: string, given: { name?: string }, meta: RequestMeta): Promise<Session & { created: boolean }> {
    if (!this.enabled(p)) throw new ServiceUnavailableException(`Sign in with ${PROVIDERS[p].name} is not set up on this archive yet.`);
    const c = await this.verify(p, idToken);
    const col = PROVIDERS[p].column;
    const email = (c.email ?? '').trim().toLowerCase();
    const verified = c.email_verified === true || c.email_verified === 'true';

    let user = await this.users.createQueryBuilder('u').where(`u.${col === 'googleSub' ? 'google_sub' : 'apple_sub'} = :sub`, { sub: c.sub }).getOne();
    let created = false;
    if (!user) {
      if (!email || !verified) throw new UnauthorizedException(`Your ${PROVIDERS[p].name} account did not share a verified email address, so we cannot sign you in with it.`);
      user = await this.users.findOneBy({ email });
      if (user) {
        await this.users.update(user.id, { [col]: c.sub });
      } else {
        if (!config.allowRegistration) throw new ForbiddenException('New accounts are created by the archive team. Contact us to request one.');
        const name = (given.name ?? '').trim() || c.name || [c.given_name, c.family_name].filter(Boolean).join(' ') || email.split('@')[0];
        user = await this.users.save(this.users.create({
          name: name.slice(0, 120), email, organisation: '', role: 'user', passwordSet: false, [col]: c.sub,
          passwordHash: await hashPassword(randomBytes(32).toString('hex')),
        }));
        created = true;
        await this.activity.record({ actor: user, action: 'user.register', entityType: 'user', entityId: user.id, summary: `${user.name} created an account with ${PROVIDERS[p].name}`, ip: meta.ip });
      }
    }
    if (user.status !== 'active') throw new ForbiddenException('This account is suspended. Contact the archive team.');
    user.lastLoginAt = new Date();
    await this.users.update(user.id, { lastLoginAt: user.lastLoginAt });
    await this.activity.record({ actor: user, action: 'login', entityType: 'user', entityId: user.id, summary: `${user.name} signed in with ${PROVIDERS[p].name}`, ip: meta.ip });
    return { ...(await this.auth.issue(user, meta)), created };
  }
}
