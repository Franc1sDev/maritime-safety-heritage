import { Body, Controller, Get, HttpCode, Module, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuthUser, CurrentUser, Meta, RequestMeta, Roles } from '../common/decorators';
import { dateParam } from '../common/db';
import { AnalyticsService, CHARTS } from './analytics.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
class ReportDto {
  @Matches(DATE) from: string; @Matches(DATE) to: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsIn(Object.keys(CHARTS), { each: true }) charts?: string[];
  @IsOptional() @IsString() @MaxLength(160) title?: string;
}
class ThresholdsDto { @IsNumber() @Min(0) @Max(99) yellowAbove: number; @IsNumber() @Min(1) @Max(100) redFrom: number }

@ApiTags('Analytics and PDF reports') @ApiBearerAuth() @Roles('admin', 'super_admin')
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}
  @Get('charts') @ApiOperation({ summary: 'The charts available' })
  charts() { return Object.entries(CHARTS).map(([key, c]) => ({ key, title: c.title, series: c.series.map((s) => s.name) })); }
  @Get('summary') @ApiOperation({ summary: 'The measures the platform reports: stories, contributors, counties, incidents, resources, moderation response' })
  summary(@Query('from') from?: string, @Query('to') to?: string) { return this.analytics.summary(dateParam(from) ?? undefined, dateParam(to) ?? undefined); }
  @Get('series') @ApiOperation({ summary: 'A chart per day, week, month or year. Live updates arrive on the WebSocket “analytics” event.' })
  series(@Query('chart') chart = 'stories', @Query('period') period = 'day', @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.series(chart, (['day', 'week', 'month', 'year'].includes(period) ? period : 'day') as 'day', dateParam(from) ?? undefined, dateParam(to) ?? undefined);
  }
  @Get('reports') @ApiOperation({ summary: 'Previous and automatic monthly PDF reports' })
  reports() { return this.analytics.reports(); }
  @Post('reports') @HttpCode(202) @ApiOperation({ summary: 'Generate a PDF report for a period with chosen charts (prepared in the background)' })
  request(@Body() dto: ReportDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.analytics.requestReport(me, dto, meta); }
  @Get('ai') @ApiOperation({ summary: 'AI quality measures, thresholds and today’s use' })
  ai() { return this.analytics.aiQuality(); }
  @Roles('super_admin') @Put('ai/thresholds') @ApiOperation({ summary: 'Recalibrate the GREEN / YELLOW / RED thresholds' })
  thresholds(@Body() dto: ThresholdsDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.analytics.setThresholds(me, dto.yellowAbove, dto.redFrom, meta); }
}

@Module({ controllers: [AnalyticsController], providers: [AnalyticsService], exports: [AnalyticsService] })
export class AnalyticsModule {}
