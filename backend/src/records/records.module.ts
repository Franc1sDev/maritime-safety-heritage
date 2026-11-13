import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveRecord, RecordView } from '../database/entities';
import { MediaModule } from '../media/media.module';
import { VocabModule } from '../vocab/vocab.module';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  imports: [TypeOrmModule.forFeature([ArchiveRecord, RecordView]), VocabModule, MediaModule],
  controllers: [RecordsController], providers: [RecordsService], exports: [RecordsService],
})
export class RecordsModule {}
