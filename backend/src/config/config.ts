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
  allowRegistration: (process.env.ALLOW_REGISTRATION ?? 'true') === 'true',
  /** Multiplies every rate limit. Keep 1 in production; automated tests raise it. */
  rateLimitScale: Math.max(1, int('RATE_LIMIT_SCALE', 1)),
  /** Folder with the website, served from the same address as the API. Empty string turns it off. */
  webDir: process.env.WEB_DIR ?? require('path').resolve(__dirname, '../../../web'),
  trustProxy: (process.env.TRUST_PROXY ?? 'false') === 'true',
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
