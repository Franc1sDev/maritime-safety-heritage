import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({ controllers: [StoriesController], providers: [StoriesService, CommentsService], exports: [StoriesService, CommentsService] })
export class StoriesModule {}
