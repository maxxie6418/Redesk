import type { FastifyInstance } from 'fastify';
import { and, eq, isNull, sql, desc } from 'drizzle-orm';
import { books } from '@redesk/db';
import { BOOK_STATUS } from '@redesk/shared';
import { getDb } from '../db';
import { requireUserId } from '../lib/auth';

type StatusKey = (typeof BOOK_STATUS)[keyof typeof BOOK_STATUS];

export async function overviewRoutes(app: FastifyInstance): Promise<void> {
  app.get('/overview', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();

    const total = db
      .select({ c: sql<number>`count(*)` })
      .from(books)
      .where(and(eq(books.owner_id, userId), isNull(books.deleted_at)))
      .get()?.c ?? 0;

    const statusCounts: Record<string, number> = {};
    for (const status of [BOOK_STATUS.READING, BOOK_STATUS.PLANNED, BOOK_STATUS.READ, BOOK_STATUS.STORED]) {
      const count = db
        .select({ c: sql<number>`count(*)` })
        .from(books)
        .where(and(eq(books.owner_id, userId), eq(books.status, status as StatusKey), isNull(books.deleted_at)))
        .get()?.c ?? 0;
      statusCounts[status] = count;
    }

    const recentAdded = db
      .select({ id: books.id, title: books.title, author: books.author, status: books.status, created_at: books.created_at })
      .from(books)
      .where(and(eq(books.owner_id, userId), isNull(books.deleted_at)))
      .orderBy(desc(books.created_at))
      .limit(5)
      .all();

    const recentReading = db
      .select({ id: books.id, title: books.title, author: books.author, status: books.status, updated_at: books.updated_at })
      .from(books)
      .where(and(eq(books.owner_id, userId), eq(books.status, BOOK_STATUS.READING), isNull(books.deleted_at)))
      .orderBy(desc(books.updated_at))
      .limit(5)
      .all();

    return {
      data: {
        total,
        status_counts: statusCounts,
        recent_added: recentAdded,
        recent_reading: recentReading,
      },
    };
  });
}
