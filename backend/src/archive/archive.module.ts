import { Module } from '@nestjs/common';
import { StoriesModule } from '../stories/stories.module';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';
import { ImportService } from './import.service';

@Module({ imports: [StoriesModule], controllers: [ArchiveController], providers: [ArchiveService, ImportService], exports: [ArchiveService] })
export class ArchiveModule {}
