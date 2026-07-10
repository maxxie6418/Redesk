import type { FastifyInstance } from 'fastify';
import { and, eq, count, desc, sql, or } from 'drizzle-orm';
import { highlights, notes, books, bookmarks } from '@redesk/db';
import {
  ERROR_CODE,
  createHighlightSchema,
  updateHighlightSchema,
  createNoteSchema,
  updateNoteSchema,
  createBookmarkSchema,
  readingMarkListQuerySchema,
  readingMarkSearchQuerySchema,
} from '@redesk/shared';
import { getDb, getSqlite } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requirePermission, getPublicUserId, isAdmin } from '../lib/auth';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

function createFtsQuery(q: string): string {
  const ftsMatch = q.replace(/['"]/g, '').split(/\s+/).filter(Boolean).join(' ');
  if (!ftsMatch) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '搜索词无效');
  return ftsMatch.replace(/'/g, "''");
}

export async function noteRoutes(app: FastifyInstance): Promise<void> {
  // ========== Highlights ==========

  app.get('/highlights', async (req) => {
    const userId = getPublicUserId(req);
    const { page, page_size: pageSize, book_id: bookId } = validate(readingMarkListQuerySchema, req.query);

    const db = getDb();
    const conditions = [
      sql`${highlights.deleted_at} IS NULL`,
      or(
        eq(books.visibility, 'PUBLIC'),
        eq(books.owner_id, userId),
      ),
    ];
    if (bookId) {
      conditions.push(eq(highlights.book_id, bookId));
    }

    const where = and(...conditions);

    const total = db
      .select({ value: count() })
      .from(highlights)
      .innerJoin(books, eq(highlights.book_id, books.id))
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
      .innerJoin(books, eq(highlights.book_id, books.id))
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
    const userId = requirePermission(req, 'read');
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
    const userId = requirePermission(req, 'read');
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
    const userId = requirePermission(req, 'read');
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
    const userId = requirePermission(req, 'view');
    const { page, page_size: pageSize, book_id: bookId } = validate(readingMarkListQuerySchema, req.query);

    const db = getDb();
    const conditions = [
      sql`${notes.deleted_at} IS NULL`,
    ];

    // 管理员可查看所有笔记，普通用户只能查看自己的笔记
    if (!isAdmin(userId)) {
      conditions.push(eq(notes.owner_id, userId));
    }

    if (bookId) {
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
    const userId = requirePermission(req, 'read');
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
    const userId = requirePermission(req, 'read');
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
    const userId = requirePermission(req, 'read');
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

  // ========== Bookmarks ==========

  app.get('/bookmarks', async (req) => {
    const userId = requirePermission(req, 'view');
    const { page, page_size: pageSize, book_id: bookId } = validate(readingMarkListQuerySchema, req.query);

    const db = getDb();
    const conditions = [];

    // 管理员可查看所有书签，普通用户只能查看自己的书签
    if (!isAdmin(userId)) {
      conditions.push(eq(bookmarks.owner_id, userId));
    }
    if (bookId) {
      conditions.push(eq(bookmarks.book_id, bookId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const total = db
      .select({ value: count() })
      .from(bookmarks)
      .where(where)
      .get()?.value ?? 0;

    const rows = db
      .select()
      .from(bookmarks)
      .where(where)
      .orderBy(desc(bookmarks.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      data: rows,
      pagination: { page, page_size: pageSize, total },
    };
  });

  app.post('/bookmarks', async (req) => {
    const userId = requirePermission(req, 'read');
    const input = validate(createBookmarkSchema, req.body);
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

    // 同一 CFI 已存在则先删除，确保唯一
    const existing = db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.owner_id, userId),
          eq(bookmarks.book_id, input.book_id),
          eq(bookmarks.cfi, input.cfi),
        ),
      )
      .get();
    if (existing) {
      db.delete(bookmarks).where(eq(bookmarks.id, existing.id)).run();
      return { data: { id: existing.id, deleted: true } };
    }

    const bookmark = db
      .insert(bookmarks)
      .values({
        book_id: input.book_id,
        owner_id: userId,
        cfi: input.cfi,
        label: input.label ?? null,
        percentage: input.percentage ?? null,
        created_at: timestamp,
      })
      .returning()
      .get();

    return { data: bookmark };
  });

  app.delete('/bookmarks/:id', async (req) => {
    const userId = requirePermission(req, 'read');
    const { id } = req.params as { id: string };
    const bookmarkId = Number(id);
    if (Number.isNaN(bookmarkId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书签 ID');
    }

    const db = getDb();
    const existing = db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.owner_id, userId)))
      .get();
    if (!existing) {
      throw notFound('书签不存在');
    }

    db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId)).run();
    return { data: { id: bookmarkId, deleted: true } };
  });

  // ========== Stats ==========

  app.get('/reading-marks/stats', async (req) => {
    const userId = requirePermission(req, 'view');
    const db = getDb();
    const admin = isAdmin(userId);

    // 管理员统计所有用户，普通用户只统计自己
    const ownerCondition = admin ? undefined : eq(highlights.owner_id, userId);
    const noteOwnerCondition = admin ? undefined : eq(notes.owner_id, userId);

    const totalHighlights = db
      .select({ value: count() })
      .from(highlights)
      .where(ownerCondition ? and(ownerCondition, sql`${highlights.deleted_at} IS NULL`) : sql`${highlights.deleted_at} IS NULL`)
      .get()?.value ?? 0;

    const totalNotes = db
      .select({ value: count() })
      .from(notes)
      .where(noteOwnerCondition ? and(noteOwnerCondition, sql`${notes.deleted_at} IS NULL`) : sql`${notes.deleted_at} IS NULL`)
      .get()?.value ?? 0;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();

    const notesThisMonth = db
      .select({ value: count() })
      .from(notes)
      .where(
        noteOwnerCondition
          ? and(noteOwnerCondition, sql`${notes.deleted_at} IS NULL`, sql`${notes.created_at} >= ${monthStartIso}`)
          : and(sql`${notes.deleted_at} IS NULL`, sql`${notes.created_at} >= ${monthStartIso}`),
      )
      .get()?.value ?? 0;

    const annotatedCount = db
      .select({ value: count() })
      .from(notes)
      .where(
        noteOwnerCondition
          ? and(noteOwnerCondition, sql`${notes.deleted_at} IS NULL`, sql`${notes.content_html} IS NOT NULL AND ${notes.content_html} != ''`)
          : and(sql`${notes.deleted_at} IS NULL`, sql`${notes.content_html} IS NOT NULL AND ${notes.content_html} != ''`),
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
    const userId = requirePermission(req, 'view');
    const { q, page, page_size: pageSize, book_id: bookId } = validate(readingMarkSearchQuerySchema, req.query);
    const escaped = createFtsQuery(q);
    const sqlite = getSqlite();
    const bookFilter = bookId ? 'AND n.book_id = ?' : '';

    // 管理员可搜索所有笔记，普通用户只能搜索自己的笔记
    const ownerFilter = isAdmin(userId) ? '' : 'AND n.owner_id = ?';
    const baseParams = [escaped, ...(isAdmin(userId) ? [] : [userId]), ...(bookId ? [bookId] : [])];

    const total = (sqlite
      .prepare(
        `SELECT COUNT(*) AS total
         FROM notes_fts f
         JOIN notes n ON n.id = f.rowid
         WHERE notes_fts MATCH ?
           AND n.deleted_at IS NULL
           ${ownerFilter}
         ${bookFilter}`,
      )
      .get(...baseParams) as { total: number } | undefined)?.total ?? 0;

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
           ${ownerFilter}
         ${bookFilter}
         ORDER BY rank
         LIMIT ? OFFSET ?`,
      )
      .all(...baseParams, pageSize, (page - 1) * pageSize) as Array<Record<string, unknown>>;

    return {
      data: noteRows,
      type: 'notes',
      pagination: { page, page_size: pageSize, total },
    };
  });

  app.get('/highlights/search', async (req) => {
    const userId = getPublicUserId(req);
    const { q, page, page_size: pageSize, book_id: bookId } = validate(readingMarkSearchQuerySchema, req.query);
    const escaped = createFtsQuery(q);
    const sqlite = getSqlite();
    const bookFilter = bookId ? 'AND h.book_id = ?' : '';
    const baseParams = [escaped, userId, ...(bookId ? [bookId] : [])];

    const total = (sqlite
      .prepare(
        `SELECT COUNT(*) AS total
         FROM highlights_fts f
         JOIN highlights h ON h.id = f.rowid
         JOIN books b ON b.id = h.book_id
         WHERE highlights_fts MATCH ?
           AND h.deleted_at IS NULL
           AND (b.visibility = 'PUBLIC' OR b.owner_id = ?)
         ${bookFilter}`,
      )
      .get(...baseParams) as { total: number } | undefined)?.total ?? 0;

    const hlRows = sqlite
      .prepare(
        `SELECT h.id, h.book_id, h.owner_id, h.cfi_start, h.cfi_end, h.text, h.type,
                h.color, h.note, h.mark_type, h.created_at, h.updated_at,
                b.title AS book_title, b.author AS book_author, b.cover_path AS book_cover_path
         FROM highlights_fts f
         JOIN highlights h ON h.id = f.rowid
         JOIN books b ON b.id = h.book_id
         WHERE highlights_fts MATCH ?
           AND h.deleted_at IS NULL
           AND (b.visibility = 'PUBLIC' OR b.owner_id = ?)
         ${bookFilter}
         ORDER BY rank
         LIMIT ? OFFSET ?`,
      )
      .all(...baseParams, pageSize, (page - 1) * pageSize) as Array<Record<string, unknown>>;

    return {
      data: hlRows,
      type: 'highlights',
      pagination: { page, page_size: pageSize, total },
    };
  });
}
