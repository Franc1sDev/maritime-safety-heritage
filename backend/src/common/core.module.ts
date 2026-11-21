import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Audit } from './audit.service';
import { Cache } from './cache.service';
import { AuthGuard } from './auth.guard';
import { Db } from './db';
import { Jobs } from './jobs.service';
import { MailService } from './mail.service';
import { Notify } from './notify.service';
import { Realtime } from './realtime.gateway';
import { Track } from './track.service';

/** Shared services every module uses: database access, audit log, background jobs, live updates, notifications and email. */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [Db, Cache, Audit, Jobs, MailService, AuthGuard, Realtime, Notify, Track],
  exports: [Db, Cache, Audit, Jobs, MailService, AuthGuard, Realtime, Notify, Track, JwtModule],
})
export class CoreModule {}
