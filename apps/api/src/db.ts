import { createDatabase, runMigrationsOn, type AppDatabase, type DatabaseHandle } from '@redesk/db';
import { config } from './config';

let handle: DatabaseHandle | undefined;

export function initDatabase(): AppDatabase {
  handle = createDatabase({ url: config.databaseUrl });
  runMigrationsOn(handle);
  return handle.db;
}

export function getDb(): AppDatabase {
  if (!handle) {
    throw new Error('数据库未初始化');
  }
  return handle.db;
}

export function getSqlite() {
  if (!handle) {
    throw new Error('数据库未初始化');
  }
  return handle.sqlite;
}
