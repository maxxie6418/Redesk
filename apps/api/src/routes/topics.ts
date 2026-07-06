import type { FastifyInstance } from 'fastify';
import { and, eq, count, desc, sql } from 'drizzle-orm';
import {
  topics,
  topicBooks,
  topicEntries,
  topicHighlights,
  topicNotes,
  topicSegments,
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
  linkTopicHighlightSchema,
  linkTopicNoteSchema,
  createTopicSegmentSchema,
  updateTopicSegmentSchema,
} from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

function parseTopicId(raw: string): number {
  const topicId = Number(raw);
  if (Number.isNaN(topicId)) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的话题 ID');
  }
  return topicId;
}

function parseResourceId(raw: string, label = 'ID'): number {
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `无效的${label}`);
  }
  return value;
}

function requireTopic(topicId: number, userId: number) {
  const db = getDb();
  const topic = db
    .select()
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.owner_id, userId), sql`${topics.deleted_at} IS NULL`))
    .get();
  if (!topic) {
    throw notFound('话题不存在');
  }
  return topic;
}

function entryTypeTitle(entryType: string): string {
  if (entryType === 'QUESTION') return '问题';
  if (entryType === 'JUDGMENT') return '判断';
  if (entryType === 'COMPARISON') return '比较';
  return '沉淀';
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

    const bookCounts = new Map(
      db
        .select({ topic_id: topicBooks.topic_id, value: count() })
        .from(topicBooks)
        .innerJoin(topics, eq(topics.id, topicBooks.topic_id))
        .where(and(eq(topics.owner_id, userId), sql`${topics.deleted_at} IS NULL`))
        .groupBy(topicBooks.topic_id)
        .all()
        .map((row) => [row.topic_id, row.value]),
    );

    const entryCounts = new Map(
      db
        .select({ topic_id: topicEntries.topic_id, value: count() })
        .from(topicEntries)
        .innerJoin(topics, eq(topics.id, topicEntries.topic_id))
        .where(and(eq(topics.owner_id, userId), sql`${topics.deleted_at} IS NULL`))
        .groupBy(topicEntries.topic_id)
        .all()
        .map((row) => [row.topic_id, row.value]),
    );

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

  app.get('/topics/:id/timeline', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = parseTopicId(id);
    const db = getDb();
    const topic = requireTopic(topicId, userId);

    const topicBookRows = db
      .select({
        book_id: topicBooks.book_id,
        added_at: topicBooks.added_at,
        title: books.title,
        author: books.author,
      })
      .from(topicBooks)
      .innerJoin(books, eq(topicBooks.book_id, books.id))
      .where(and(eq(topicBooks.topic_id, topicId), eq(books.owner_id, userId), sql`${books.deleted_at} IS NULL`))
      .all();

    const topicHighlightRows = db
      .select({
        highlight_id: topicHighlights.highlight_id,
        added_at: topicHighlights.added_at,
        text: highlights.text,
        cfi_start: highlights.cfi_start,
        cfi_end: highlights.cfi_end,
        book_id: highlights.book_id,
        book_title: books.title,
      })
      .from(topicHighlights)
      .innerJoin(highlights, eq(topicHighlights.highlight_id, highlights.id))
      .innerJoin(books, eq(highlights.book_id, books.id))
      .where(and(eq(topicHighlights.topic_id, topicId), eq(highlights.owner_id, userId), sql`${highlights.deleted_at} IS NULL`, sql`${books.deleted_at} IS NULL`))
      .all();

    const topicNoteRows = db
      .select({
        note_id: topicNotes.note_id,
        added_at: topicNotes.added_at,
        title: notes.title,
        content_markdown: notes.content_markdown,
        cfi: notes.cfi,
        book_id: notes.book_id,
        book_title: books.title,
      })
      .from(topicNotes)
      .innerJoin(notes, eq(topicNotes.note_id, notes.id))
      .innerJoin(books, eq(notes.book_id, books.id))
      .where(and(eq(topicNotes.topic_id, topicId), eq(notes.owner_id, userId), sql`${notes.deleted_at} IS NULL`, sql`${books.deleted_at} IS NULL`))
      .all();

    const segmentRows = db
      .select({
        id: topicSegments.id,
        book_id: topicSegments.book_id,
        cfi_start: topicSegments.cfi_start,
        cfi_end: topicSegments.cfi_end,
        label: topicSegments.label,
        added_at: topicSegments.added_at,
        book_title: books.title,
      })
      .from(topicSegments)
      .innerJoin(books, eq(topicSegments.book_id, books.id))
      .where(and(eq(topicSegments.topic_id, topicId), eq(books.owner_id, userId), sql`${books.deleted_at} IS NULL`))
      .all();

    const entries = db
      .select()
      .from(topicEntries)
      .where(eq(topicEntries.topic_id, topicId))
      .all();

    const events = [
      {
        event_type: 'topic_created',
        subject_type: 'topic',
        subject_id: topic.id,
        title: topic.name,
        summary: topic.description,
        book_id: null,
        book_title: null,
        cfi: null,
        created_at: topic.created_at,
      },
      ...(topic.updated_at !== topic.created_at ? [{
        event_type: 'topic_updated',
        subject_type: 'topic',
        subject_id: topic.id,
        title: topic.name,
        summary: topic.description,
        book_id: null,
        book_title: null,
        cfi: null,
        created_at: topic.updated_at,
      }] : []),
      ...topicBookRows.map((row) => ({
        event_type: 'book_added',
        subject_type: 'book',
        subject_id: row.book_id,
        title: row.title,
        summary: row.author,
        book_id: row.book_id,
        book_title: row.title,
        cfi: null,
        created_at: row.added_at,
      })),
      ...topicHighlightRows.map((row) => ({
        event_type: 'highlight_added',
        subject_type: 'highlight',
        subject_id: row.highlight_id,
        title: row.text,
        summary: row.book_title,
        book_id: row.book_id,
        book_title: row.book_title,
        cfi: row.cfi_start,
        cfi_start: row.cfi_start,
        cfi_end: row.cfi_end,
        created_at: row.added_at,
      })),
      ...topicNoteRows.map((row) => ({
        event_type: 'note_added',
        subject_type: 'note',
        subject_id: row.note_id,
        title: row.title ?? '笔记',
        summary: row.content_markdown,
        book_id: row.book_id,
        book_title: row.book_title,
        cfi: row.cfi,
        created_at: row.added_at,
      })),
      ...segmentRows.map((row) => ({
        event_type: 'segment_added',
        subject_type: 'segment',
        subject_id: row.id,
        title: row.label ?? '章节片段',
        summary: row.book_title,
        book_id: row.book_id,
        book_title: row.book_title,
        cfi: row.cfi_start,
        cfi_start: row.cfi_start,
        cfi_end: row.cfi_end,
        created_at: row.added_at,
      })),
      ...entries.flatMap((row) => [
        {
          event_type: 'entry_created',
          subject_type: 'entry',
          subject_id: row.id,
          title: entryTypeTitle(row.entry_type),
          summary: row.content,
          book_id: null,
          book_title: null,
          cfi: null,
          created_at: row.created_at,
        },
        ...(row.updated_at !== row.created_at ? [{
          event_type: 'entry_updated',
          subject_type: 'entry',
          subject_id: row.id,
          title: entryTypeTitle(row.entry_type),
          summary: row.content,
          book_id: null,
          book_title: null,
          cfi: null,
          created_at: row.updated_at,
        }] : []),
      ]),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at));

    return { data: { topic_id: topicId, events } };
  });

  app.get('/topics/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = parseTopicId(id);
    const db = getDb();

    const topic = requireTopic(topicId, userId);

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
      .where(and(eq(topicBooks.topic_id, topicId), sql`${books.deleted_at} IS NULL`))
      .all();

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
      .where(and(eq(topicHighlights.topic_id, topicId), sql`${highlights.deleted_at} IS NULL`, sql`${books.deleted_at} IS NULL`))
      .all();

    const topicNoteRows = db
      .select({
        topic_id: topicNotes.topic_id,
        note_id: topicNotes.note_id,
        added_at: topicNotes.added_at,
        title: notes.title,
        content_markdown: notes.content_markdown,
        cfi: notes.cfi,
        book_id: notes.book_id,
        book_title: books.title,
      })
      .from(topicNotes)
      .innerJoin(notes, eq(topicNotes.note_id, notes.id))
      .leftJoin(books, eq(notes.book_id, books.id))
      .where(and(eq(topicNotes.topic_id, topicId), sql`${notes.deleted_at} IS NULL`, sql`${books.deleted_at} IS NULL`))
      .all();

    const segmentRows = db
      .select({
        id: topicSegments.id,
        topic_id: topicSegments.topic_id,
        book_id: topicSegments.book_id,
        cfi_start: topicSegments.cfi_start,
        cfi_end: topicSegments.cfi_end,
        label: topicSegments.label,
        added_at: topicSegments.added_at,
        book_title: books.title,
      })
      .from(topicSegments)
      .innerJoin(books, eq(topicSegments.book_id, books.id))
      .where(and(eq(topicSegments.topic_id, topicId), sql`${books.deleted_at} IS NULL`))
      .orderBy(desc(topicSegments.added_at))
      .all();

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
        segments: segmentRows,
        entries,
      },
    };
  });

  app.patch('/topics/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = parseTopicId(id);

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
    const topicId = parseTopicId(id);

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

  app.post('/topics/:id/books', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = parseTopicId(id);

    const body = req.body as { book_id?: number };
    const bookId = body?.book_id;
    if (!bookId || Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();

    requireTopic(topicId, userId);

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
    const topicId = parseTopicId(id);
    const bookId = parseResourceId(bookIdStr, '书籍 ID');

    const db = getDb();

    requireTopic(topicId, userId);

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

  app.post('/topics/:id/highlights', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = parseTopicId(id);
    const input = validate(linkTopicHighlightSchema, req.body);
    const db = getDb();

    requireTopic(topicId, userId);

    const highlight = db
      .select({ id: highlights.id })
      .from(highlights)
      .where(
        and(
          eq(highlights.id, input.highlight_id),
          eq(highlights.owner_id, userId),
          sql`${highlights.deleted_at} IS NULL`,
        ),
      )
      .get();
    if (!highlight) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '高亮不存在');
    }

    const existing = db
      .select()
      .from(topicHighlights)
      .where(and(eq(topicHighlights.topic_id, topicId), eq(topicHighlights.highlight_id, input.highlight_id)))
      .get();
    if (existing) {
      throw new AppError(ERROR_CODE.CONFLICT, '该高亮已关联到此话题');
    }

    db.insert(topicHighlights)
      .values({ topic_id: topicId, highlight_id: input.highlight_id, added_at: now() })
      .run();

    db.update(topics).set({ updated_at: now() }).where(eq(topics.id, topicId)).run();

    return { data: { added: true } };
  });

  app.delete('/topics/:id/highlights/:highlightId', async (req) => {
    const userId = requireUserId(req);
    const { id, highlightId: highlightIdStr } = req.params as { id: string; highlightId: string };
    const topicId = parseTopicId(id);
    const highlightId = parseResourceId(highlightIdStr, '高亮 ID');
    const db = getDb();

    requireTopic(topicId, userId);

    const existing = db
      .select()
      .from(topicHighlights)
      .where(and(eq(topicHighlights.topic_id, topicId), eq(topicHighlights.highlight_id, highlightId)))
      .get();
    if (!existing) {
      throw notFound('关联不存在');
    }

    db.delete(topicHighlights)
      .where(and(eq(topicHighlights.topic_id, topicId), eq(topicHighlights.highlight_id, highlightId)))
      .run();

    db.update(topics).set({ updated_at: now() }).where(eq(topics.id, topicId)).run();

    return { data: { removed: true } };
  });

  app.post('/topics/:id/notes', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = parseTopicId(id);
    const input = validate(linkTopicNoteSchema, req.body);
    const db = getDb();

    requireTopic(topicId, userId);

    const note = db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, input.note_id), eq(notes.owner_id, userId), sql`${notes.deleted_at} IS NULL`))
      .get();
    if (!note) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '笔记不存在');
    }

    const existing = db
      .select()
      .from(topicNotes)
      .where(and(eq(topicNotes.topic_id, topicId), eq(topicNotes.note_id, input.note_id)))
      .get();
    if (existing) {
      throw new AppError(ERROR_CODE.CONFLICT, '该笔记已关联到此话题');
    }

    db.insert(topicNotes)
      .values({ topic_id: topicId, note_id: input.note_id, added_at: now() })
      .run();

    db.update(topics).set({ updated_at: now() }).where(eq(topics.id, topicId)).run();

    return { data: { added: true } };
  });

  app.delete('/topics/:id/notes/:noteId', async (req) => {
    const userId = requireUserId(req);
    const { id, noteId: noteIdStr } = req.params as { id: string; noteId: string };
    const topicId = parseTopicId(id);
    const noteId = parseResourceId(noteIdStr, '笔记 ID');
    const db = getDb();

    requireTopic(topicId, userId);

    const existing = db
      .select()
      .from(topicNotes)
      .where(and(eq(topicNotes.topic_id, topicId), eq(topicNotes.note_id, noteId)))
      .get();
    if (!existing) {
      throw notFound('关联不存在');
    }

    db.delete(topicNotes)
      .where(and(eq(topicNotes.topic_id, topicId), eq(topicNotes.note_id, noteId)))
      .run();

    db.update(topics).set({ updated_at: now() }).where(eq(topics.id, topicId)).run();

    return { data: { removed: true } };
  });

  app.post('/topics/:id/segments', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = parseTopicId(id);
    const input = validate(createTopicSegmentSchema, req.body);
    const db = getDb();

    requireTopic(topicId, userId);

    const book = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, input.book_id), eq(books.owner_id, userId), sql`${books.deleted_at} IS NULL`))
      .get();
    if (!book) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '书籍不存在');
    }

    const timestamp = now();
    const segment = db
      .insert(topicSegments)
      .values({
        topic_id: topicId,
        book_id: input.book_id,
        cfi_start: input.cfi_start,
        cfi_end: input.cfi_end,
        label: input.label ?? null,
        added_at: timestamp,
      })
      .returning()
      .get();

    db.update(topics).set({ updated_at: timestamp }).where(eq(topics.id, topicId)).run();

    return { data: segment };
  });

  app.patch('/topics/:topicId/segments/:segmentId', async (req) => {
    const userId = requireUserId(req);
    const { topicId: topicIdStr, segmentId: segmentIdStr } = req.params as { topicId: string; segmentId: string };
    const topicId = parseTopicId(topicIdStr);
    const segmentId = parseResourceId(segmentIdStr, '片段 ID');
    const input = validate(updateTopicSegmentSchema, req.body);
    const db = getDb();

    requireTopic(topicId, userId);

    const existing = db
      .select()
      .from(topicSegments)
      .where(and(eq(topicSegments.id, segmentId), eq(topicSegments.topic_id, topicId)))
      .get();
    if (!existing) {
      throw notFound('片段不存在');
    }

    const updateData: Record<string, unknown> = {};
    if (input.cfi_start !== undefined) updateData.cfi_start = input.cfi_start;
    if (input.cfi_end !== undefined) updateData.cfi_end = input.cfi_end;
    if (input.label !== undefined) updateData.label = input.label;

    if (Object.keys(updateData).length > 0) {
      db.update(topicSegments).set(updateData).where(eq(topicSegments.id, segmentId)).run();
      db.update(topics).set({ updated_at: now() }).where(eq(topics.id, topicId)).run();
    }

    const updated = db.select().from(topicSegments).where(eq(topicSegments.id, segmentId)).get();
    return { data: updated };
  });

  app.delete('/topics/:topicId/segments/:segmentId', async (req) => {
    const userId = requireUserId(req);
    const { topicId: topicIdStr, segmentId: segmentIdStr } = req.params as { topicId: string; segmentId: string };
    const topicId = parseTopicId(topicIdStr);
    const segmentId = parseResourceId(segmentIdStr, '片段 ID');
    const db = getDb();

    requireTopic(topicId, userId);

    const existing = db
      .select()
      .from(topicSegments)
      .where(and(eq(topicSegments.id, segmentId), eq(topicSegments.topic_id, topicId)))
      .get();
    if (!existing) {
      throw notFound('片段不存在');
    }

    db.delete(topicSegments).where(eq(topicSegments.id, segmentId)).run();
    db.update(topics).set({ updated_at: now() }).where(eq(topics.id, topicId)).run();

    return { data: { removed: true } };
  });

  app.post('/topics/:id/entries', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const topicId = parseTopicId(id);

    const input = validate(createTopicEntrySchema, req.body);
    const db = getDb();

    requireTopic(topicId, userId);

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
    const topicId = parseTopicId(topicIdStr);
    const entryId = parseResourceId(entryIdStr, '沉淀内容 ID');

    const input = validate(updateTopicEntrySchema, req.body);
    const db = getDb();

    requireTopic(topicId, userId);

    const existing = db
      .select()
      .from(topicEntries)
      .where(and(eq(topicEntries.id, entryId), eq(topicEntries.topic_id, topicId)))
      .get();
    if (!existing) {
      throw notFound('沉淀内容不存在');
    }

    if (input.content !== undefined) {
      const timestamp = now();
      db.update(topicEntries)
        .set({ content: input.content, updated_at: timestamp })
        .where(eq(topicEntries.id, entryId))
        .run();
      db.update(topics).set({ updated_at: timestamp }).where(eq(topics.id, topicId)).run();
    }

    const updated = db.select().from(topicEntries).where(eq(topicEntries.id, entryId)).get();
    return { data: updated };
  });

  app.delete('/topics/:topicId/entries/:entryId', async (req) => {
    const userId = requireUserId(req);
    const { topicId: topicIdStr, entryId: entryIdStr } = req.params as { topicId: string; entryId: string };
    const topicId = parseTopicId(topicIdStr);
    const entryId = parseResourceId(entryIdStr, '沉淀内容 ID');
    const db = getDb();

    requireTopic(topicId, userId);

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
