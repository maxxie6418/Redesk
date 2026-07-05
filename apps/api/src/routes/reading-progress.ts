import type { FastifyInstance } from 'fastify';
import { and, eq, desc } from 'drizzle-orm';
import { readingProgress } from '@redesk/db';
import { ERROR_CODE, updateReadingProgressSchema } from '@redesk/shared';
import type { UpdateReadingProgressInput } from '@redesk/shared';
import { getDb } from '../db';
import { AppError } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

export async function readingProgressRoutes(app: FastifyInstance): Promise<void> {
  // 获取单本书的阅读进度
  app.get('/books/:id/reading-progress', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();
    const progress = db
      .select()
      .from(readingProgress)
      .where(and(eq(readingProgress.book_id, bookId), eq(readingProgress.owner_id, userId)))
      .get();

    if (!progress) {
      return { data: null };
    }

    return { data: progress };
  });

  // 保存或更新单本书的阅读进度
  app.put('/books/:id/reading-progress', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const input = validate(updateReadingProgressSchema, req.body) as UpdateReadingProgressInput;
    const db = getDb();
    const timestamp = now();

    const existing = db
      .select({ id: readingProgress.id })
      .from(readingProgress)
      .where(and(eq(readingProgress.book_id, bookId), eq(readingProgress.owner_id, userId)))
      .get();

    if (existing) {
      db.update(readingProgress)
        .set({
          file_id: input.file_id,
          cfi: input.cfi,
          percentage: input.percentage,
          last_read_at: timestamp,
          updated_at: timestamp,
        })
        .where(eq(readingProgress.id, existing.id))
        .run();
    } else {
      db.insert(readingProgress)
        .values({
          book_id: bookId,
          owner_id: userId,
          file_id: input.file_id,
          cfi: input.cfi,
          percentage: input.percentage,
          last_read_at: timestamp,
          created_at: timestamp,
          updated_at: timestamp,
        })
        .run();
    }

    const updated = db
      .select()
      .from(readingProgress)
      .where(and(eq(readingProgress.book_id, bookId), eq(readingProgress.owner_id, userId)))
      .get();

    return { data: updated };
  });

  // 获取最近阅读列表（用于概览页）
  app.get('/reading-progress/recent', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();

    const rows = db
      .select({
        book_id: readingProgress.book_id,
        percentage: readingProgress.percentage,
        last_read_at: readingProgress.last_read_at,
      })
      .from(readingProgress)
      .where(eq(readingProgress.owner_id, userId))
      .orderBy(desc(readingProgress.last_read_at))
      .limit(5)
      .all();

    return { data: rows };
  });
}