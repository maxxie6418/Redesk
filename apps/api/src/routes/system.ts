import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { and, eq, isNull } from 'drizzle-orm';
import { books, bookCovers, bookFiles, categories, tags, users, settings } from '@redesk/db';
import { runMigrationsOn } from '@redesk/db';
import { ERROR_CODE } from '@redesk/shared';
import { config, MONOREPO_ROOT } from '../config';
import { getDb, getSqlite } from '../db';
import { requireAdmin, requireUserId, isAdminRequest, verifyPassword } from '../lib/auth';
import { AppError } from '../lib/errors';
import { getSettingsOwnerId } from '../lib/storage-factory';
import { join } from 'node:path';
import { statSync, existsSync, mkdirSync, readdirSync, unlinkSync, rmdirSync, readFileSync } from 'node:fs';

// ── 版本更新检查 ──────────────────────────────────────────────

const GITHUB_REPO = 'maxxie6418/Redesk';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟

interface UpdateCache {
  result: UpdateCheckResult;
  ts: number;
}

let updateCache: UpdateCache | null = null;

function compareVersions(a: string, b: string): number {
  // 忽略 -tag 后缀，只比较 x.y.z
  const pa = a.replace(/-.*$/, '').split('.').map(Number);
  const pb = b.replace(/-.*$/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
  body: string;
}

interface UpdateCheckResult {
  current_version: string;
  latest_version: string | null;
  has_update: boolean | null;
  release_url: string | null;
  published_at: string | null;
  release_notes: string | null;
}

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'User-Agent': 'redesk-update-checker' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as GitHubRelease;
  } catch {
    return null;
  }
}

async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = getAppVersion();

  // 缓存命中直接返回
  if (updateCache && Date.now() - updateCache.ts < CACHE_TTL_MS) {
    // 但需要确保 current_version 始终是最新的
    return { ...updateCache.result, current_version: currentVersion };
  }

  const release = await fetchLatestRelease();
  if (!release) {
    const result: UpdateCheckResult = {
      current_version: currentVersion,
      latest_version: null,
      has_update: null,
      release_url: null,
      published_at: null,
      release_notes: null,
    };
    return result;
  }

  const latestVersion = release.tag_name.replace(/^v/, '');
  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

  const result: UpdateCheckResult = {
    current_version: currentVersion,
    latest_version: latestVersion,
    has_update: hasUpdate,
    release_url: release.html_url,
    published_at: release.published_at,
    release_notes: release.body,
  };

  updateCache = { result, ts: Date.now() };
  return result;
}

interface DirInfo {
  file_count: number;
  size_bytes: number;
}

const STORAGE_BUCKETS = ['books', 'covers', 'backups', 'tmp', 'unassociated'] as const;

type StorageBucket = (typeof STORAGE_BUCKETS)[number];

interface StorageEntryRef {
  local_path: string | null;
  file_size: number | null;
}

function scanDir(dir: string): DirInfo {
  const result: DirInfo = { file_count: 0, size_bytes: 0 };
  if (!existsSync(dir)) return result;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = scanDir(full);
        result.file_count += sub.file_count;
        result.size_bytes += sub.size_bytes;
      } else {
        try {
          result.size_bytes += statSync(full).size;
        } catch {
          // file may have been deleted
        }
        result.file_count += 1;
      }
    }
  } catch {
    // ignore permission errors
  }
  return result;
}

function createEmptyDirInfo(): DirInfo {
  return { file_count: 0, size_bytes: 0 };
}

export function createEmptyStorageBreakdown(): Record<StorageBucket, DirInfo> {
  return {
    books: createEmptyDirInfo(),
    covers: createEmptyDirInfo(),
    backups: createEmptyDirInfo(),
    tmp: createEmptyDirInfo(),
    unassociated: createEmptyDirInfo(),
  };
}

export function classifyStoragePath(localPath: string | null | undefined): StorageBucket | null {
  if (!localPath) return null;
  const normalized = localPath.replace(/\\/g, '/').replace(/^\/+/, '');
  for (const bucket of STORAGE_BUCKETS) {
    if (normalized === bucket || normalized.startsWith(`${bucket}/`)) return bucket;
  }
  return null;
}

function safeReadFileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function mergeDirInfo(target: DirInfo, source: DirInfo): void {
  target.file_count += source.file_count;
  target.size_bytes += source.size_bytes;
}

function appendScannedDir(
  breakdown: Record<StorageBucket, DirInfo>,
  storageDir: string,
  bucket: StorageBucket,
): void {
  mergeDirInfo(breakdown[bucket], scanDir(join(storageDir, bucket)));
}

export function summarizeTrackedStorage(
  entries: StorageEntryRef[],
  storageDir: string,
): Record<StorageBucket, DirInfo> {
  const breakdown = createEmptyStorageBreakdown();
  const seenPaths = new Set<string>();

  for (const entry of entries) {
    if (!entry.local_path) continue;
    const normalizedPath = entry.local_path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (seenPaths.has(normalizedPath)) continue;
    seenPaths.add(normalizedPath);

    const bucket = classifyStoragePath(normalizedPath);
    if (!bucket) continue;

    breakdown[bucket].file_count += 1;
    breakdown[bucket].size_bytes += entry.file_size ?? safeReadFileSize(join(storageDir, normalizedPath));
  }

  return breakdown;
}

