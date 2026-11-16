import {
  Body, Controller, Delete, Get, Global, HttpCode, Injectable, Logger, Module, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown,
  Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuthUser, CurrentUser } from '../common/decorators';
import { MailService } from '../common/mail.service';
import { PageQuery, pageOf } from '../common/pagination';
import { config } from '../config/config';
import { ContactMessage, Notification, Reminder } from '../database/entities';
import { AuthModule } from '../auth/auth.module';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export interface NewNotification {
  kind: string;
  title: string;
  summary?: string;
  body?: string;
  link?: string;
  /** Stays on screen until the matching action is done; [actionKey] identifies that action. */
  actionKey?: string;
  actionLabel?: string;
}

/**
 * Notifications for one person: pop-ups with a short summary, a longer body to read on demand,
 * and actions that stay pinned until done (for example "Review SUB-0004").
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    @InjectRepository(ContactMessage) private readonly messages: Repository<ContactMessage>,
    private readonly ds: DataSource,
  ) {}

  /** Sends the same notification to several people. Repeats of an open action for the same person are skipped. */
  async notify(userIds: string[], n: NewNotification): Promise<void> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;
    let skip = new Set<string>();
    if (n.actionKey) {
      const open = await this.repo.find({ select: { userId: true }, where: ids.map((userId) => ({ userId, actionKey: n.actionKey, doneAt: IsNull() })) });
      skip = new Set(open.map((o) => o.userId));
    }
    const rows = ids.filter((id) => !skip.has(id)).map((userId) => this.repo.create({
      userId, kind: n.kind, title: n.title.slice(0, 200), summary: (n.summary ?? '').slice(0, 300), body: (n.body ?? '').slice(0, 5000), link: n.link ?? '',
      requiresAction: !!n.actionKey, actionKey: n.actionKey ?? null, actionLabel: n.actionLabel ?? '',
    }));
    if (rows.length) await this.repo.save(rows);
  }

  /** Everyone who catalogues and reviews (editors and admins), or only admins. */
  async staffIds(adminsOnly = false): Promise<string[]> {
    const rows: { id: string }[] = await this.ds.query(
      `SELECT id FROM users WHERE status = 'active' AND role = ANY($1)`, [adminsOnly ? ['admin'] : ['admin', 'editor']]);
    return rows.map((r) => r.id);
  }
  async notifyStaff(n: NewNotification, adminsOnly = false) { await this.notify(await this.staffIds(adminsOnly), n); }

  /** The action has been done: every open notification for it goes away (for one person, or for everyone). */
  async complete(actionKey: string, userId?: string): Promise<number> {
    const res = await this.repo.update({ actionKey, doneAt: IsNull(), ...(userId && { userId }) }, { doneAt: new Date(), viewedAt: new Date() });
    return res.affected ?? 0;
  }

  /** Someone looked at the item (for example opened the message): it no longer counts as new, but its action stays open. */
  async markViewedByAction(actionKey: string) {
    await this.repo.update({ actionKey, viewedAt: IsNull() }, { viewedAt: new Date() });
  }

  /** What the app needs on every screen: counts, open actions and new pop-ups. */
  async summary(user: AuthUser) {
    const unviewed = await this.repo.countBy({ userId: user.id, viewedAt: IsNull() });
    const actions = await this.repo.find({ where: { userId: user.id, requiresAction: true, doneAt: IsNull() }, order: { createdAt: 'ASC' }, take: 20 });
    const fresh = await this.repo.find({ where: { userId: user.id, requiresAction: false, viewedAt: IsNull() }, order: { createdAt: 'ASC' }, take: 10 });
    const staff = user.role === 'admin';
    const enquiries = staff
      ? await this.messages.countBy({ read: false })
      : await this.messages.createQueryBuilder('m').where('m.user_id = :id', { id: user.id }).andWhere('m.reply IS NOT NULL').andWhere('m.reply_seen_at IS NULL').getCount();
    return { unviewed, enquiries, actions: actions.map(view), fresh: fresh.map(view) };
  }

  async list(user: AuthUser, q: PageQuery) {
    const [items, total] = await this.repo.findAndCount({ where: { userId: user.id }, order: { createdAt: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
    return { ...pageOf(items.map(view), total, q), unviewed: await this.repo.countBy({ userId: user.id, viewedAt: IsNull() }) };
  }

  async markViewed(user: AuthUser, id: string) {
    const n = await this.repo.findOneBy({ id, userId: user.id });
    if (!n) throw new NotFoundException('That notification does not exist.');
    if (!n.viewedAt) await this.repo.update(n.id, { viewedAt: new Date() });
    return this.summary(user);
  }
  async markAllViewed(user: AuthUser) {
    await this.repo.update({ userId: user.id, viewedAt: IsNull() }, { viewedAt: new Date() });
    return this.summary(user);
  }
}

const view = (n: Notification) => ({
  id: n.id, kind: n.kind, title: n.title, summary: n.summary, body: n.body, link: n.link, requiresAction: n.requiresAction,
  actionKey: n.actionKey, actionLabel: n.actionLabel, createdAt: n.createdAt, viewed: !!n.viewedAt, done: !!n.doneAt,
});

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------
class ReminderDto {
  @ApiProperty() @trim() @IsString() @Length(1, 200, { message: 'Give the reminder a subject.' }) subject: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(2000) description?: string;
  @ApiProperty({ description: 'Date and time, ISO 8601 with time zone' }) @IsDateString({}, { message: 'Choose a date and time.' }) dueAt: string;
}
class ReminderPatchDto {
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @Length(1, 200) subject?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueAt?: string;
}
class SnoozeDto { @ApiProperty({ minimum: 5, maximum: 10080 }) @Type(() => Number) @IsInt() @Min(5) @Max(10080) minutes: number }
class ReminderQuery { @ApiPropertyOptional({ enum: ['upcoming', 'done', 'all'] }) @IsOptional() @IsString() show?: 'upcoming' | 'done' | 'all' }

@Injectable()
export class RemindersService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Reminders');
  private timer: NodeJS.Timeout | null = null;
  constructor(
    @InjectRepository(Reminder) private readonly repo: Repository<Reminder>,
    private readonly notes: NotificationsService,
    private readonly mail: MailService,
    private readonly ds: DataSource,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.fireDue().catch((e) => this.log.error(e.message)), 30_000);
    this.timer.unref();
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }

  /** Turns every reminder that has come due into a notification (and an email when email is set up). */
  async fireDue(userId?: string): Promise<number> {
    const res: [Reminder[], number] | Reminder[] = await this.ds.query(
      `UPDATE reminders SET fired_at = now() WHERE fired_at IS NULL AND done_at IS NULL AND due_at <= now() ${userId ? 'AND user_id = $1' : ''}
       RETURNING id, user_id AS "userId", subject, description, due_at AS "dueAt"`, userId ? [userId] : []);
    // TypeORM answers an UPDATE ... RETURNING with [rows, affected]
    const due = (Array.isArray(res[0]) ? res[0] : res) as Reminder[];
    for (const r of due) {
      await this.notes.notify([r.userId], {
        kind: 'reminder', title: `Reminder: ${r.subject}`, summary: r.description ? r.description.slice(0, 160) : 'It is time.',
        body: r.description, link: '#/reminders', actionKey: `reminder:${r.id}`, actionLabel: 'Mark as done',
      });
      if (this.mail.enabled) {
        const [u]: { email: string; name: string }[] = await this.ds.query(`SELECT email, name FROM users WHERE id = $1 AND status = 'active'`, [r.userId]);
        if (u) await this.mail.send(u.email, `Reminder: ${r.subject}`, `Hello ${u.name},\n\n${r.subject}\n\n${r.description || ''}\n\nMark it as done in the archive: ${config.siteUrl}/#/reminders\n`);
      }
    }
    return due.length;
  }

  async list(user: AuthUser, show: string = 'upcoming') {
    const qb = this.repo.createQueryBuilder('r').where('r.user_id = :id', { id: user.id });
    if (show === 'upcoming') qb.andWhere('r.done_at IS NULL').orderBy('r.due_at', 'ASC');
    else if (show === 'done') qb.andWhere('r.done_at IS NOT NULL').orderBy('r.done_at', 'DESC');
    else qb.orderBy('r.due_at', 'DESC');
    return (await qb.take(200).getMany()).map(rview);
  }
  async create(user: AuthUser, dto: ReminderDto) {
    const r = await this.repo.save(this.repo.create({ userId: user.id, subject: dto.subject, description: dto.description ?? '', dueAt: new Date(dto.dueAt) }));
    await this.fireDue(user.id);
    return rview(await this.repo.findOneByOrFail({ id: r.id }));
  }
  private async mine(user: AuthUser, id: string) {
    const r = await this.repo.findOneBy({ id, userId: user.id });
    if (!r) throw new NotFoundException('That reminder does not exist.');
    return r;
  }
  async update(user: AuthUser, id: string, dto: ReminderPatchDto) {
    const r = await this.mine(user, id);
    const patch: Partial<Reminder> = {};
    if (dto.subject !== undefined) patch.subject = dto.subject;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.dueAt !== undefined) { patch.dueAt = new Date(dto.dueAt); patch.firedAt = null; patch.doneAt = null; await this.notes.complete(`reminder:${r.id}`); }
    await this.repo.update(r.id, patch);
    await this.fireDue(user.id);
    return rview(await this.repo.findOneByOrFail({ id: r.id }));
  }
  async done(user: AuthUser, id: string) {
    const r = await this.mine(user, id);
    await this.repo.update(r.id, { doneAt: new Date() });
    await this.notes.complete(`reminder:${r.id}`);
    return rview(await this.repo.findOneByOrFail({ id: r.id }));
  }
  async snooze(user: AuthUser, id: string, minutes: number) {
    const r = await this.mine(user, id);
    await this.repo.update(r.id, { dueAt: new Date(Date.now() + minutes * 60_000), firedAt: null, doneAt: null });
    await this.notes.complete(`reminder:${r.id}`);
    return rview(await this.repo.findOneByOrFail({ id: r.id }));
  }
  async remove(user: AuthUser, id: string) {
    const r = await this.mine(user, id);
    await this.repo.delete(r.id);
    await this.notes.complete(`reminder:${r.id}`);
  }
}

