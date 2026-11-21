import { Body, Controller, Get, Global, Headers, HttpCode, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser, Meta, RequestMeta, Roles } from '../common/decorators';
import { MessageLimit } from '../common/rate-limits';
import { InboxService } from './inbox.service';

class SendDto {
  @IsOptional() @IsUUID() conversationId?: string;
  @IsOptional() @IsUUID() toUserId?: string;
  @IsOptional() @IsBoolean() toAdmins?: boolean;
  @IsOptional() @IsString() @MaxLength(120) topic?: string;
  @IsOptional() @IsString() @MaxLength(8000) text?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsUUID('all', { each: true }) mediaIds?: string[];
}

@ApiTags('INBOX') @ApiBearerAuth()
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}
  @Get() @ApiOperation({ summary: 'My conversations and message requests, each with its unread count' })
  list(@CurrentUser() me: AuthUser) { return this.inbox.list(me); }
  @Roles('contributor', 'admin') @MessageLimit() @Post() @ApiOperation({ summary: 'Send a message to a person, to the admins, or into a conversation. Idempotency-Key prevents duplicates on retry.' })
  send(@CurrentUser() me: AuthUser, @Body() dto: SendDto, @Headers('idempotency-key') key: string | undefined, @Meta() meta: RequestMeta) { return this.inbox.send(me, dto, key?.slice(0, 80), meta); }
  @Get(':id') @ApiOperation({ summary: 'The full correspondence of one conversation' })
  messages(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Query() q: Record<string, string>) { return this.inbox.messages(id, me, q); }
  @Post(':id/read') @HttpCode(200) @ApiOperation({ summary: 'Mark a conversation as read' })
  read(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.inbox.read(id, me); }
  @Post(':id/accept') @HttpCode(200) @ApiOperation({ summary: 'Accept a message request' })
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.inbox.accept(id, me); }
}

@Global()
@Module({ controllers: [InboxController], providers: [InboxService], exports: [InboxService] })
export class InboxModule {}
