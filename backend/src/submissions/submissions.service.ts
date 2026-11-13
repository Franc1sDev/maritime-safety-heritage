import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, RequestMeta } from '../common/decorators';
import { MailService } from '../common/mail.service';
import { pageOf } from '../common/pagination';
import { buildSearchText } from '../common/search-text';
import { ArchiveRecord, MediaFile, RecordFormat, Submission } from '../database/entities';
import { MediaService } from '../media/media.service';
import { TYPE_LABELS, VocabService } from '../vocab/vocab.service';
import { SubmissionInputDto, SubmissionQuery } from './submission.dto';

const DEFAULT_FORMAT: Record<string, RecordFormat> = { oral: 'audio', photo: 'image', record: 'document', testimony: 'text' };

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission) private readonly subs: Repository<Submission>,
    private readonly ds: DataSource,
    private readonly media: MediaService,
    private readonly vocab: VocabService,
    private readonly activity: ActivityService,
    private readonly mail: MailService,
  ) {}

  private async view(s: Submission, withSubmitter = false) {
    const files = await this.media.forSubmission(s.id);
    return {
      id: s.id, reference: s.reference, type: s.type, typeLabel: TYPE_LABELS[s.type], title: s.title, description: s.description, year: s.year,
      waterBody: s.waterBody ? { id: s.waterBody.id, name: s.waterBody.name } : null, place: s.place, consentConfirmed: s.consentConfirmed,
      status: s.status, reviewNote: s.reviewNote, reviewedAt: s.reviewedAt, recordId: s.recordId, createdAt: s.createdAt,
      files: files.map((f) => this.media.describe(f)),
      ...(withSubmitter && s.submittedBy && { submittedBy: { id: s.submittedBy.id, name: s.submittedBy.name, email: s.submittedBy.email, organisation: s.submittedBy.organisation } }),
    };
  }

  async create(dto: SubmissionInputDto, files: Express.Multer.File[], user: AuthUser, meta: RequestMeta) {
    let saved: Submission;
    try {
      const wb = await this.vocab.waterBody(dto.waterBodyId);
      saved = await this.subs.save(this.subs.create({
        submittedById: user.id, type: dto.type, title: dto.title, description: dto.description, year: dto.year ?? null,
        waterBodyId: wb?.id ?? null, place: dto.place ?? '', consentConfirmed: true,
      }));
    } catch (e) {
      await this.media.discard(files);
      throw e;
    }
    const stored: MediaFile[] = [];
    try {
      for (const f of files) stored.push(await this.media.ingest(f, { submissionId: saved.id, uploadedById: user.id, prefix: 'submissions' }));
    } catch (e) {
      // Do not keep a half-uploaded submission
      await this.media.discard(files);
      for (const m of stored) await this.media.remove(m.id);
      await this.subs.delete(saved.id);
      throw e;
    }
    const fresh = await this.subs.findOneByOrFail({ id: saved.id });
    await this.activity.record({ actor: user, action: 'submission.create', entityType: 'submission', entityId: saved.id,
      summary: `${user.name} shared ${fresh.reference} "${fresh.title}"`, details: { files: stored.length }, ip: meta.ip });
    return this.view(fresh);
  }

  async mine(user: AuthUser, q: SubmissionQuery) {
    const [rows, total] = await this.subs.findAndCount({ where: { submittedById: user.id }, order: { createdAt: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
    return pageOf(await Promise.all(rows.map((s) => this.view(s))), total, q);
  }

  async list(q: SubmissionQuery) {
    const [rows, total] = await this.subs.findAndCount({
      where: q.status ? { status: q.status } : {}, relations: { submittedBy: true },
      order: { status: 'DESC', createdAt: 'DESC' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
    });
    return pageOf(await Promise.all(rows.map((s) => this.view(s, true))), total, q);
  }

  async get(id: string, user: AuthUser) {
    const s = await this.subs.findOne({ where: { id }, relations: { submittedBy: true } });
    if (!s || (user.role !== 'admin' && s.submittedById !== user.id)) throw new NotFoundException('That submission does not exist.');
    return this.view(s, user.role === 'admin');
  }

  private async pending(id: string) {
    const s = await this.subs.findOne({ where: { id }, relations: { submittedBy: true } });
    if (!s) throw new NotFoundException('That submission does not exist.');
    if (s.status !== 'pending') throw new ConflictException(`This submission was already ${s.status}.`);
    return s;
  }

  /** Turns the submission into a draft archive item (with its files) for cataloguing, then tells the contributor. */
  async approve(id: string, note: string | undefined, user: AuthUser, meta: RequestMeta) {
    const s = await this.pending(id);
    const files = await this.media.forSubmission(s.id);
    const mt = files[0]?.mimeType ?? '';
    const format: RecordFormat = mt.startsWith('audio/') ? 'audio' : mt.startsWith('video/') ? 'video' : mt.startsWith('image/') ? 'image'
      : mt === 'application/pdf' ? 'document' : mt.startsWith('text/') ? 'text' : DEFAULT_FORMAT[s.type];
    const recordId = await this.ds.transaction(async (m) => {
      const done = await m.update(Submission, { id: s.id, status: 'pending' }, { status: 'approved', reviewNote: note ?? '', reviewedById: user.id, reviewedAt: new Date() });
      if (!done.affected) throw new ConflictException('Someone else reviewed this submission just now.');
      const r = m.create(ArchiveRecord, {
        type: s.type, format, title: s.title, summary: s.description.slice(0, 600), body: s.type === 'testimony' ? s.description : null,
        year: s.year, waterBodyId: s.waterBodyId, waterBody: s.waterBody, place: s.place, creator: s.submittedBy.name,
        consent: `Contributor confirmed permission when submitting ${s.reference}`, status: 'draft', createdById: user.id, updatedById: user.id,
        subjects: [], transcript: [],
      });
      r.searchText = buildSearchText(r);
      const rec = await m.save(ArchiveRecord, r);
      await m.update(Submission, s.id, { recordId: rec.id });
      await m.update(MediaFile, { submissionId: s.id }, { recordId: rec.id });
      return rec.id;
    });
    const record = await this.ds.getRepository(ArchiveRecord).findOneByOrFail({ id: recordId });
    await this.activity.record({ actor: user, action: 'submission.approve', entityType: 'submission', entityId: s.id,
      summary: `Approved ${s.reference}; catalogue it as ${record.identifier}`, details: { recordId }, ip: meta.ip });
    await this.mail.send(s.submittedBy.email, `Your submission ${s.reference} was accepted`,
      `Hello ${s.submittedBy.name},\n\nThank you. "${s.title}" has been accepted into the Maritime Safety Heritage Archive. The research team will catalogue it before it is published.${note ? `\n\nNote from the team: ${note}` : ''}\n`);
    return { submission: await this.get(s.id, user), recordId, recordIdentifier: record.identifier };
  }

  async reject(id: string, note: string, user: AuthUser, meta: RequestMeta) {
    const s = await this.pending(id);
    if (!note) throw new BadRequestException('Tell the contributor why.');
    await this.subs.update(s.id, { status: 'rejected', reviewNote: note, reviewedById: user.id, reviewedAt: new Date() });
    await this.activity.record({ actor: user, action: 'submission.reject', entityType: 'submission', entityId: s.id, summary: `Declined ${s.reference}`, ip: meta.ip });
    await this.mail.send(s.submittedBy.email, `About your submission ${s.reference}`,
      `Hello ${s.submittedBy.name},\n\nThank you for sharing "${s.title}". The research team could not add it to the archive this time.\n\nReason: ${note}\n`);
    return this.get(s.id, user);
  }
}
