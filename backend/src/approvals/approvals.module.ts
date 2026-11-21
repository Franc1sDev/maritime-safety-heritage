import { Body, Controller, Get, Global, HttpCode, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Meta, RequestMeta, Roles } from '../common/decorators';
import { Approvals } from './approvals.service';

class VoteDto { @IsIn(['approve', 'reject', 'changes']) vote: 'approve' | 'reject' | 'changes'; @IsString() @MinLength(3) @MaxLength(2000) justification: string }
class JustifyDto { @IsString() @MinLength(3) @MaxLength(2000) justification: string }
class DecideDto { @IsBoolean() approve: boolean; @IsString() @MinLength(3) @MaxLength(2000) justification: string }

@ApiTags('Approvals') @ApiBearerAuth()
@Controller()
export class ApprovalsController {
  constructor(private readonly approvals: Approvals) {}

  @Roles('admin', 'super_admin') @Get('admin/approvals') @ApiOperation({ summary: 'Approval requests with their votes and progress' })
  list(@CurrentUser() me: AuthUser, @Query('status') status?: string) { return this.approvals.list(me, status); }
  @Roles('admin') @Get('admin/approvals/waiting') @ApiOperation({ summary: 'Requests waiting for my decision' })
  waiting(@CurrentUser() me: AuthUser) { return this.approvals.waitingFor(me); }
  @Roles('admin', 'super_admin') @Get('admin/approvals/:id') @ApiOperation({ summary: 'One approval request' })
  one(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.approvals.view(id, me.id); }
  @Roles('admin') @Post('admin/approvals/:id/vote') @HttpCode(200) @ApiOperation({ summary: 'Approve, reject or request changes, with a written justification' })
  vote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VoteDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.approvals.vote(id, me, dto.vote, dto.justification, meta); }
  @Roles('admin') @Post('admin/approvals/:id/resubmit') @HttpCode(200) @ApiOperation({ summary: 'Answer a request for changes and restart voting' })
  resubmit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: JustifyDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.approvals.resubmit(id, me, dto.justification, meta); }
  @Roles('super_admin') @Post('super/approvals/:id/decide') @HttpCode(200) @ApiOperation({ summary: 'Super Admin decision on a request that passed its deadline' })
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.approvals.decideOverdue(id, me, dto.approve, dto.justification, meta); }
}

@Global()
@Module({ controllers: [ApprovalsController], providers: [Approvals], exports: [Approvals] })
export class ApprovalsModule {}
