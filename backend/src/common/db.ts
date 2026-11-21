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
export const pageSize = (v: unknown, def = 10, max = 50) => Math.min(max, Math.max(1, parseInt(String(v ?? ''), 10) || def));
