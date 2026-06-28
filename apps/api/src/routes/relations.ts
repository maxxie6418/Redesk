import type { FastifyInstance } from 'fastify';
import { and, eq, or, asc } from 'drizzle-orm';
import { bookRelations, books } from '@redesk/db';
import { ERROR_CODE, createRelationSchema } from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

export async function relationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/books/:id/relations', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();

    const book = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!book) {
      throw notFound('书籍不存在');
    }

    const rows = db
      .select({
        id: bookRelations.id,
        source_book_id: bookRelations.source_book_id,
        target_book_id: bookRelations.target_book_id,
        relation_type: bookRelations.relation_type,
        note: bookRelations.note,
        created_at: bookRelations.created_at,
        target_title: books.title,
        target_author: books.author,
      })
      .from(bookRelations)
      .innerJoin(books, eq(bookRelations.target_book_id, books.id))
      .where(eq(bookRelations.source_book_id, bookId))
      .orderBy(asc(bookRelations.created_at))
      .all();

    const reverseRows = db
      .select({
        id: bookRelations.id,
        source_book_id: bookRelations.source_book_id,
        target_book_id: bookRelations.target_book_id,
        relation_type: bookRelations.relation_type,
        note: bookRelations.note,
        created_at: bookRelations.created_at,
        source_title: books.title,
        source_author: books.author,
      })
      .from(bookRelations)
      .innerJoin(books, eq(bookRelations.source_book_id, books.id))
      .where(eq(bookRelations.target_book_id, bookId))
      .orderBy(asc(bookRelations.created_at))
      .all();

    return {
      data: {
        outgoing: rows,
        incoming: reverseRows,
      },
    };
  });

  app.post('/books/:id/relations', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const input = validate(createRelationSchema, req.body);
    const db = getDb();

    const sourceBook = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!sourceBook) {
      throw notFound('书籍不存在');
    }

    const targetBook = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, input.target_book_id), eq(books.owner_id, userId)))
      .get();

    if (!targetBook) {
      throw notFound('目标书籍不存在');
    }

    if (bookId === input.target_book_id) {
      throw new AppError(ERROR_CODE.BUSINESS_ERROR, '不能将书籍关联到自身');
    }

    const existing = db
      .select({ id: bookRelations.id })
      .from(bookRelations)
      .where(
        and(
          eq(bookRelations.source_book_id, bookId),
          eq(bookRelations.target_book_id, input.target_book_id),
          input.relation_type
            ? eq(bookRelations.relation_type, input.relation_type)
            : undefined,
        ),
      )
      .get();

    if (existing) {
      throw new AppError(ERROR_CODE.CONFLICT, '该关联已存在');
    }

    const timestamp = now();
    const relation = db
      .insert(bookRelations)
      .values({
        source_book_id: bookId,
        target_book_id: input.target_book_id,
        relation_type: input.relation_type ?? null,
        note: input.note ?? null,
        created_at: timestamp,
      })
      .returning()
      .get();

    return { data: relation };
  });

  app.delete('/books/:id/relations/:relId', async (req) => {
    const userId = requireUserId(req);
    const { id, relId } = req.params as { id: string; relId: string };
    const bookId = Number(id);
    const relationId = Number(relId);

    if (Number.isNaN(bookId) || Number.isNaN(relationId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    }

    const db = getDb();

    const book = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!book) {
      throw notFound('书籍不存在');
    }

    const relation = db
      .select({ id: bookRelations.id })
      .from(bookRelations)
      .where(
        and(
          eq(bookRelations.id, relationId),
          or(eq(bookRelations.source_book_id, bookId), eq(bookRelations.target_book_id, bookId)),
        ),
      )
      .get();

    if (!relation) {
      throw notFound('关联不存在');
    }

    db.delete(bookRelations).where(eq(bookRelations.id, relationId)).run();

    return { data: { id: relationId, deleted: true } };
  });
}
