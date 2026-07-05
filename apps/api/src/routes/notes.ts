import type { FastifyInstance } from 'fastify';
import { and, eq, count, desc, sql } from 'drizzle-orm';
import { highlights, notes, books } from '@redesk/db';
import {
  ERROR_CODE,
  createHighlightSchema,
  updateHighlightSchema,
  createNoteSchema,
  updateNoteSchema,
} from '@redesk/shared';
import { getDb, getSqlite } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

export async function noteRoutes(app: FastifyInstance): Promise<void> {
  // ========== Highlights ==========

  app.get('/highlights', async (req) => {
    const userId = requireUserId(req);
    const query = req.query as Record<string, unknown>;
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    const bookId = query.book_id ? Number(query.book_id) : undefined;

    const db = getDb();
    const conditions = [
      eq(highlights.owner_id, userId),
      sql`${highlights.deleted_at} IS NULL`,
    ];
    if (bookId && !Number.isNaN(bookId)) {
      conditions.push(eq(highlights.book_id, bookId));
    }

    const where = and(...conditions);

    const total = db
      .select({ value: count() })
      .from(highlights)
      .where(where)
      .get()?.value ?? 0;

    const rows = db
      .select({
        id: highlights.id,
        book_id: highlights.book_id,
        owner_id: highlights.owner_id,
        cfi_start: highlights.cfi_start,
        cfi_end: highlights.cfi_end,
        text: highlights.text,
        type: highlights.type,
        color: highlights.color,
        note: highlights.note,
        mark_type: highlights.mark_type,
        created_at: highlights.created_at,
        updated_at: highlights.updated_at,
        book_title: books.title,
        book_author: books.author,
        book_cover_path: books.cover_path,
      })
      .from(highlights)
      .leftJoin(books, eq(highlights.book_id, books.id))
      .where(where)
      .orderBy(desc(highlights.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      data: rows,
      pagination: { page, page_size: pageSize, total },
    };
  });

  app.post('/highlights', async (req) => {
    const userId = requireUserId(req);
    const input = validate(createHighlightSchema, req.body);
    const db = getDb();
    const timestamp = now();

    const book = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, input.book_id), eq(books.owner_id, userId)))
      .get();
    if (!book) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '书籍不存在');
    }

    const highlight = db
      .insert(highlights)
      .values({
        book_id: input.book_id,
        owner_id: userId,
        cfi_start: input.cfi_start,
        cfi_end: input.cfi_end,
        text: input.text,
        type: input.type ?? 'HIGHLIGHT',
        color: input.color ?? null,
        note: input.note ?? null,
        mark_type: input.mark_type ?? 'NONE',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning()
      .get();

    return { data: highlight };
  });

  app.patch('/highlights/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const highlightId = Number(id);
    if (Number.isNaN(highlightId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的高亮 ID');
    }

    const input = validate(updateHighlightSchema, req.body);
    const db = getDb();

    const existing = db
      .select()
      .from(highlights)
      .where(and(eq(highlights.id, highlightId), eq(highlights.owner_id, userId)))
      .get();
    if (!existing) {
      throw notFound('高亮不存在');
    }

    const updateData: Record<string, unknown> = { updated_at: now() };
    if (input.cfi_start !== undefined) updateData.cfi_start = input.cfi_start;
    if (input.cfi_end !== undefined) updateData.cfi_end = input.cfi_end;
    if (input.text !== undefined) updateData.text = input.text;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.note !== undefined) updateData.note = input.note;
    if (input.mark_type !== undefined) updateData.mark_type = input.mark_type;

    if (Object.keys(updateData).length > 1) {
      db.update(highlights).set(updateData).where(eq(highlights.id, highlightId)).run();
    }

    const updated = db.select().from(highlights).where(eq(highlights.id, highlightId)).get();
    return { data: updated };
  });

  app.delete('/highlights/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const highlightId = Number(id);
    if (Number.isNaN(highlightId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的高亮 ID');
    }

    const db = getDb();
    const existing = db
      .select()
      .from(highlights)
      .where(and(eq(highlights.id, highlightId), eq(highlights.owner_id, userId)))
      .get();
    if (!existing) {
      throw notFound('高亮不存在');
    }

    db.update(highlights)
      .set({ deleted_at: now(), updated_at: now() })
      .where(eq(highlights.id, highlightId))
      .run();

    return { data: { id: highlightId, deleted: true } };
  });

  // ========== Notes ==========

  app.get('/notes', async (req) => {
    const userId = requireUserId(req);
    const query = req.query as Record<string, unknown>;
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    const bookId = query.book_id ? Number(query.book_id) : undefined;

    const db = getDb();
    const conditions = [
      eq(notes.owner_id, userId),
      sql`${notes.deleted_at} IS NULL`,
    ];
    if (bookId && !Number.isNaN(bookId)) {
      conditions.push(eq(notes.book_id, bookId));
    }

    const where = and(...conditions);

    const total = db
      .select({ value: count() })
      .from(notes)
      .where(where)
      .get()?.value ?? 0;

    const rows = db
      .select({
        id: notes.id,
        book_id: notes.book_id,
        owner_id: notes.owner_id,
        cfi: notes.cfi,
        title: notes.title,
        content_html: notes.content_html,
        content_markdown: notes.content_markdown,
        mark_type: notes.mark_type,
        created_at: notes.created_at,
        updated_at: notes.updated_at,
        book_title: books.title,
        book_author: books.author,
        book_cover_path: books.cover_path,
      })
      .from(notes)
      .leftJoin(books, eq(notes.book_id, books.id))
      .where(where)
      .orderBy(desc(notes.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      data: rows,
      pagination: { page, page_size: pageSize, total },
    };
  });

  app.post('/notes', async (req) => {
    const userId = requireUserId(req);
    const input = validate(createNoteSchema, req.body);
    const db = getDb();
    const timestamp = now();

    const book = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, input.book_id), eq(books.owner_id, userId)))
      .get();
    if (!book) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '书籍不存在');
    }

    const note = db
      .insert(notes)
      .values({
        book_id: input.book_id,
        owner_id: userId,
        cfi: input.cfi ?? null,
        title: input.title ?? null,
        content_html: input.content_html ?? null,
        content_markdown: input.content_markdown ?? null,
        mark_type: input.mark_type ?? 'NONE',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning()
      .get();

    return { data: note };
  });

  app.patch('/notes/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const noteId = Number(id);
    if (Number.isNaN(noteId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的笔记 ID');
    }

    const input = validate(updateNoteSchema, req.body);
    const db = getDb();

    const existing = db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.owner_id, userId)))
      .get();
    if (!existing) {
      throw notFound('笔记不存在');
    }

    const updateData: Record<string, unknown> = { updated_at: now() };
    if (input.cfi !== undefined) updateData.cfi = input.cfi;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.content_html !== undefined) updateData.content_html = input.content_html;
    if (input.content_markdown !== undefined) updateData.content_markdown = input.content_markdown;
    if (input.mark_type !== undefined) updateData.mark_type = input.mark_type;

    if (Object.keys(updateData).length > 1) {
      db.update(notes).set(updateData).where(eq(notes.id, noteId)).run();
    }

    const updated = db.select().from(notes).where(eq(notes.id, noteId)).get();
    return { data: updated };
  });

  app.delete('/notes/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const noteId = Number(id);
    if (Number.isNaN(noteId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的笔记 ID');
    }

    const db = getDb();
    const existing = db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.owner_id, userId)))
      .get();
    if (!existing) {
      throw notFound('笔记不存在');
    }

    db.update(notes)
      .set({ deleted_at: now(), updated_at: now() })
      .where(eq(notes.id, noteId))
      .run();

    return { data: { id: noteId, deleted: true } };
  });

  // ========== Stats ==========

  app.get('/reading-marks/stats', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();

    const totalHighlights = db
      .select({ value: count() })
      .from(highlights)
      .where(and(eq(highlights.owner_id, userId), sql`${highlights.deleted_at} IS NULL`))
      .get()?.value ?? 0;

    const totalNotes = db
      .select({ value: count() })
      .from(notes)
      .where(and(eq(notes.owner_id, userId), sql`${notes.deleted_at} IS NULL`))
      .get()?.value ?? 0;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();

    const notesThisMonth = db
      .select({ value: count() })
      .from(notes)
      .where(
        and(
          eq(notes.owner_id, userId),
          sql`${notes.deleted_at} IS NULL`,
          sql`${notes.created_at} >= ${monthStartIso}`,
        ),
      )
      .get()?.value ?? 0;

    const annotatedCount = db
      .select({ value: count() })
      .from(notes)
      .where(
        and(
          eq(notes.owner_id, userId),
          sql`${notes.deleted_at} IS NULL`,
          sql`${notes.content_html} IS NOT NULL AND ${notes.content_html} != ''`,
        ),
      )
      .get()?.value ?? 0;

    return {
      data: {
        total_highlights: totalHighlights,
        total_notes: totalNotes,
        notes_this_month: notesThisMonth,
        annotated: annotatedCount,
      },
    };
  });

  // ========== Search ==========

  app.get('/notes/search', async (req) => {
    const userId = requireUserId(req);
    const query = req.query as { q?: string; book_id?: string; page?: string; page_size?: string };
    const q = query.q?.trim();
    if (!q) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '搜索词不能为空');
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    const bookId = query.book_id ? Number(query.book_id) : undefined;

    const sqlite = getSqlite();

    // 搜索 notes_fts
    const ftsMatch = q.replace(/['"]/g, '').split(/\s+/).filter(Boolean).join(' ');
    if (!ftsMatch) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '搜索词无效');

    const escaped = ftsMatch.replace(/'/g, "''");
    const noteRows = sqlite
      .prepare(
        `SELECT n.id, n.book_id, n.owner_id, n.cfi, n.title, n.content_html, n.content_markdown,
                n.mark_type, n.created_at, n.updated_at,
                b.title AS book_title, b.author AS book_author, b.cover_path AS book_cover_path
         FROM notes_fts f
         JOIN notes n ON n.id = f.rowid
         LEFT JOIN books b ON b.id = n.book_id
         WHERE notes_fts MATCH ?
           AND n.deleted_at IS NULL
           AND n.owner_id = ?
         ${bookId && !Number.isNaN(bookId) ? 'AND n.book_id = ?' : ''}
         ORDER BY rank
         LIMIT ? OFFSET ?`,
      )
      .all(
        ...[
          escaped,
          userId,
          ...(bookId && !Number.isNaN(bookId) ? [bookId] : []),
          pageSize,
          (page - 1) * pageSize,
        ],
      ) as Array<Record<string, unknown>>;

    return {
      data: noteRows,
      type: 'notes',
    };
  });

  app.get('/highlights/search', async (req) => {
    const userId = requireUserId(req);
    const query = req.query as { q?: string; book_id?: string; page?: string; page_size?: string };
    const q = query.q?.trim();
    if (!q) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '搜索词不能为空');
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    const bookId = query.book_id ? Number(query.book_id) : undefined;

    const sqlite = getSqlite();

    const ftsMatch = q.replace(/['"]/g, '').split(/\s+/).filter(Boolean).join(' ');
    if (!ftsMatch) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '搜索词无效');

    const escaped = ftsMatch.replace(/'/g, "''");
    const hlRows = sqlite
      .prepare(
        `SELECT h.id, h.book_id, h.owner_id, h.cfi_start, h.cfi_end, h.text, h.type,
                h.color, h.note, h.mark_type, h.created_at, h.updated_at,
                b.title AS book_title, b.author AS book_author, b.cover_path AS book_cover_path
         FROM highlights_fts f
         JOIN highlights h ON h.id = f.rowid
         LEFT JOIN books b ON b.id = h.book_id
         WHERE highlights_fts MATCH ?
           AND h.deleted_at IS NULL
           AND h.owner_id = ?
         ${bookId && !Number.isNaN(bookId) ? 'AND h.book_id = ?' : ''}
         ORDER BY rank
         LIMIT ? OFFSET ?`,
      )
      .all(
        ...[
          escaped,
          userId,
          ...(bookId && !Number.isNaN(bookId) ? [bookId] : []),
          pageSize,
          (page - 1) * pageSize,
        ],
      ) as Array<Record<string, unknown>>;

    return {
      data: hlRows,
      type: 'highlights',
    };
  });
}
