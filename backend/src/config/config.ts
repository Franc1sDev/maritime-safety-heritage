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
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
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
