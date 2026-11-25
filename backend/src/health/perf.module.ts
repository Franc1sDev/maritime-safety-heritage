import { Body, Controller, Get, Header, HttpCode, Injectable, Logger, Module, NotFoundException, OnApplicationShutdown, OnModuleInit, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { timingSafeEqual } from 'crypto';
import { config } from '../config/config';
import { Db } from '../common/db';
import { Public, Roles } from '../common/decorators';
import { Jobs } from '../common/jobs.service';
import { Notify } from '../common/notify.service';
import { perf, percentile } from '../common/perf';
import { RumLimit } from '../common/rate-limits';

/** The measures the website reports (Core Web Vitals and two others). */
export const VITALS = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'] as const;
/** "Good" limits from web.dev, and the plan's target of the first story within 2 s on 4G (Section 9.4). */
export const VITAL_TARGETS: Record<string, number> = { LCP: 2500, CLS: 0.1, INP: 200, FCP: 1800, TTFB: 800 };

class VitalDto {
  @IsIn(VITALS as unknown as string[]) metric: string;
  @IsNumber() @Min(0) @Max(600_000) value: number;
  /** The kind of page (“story”, “stories”, “map”…), never its full address. */
  @IsOptional() @IsString() @MaxLength(40) @Matches(/^[a-z0-9/_-]*$/i) page?: string;
  @IsOptional() @IsString() @MaxLength(12) @Matches(/^[a-z0-9-]*$/i) connection?: string;
}
class VitalsDto { @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => VitalDto) items: VitalDto[]; }

@Injectable()
export class PerfService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger('Performance');
  private lastAlert = 0;
  constructor(private readonly db: Db, private readonly jobs: Jobs, private readonly notify: Notify) {}

  onModuleInit() {
    perf.start();
    this.jobs.every('performance.alert', 5 * 60_000, () => this.checkAlerts());
    this.jobs.every('performance.vitals-purge', 24 * 3600_000, () => this.db.q(`DELETE FROM web_vitals WHERE at < now() - interval '90 days'`));
  }
  onApplicationShutdown() { perf.stop(); }

  /** Stores the website's measurements, after checking each one. */
  async recordVitals(items: VitalDto[]) {
    const ok = items.filter((v) => (VITALS as readonly string[]).includes(v.metric) && Number.isFinite(v.value) && v.value >= 0 && v.value <= 600_000).slice(0, 10);
    for (const v of ok) {
      await this.db.q(`INSERT INTO web_vitals (metric, value, page, connection) VALUES ($1,$2,$3,$4)`,
        [v.metric, v.value, String(v.page ?? '').slice(0, 40), String(v.connection ?? '').slice(0, 12)]);
    }
    return { received: ok.length };
  }

  /** p75 of each measure over the last 7 days (how web.dev judges a site), overall and by connection type. */
  async vitals() {
    const rows = await this.db.q<{ metric: string; connection: string; p75: number; n: number }>(
      `SELECT metric, connection, percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75, count(*)::int AS n
         FROM web_vitals WHERE at > now() - interval '7 days' GROUP BY GROUPING SETS ((metric), (metric, connection))`);
    return VITALS.map((m) => {
      const all = rows.find((r) => r.metric === m && r.connection === null);
      return {
        metric: m, target: VITAL_TARGETS[m], samples: all?.n ?? 0,
        p75: all ? Math.round(Number(all.p75) * (m === 'CLS' ? 1000 : 1)) / (m === 'CLS' ? 1000 : 1) : null,
        byConnection: rows.filter((r) => r.metric === m && r.connection !== null && r.connection !== '')
          .map((r) => ({ connection: r.connection, p75: Math.round(Number(r.p75) * (m === 'CLS' ? 1000 : 1)) / (m === 'CLS' ? 1000 : 1), samples: r.n })),
      };
    });
  }

  /** The slowest statements from pg_stat_statements, when the database has it. */
  async statements() {
    try {
      const ready = await this.db.one(`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements')
        AND current_setting('shared_preload_libraries', true) LIKE '%pg_stat_statements%' AS ok`);
      if (!ready?.ok) return { available: false, rows: [] };
      const rows = await this.db.q(
        `SELECT left(regexp_replace(query, '\\s+', ' ', 'g'), 160) AS query, calls::int AS calls,
                round(mean_exec_time::numeric, 1)::float AS mean_ms, round(total_exec_time::numeric)::float AS total_ms
           FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
          ORDER BY mean_exec_time DESC LIMIT 10`);
      return { available: true, rows };
    } catch { return { available: false, rows: [] }; }
  }

  async report() {
    return {
      ...perf.snapshot(),
      targets: { p95Ms: 300, alertP95Ms: config.perfAlertP95Ms, alertErrorPct: config.perfAlertErrorPct },
      webVitals: await this.vitals(),
      statements: await this.statements(),
    };
  }

  /** Every 5 minutes: if responses are slow or failing, tell the Super Admins (at most once an hour). */
  async checkAlerts(now = Date.now()) {
    const w = perf.window(5);
    const slow = w.requests >= 50 && w.p95 > config.perfAlertP95Ms;
    const failing = w.requests >= 20 && w.errorRate > config.perfAlertErrorPct;
    if (!slow && !failing) return { alerted: false };
    if (now - this.lastAlert < 3600_000) return { alerted: false, quiet: true };
    this.lastAlert = now;
    const parts = [slow ? `95% of responses took up to ${w.p95} ms (target ${config.perfAlertP95Ms} ms)` : '', failing ? `${w.errorRate}% of responses were server errors` : ''].filter(Boolean);
    this.log.warn(`Performance alert: ${parts.join('; ')}`);
    await this.notify.superAdmins({
      group: 'account', kind: 'performance.alert', title: slow ? 'The archive is responding slowly' : 'The archive is returning errors',
      body: `In the last 5 minutes ${parts.join(', and ')}, over ${w.requests} requests. See SUPER ADMIN › System › Performance.`, link: '/super/system',
    });
    return { alerted: true };
  }
}

@ApiTags('Health')
@Controller()
export class PerfController {
  constructor(private readonly svc: PerfService) {}

  @Roles('super_admin') @ApiBearerAuth() @Get('super/performance') @ApiOperation({ summary: 'Response times, errors, server load, slow queries and real-user page speed' })
  report() { return this.svc.report(); }

  @Public() @RumLimit() @HttpCode(202) @Post('rum') @ApiOperation({ summary: 'Page-speed measurements from the website (no personal data)' })
  rum(@Body() dto: VitalsDto) { return this.svc.recordVitals(dto.items); }

  @Public() @Get('metrics') @Header('Content-Type', 'text/plain; version=0.0.4') @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Prometheus metrics for an outside monitor. Needs METRICS_TOKEN as a bearer token; closed when it is not set' })
  metrics(@Req() req: { headers: Record<string, string | undefined> }) {
    const given = Buffer.from(String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
    const want = Buffer.from(config.metricsToken);
    if (!config.metricsToken || given.length !== want.length || !timingSafeEqual(given, want)) throw new NotFoundException();
    return perf.prometheus();
  }
}

@Module({ controllers: [PerfController], providers: [PerfService] })
export class PerfModule {}
