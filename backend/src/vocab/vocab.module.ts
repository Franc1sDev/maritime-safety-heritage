import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subject, WaterBody } from '../database/entities';
import { VocabController } from './vocab.controller';
import { VocabService } from './vocab.service';

@Module({ imports: [TypeOrmModule.forFeature([Subject, WaterBody])], controllers: [VocabController], providers: [VocabService], exports: [VocabService] })
export class VocabModule {}
