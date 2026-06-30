import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { and, eq, isNull } from 'drizzle-orm';
import { books, bookFiles, categories, tags, users, settings } from '@redesk/db';
import { ERROR_CODE } from '@redesk/shared';
import { config, MONOREPO_ROOT } from '../config';
import { getDb, getSqlite } from '../db';
import { requireUserId } from '../lib/auth';
import { AppError } from '../lib/errors';
import { join } from 'node:path';
import { statSync, existsSync, mkdirSync, readdirSync, unlinkSync, rmdirSync, readFileSync } from 'node:fs';

interface DirInfo {
  file_count: number;
  size_bytes: number;
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
    requireUserId(req);
    const db = getDb();

    const totalBooks = db
      .select({ c: sql<number>`count(*)` })
      .from(books)
      .where(isNull(books.deleted_at))
      .get()?.c ?? 0;

    const trashBooks = db
      .select({ c: sql<number>`count(*)` })
      .from(books)
      .where(sql`${books.deleted_at} IS NOT NULL`)
      .get()?.c ?? 0;

    const fileStats = db
      .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(size_bytes), 0)` })
      .from(bookFiles)
      .get();

    const tagCount = db
      .select({ c: sql<number>`count(*)` })
      .from(tags)
      .get()?.c ?? 0;

    const categoryCount = db
      .select({ c: sql<number>`count(*)` })
      .from(categories)
      .get()?.c ?? 0;

    const userCount = db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .get()?.c ?? 0;

    const dbSize = getDbFileSize();
    const filesOnDisk = scanDir(config.storageDir);

    return {
      data: {
        version: getAppVersion(),
        node_env: config.nodeEnv,
        node_version: getNodeVersion(),
        sqlite_version: getSqliteVersion(),
        uptime_seconds: getUptimeSeconds(),
        db_path: config.databaseUrl,
        db_size_bytes: dbSize,
        storage_size_bytes: filesOnDisk.size_bytes + (fileStats?.total ?? 0),
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
    requireUserId(req);

    const storageDir = config.storageDir;
    const dirs = ['books', 'covers', 'backups', 'tmp', 'unassociated'];

    const breakdown: Record<string, DirInfo> = {};
    let totalFiles = 0;
    let totalSize = 0;

    for (const name of dirs) {
      const info = scanDir(join(storageDir, name));
      breakdown[name] = info;
      totalFiles += info.file_count;
      totalSize += info.size_bytes;
    }

    const dbSize = getDbFileSize();

    const ossRow = getDb()
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.owner_id, 1), eq(settings.key, 'oss_provider')))
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
        .where(and(eq(settings.owner_id, 1), eq(settings.key, 'oss_endpoint')))
        .get();
      ossEndpoint = ep?.value ?? '';
      const bk = getDb()
        .select({ value: settings.value })
        .from(settings)
        .where(and(eq(settings.owner_id, 1), eq(settings.key, 'oss_bucket')))
        .get();
      ossBucket = bk?.value ?? '';
    }

    return {
      data: {
        db_size_bytes: dbSize,
        total_files: totalFiles,
        total_size_bytes: totalSize,
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
    requireUserId(req);
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
    requireUserId(req);
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

  app.post('/system/clear-cache', async (_req) => {
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
}
