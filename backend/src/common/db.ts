import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
export type Row = Record<string, any>;
const convert = (rows: unknown): Row[] => {
  // UPDATE/DELETE ... RETURNING answers [rows, count]
  const list = Array.isArray(rows) && rows.length === 2 && Array.isArray(rows[0]) && typeof rows[1] === 'number' ? rows[0] : rows;
  if (!Array.isArray(list)) return [];
  return list.map((r) => {
    const o: Row = {};
    for (const k of Object.keys(r)) o[camel(k)] = r[k];
    return o;
  });
};

export interface Sql {
  q<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Row>(sql: string, params?: unknown[]): Promise<T | null>;
}
const wrap = (runner: { query: (s: string, p?: unknown[]) => Promise<unknown> }): Sql => ({
  q: async <T>(sql: string, params: unknown[] = []) => convert(await runner.query(sql, params)) as T[],
  one: async <T>(sql: string, params: unknown[] = []) => (convert(await runner.query(sql, params))[0] as T) ?? null,
});

/** Plain SQL with named-column results in camelCase. Every query is parameterised. */
@Injectable()
export class Db implements Sql {
  private readonly base: Sql;
  constructor(readonly ds: DataSource) { this.base = wrap(ds); }
  q<T = Row>(sql: string, params?: unknown[]) { return this.base.q<T>(sql, params); }
  one<T = Row>(sql: string, params?: unknown[]) { return this.base.one<T>(sql, params); }
  tx<T>(fn: (sql: Sql) => Promise<T>): Promise<T> { return this.ds.transaction((m: EntityManager) => fn(wrap(m))); }
}

/** Cursor pagination: an opaque cursor made from the sort value and the id of the last row. */
export const encodeCursor = (parts: unknown[]) => Buffer.from(JSON.stringify(parts)).toString('base64url');
export function decodeCursor(cursor?: string): any[] | null {
  if (!cursor) return null;
  try { const v = JSON.parse(Buffer.from(cursor, 'base64url').toString()); return Array.isArray(v) ? v : null; } catch { return null; }
}
/** A date from a request, as YYYY-MM-DD, or null when it is not a real calendar date (so it never reaches the database as text). */
export function dateParam(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}
/** A whole number from a request (a year, a place number), or null when it is not one. */
export const intParam = (v: unknown, min = 0, max = 2_000_000_000): number | null => {
  const s = String(v ?? '').trim();
  if (!/^-?\d{1,10}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};
export const pageSize = (v: unknown, def = 10, max = 50) => Math.min(max, Math.max(1, parseInt(String(v ?? ''), 10) || def));
