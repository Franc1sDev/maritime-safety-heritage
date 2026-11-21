import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { createStorage, STORAGE } from './storage';
import { TusController } from './tus.controller';

@Global()
@Module({
  controllers: [MediaController, TusController],
  providers: [MediaService, { provide: STORAGE, useFactory: createStorage, inject: [DataSource] }],
  exports: [MediaService],
})
export class MediaModule {}
