import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { sql } from 'drizzle-orm';
import type { AppDatabase } from './client';

export const CORE_TABLES = [
  'users',
  'books',
  'book_files',
  'book_covers',
  'highlights',
  'notes',
  'reading_progress',
  'bookmarks',
  'topics',
  'settings',
] as const;

export type CoreTable = (typeof CORE_TABLES)[number];

export interface PreflightOptions {
  requiredTables?: readonly string[];
  allowForce?: boolean;
  cleanupResidual?: boolean;
}

export interface PreflightResult {
  ok: boolean;
  missingTables: string[];
  residualTables: string[];
  forced: boolean;
}

const RESIDUAL_PREFIX = '__new_';

function quoteSqliteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function listTables(db: AppDatabase): string[] {
  return db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type='table'`,
  ).map((row) => row.name);
}

export function preflight(db: AppDatabase, options: PreflightOptions = {}): PreflightResult {
  const required = options.requiredTables ?? CORE_TABLES;
  const allTables = listTables(db);
  const missingTables = required.filter((name) => !allTables.includes(name));

  const residualTables = options.cleanupResidual
    ? cleanupResidualTables(db)
    : allTables.filter((name) => name.startsWith(RESIDUAL_PREFIX));

  const migrationsTableExists = allTables.includes('__drizzle_migrations');
  const isFreshDatabase = !migrationsTableExists || allTables.length === 0;

  if (isFreshDatabase) {
    return {
      ok: true,
      missingTables,
      residualTables,
      forced: false,
    };
  }

  const forced = process.env.REDESK_FORCE_REBUILD === 'true';
  const allowForce = options.allowForce ?? false;
  const ok = missingTables.length === 0 || (allowForce && forced);

  if (!ok) {
    const message = [
      '[redesk] 数据库结构不完整，缺以下核心表：',
      ...missingTables.map((name) => `  - ${name}`),
      '',
      '这通常意味着旧库 schema 已被破坏。修复方式：',
      '  1) 从备份恢复（GET /api/v1/backup/manual 导出的 ZIP）',
      '  2) 或接受全量重建（删除 redesk.db 后重启容器）',
      '  3) 或设置 REDESK_FORCE_REBUILD=true 强制重建（危险，仅用于演示）',
    ].join('\n');
    throw new Error(message);
  }

  return { ok, missingTables, residualTables, forced };
}

export function cleanupResidualTables(db: AppDatabase): string[] {
  const all = listTables(db);
  const residuals = all.filter((name) => name.startsWith(RESIDUAL_PREFIX));
  for (const name of residuals) {
    db.run(sql.raw(`DROP TABLE IF EXISTS "${name.replace(/"/g, '""')}"`));
  }
  return residuals;
}

export interface SnapshotOptions {
  maxKeep?: number;
}

export interface SnapshotInfo {
  path: string;
  size: number;
  createdAt: Date;
}

function ensureSnapshotDir(snapshotDir: string): void {
  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
    `-${ms}`
  );
}

export function snapshotBefore(db: AppDatabase, dbPath: string, options: SnapshotOptions = {}): SnapshotInfo | null {
  if (!existsSync(dbPath)) {
    return null;
  }
  const snapshotDir = join(dirname(dbPath), '.snapshots');
  ensureSnapshotDir(snapshotDir);
  const filename = `redesk-snapshot-${timestamp()}.db`;
  const target = join(snapshotDir, filename);
  try {
    const sqlite = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    sqlite.exec(`VACUUM INTO ${quoteSqliteString(target)}`);
  } catch (err) {
    console.warn(
      `[redesk] 迁移前快照失败：${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
  const info = statSync(target);
  const maxKeep = options.maxKeep ?? 7;
  pruneSnapshots(snapshotDir, maxKeep);
  return { path: target, size: info.size, createdAt: info.mtime };
}

export function listSnapshots(dbPath: string): SnapshotInfo[] {
  const snapshotDir = join(dirname(dbPath), '.snapshots');
  if (!existsSync(snapshotDir)) return [];
  return readdirSync(snapshotDir)
    .filter((name) => name.startsWith('redesk-snapshot-') && name.endsWith('.db'))
    .map((name) => {
      const path = join(snapshotDir, name);
      const stat = statSync(path);
      return { path, size: stat.size, createdAt: stat.mtime };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function pruneSnapshots(snapshotDir: string, maxKeep: number): void {
  const files = readdirSync(snapshotDir)
    .filter((name) => name.startsWith('redesk-snapshot-') && name.endsWith('.db'))
    .map((name) => {
      const path = join(snapshotDir, name);
      return { path, mtime: statSync(path).mtime.getTime() };
    })
    .sort((a, b) => b.mtime - a.mtime);
  for (const file of files.slice(maxKeep)) {
    try {
      unlinkSync(file.path);
    } catch (err) {
      console.warn(
        `[redesk] 清理过期快照失败：${basename(file.path)} ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export function resolveDatabasePath(url: string): string {
  return url.startsWith('file:') ? url.slice('file:'.length) : url;
}
