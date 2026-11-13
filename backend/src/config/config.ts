import 'dotenv/config';

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing required setting ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}
const int = (name: string, fallback: number) => {
  const n = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

// Hosts such as Render, Neon and Supabase give the database as one connection string; split it into the DB_* settings.
// Accepts the bare link or a pasted snippet such as  psql 'postgresql://…'  or  DATABASE_URL="postgresql://…".
const dbUrl = (process.env.DATABASE_URL ?? '').match(/postgres(?:ql)?:\/\/[^\s'"]+/)?.[0];
if (process.env.DATABASE_URL && !dbUrl) throw new Error('DATABASE_URL is set but contains no postgresql:// link.');
if (dbUrl) {
  const u = new URL(dbUrl);
  process.env.DB_HOST ??= u.hostname;
  process.env.DB_PORT ??= u.port || '5432';
  process.env.DB_USER ??= decodeURIComponent(u.username);
  process.env.DB_PASSWORD ??= decodeURIComponent(u.password);
  process.env.DB_NAME ??= u.pathname.replace(/^\//, '');
  const mode = u.searchParams.get('sslmode');
  if (mode && mode !== 'disable') process.env.DB_SSL ??= 'true';
}
// Render tells the app its public address; use it when SITE_URL and WEB_BASE_URL are not set.
if (process.env.RENDER_EXTERNAL_URL) {
  process.env.SITE_URL ??= process.env.RENDER_EXTERNAL_URL;
  process.env.WEB_BASE_URL ??= process.env.RENDER_EXTERNAL_URL;
}

const env = process.env.NODE_ENV ?? 'development';
const isProd = env === 'production';

function secret(name: string): string {
  const v = req(name, isProd ? undefined : `dev-only-${name.toLowerCase()}-not-for-production-use`);
  if (isProd && (v.length < 32 || v.startsWith('change-me'))) {
    throw new Error(`${name} must be a random value of at least 32 characters in production.`);
  }
  return v;
}

export const config = {
  env,
  isProd,
  port: int('PORT', 4000),
  /** Public address of the API, used to build absolute media links. Leave empty to return links relative to the API host. */
  publicApiUrl: (process.env.PUBLIC_API_URL ?? '').replace(/\/$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  db: {
    host: req('DB_HOST', 'localhost'),
    port: int('DB_PORT', 5432),
    user: req('DB_USER', 'postgres'),
    password: process.env.DB_PASSWORD ?? '',
    name: req('DB_NAME', 'maritime_heritage'),
    ssl: (process.env.DB_SSL ?? 'false') === 'true',
  },
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET'),
    refreshSecret: secret('JWT_REFRESH_SECRET'),
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
    refreshDays: int('REFRESH_TOKEN_DAYS', 30),
  },
  media: {
    signingSecret: secret('MEDIA_SIGNING_SECRET'),
    linkTtlSeconds: int('MEDIA_LINK_TTL_SECONDS', 3600),
    maxUploadMb: int('MAX_UPLOAD_MB', 500),
    /** Key for encrypting stored files. Keep it safe and backed up: without it, encrypted files cannot be read. */
    encryptionKey: secret('MEDIA_ENCRYPTION_KEY'),
    encryptAtRest: (process.env.MEDIA_ENCRYPT_AT_REST ?? 'true') === 'true',
  },
  /** ClamAV virus scanning of every upload. Set CLAMAV_HOST to turn it on. */
  clamav: {
    host: process.env.CLAMAV_HOST ?? '',
    port: int('CLAMAV_PORT', 3310),
    timeoutMs: int('CLAMAV_TIMEOUT_MS', 60000),
    /** When true, uploads are refused if the scanner cannot be reached. */
    required: (process.env.CLAMAV_REQUIRED ?? (isProd ? 'true' : 'false')) === 'true',
  },
  /** Storage and uptime alerts go to these addresses. */
  alerts: {
    emails: (process.env.ALERT_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    storageGb: int('STORAGE_ALERT_GB', 0),
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
    localDir: process.env.STORAGE_LOCAL_DIR ?? './storage',
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'auto',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  },
  cookie: {
    // 'strict' when the website and API share a site (recommended); 'none' only if they are on different sites (requires HTTPS).
    sameSite: (process.env.COOKIE_SAMESITE ?? 'strict') as 'strict' | 'lax' | 'none',
    secure: (process.env.COOKIE_SECURE ?? (isProd ? 'true' : 'false')) === 'true',
  },
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: int('SMTP_PORT', 587),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.MAIL_FROM ?? 'Maritime Safety Heritage Archive <no-reply@localhost>',
    webBaseUrl: process.env.WEB_BASE_URL ?? 'http://localhost:4000',
  },
  /** The archive's official public address (no trailing slash), used for canonical links, the sitemap and emails. */
  siteUrl: (process.env.SITE_URL ?? process.env.WEB_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  /** Public catalogue pages (/items) with titles and summaries, so search engines can find the archive. */
  publicPreviews: (process.env.PUBLIC_PREVIEWS ?? 'true') === 'true',
  allowRegistration: (process.env.ALLOW_REGISTRATION ?? 'true') === 'true',
  /** Multiplies every rate limit. Keep 1 in production; automated tests raise it. */
  rateLimitScale: Math.max(1, int('RATE_LIMIT_SCALE', 1)),
  /** Folder with the website, served from the same address as the API. Empty string turns it off. */
  webDir: process.env.WEB_DIR ?? require('path').resolve(__dirname, '../../../web'),
  /** Number of reverse proxies in front of the API ("true" = 1). Needed for correct visitor addresses in logs and rate limits. */
  trustProxy: ((v) => (v === 'true' ? 1 : Math.max(0, parseInt(v, 10) || 0)))(process.env.TRUST_PROXY ?? 'false'),
  security: {
    maxFailedLogins: int('MAX_FAILED_LOGINS', 5),
    lockMinutes: int('LOCK_MINUTES', 15),
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@demo.ke',
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? '',
    sampleData: (process.env.SEED_SAMPLE_DATA ?? 'true') === 'true',
  },
};
export type AppConfig = typeof config;
