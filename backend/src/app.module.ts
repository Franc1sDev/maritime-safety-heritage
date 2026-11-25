import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ArchiveModule } from './archive/archive.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/auth.guard';
import { CoreModule } from './common/core.module';
import { DEFAULT_LIMIT } from './common/rate-limits';
import { config } from './config/config';
import { dataSourceOptions } from './database/data-source';
import { HealthController } from './health/health.controller';
import { PerfModule } from './health/perf.module';
import { InboxModule } from './inbox/inbox.module';
import { MediaModule } from './media/media.module';
import { ModerationModule } from './moderation/moderation.module';
import { StoriesModule } from './stories/stories.module';
import { TeamModule } from './team/team.module';
import { UsersModule } from './users/users.module';

/**
 * A modular monolith (Section 2.1): each area of the platform is its own module with clear boundaries, so any module
 * can later be split into a separate service if load requires it.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => dataSourceOptions() }),
    ThrottlerModule.forRoot([{ ...DEFAULT_LIMIT, limit: DEFAULT_LIMIT.limit * config.rateLimitScale }]),
    CoreModule, MediaModule, AiModule, ApprovalsModule, InboxModule,
    AuthModule, UsersModule, StoriesModule, ModerationModule, ArchiveModule, AnalyticsModule, TeamModule, PerfModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
export class AppModule {}
