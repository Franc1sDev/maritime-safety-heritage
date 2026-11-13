import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from '../config/config';
import { ENTITIES } from './entities';
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
    entities: ENTITIES,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false, // schema is managed by SQL migrations only
    logging: ['error'],
  };
}

export const AppDataSource = new DataSource(dataSourceOptions());
