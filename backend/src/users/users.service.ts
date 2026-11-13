import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { Brackets, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthService } from '../auth/auth.service';
import { hashPassword } from '../common/crypto';
import { AuthUser, RequestMeta } from '../common/decorators';
import { pageOf } from '../common/pagination';
import { User } from '../database/entities';
import { CreateUserDto, publicUser, UpdateUserDto, UserQuery } from './user.dto';

/** A readable one-time password such as "tide-4821-Reef". */
function temporaryPassword(): string {
  const words = ['Tide', 'Reef', 'Dhow', 'Wave', 'Gulf', 'Keel', 'Buoy', 'Oar', 'Sail', 'Jetty', 'Lamu', 'Mbita'];
  const w = () => words[randomInt(words.length)];
  return `${w().toLowerCase()}-${randomInt(1000, 9999)}-${w()}-${randomInt(10, 99)}`;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly auth: AuthService,
    private readonly activity: ActivityService,
  ) {}

  async list(q: UserQuery) {
    const qb = this.users.createQueryBuilder('u').orderBy('u.createdAt', 'DESC').skip((q.page - 1) * q.pageSize).take(q.pageSize);
    if (q.q) qb.andWhere(new Brackets((b) => b.where('u.name ILIKE :q', { q: `%${q.q}%` }).orWhere('u.email ILIKE :q').orWhere('u.organisation ILIKE :q')));
    if (q.role) qb.andWhere('u.role = :role', { role: q.role });
    if (q.status) qb.andWhere('u.status = :status', { status: q.status });
    else qb.andWhere(`u.status <> 'deleted'`);
    const [rows, total] = await qb.getManyAndCount();
    return pageOf(rows.map(publicUser), total, q);
  }

  async create(dto: CreateUserDto, actor: AuthUser, meta: RequestMeta) {
    if (await this.users.existsBy({ email: dto.email })) throw new ConflictException('An account with this email already exists.');
    const password = temporaryPassword();
    const user = await this.users.save(this.users.create({ name: dto.name, email: dto.email, role: dto.role, organisation: dto.organisation ?? '', passwordHash: await hashPassword(password) }));
    await this.activity.record({ actor, action: 'user.create', entityType: 'user', entityId: user.id, summary: `Created ${dto.role} account for ${user.name}`, ip: meta.ip });
    return { user: publicUser(user), temporaryPassword: password };
  }

  private async get(id: string) {
    const u = await this.users.findOneBy({ id });
    if (!u || u.status === 'deleted') throw new NotFoundException('That account does not exist.');
    return u;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser, meta: RequestMeta) {
    const user = await this.get(id);
    const losingAdmin = user.role === 'admin' && user.status === 'active' && ((dto.role !== undefined && dto.role !== 'admin') || dto.status === 'suspended');
    if (losingAdmin) {
      if (id === actor.id) throw new BadRequestException('You cannot remove your own admin access or suspend yourself. Ask another admin.');
      const admins = await this.users.countBy({ role: 'admin', status: 'active' });
      if (admins <= 1) throw new BadRequestException('The archive needs at least one active admin.');
    }
    const changes: Partial<User> = {};
    for (const k of ['name', 'organisation', 'role', 'status'] as const) if (dto[k] !== undefined && dto[k] !== user[k]) (changes as Record<string, unknown>)[k] = dto[k];
    if (!Object.keys(changes).length) return publicUser(user);
    await this.users.update(id, changes);
    if (changes.status === 'suspended' || changes.role) await this.auth.revokeAll(id);
    const what = changes.status === 'suspended' ? 'Suspended' : changes.status === 'active' ? 'Reactivated' : changes.role ? `Made ${changes.role}:` : 'Updated';
    await this.activity.record({ actor, action: 'user.update', entityType: 'user', entityId: id, summary: `${what} ${user.name}`, details: changes as Record<string, unknown>, ip: meta.ip });
    return publicUser(await this.get(id));
  }

  /** Sets a temporary password the admin passes on, and signs the account out everywhere. */
  async resetPassword(id: string, actor: AuthUser, meta: RequestMeta) {
    const user = await this.get(id);
    const password = temporaryPassword();
    await this.users.update(id, { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null });
    await this.auth.revokeAll(id);
    await this.activity.record({ actor, action: 'user.reset_password', entityType: 'user', entityId: id, summary: `Reset the password for ${user.name}`, ip: meta.ip });
    return { temporaryPassword: password };
  }
}
