import type { FastifyInstance } from 'fastify';
import { and, eq, count, desc, sql } from 'drizzle-orm';
import {
  topics,
  topicBooks,
  topicEntries,
  topicHighlights,
  topicNotes,
  books,
  highlights,
  notes,
} from '@redesk/db';
import {
  ERROR_CODE,
  createTopicSchema,
  updateTopicSchema,
  createTopicEntrySchema,
  updateTopicEntrySchema,
} from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

export async function topicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/topics', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();

    const rows = db
      .select()
      .from(topics)
      .where(and(eq(topics.owner_id, userId), sql`${topics.deleted_at} IS NULL`))
      .orderBy(desc(topics.updated_at))
      .all();

    const topicIds = rows.map((t) => t.id);

    const bookCounts = new Map<number, number>();
    const entryCounts = new Map<number, number>();

    if (topicIds.length > 0) {
      for (const topicId of topicIds) {
        const bc = db
          .select({ value: count() })
          .from(topicBooks)
          .where(eq(topicBooks.topic_id, topicId))
          .get()?.value ?? 0;
        bookCounts.set(topicId, bc);

        const ec = db
          .select({ value: count() })
          .from(topicEntries)
          .where(eq(topicEntries.topic_id, topicId))
          .get()?.value ?? 0;
        entryCounts.set(topicId, ec);
      }
    }

    const data = rows.map((topic) => ({
      ...topic,
      book_count: bookCounts.get(topic.id) ?? 0,
      entry_count: entryCounts.get(topic.id) ?? 0,
    }));

    return { data };
  });

  app.post('/topics', async (req) => {
    const userId = requireUserId(req);
    const input = validate(createTopicSchema, req.body);
    const db = getDb();
    const timestamp = now();

    const topic = db
      .insert(topics)
      .values({
        owner_id: userId,
        name: input.name,
        description: input.description ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning()
      .get();

    return { data: { ...topic, book_count: 0, entry_count: 0 } };
  });

  app.get('/topics/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = Number(id);
    if (Number.isNaN(topicId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的话题 ID');
    }

    const db = getDb();

    const topic = db
      .select()
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.owner_id, userId), sql`${topics.deleted_at} IS NULL`))
      .get();
    if (!topic) {
      throw notFound('话题不存在');
    }

    // 获取关联书籍
    const topicBookRows = db
      .select({
        topic_id: topicBooks.topic_id,
        book_id: topicBooks.book_id,
        added_at: topicBooks.added_at,
        title: books.title,
        author: books.author,
        cover_path: books.cover_path,
      })
      .from(topicBooks)
      .innerJoin(books, eq(topicBooks.book_id, books.id))
      .where(eq(topicBooks.topic_id, topicId))
      .all();

    // 获取关联高亮
    const topicHighlightRows = db
      .select({
        topic_id: topicHighlights.topic_id,
        highlight_id: topicHighlights.highlight_id,
        added_at: topicHighlights.added_at,
        text: highlights.text,
        cfi_start: highlights.cfi_start,
        cfi_end: highlights.cfi_end,
        color: highlights.color,
        note: highlights.note,
        book_id: highlights.book_id,
        book_title: books.title,
      })
      .from(topicHighlights)
      .innerJoin(highlights, eq(topicHighlights.highlight_id, highlights.id))
      .leftJoin(books, eq(highlights.book_id, books.id))
      .where(eq(topicHighlights.topic_id, topicId))
      .all();

    // 获取关联笔记
    const topicNoteRows = db
      .select({
        topic_id: topicNotes.topic_id,
        note_id: topicNotes.note_id,
        added_at: topicNotes.added_at,
        title: notes.title,
        content_markdown: notes.content_markdown,
        book_id: notes.book_id,
        book_title: books.title,
      })
      .from(topicNotes)
      .innerJoin(notes, eq(topicNotes.note_id, notes.id))
      .leftJoin(books, eq(notes.book_id, books.id))
      .where(eq(topicNotes.topic_id, topicId))
      .all();

    // 获取沉淀内容
    const entries = db
      .select()
      .from(topicEntries)
      .where(eq(topicEntries.topic_id, topicId))
      .orderBy(desc(topicEntries.created_at))
      .all();

    return {
      data: {
        ...topic,
        books: topicBookRows,
        highlights: topicHighlightRows,
        notes: topicNoteRows,
        entries,
      },
    };
  });

  app.patch('/topics/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = Number(id);
    if (Number.isNaN(topicId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的话题 ID');
    }

    const input = validate(updateTopicSchema, req.body);
    const db = getDb();

    const existing = db
      .select()
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.owner_id, userId)))
      .get();
    if (!existing) {
      throw notFound('话题不存在');
    }

    const updateData: Record<string, unknown> = { updated_at: now() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;

    if (Object.keys(updateData).length > 1) {
      db.update(topics).set(updateData).where(eq(topics.id, topicId)).run();
    }

    const updated = db.select().from(topics).where(eq(topics.id, topicId)).get();
    return { data: updated };
  });

  app.delete('/topics/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = Number(id);
    if (Number.isNaN(topicId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的话题 ID');
    }

    const db = getDb();
    const existing = db
      .select()
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.owner_id, userId)))
      .get();
    if (!existing) {
      throw notFound('话题不存在');
    }

    db.update(topics)
      .set({ deleted_at: now(), updated_at: now() })
      .where(eq(topics.id, topicId))
      .run();

    return { data: { id: topicId, deleted: true } };
  });

  // ========== Topic Books ==========

  app.post('/topics/:id/books', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = Number(id);
    if (Number.isNaN(topicId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的话题 ID');
    }

    const body = req.body as { book_id?: number };
    const bookId = body?.book_id;
    if (!bookId || Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();

    const topic = db
      .select()
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.owner_id, userId), sql`${topics.deleted_at} IS NULL`))
      .get();
    if (!topic) {
      throw notFound('话题不存在');
    }

    const book = db
      .select()
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();
    if (!book) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '书籍不存在');
    }

    const existing = db
      .select()
      .from(topicBooks)
      .where(and(eq(topicBooks.topic_id, topicId), eq(topicBooks.book_id, bookId)))
      .get();
    if (existing) {
      throw new AppError(ERROR_CODE.CONFLICT, '该书籍已关联到此话题');
    }

    db.insert(topicBooks)
      .values({ topic_id: topicId, book_id: bookId, added_at: now() })
      .run();

    db.update(topics).set({ updated_at: now() }).where(eq(topics.id, topicId)).run();

    return { data: { added: true } };
  });

  app.delete('/topics/:id/books/:bookId', async (req) => {
    const userId = requireUserId(req);
    const { id, bookId: bookIdStr } = req.params as { id: string; bookId: string };
    const topicId = Number(id);
    const bookId = Number(bookIdStr);
    if (Number.isNaN(topicId) || Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的 ID');
    }

    const db = getDb();

    const topic = db
      .select()
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.owner_id, userId)))
      .get();
    if (!topic) {
      throw notFound('话题不存在');
    }

    const existing = db
      .select()
      .from(topicBooks)
      .where(and(eq(topicBooks.topic_id, topicId), eq(topicBooks.book_id, bookId)))
      .get();
    if (!existing) {
      throw notFound('关联不存在');
    }

    db.delete(topicBooks)
      .where(and(eq(topicBooks.topic_id, topicId), eq(topicBooks.book_id, bookId)))
      .run();

    db.update(topics).set({ updated_at: now() }).where(eq(topics.id, topicId)).run();

    return { data: { removed: true } };
  });

  // ========== Topic Entries ==========

  app.post('/topics/:id/entries', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = Number(id);
    if (Number.isNaN(topicId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的话题 ID');
    }

    const input = validate(createTopicEntrySchema, req.body);
    const db = getDb();

    const topic = db
      .select()
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.owner_id, userId), sql`${topics.deleted_at} IS NULL`))
      .get();
    if (!topic) {
      throw notFound('话题不存在');
    }

    const timestamp = now();
    const entry = db
      .insert(topicEntries)
      .values({
        topic_id: topicId,
        entry_type: input.entry_type,
        content: input.content,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning()
      .get();

    db.update(topics).set({ updated_at: timestamp }).where(eq(topics.id, topicId)).run();

    return { data: entry };
  });

  app.patch('/topics/:topicId/entries/:entryId', async (req) => {
    const userId = requireUserId(req);
    const { topicId: topicIdStr, entryId: entryIdStr } = req.params as { topicId: string; entryId: string };
    const topicId = Number(topicIdStr);
    const entryId = Number(entryIdStr);
    if (Number.isNaN(topicId) || Number.isNaN(entryId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的 ID');
    }

    const input = validate(updateTopicEntrySchema, req.body);
    const db = getDb();

    const topic = db
      .select()
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.owner_id, userId)))
      .get();
    if (!topic) {
      throw notFound('话题不存在');
    }

    const existing = db
      .select()
      .from(topicEntries)
      .where(and(eq(topicEntries.id, entryId), eq(topicEntries.topic_id, topicId)))
      .get();
    if (!existing) {
      throw notFound('沉淀内容不存在');
    }

    if (input.content !== undefined) {
      db.update(topicEntries)
        .set({ content: input.content, updated_at: now() })
        .where(eq(topicEntries.id, entryId))
        .run();
    }

    const updated = db.select().from(topicEntries).where(eq(topicEntries.id, entryId)).get();
    return { data: updated };
  });

  app.delete('/topics/:topicId/entries/:entryId', async (req) => {
    const userId = requireUserId(req);
    const { topicId: topicIdStr, entryId: entryIdStr } = req.params as { topicId: string; entryId: string };
    const topicId = Number(topicIdStr);
    const entryId = Number(entryIdStr);
    if (Number.isNaN(topicId) || Number.isNaN(entryId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的 ID');
    }

    const db = getDb();

    const topic = db
      .select()
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.owner_id, userId)))
      .get();
    if (!topic) {
      throw notFound('话题不存在');
    }

    const existing = db
      .select()
      .from(topicEntries)
      .where(and(eq(topicEntries.id, entryId), eq(topicEntries.topic_id, topicId)))
      .get();
    if (!existing) {
      throw notFound('沉淀内容不存在');
    }

    db.delete(topicEntries).where(eq(topicEntries.id, entryId)).run();
    db.update(topics).set({ updated_at: now() }).where(eq(topics.id, topicId)).run();

    return { data: { id: entryId, deleted: true } };
  });
}
