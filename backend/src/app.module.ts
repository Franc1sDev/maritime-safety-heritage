import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from './activity/activity.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/auth.guard';
import { DEFAULT_LIMIT } from './common/rate-limits';
import { config } from './config/config';
import { dataSourceOptions } from './database/data-source';
import { User } from './database/entities';
import { HealthController } from './health/health.controller';
import { MediaModule } from './media/media.module';
import { MessagesModule } from './messages/messages.module';
import { RecordsModule } from './records/records.module';
import { ReportsModule } from './reports/reports.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { UsersModule } from './users/users.module';
import { VocabModule } from './vocab/vocab.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => dataSourceOptions() }),
    TypeOrmModule.forFeature([User]),
    ThrottlerModule.forRoot([{ ...DEFAULT_LIMIT, limit: DEFAULT_LIMIT.limit * config.rateLimitScale }]),
    ActivityModule, AuthModule, UsersModule, VocabModule, RecordsModule, MediaModule, SubmissionsModule, MessagesModule, ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
