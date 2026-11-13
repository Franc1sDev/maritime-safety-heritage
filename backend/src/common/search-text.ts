import { ArchiveRecord } from '../database/entities';

/** Text that is searchable but not stored in a column of its own: subjects, people, transcript and the water body. */
export function buildSearchText(r: Partial<ArchiveRecord>): string {
  return [
    r.identifier ?? '',
    r.waterBody?.name ?? '',
    r.creator, r.narrator, r.interviewer, r.photographer, r.language,
    ...(r.subjects ?? []).map((s) => s.label),
    ...(r.transcript ?? []).map((t) => t.text),
  ].filter(Boolean).join(' ');
}