function getTotalDirInfo(breakdown: Record<StorageBucket, DirInfo>): DirInfo {
  const total = createEmptyDirInfo();
  for (const bucket of STORAGE_BUCKETS) {
    mergeDirInfo(total, breakdown[bucket]);
  }
  return total;
}

function getDbFileSize(): number {
  const dbPath = config.databaseUrl;
  if (!existsSync(dbPath)) return 0;
  return statSync(dbPath).size;
}

function getUptimeSeconds(): number {
  return Math.floor(process.uptime());
}

function getSqliteVersion(): string {
  const sqlite = getSqlite();
  const row = sqlite.prepare('SELECT sqlite_version() as v').get() as { v: string } | undefined;
  return row?.v ?? 'unknown';
}

function getNodeVersion(): string {
  return process.version;
}

function getAppVersion(): string {
  try {
    const pkgPath = join(MONOREPO_ROOT, 'package.json');
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/system/stats', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();

    const totalBooks = db
      .select({ c: sql<number>`count(*)` })
      .from(books)
      .where(and(eq(books.owner_id, userId), isNull(books.deleted_at)))
      .get()?.c ?? 0;

    const trashBooks = db
      .select({ c: sql<number>`count(*)` })
      .from(books)
      .where(and(eq(books.owner_id, userId), sql`${books.deleted_at} IS NOT NULL`))
      .get()?.c ?? 0;

    const fileStats = db
      .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(file_size), 0)` })
      .from(bookFiles)
      .where(eq(bookFiles.owner_id, userId))
      .get();

    const tagCount = db
      .select({ c: sql<number>`count(*)` })
      .from(tags)
      .where(eq(tags.owner_id, userId))
      .get()?.c ?? 0;

    const categoryCount = db
      .select({ c: sql<number>`count(*)` })
      .from(categories)
      .where(eq(categories.owner_id, userId))
      .get()?.c ?? 0;

    // user_count 属于系统级信息，仅对管理员返回。
    const isAdmin = isAdminRequest(req);
    const userCount = isAdmin
      ? db.select({ c: sql<number>`count(*)` }).from(users).get()?.c ?? 0
      : undefined;

    const storageDir = config.storageDir;
    const trackedFiles = db
      .select({ local_path: bookFiles.local_path, file_size: bookFiles.file_size })
      .from(bookFiles)
      .where(eq(bookFiles.owner_id, userId))
      .all();

    const trackedCovers = db
      .select({ local_path: bookCovers.local_path, file_size: bookCovers.file_size })
      .from(bookCovers)
      .where(eq(bookCovers.owner_id, userId))
      .all();

    const storageBreakdown = summarizeTrackedStorage([...trackedFiles, ...trackedCovers], storageDir);
    if (isAdminRequest(req)) {
      appendScannedDir(storageBreakdown, storageDir, 'backups');
      appendScannedDir(storageBreakdown, storageDir, 'tmp');
    }

    const dbSize = getDbFileSize();
    const storageTotals = getTotalDirInfo(storageBreakdown);

    return {
      data: {
        version: getAppVersion(),
        node_env: config.nodeEnv,
        node_version: getNodeVersion(),
        sqlite_version: getSqliteVersion(),
        uptime_seconds: getUptimeSeconds(),
        db_size_bytes: dbSize,
        storage_size_bytes: storageTotals.size_bytes,
        book_count: totalBooks,
        trash_count: trashBooks,
        file_count: fileStats?.count ?? 0,
        tag_count: tagCount,
        category_count: categoryCount,
        user_count: userCount,
      },
    };
  });

  app.get('/system/storage', async (req) => {
    const userId = requireUserId(req);
    const settingsOwnerId = getSettingsOwnerId();
    const storageDir = config.storageDir;
    const trackedFiles = getDb()
      .select({ local_path: bookFiles.local_path, file_size: bookFiles.file_size })
      .from(bookFiles)
      .where(eq(bookFiles.owner_id, userId))
      .all();

    const trackedCovers = getDb()
      .select({ local_path: bookCovers.local_path, file_size: bookCovers.file_size })
      .from(bookCovers)
      .where(eq(bookCovers.owner_id, userId))
      .all();

    const breakdown = summarizeTrackedStorage([...trackedFiles, ...trackedCovers], storageDir);
    if (isAdminRequest(req)) {
      appendScannedDir(breakdown, storageDir, 'backups');
      appendScannedDir(breakdown, storageDir, 'tmp');
    }

    const totals = getTotalDirInfo(breakdown);

    const dbSize = getDbFileSize();

    const ossRow = getDb()
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.owner_id, settingsOwnerId ?? -1), eq(settings.key, 'oss_provider')))
      .get();

    const ossConfigured = Boolean(ossRow?.value && ossRow.value !== '');

    let ossProvider = '';
    let ossEndpoint = '';
    let ossBucket = '';
    if (ossConfigured) {
      ossProvider = ossRow!.value;
      const ep = getDb()
        .select({ value: settings.value })
        .from(settings)
        .where(and(eq(settings.owner_id, settingsOwnerId ?? -1), eq(settings.key, 'oss_endpoint')))
        .get();
      ossEndpoint = ep?.value ?? '';
      const bk = getDb()
        .select({ value: settings.value })
        .from(settings)
        .where(and(eq(settings.owner_id, settingsOwnerId ?? -1), eq(settings.key, 'oss_bucket')))
        .get();
      ossBucket = bk?.value ?? '';
    }

    return {
      data: {
        db_size_bytes: dbSize,
        total_files: totals.file_count,
        total_size_bytes: totals.size_bytes,
        breakdown,
        oss: {
          configured: ossConfigured,
          provider: ossProvider,
          endpoint: ossEndpoint,
          bucket: ossBucket,
        },
      },
    };
  });

  app.post('/system/backup', async (req) => {
    requireAdmin(req);
    const sqlite = getSqlite();
    const backupPath = join(config.storageDir, 'backups', `redesk-backup-${Date.now()}.db`);
    const escapedPath = backupPath.replace(/\\/g, '/').replace(/'/g, "''");

    const dir = join(config.storageDir, 'backups');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    try {
      sqlite.exec(`VACUUM INTO '${escapedPath}'`);
      return { data: { path: backupPath, success: true } };
    } catch (err) {
      throw new AppError(
        ERROR_CODE.INTERNAL_ERROR,
        `备份失败: ${err instanceof Error ? err.message : '未知错误'}`,
      );
    }
  });

  app.post('/system/fts-rebuild', async (req) => {
    requireAdmin(req);
    const db = getDb();
    try {
      db.run(sql`INSERT INTO books_fts(books_fts) VALUES('rebuild')`);
      return { data: { success: true } };
    } catch (err) {
      throw new AppError(
        ERROR_CODE.INTERNAL_ERROR,
        `重建索引失败: ${err instanceof Error ? err.message : '未知错误'}`,
      );
    }
  });

  app.post('/system/clear-cache', async (req) => {
    requireAdmin(req);
    const tmpDir = join(config.storageDir, 'tmp');
    let freedBytes = 0;
    let removedFiles = 0;

    if (existsSync(tmpDir)) {
      try {
        const entries = readdirSync(tmpDir, { withFileTypes: true });
        for (const entry of entries) {
          const full = join(tmpDir, entry.name);
          try {
            if (entry.isFile()) {
              freedBytes += statSync(full).size;
              unlinkSync(full);
              removedFiles++;
            } else if (entry.isDirectory()) {
              const subInfo = scanDir(full);
              freedBytes += subInfo.size_bytes;
              removedFiles += subInfo.file_count;
              rmdirSync(full, { recursive: true });
            }
          } catch {
            // skip locked files
          }
        }
      } catch {
        // ignore permission errors
      }
    }

    return {
      data: {
        success: true,
        freed_bytes: freedBytes,
        removed_files: removedFiles,
      },
    };
  });

  app.post('/system/reset', async (req) => {
    const userId = requireAdmin(req);
    const body = req.body as { password?: string } | undefined;
    const inputPassword = body?.password;
    if (!inputPassword) {
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '需要管理员口令验证');
    }

    const admin = getDb()
      .select({ id: users.id, password_hash: users.password_hash })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!admin) {
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '管理员账户不存在');
    }
    const ok = await verifyPassword(inputPassword, admin.password_hash);
    if (!ok) {
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '口令错误');
    }

    const db = getDb();
    const storageDir = config.storageDir;

    db.run(sql.raw('PRAGMA foreign_keys = OFF;'));

    const tables = [
      'bookmarks', 'book_files', 'book_covers', 'book_relations',
      'book_tags', 'status_history', 'categories', 'tags',
      'books_fts',
      'books', 'settings', 'users',
    ];
    for (const t of tables) {
      db.run(sql.raw(`DROP TABLE IF EXISTS "${t}"`));
    }

    runMigrationsOn(db);

    for (const dirName of ['books', 'covers', 'backups', 'tmp', 'unassociated']) {
      const dir = join(storageDir, dirName);
      if (existsSync(dir)) {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = join(dir, entry.name);
            try {
              if (entry.isFile()) unlinkSync(full);
              else if (entry.isDirectory()) rmdirSync(full, { recursive: true });
            } catch { /* skip locked */ }
          }
        } catch { /* skip */ }
      }
    }

    return {
      data: { success: true, message: '应用已重置，请刷新页面后重新设置管理员账户' },
    };
  });

  // ── 版本更新检查 ────────────────────────────────────────────
  app.get('/system/update-check', async (req) => {
    requireAdmin(req);
    const result = await checkForUpdates();
    return { data: result };
  });
}
