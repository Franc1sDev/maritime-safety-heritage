import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Submission } from '../database/entities';
import { MediaModule } from '../media/media.module';
import { VocabModule } from '../vocab/vocab.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({ imports: [TypeOrmModule.forFeature([Submission]), MediaModule, VocabModule, AuthModule], controllers: [SubmissionsController], providers: [SubmissionsService] })
export class SubmissionsModule {}
