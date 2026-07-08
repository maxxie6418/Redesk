import type { FastifyInstance } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { books, readingSessions } from '@redesk/db';
import { ERROR_CODE, heartbeatSchema, closeSessionSchema } from '@redesk/shared';
import type { HeartbeatInput, CloseSessionInput } from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

const HEARTBEAT_MAX_GAP_SECONDS = 60;

export async function readingSessionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/reading-sessions/heartbeat', async (req) => {
    const userId = requireUserId(req);
    const input = validate(heartbeatSchema, req.body) as HeartbeatInput;
    const db = getDb();
    const timestamp = now();

    const ownedBook = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, input.book_id), eq(books.owner_id, userId), isNull(books.deleted_at)))
      .get();
    if (!ownedBook) {
      throw notFound('书籍不存在');
    }

    const existing = db
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.book_id, input.book_id),
          eq(readingSessions.owner_id, userId),
          isNull(readingSessions.ended_at),
        ),
      )
      .get();

    if (existing) {
      const lastHb = new Date(existing.last_heartbeat_at).getTime();
      const gap = Math.min(Math.floor((Date.now() - lastHb) / 1000), HEARTBEAT_MAX_GAP_SECONDS);

      db.update(readingSessions)
        .set({
          duration_seconds: existing.duration_seconds + gap,
          last_heartbeat_at: timestamp,
        })
        .where(eq(readingSessions.id, existing.id))
        .run();

      const updated = db
        .select()
        .from(readingSessions)
        .where(eq(readingSessions.id, existing.id))
        .get();
      return { data: updated };
    }

    db.insert(readingSessions)
      .values({
        book_id: input.book_id,
        owner_id: userId,
        started_at: timestamp,
        duration_seconds: 0,
        last_heartbeat_at: timestamp,
        created_at: timestamp,
      })
      .run();

    const created = db
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.book_id, input.book_id),
          eq(readingSessions.owner_id, userId),
          isNull(readingSessions.ended_at),
        ),
      )
      .get();
    return { data: created };
  });

  app.post('/reading-sessions/close', async (req) => {
    const userId = requireUserId(req);
    const input = validate(closeSessionSchema, req.body) as CloseSessionInput;
    const db = getDb();
    const timestamp = now();

    const existing = db
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.book_id, input.book_id),
          eq(readingSessions.owner_id, userId),
          isNull(readingSessions.ended_at),
        ),
      )
      .get();

    if (!existing) {
      return { data: null };
    }

    const lastHb = new Date(existing.last_heartbeat_at).getTime();
    const gap = Math.min(Math.floor((Date.now() - lastHb) / 1000), HEARTBEAT_MAX_GAP_SECONDS);

    db.update(readingSessions)
      .set({
        ended_at: timestamp,
        duration_seconds: existing.duration_seconds + gap,
        last_heartbeat_at: timestamp,
      })
      .where(eq(readingSessions.id, existing.id))
      .run();

    const closed = db
      .select()
      .from(readingSessions)
      .where(eq(readingSessions.id, existing.id))
      .get();
    return { data: closed };
  });

  app.get('/reading-sessions/current', async (req) => {
    const userId = requireUserId(req);
    const { book_id } = req.query as { book_id?: string };

    if (!book_id) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 book_id 参数');
    }

    const bookId = Number(book_id);
    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();
    const session = db
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.book_id, bookId),
          eq(readingSessions.owner_id, userId),
          isNull(readingSessions.ended_at),
        ),
      )
      .get();

    return { data: session ?? null };
  });
}
