import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { config } from './config/config';

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureApp(app);
  await app.listen(config.port);
  const log = new Logger('Server');
  log.log(`API running on http://localhost:${config.port}/api/v1`);
  if (!config.isProd) log.log(`API docs on http://localhost:${config.port}/api/docs`);
}
main();
