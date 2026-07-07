import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema/index';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export interface CreateDatabaseOptions {
  url: string;
  readonly?: boolean;
}

export interface DatabaseHandle {
  db: AppDatabase;
  sqlite: Database.Database;
  path: string;
  close: () => void;
}

export function createDatabase({ url, readonly = false }: CreateDatabaseOptions): DatabaseHandle {
  const dir = dirname(url);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const sqlite = new Database(url, { readonly });
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return {
    db,
    sqlite,
    path: url,
    close: () => sqlite.close(),
  };
}
