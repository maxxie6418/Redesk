import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, runMigrationsOn } from '@redesk/db';

describe('database migrations', () => {
  it('creates reading_progress on a fresh database', () => {
    const root = mkdtempSync(join(tmpdir(), 'redesk-db-migrate-'));
    const url = join(root, 'redesk.db');
    const handle = createDatabase({ url });

    try {
      runMigrationsOn(handle.db);

      const table = handle.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get('reading_progress');

      expect(table).toEqual({ name: 'reading_progress' });
    } finally {
      handle.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
