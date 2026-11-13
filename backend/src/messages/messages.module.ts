import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, CurrentUser, Meta, Public, RequestMeta, Roles } from '../common/decorators';
import { PageQuery, pageOf } from '../common/pagination';
import { ContactLimit } from '../common/rate-limits';
import { ContactMessage } from '../database/entities';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

class ContactDto {
  @ApiProperty() @trim() @IsString() @Length(2, 120) name: string;
  @ApiProperty() @trim() @IsEmail({}, { message: 'Enter a valid email address so we can reply.' }) @MaxLength(254) email: string;
  @ApiProperty() @trim() @IsString() @Length(3, 200) subject: string;
  @ApiProperty() @trim() @IsString() @Length(10, 5000, { message: 'Write a message of at least 10 characters.' }) body: string;
  /** Hidden form field. People leave it empty; spam bots fill it in. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) website?: string;
}
class MessageQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['read', 'unread'] }) @IsOptional() @IsIn(['read', 'unread']) filter?: 'read' | 'unread';
}
class MarkDto { @ApiProperty() @IsBoolean() read: boolean }

@Injectable()
export class MessagesService {
  constructor(@InjectRepository(ContactMessage) private readonly repo: Repository<ContactMessage>) {}
  async create(dto: ContactDto, user?: AuthUser) {
    if (dto.website) return null; // silently drop spam
    return this.repo.save(this.repo.create({ name: dto.name, email: dto.email.toLowerCase(), subject: dto.subject, body: dto.body, userId: user?.id ?? null }));
  }
  async list(q: MessageQuery) {
    const [items, total] = await this.repo.findAndCount({
      where: q.filter ? { read: q.filter === 'read' } : {}, order: { createdAt: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
    });
    return { ...pageOf(items, total, q), unread: await this.repo.countBy({ read: false }) };
  }
  async mark(id: string, read: boolean) {
    const res = await this.repo.update(id, { read });
    if (!res.affected) throw new NotFoundException('That message does not exist.');
    return this.repo.findOneByOrFail({ id });
  }
  async remove(id: string) {
    const m = await this.repo.findOneBy({ id });
    if (!m) throw new NotFoundException('That message does not exist.');
    await this.repo.delete(id);
    return m;
  }
}

@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService, private readonly activity: ActivityService) {}

  @Public() @ContactLimit() @Post() @HttpCode(202) @ApiOperation({ summary: 'Contact the research team (no sign-in needed)' })
  async create(@Body() dto: ContactDto, @CurrentUser() me: AuthUser | undefined, @Meta() meta: RequestMeta) {
    const m = await this.messages.create(dto, me);
    if (m) await this.activity.record({ actor: me ?? { id: '', name: dto.name }, action: 'message.create', entityType: 'message', entityId: m.id, summary: `Message: ${m.subject}`, ip: meta.ip });
    return { message: 'Thank you. The research team will reply by email.' };
  }

  @ApiBearerAuth() @Roles('admin') @Get() @ApiOperation({ summary: 'Messages to the research team' })
  list(@Query() q: MessageQuery) { return this.messages.list(q); }

  @ApiBearerAuth() @Roles('admin') @Patch(':id') @ApiOperation({ summary: 'Mark as read or unread' })
  mark(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkDto) { return this.messages.mark(id, dto.read); }

  @ApiBearerAuth() @Roles('admin') @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'Delete a message' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    const m = await this.messages.remove(id);
    await this.activity.record({ actor: me, action: 'message.delete', entityType: 'message', entityId: id, summary: `Deleted message "${m.subject}"`, ip: meta.ip });
  }
}

@Module({ imports: [TypeOrmModule.forFeature([ContactMessage])], controllers: [MessagesController], providers: [MessagesService] })
export class MessagesModule {}
