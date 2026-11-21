import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { types } = require('pg') as { types: { setTypeParser: (oid: number, fn: (v: string) => unknown) => void } };
import { config } from '../config/config';

// Calendar dates (the day an event happened) stay as plain YYYY-MM-DD text, so they never shift with the server's time zone.
types.setTypeParser(1082, (v: string) => v);

import { SnakeNamingStrategy } from './naming.strategy';

export function dataSourceOptions(overrides: Partial<{ host: string; port: number; user: string; password: string; name: string }> = {}): DataSourceOptions {
  const db = { ...config.db, ...overrides };
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.name,
    ssl: config.db.ssl ? { rejectUnauthorized: true } : false,
    entities: [],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false, // schema is managed by SQL migrations only
    logging: ['error'],
  };
}

export const AppDataSource = new DataSource(dataSourceOptions());
