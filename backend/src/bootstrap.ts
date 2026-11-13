import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ErrorsFilter } from './common/errors.filter';
import { config } from './config/config';

/** Security and request handling shared by the server and the automated tests. */
export function configureApp(app: INestApplication) {
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  if (config.trustProxy) express.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'X-Client'],
    maxAge: 600,
  });
  app.setGlobalPrefix('api/v1');
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
