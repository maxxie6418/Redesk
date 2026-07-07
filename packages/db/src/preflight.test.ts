import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, type DatabaseHandle } from './client';
import {
  cleanupResidualTables,
  listSnapshots,
  preflight,
  resolveDatabasePath,
  snapshotBefore,
} from './preflight';

let workDir: string;
let handle: DatabaseHandle;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'redesk-preflight-'));
  handle = createDatabase({ url: join(workDir, 'redesk.db') });
});

afterEach(() => {
  handle.close();
  rmSync(workDir, { recursive: true, force: true });
});

function bootstrapSchema(handle: DatabaseHandle) {
  handle.sqlite.exec(`
    CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT, created_at INTEGER);
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    CREATE TABLE books (id INTEGER PRIMARY KEY);
    CREATE TABLE book_files (id INTEGER PRIMARY KEY);
    CREATE TABLE book_covers (id INTEGER PRIMARY KEY);
    CREATE TABLE highlights (id INTEGER PRIMARY KEY);
    CREATE TABLE notes (id INTEGER PRIMARY KEY);
    CREATE TABLE reading_progress (id INTEGER PRIMARY KEY);
    CREATE TABLE bookmarks (id INTEGER PRIMARY KEY);
    CREATE TABLE topics (id INTEGER PRIMARY KEY);
    CREATE TABLE settings (id INTEGER PRIMARY KEY);
  `);
}

function bootstrapMigrationsOnly(handle: DatabaseHandle) {
  handle.sqlite.exec(`
    CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT, created_at INTEGER);
    INSERT INTO __drizzle_migrations (id, hash, created_at) VALUES (1, 'fakehash', 1000);
    CREATE TABLE users (id INTEGER PRIMARY KEY);
  `);
}

describe('preflight', () => {
  it('通过当所有核心表都存在', () => {
    bootstrapSchema(handle);
    const result = preflight(handle.db, { cleanupResidual: false });
    expect(result.ok).toBe(true);
    expect(result.missingTables).toEqual([]);
    expect(result.forced).toBe(false);
  });

  it('空库（无 __drizzle_migrations）应直接通过，不视为缺表', () => {
    const result = preflight(handle.db, { allowForce: true });
    expect(result.ok).toBe(true);
    expect(result.missingTables.length).toBeGreaterThan(0);
  });

  it('已有 __drizzle_migrations 但缺核心表：抛错', () => {
    bootstrapMigrationsOnly(handle);
    expect(() => preflight(handle.db, { allowForce: true })).toThrow(/books/);
  });

  it('REDESK_FORCE_REBUILD=true 允许缺表继续', () => {
    bootstrapMigrationsOnly(handle);
    process.env.REDESK_FORCE_REBUILD = 'true';
    try {
      const result = preflight(handle.db, { allowForce: true });
      expect(result.ok).toBe(true);
      expect(result.forced).toBe(true);
      expect(result.missingTables).toContain('books');
      expect(result.missingTables).toContain('book_files');
      expect(result.missingTables.length).toBeGreaterThan(1);
    } finally {
      delete process.env.REDESK_FORCE_REBUILD;
    }
  });

  it('未设 allowForce 时即使 REDESK_FORCE_REBUILD=true 也不放过', () => {
    bootstrapMigrationsOnly(handle);
    process.env.REDESK_FORCE_REBUILD = 'true';
    try {
      expect(() => preflight(handle.db, { allowForce: false })).toThrow(/books/);
    } finally {
      delete process.env.REDESK_FORCE_REBUILD;
    }
  });
});

describe('cleanupResidualTables', () => {
  it('清理所有 __new_xxx 临时表', () => {
    handle.sqlite.exec(`
      CREATE TABLE __new_books (id INTEGER PRIMARY KEY);
      CREATE TABLE __new_settings (id INTEGER PRIMARY KEY);
      CREATE TABLE books (id INTEGER PRIMARY KEY);
    `);
    const removed = cleanupResidualTables(handle.db);
    expect(removed.sort()).toEqual(['__new_books', '__new_settings']);
    const names = handle.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    expect(names.map((r) => r.name)).toEqual(['books']);
  });
});

describe('snapshotBefore / listSnapshots', () => {
  it('数据库文件不存在时返回 null', () => {
    const result = snapshotBefore(handle.db, join(workDir, 'never-exists.db'));
    expect(result).toBeNull();
  });

  it('生成快照到 .snapshots 子目录并被 listSnapshots 列出', () => {
    handle.sqlite.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);`);
    const dbPath = join(workDir, 'redesk.db');
    const snap = snapshotBefore(handle.db, dbPath);
    expect(snap).not.toBeNull();
    expect(snap?.path).toMatch(/\.snapshots[\\/]redesk-snapshot-\d{8}-\d{6}-\d{3}\.db$/);
    expect(snap?.size).toBeGreaterThan(0);

    const list = listSnapshots(dbPath);
    expect(list.length).toBe(1);
    expect(list[0].path).toBe(snap?.path);
  });

  it('保留最近 N 份快照', () => {
    handle.sqlite.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);`);
    const dbPath = join(workDir, 'redesk.db');
    snapshotBefore(handle.db, dbPath, { maxKeep: 2 });
    snapshotBefore(handle.db, dbPath, { maxKeep: 2 });
    snapshotBefore(handle.db, dbPath, { maxKeep: 2 });
    snapshotBefore(handle.db, dbPath, { maxKeep: 2 });
    const list = listSnapshots(dbPath);
    expect(list.length).toBeLessThanOrEqual(2);
  });
});

describe('resolveDatabasePath', () => {
  it('剥去 file: 前缀', () => {
    expect(resolveDatabasePath('file:/data/redesk.db')).toBe('/data/redesk.db');
  });
  it('保留裸路径', () => {
    expect(resolveDatabasePath('/data/redesk.db')).toBe('/data/redesk.db');
    expect(resolveDatabasePath('./data/redesk.db')).toBe('./data/redesk.db');
  });
});
