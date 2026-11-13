import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveRecord, MediaFile, Submission } from '../database/entities';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { createStorage, STORAGE } from './storage';

@Module({
  imports: [TypeOrmModule.forFeature([MediaFile, ArchiveRecord, Submission])],
  controllers: [MediaController],
  providers: [MediaService, { provide: STORAGE, useFactory: createStorage }],
  exports: [MediaService],
})
export class MediaModule {}
