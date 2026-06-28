import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { books, bookFiles } from '@redesk/db';
import { ERROR_CODE } from '@redesk/shared';
import { config } from '../config';
import { getDb, getSqlite } from '../db';
import { requireUserId } from '../lib/auth';
import { AppError } from '../lib/errors';
import { join } from 'node:path';
import { statSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

function getDbFileSize(): number {
  const dbPath = config.databaseUrl;
  if (!existsSync(dbPath)) return 0;
  return statSync(dbPath).size;
}

function getStorageSize(): number {
  const dir = config.storageDir;
  if (!existsSync(dir)) return 0;
  let total = 0;
  try {
    const walk = (d: string) => {
      const entries = readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else total += statSync(full).size;
      }
    };
    walk(dir);
  } catch {
    // ignore
  }
  return total;
}

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/system/stats', async (req) => {
    requireUserId(req);
    const db = getDb();

    const totalBooks = db
      .select({ c: sql<number>`count(*)` })
      .from(books)
      .get()
      ?.c ?? 0;

    const fileStats = db
      .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(size_bytes), 0)` })
      .from(bookFiles)
      .get();

    const dbSize = getDbFileSize();
    const storageSize = getStorageSize();

    return {
      data: {
        db_size_bytes: dbSize,
        storage_size_bytes: storageSize + (fileStats?.total ?? 0),
        book_count: totalBooks,
        file_count: fileStats?.count ?? 0,
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
    return { data: { success: true, message: '缓存清理功能尚未实现' } };
  });
}
