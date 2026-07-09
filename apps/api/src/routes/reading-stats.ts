import type { FastifyInstance } from 'fastify';
import { and, eq, sql, isNull, gte } from 'drizzle-orm';
import { books, readingSessions } from '@redesk/db';
import { ERROR_CODE } from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';

function startOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth(date: Date): string {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function readingStatsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reading-stats/summary', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();
    const now = new Date();

    const totalRow = db
      .select({ total: sql<number>`coalesce(sum(${readingSessions.duration_seconds}), 0)` })
      .from(readingSessions)
      .where(eq(readingSessions.owner_id, userId))
      .get();

    const todayRow = db
      .select({ total: sql<number>`coalesce(sum(${readingSessions.duration_seconds}), 0)` })
      .from(readingSessions)
      .where(and(eq(readingSessions.owner_id, userId), gte(readingSessions.started_at, startOfDay(now))))
      .get();

    const weekRow = db
      .select({ total: sql<number>`coalesce(sum(${readingSessions.duration_seconds}), 0)` })
      .from(readingSessions)
      .where(and(eq(readingSessions.owner_id, userId), gte(readingSessions.started_at, startOfWeek(now))))
      .get();

    const monthRow = db
      .select({ total: sql<number>`coalesce(sum(${readingSessions.duration_seconds}), 0)` })
      .from(readingSessions)
      .where(and(eq(readingSessions.owner_id, userId), gte(readingSessions.started_at, startOfMonth(now))))
      .get();

    return {
      data: {
        total_seconds: totalRow?.total ?? 0,
        today_seconds: todayRow?.total ?? 0,
        week_seconds: weekRow?.total ?? 0,
        month_seconds: monthRow?.total ?? 0,
      },
    };
  });

  app.get('/books/:id/reading-stats', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();

    const ownedBook = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId), isNull(books.deleted_at)))
      .get();
    if (!ownedBook) {
      throw notFound('书籍不存在');
    }

    const stats = db
      .select({
        total_duration: sql<number>`coalesce(sum(${readingSessions.duration_seconds}), 0)`,
        session_count: sql<number>`count(*)`,
        last_session_at: sql<string | null>`max(${readingSessions.started_at})`,
      })
      .from(readingSessions)
      .where(and(eq(readingSessions.book_id, bookId), eq(readingSessions.owner_id, userId)))
      .get();

    return {
      data: {
        total_duration: stats?.total_duration ?? 0,
        session_count: stats?.session_count ?? 0,
        last_session_at: stats?.last_session_at ?? null,
      },
    };
  });
}
