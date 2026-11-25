import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, readdirSync } from 'fs';
import helmet from 'helmet';
import { extname, join } from 'path';
import { ErrorsFilter } from './common/errors.filter';
import { config } from './config/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { registerAppFallback, registerPublicPages } from './public/seo';
import { perf } from './common/perf';

/** Security and request handling shared by the server and the automated tests. */
export function configureApp(app: INestApplication) {
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  if (config.trustProxy) express.set('trust proxy', config.trustProxy);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Sign in with Google (Google Identity Services) and Sign in with Apple load their own scripts.
        scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client', 'https://appleid.cdn-apple.com', 'https://challenges.cloudflare.com', 'https://maps.googleapis.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.googleusercontent.com', 'https://maps.gstatic.com', 'https://*.googleapis.com', 'https://*.ggpht.com', 'https://*.basemaps.cartocdn.com', 'https://*.tile.openstreetmap.org'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'https://accounts.google.com/gsi/', 'https://challenges.cloudflare.com', 'https://maps.googleapis.com', ...(config.isProd ? [config.siteUrl.replace(/^http/, 'ws')] : ['ws:', 'wss:'])],
        workerSrc: ["'self'", 'blob:'],
        frameSrc: ["'self'", 'https://accounts.google.com/gsi/', 'https://appleid.apple.com', 'https://challenges.cloudflare.com'],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", 'https://appleid.apple.com'],
        // Only upgrade to HTTPS in production, so the site still works on http://localhost and local network addresses.
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    hsts: config.isProd,
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  // Only the features the archive uses: the camera and microphone for recording a story, location for “near me”
  // and the map, full screen for video. Everything else (payments, USB, sensors…) is switched off for every page.
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), fullscreen=(self), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=()');
    next();
  });
  // Response times and errors of every API request, by route pattern, for performance monitoring (Section 9.4).
  app.use((req: { originalUrl?: string; url: string; route?: { path?: string }; baseUrl?: string }, res: { statusCode: number; on: (e: string, f: () => void) => void }, next: () => void) => {
    const url = req.originalUrl ?? req.url;
    if (!url.startsWith('/api/')) return next();
    const t = performance.now();
    res.on('finish', () => perf.request(req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : 'unmatched', res.statusCode, performance.now() - t));
    next();
  });
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, !origin || config.corsOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Location', 'Upload-Offset', 'Upload-Length', 'Tus-Resumable', 'Upload-Media-Id'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'X-Client', 'X-Language', 'Idempotency-Key', 'X-Refresh-Token', 'X-App-Version', 'Tus-Resumable', 'Upload-Length', 'Upload-Offset', 'Upload-Metadata'],
    maxAge: 600,
  });
  app.setGlobalPrefix('api/v1');
  // Search-engine pages and the start page come before the static files, so they win for "/".
  registerPublicPages(app);
  // The website lives in ../web and is served from the same address, so its sign-in cookie stays first-party.
  if (config.webDir && existsSync(join(config.webDir, 'index.html'))) {
    // The website's build leaves a .br and .gz copy beside each text file. They are sent to browsers that accept them,
    // so the site is small on the wire even where no proxy compresses it (a third of the size on a slow connection).
    const small = new Set<string>();
    const walk = (dir: string, rel: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { if (e.isDirectory()) walk(join(dir, e.name), `${rel}/${e.name}`); else if (/\.(br|gz)$/.test(e.name)) small.add(`${rel}/${e.name}`); } };
    try { walk(config.webDir, ''); } catch { /* none */ }
    const TYPES: Record<string, string> = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
    express.use((req: Request, res: Response, next: NextFunction) => {
      const type = TYPES[extname(req.path)];
      if (!type || (req.method !== 'GET' && req.method !== 'HEAD') || req.headers.range) return next();
      const accepts = String(req.headers['accept-encoding'] ?? '');
      const pick = /\bbr\b/.test(accepts) && small.has(`${req.path}.br`) ? ['br', '.br'] : /\bgzip\b/.test(accepts) && small.has(`${req.path}.gz`) ? ['gzip', '.gz'] : null;
      if (pick) {
        const query = req.url.slice(req.path.length);
        req.url = `${req.path}${pick[1]}${query}`;
        res.setHeader('Content-Encoding', pick[0]); res.setHeader('Content-Type', type);
      }
      res.setHeader('Vary', 'Accept-Encoding');
      next();
    });
    // Files in /assets carry a content hash in their name and never change, so browsers may keep them for a year.
    express.useStaticAssets(config.webDir, { index: false, maxAge: config.isProd ? '1h' : 0, dotfiles: 'ignore',
      setHeaders: (res: { setHeader: (k: string, v: string) => void }, path: string) => { if (/[\\/]assets[\\/]/.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } });
  }
  registerAppFallback(app);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ErrorsFilter());
  express.useBodyParser('json', { limit: '1mb' });
  // Form posts: only Sign in with Apple's return address uses these.
  express.useBodyParser('urlencoded', { limit: '32kb', extended: false });

  if (!config.isProd || process.env.API_DOCS === 'true') {
    const doc = new DocumentBuilder()
      .setTitle('Maritime Safety Heritage Archive API')
      .setDescription('Shared API for the website and the mobile app. Sign in with POST /api/v1/auth/login, then send the access token as a Bearer token.')
      .setVersion('1.0').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }
  app.useWebSocketAdapter(new RealtimeAdapter(app));
  app.enableShutdownHooks();
  return app;
}

/** Socket.IO for live updates. With REDIS_URL set, events are shared across every copy of the API through Redis. */
class RealtimeAdapter extends IoAdapter {
  private redis?: (nsp: unknown) => unknown;
  constructor(app: INestApplication) {
    super(app);
    if (config.redisUrl) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createAdapter } = require('@socket.io/redis-adapter'); const Redis = require('ioredis');
      const pub = new Redis(config.redisUrl), sub = pub.duplicate();
      this.redis = createAdapter(pub, sub);
    }
  }
  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, { ...options, cors: { origin: (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, !origin || config.corsOrigins.includes(origin) || origin === config.siteUrl), credentials: true } });
    if (this.redis) server.adapter(this.redis);
    return server;
  }
}