const rview = (r: Reminder) => ({
  id: r.id, subject: r.subject, description: r.description, dueAt: r.dueAt, fired: !!r.firedAt, done: !!r.doneAt, doneAt: r.doneAt, createdAt: r.createdAt,
});

@ApiTags('Notifications') @ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly n: NotificationsService, private readonly reminders: RemindersService) {}

  @Get('summary') @ApiOperation({ summary: 'Counts, open actions and new pop-ups for the signed-in person' })
  async summary(@CurrentUser() me: AuthUser) {
    await this.reminders.fireDue(me.id); // catch up straight away if the server was asleep
    return this.n.summary(me);
  }
  @Get() @ApiOperation({ summary: 'All of my notifications, newest first' })
  list(@CurrentUser() me: AuthUser, @Query() q: PageQuery) { return this.n.list(me, q); }
  @Post('viewed') @HttpCode(200) @ApiOperation({ summary: 'Mark all as viewed' })
  allViewed(@CurrentUser() me: AuthUser) { return this.n.markAllViewed(me); }
  @Post(':id/viewed') @HttpCode(200) @ApiOperation({ summary: 'Mark one as viewed' })
  viewed(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.n.markViewed(me, id); }
}

@ApiTags('Reminders') @ApiBearerAuth()
@Controller('reminders')
export class RemindersController {
  constructor(private readonly r: RemindersService) {}
  @Get() @ApiOperation({ summary: 'My reminders (upcoming by default)' })
  list(@CurrentUser() me: AuthUser, @Query() q: ReminderQuery) { return this.r.list(me, q.show); }
  @Post() @ApiOperation({ summary: 'Set a reminder' })
  create(@CurrentUser() me: AuthUser, @Body() dto: ReminderDto) { return this.r.create(me, dto); }
  @Patch(':id') @ApiOperation({ summary: 'Change a reminder' })
  update(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReminderPatchDto) { return this.r.update(me, id, dto); }
  @Post(':id/done') @HttpCode(200) @ApiOperation({ summary: 'Mark a reminder as done' })
  done(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.r.done(me, id); }
  @Post(':id/snooze') @HttpCode(200) @ApiOperation({ summary: 'Remind me again later' })
  snooze(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SnoozeDto) { return this.r.snooze(me, id, dto.minutes); }
  @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'Delete a reminder' })
  remove(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.r.remove(me, id); }
}

@Global()
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Notification, Reminder, ContactMessage])],
  controllers: [NotificationsController, RemindersController],
  providers: [NotificationsService, RemindersService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
