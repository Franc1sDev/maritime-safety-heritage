import { BadRequestException, Body, Controller, ForbiddenException, HttpCode, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { REFRESH_COOKIE } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { hashPassword, verifyPassword } from '../common/crypto';
import { AuthUser, CurrentUser, Meta, RequestMeta } from '../common/decorators';
import { LoginLimit } from '../common/rate-limits';
import { config } from '../config/config';
import { MediaFile, Submission, User } from '../database/entities';
import { MediaService } from '../media/media.service';

class DeleteAccountDto { @ApiProperty() @IsString() @MaxLength(128) password: string }

/**
 * Lets people close their own account (required by Google Play and the App Store).
 * The person's name, email and organisation are erased and they can never sign in again.
 * Submissions still waiting for review are withdrawn and their files deleted.
 * Material already accepted into the archive stays, because it is now part of the archive.
 */
@ApiTags('Account') @ApiBearerAuth()
@Controller('auth')
export class AccountController {
  constructor(
    private readonly auth: AuthService,
    private readonly media: MediaService,
    private readonly activity: ActivityService,
    private readonly ds: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Submission) private readonly submissions: Repository<Submission>,
    @InjectRepository(MediaFile) private readonly files: Repository<MediaFile>,
  ) {}

  @LoginLimit() @Post('delete-account') @HttpCode(204)
  @ApiOperation({ summary: 'Permanently close your account (needs your password)' })
  async deleteAccount(@CurrentUser() me: AuthUser, @Body() dto: DeleteAccountDto, @Meta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const user = await this.users.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id: me.id }).getOneOrFail();
    if (!(await verifyPassword(dto.password, user.passwordHash))) throw new ForbiddenException('Your password is incorrect.');
    if (user.role === 'admin' && (await this.users.countBy({ role: 'admin', status: 'active' })) <= 1) {
      throw new BadRequestException('You are the only admin. Make someone else an admin before closing your account.');
    }
    const pending = await this.submissions.find({ where: { submittedById: user.id, status: 'pending' } });
    if (pending.length) {
      const files = await this.files.find({ where: { submissionId: In(pending.map((s) => s.id)) } });
      for (const f of files) if (!f.recordId) await this.media.remove(f.id);
      await this.submissions.update({ id: In(pending.map((s) => s.id)) }, { status: 'rejected', reviewNote: 'Withdrawn: the contributor closed their account.', reviewedAt: new Date() });
    }
    await this.users.update(user.id, {
      name: 'Deleted account', email: `deleted-${user.id}@deleted.invalid`, organisation: '', status: 'deleted', deletedAt: new Date(),
      passwordHash: await hashPassword(randomBytes(32).toString('hex')), failedLogins: 0, lockedUntil: null,
    });
    await this.auth.revokeAll(user.id);
    // Past audit entries keep what happened but no longer name the person.
    await this.ds.query(`UPDATE activity_log SET actor_name = CASE WHEN actor_id = $1 THEN 'Deleted account' ELSE actor_name END,
        summary = replace(summary, $2, 'Deleted account') WHERE actor_id = $1 OR entity_id = $3`, [user.id, user.name, user.id]);
    await this.activity.record({ actor: { id: user.id, name: 'Deleted account' }, action: 'user.delete_self', entityType: 'user', entityId: user.id,
      summary: `An account closed itself; ${pending.length} pending submission(s) withdrawn`, ip: meta.ip });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth', httpOnly: true, sameSite: config.cookie.sameSite, secure: config.cookie.secure });
  }
}
