import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync } from 'fs';
import helmet from 'helmet';
import { join } from 'path';
import { ErrorsFilter } from './common/errors.filter';
import { config } from './config/config';
import { registerPublicPages } from './public/seo';

/** Security and request handling shared by the server and the automated tests. */
export function configureApp(app: INestApplication) {
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  if (config.trustProxy) express.set('trust proxy', config.trustProxy);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.basemaps.cartocdn.com', 'https://assets.mixkit.co'],
        mediaSrc: ["'self'", 'blob:', 'https://assets.mixkit.co'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // Only upgrade to HTTPS in production, so the site still works on http://localhost and local network addresses.
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    hsts: config.isProd,
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, !origin || config.corsOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'X-Client'],
    maxAge: 600,
  });
  app.setGlobalPrefix('api/v1');
  // Search-engine pages and the start page come before the static files, so they win for "/".
  registerPublicPages(app);
  // The website lives in ../web and is served from the same address, so its sign-in cookie stays first-party.
  if (config.webDir && existsSync(join(config.webDir, 'index.html'))) {
    express.useStaticAssets(config.webDir, { index: 'index.html', maxAge: config.isProd ? '1h' : 0, dotfiles: 'ignore' });
  }
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ErrorsFilter());
  express.useBodyParser('json', { limit: '1mb' });

  if (!config.isProd || process.env.API_DOCS === 'true') {
    const doc = new DocumentBuilder()
      .setTitle('Maritime Safety Heritage Archive API')
      .setDescription('Shared API for the website and the mobile app. Sign in with POST /api/v1/auth/login, then send the access token as a Bearer token.')
      .setVersion('1.0').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }
  app.enableShutdownHooks();
  return app;
}
