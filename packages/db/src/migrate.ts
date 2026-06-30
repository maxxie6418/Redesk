import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabase, type AppDatabase } from './client';
import { setupFts5 } from './fts';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, '..', 'drizzle');

export function runMigrations(url: string): void {
  const handle = createDatabase({ url });
  try {
    handle.db.run(sql.raw('PRAGMA foreign_keys = OFF;'));
    migrate(handle.db, { migrationsFolder });
    handle.db.run(sql.raw('PRAGMA foreign_keys = ON;'));
    setupFts5(handle.db);
  } finally {
    handle.close();
  }
}

export function runMigrationsOn(db: AppDatabase): void {
  db.run(sql.raw('PRAGMA foreign_keys = OFF;'));
  try {
    migrate(db, { migrationsFolder });
  } finally {
    db.run(sql.raw('PRAGMA foreign_keys = ON;'));
  }
  setupFts5(db);
}
