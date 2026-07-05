import type { FastifyInstance } from 'fastify';
import { and, eq, isNull, sql, desc } from 'drizzle-orm';
import { books, readingProgress } from '@redesk/db';
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

    const statusCounts: Record<string, number> = {
      [BOOK_STATUS.COLLECTED]: 0,
      [BOOK_STATUS.READING]: 0,
      [BOOK_STATUS.PLANNED]: 0,
      [BOOK_STATUS.READ]: 0,
      [BOOK_STATUS.STORED]: 0,
    };
    const groupedCounts = db
      .select({ status: books.status, count: sql<number>`count(*)` })
      .from(books)
      .where(and(eq(books.owner_id, userId), isNull(books.deleted_at)))
      .groupBy(books.status)
      .all();
    for (const row of groupedCounts) {
      statusCounts[row.status as StatusKey] = row.count;
    }
    const favoriteCount = db
      .select({ c: sql<number>`count(*)` })
      .from(books)
      .where(and(eq(books.owner_id, userId), isNull(books.deleted_at), sql`${books.favorited_at} IS NOT NULL`))
      .get()?.c ?? 0;

    const recentAdded = db
      .select({ id: books.id, title: books.title, author: books.author, status: books.status, created_at: books.created_at })
      .from(books)
      .where(and(eq(books.owner_id, userId), isNull(books.deleted_at)))
      .orderBy(desc(books.created_at))
      .limit(5)
      .all();

    const recentReading = db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        status: books.status,
        updated_at: readingProgress.last_read_at,
        percentage: readingProgress.percentage,
      })
      .from(readingProgress)
      .innerJoin(books, and(eq(books.id, readingProgress.book_id), eq(books.owner_id, userId)))
      .where(and(eq(readingProgress.owner_id, userId), isNull(books.deleted_at)))
      .orderBy(desc(readingProgress.last_read_at))
      .limit(5)
      .all();

    return {
      data: {
        total,
        status_counts: statusCounts,
        favorite_count: favoriteCount,
        recent_added: recentAdded,
        recent_reading: recentReading,
      },
    };
  });
}
