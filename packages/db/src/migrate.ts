import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabase, type AppDatabase, type DatabaseHandle } from './client';
import { setupFts5 } from './fts';
import { preflight, resolveDatabasePath, snapshotBefore } from './preflight';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, '..', 'drizzle');

export interface RunMigrationsOptions {
  allowForceRebuild?: boolean;
  snapshotMaxKeep?: number;
}

export function runMigrations(url: string, options: RunMigrationsOptions = {}): void {
  const handle = createDatabase({ url });
  try {
    runMigrationsOn(handle, options);
  } finally {
    handle.close();
  }
}

export function runMigrationsOn(
  handle: DatabaseHandle | AppDatabase,
  options: RunMigrationsOptions = {},
): void {
  const db: AppDatabase = 'db' in handle ? handle.db : handle;
  const dbPath: string | undefined = 'db' in handle ? resolveDatabasePath(handle.path) : undefined;

  preflight(db, { allowForce: options.allowForceRebuild ?? true, cleanupResidual: true });
  if (dbPath) {
    snapshotBefore(db, dbPath, { maxKeep: options.snapshotMaxKeep ?? 7 });
  }

  db.run(sql.raw('PRAGMA foreign_keys = OFF;'));
  try {
    migrate(db, { migrationsFolder });
  } finally {
    db.run(sql.raw('PRAGMA foreign_keys = ON;'));
  }
  setupFts5(db);
}
