import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from '../database/entities';
import { ActivityService } from './activity.service';

@Global()
@Module({ imports: [TypeOrmModule.forFeature([Activity])], providers: [ActivityService], exports: [ActivityService] })
export class ActivityModule {}
