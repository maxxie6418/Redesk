import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabase, type AppDatabase } from './client';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, '..', 'drizzle');

export function runMigrations(url: string): void {
  const handle = createDatabase({ url });
  migrate(handle.db, { migrationsFolder });
  handle.close();
}

export function runMigrationsOn(db: AppDatabase): void {
  migrate(db, { migrationsFolder });
}
