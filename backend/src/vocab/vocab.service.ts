import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { slugify } from '../common/crypto';
import { RECORD_FORMATS, RECORD_TYPES, Subject, WaterBody } from '../database/entities';

export const TYPE_LABELS: Record<string, string> = { oral: 'Oral history', photo: 'Photograph', record: 'Record or report', testimony: 'Testimony' };

@Injectable()
export class VocabService {
  constructor(
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(WaterBody) private readonly waters: Repository<WaterBody>,
  ) {}

  async all() {
    const [waterBodies, subjects, counts] = await Promise.all([
      this.waters.find({ order: { id: 'ASC' } }),
      this.subjects.find({ order: { label: 'ASC' } }),
      this.subjects.query(`SELECT rs.subject_id AS id, count(*)::int AS n FROM record_subjects rs JOIN records r ON r.id = rs.record_id
                           WHERE r.status = 'published' AND r.deleted_at IS NULL GROUP BY rs.subject_id`) as Promise<Array<{ id: number; n: number }>>,
    ]);
    const byId = new Map(counts.map((c) => [c.id, c.n]));
    return {
      types: RECORD_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
      formats: RECORD_FORMATS,
      waterBodies,
      subjects: subjects.map((s) => ({ ...s, publishedCount: byId.get(s.id) ?? 0 })),
    };
  }

  /** Finds subjects by label, creating any that are new. */
  async ensureSubjects(labels: string[]): Promise<Subject[]> {
    const clean = [...new Map(labels.map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean).map((l) => [slugify(l), l])).entries()].filter(([s]) => s);
    if (!clean.length) return [];
    const existing = await this.subjects.findBy({ slug: In(clean.map(([s]) => s)) });
    const missing = clean.filter(([s]) => !existing.some((e) => e.slug === s)).map(([slug, label]) => this.subjects.create({ slug, label: label.toLowerCase() }));
    if (missing.length) await this.subjects.createQueryBuilder().insert().values(missing).orIgnore().execute();
    return this.subjects.findBy({ slug: In(clean.map(([s]) => s)) });
  }

  async renameSubject(id: number, label: string) {
    const s = await this.subjects.findOneBy({ id });
    if (!s) throw new NotFoundException('That subject does not exist.');
    s.label = label.trim();
    return this.subjects.save(s); // the slug stays the same so links keep working
  }

  async deleteSubject(id: number) {
    const res = await this.subjects.delete(id);
    if (!res.affected) throw new NotFoundException('That subject does not exist.');
  }

  async waterBody(id: number | null | undefined) {
    if (id == null) return null;
    const wb = await this.waters.findOneBy({ id });
    if (!wb) throw new NotFoundException('That water body is not on the list.');
    return wb;
  }
}
