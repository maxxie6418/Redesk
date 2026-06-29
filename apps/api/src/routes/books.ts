import type { FastifyInstance } from 'fastify';
import { and, asc, count, desc, eq, inArray, notExists, or, sql } from 'drizzle-orm';
import { bookFiles, bookRelations, bookTags, books, categories, statusHistory, tags } from '@redesk/db';
import {
  ERROR_CODE,
  bookQuerySchema,
  createBookSchema,
  updateBookSchema,
  batchBooksSchema,
  trashQuerySchema,
  duplicateQuerySchema,
} from '@redesk/shared';
import type { BookQueryInput, TrashQueryInput, DuplicateQueryInput } from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound, businessError } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';
import { saveUploadedFile, EXTENSION_FORMAT } from './files';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { config } from '../config';

interface RawBookRow {
  id: number;
  owner_id: number;
  category_id: number | null;
  genre_category_id: number | null;
  title: string;
  author: string | null;
  subtitle: string | null;
  isbn: string | null;
  publisher: string | null;
  publish_year: number | null;
  description: string | null;
  language: string | null;
  cover_path: string | null;
  status: string;
  visibility: string;
  reading_purpose: string | null;
  rating: number | null;
  custom_attributes: string | null;
  metadata_source: string | null;
  source_url: string | null;
  translator: string | null;
  original_title: string | null;
  page_count: number | null;
  favorited_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function now(): string {
  return new Date().toISOString();
}

function longestCommonSubstring(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let maxLen = 0;
  let prev = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    const curr = new Array(n + 1).fill(0);
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > maxLen) maxLen = curr[j];
      }
    }
    prev = curr;
  }

  return maxLen;
}

function bookSelect() {
  return {
    id: books.id,
    owner_id: books.owner_id,
    category_id: books.category_id,
    genre_category_id: books.genre_category_id,
    title: books.title,
    author: books.author,
    subtitle: books.subtitle,
    isbn: books.isbn,
    publisher: books.publisher,
    publish_year: books.publish_year,
    description: books.description,
    language: books.language,
    cover_path: books.cover_path,
    status: books.status,
    visibility: books.visibility,
    reading_purpose: books.reading_purpose,
    rating: books.rating,
    custom_attributes: books.custom_attributes,
    metadata_source: books.metadata_source,
    source_url: books.source_url,
    translator: books.translator,
    original_title: books.original_title,
    page_count: books.page_count,
    favorited_at: books.favorited_at,
    started_at: books.started_at,
    finished_at: books.finished_at,
    deleted_at: books.deleted_at,
    created_at: books.created_at,
    updated_at: books.updated_at,
  };
}

function parseCustomAttributes(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function recordStatusChange(bookId: number, fromStatus: string | null, toStatus: string): void {
  getDb()
    .insert(statusHistory)
    .values({
      book_id: bookId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_at: now(),
    })
    .run();
}

function syncBookTags(bookId: number, tagIds: number[] | undefined): void {
  const db = getDb();
  db.delete(bookTags).where(eq(bookTags.book_id, bookId)).run();

  if (!tagIds || tagIds.length === 0) {
    return;
  }

  const timestamp = now();
  db.insert(bookTags)
    .values(tagIds.map((tagId) => ({ book_id: bookId, tag_id: tagId, created_at: timestamp })))
    .run();
}

function serializeBooks(rows: RawBookRow[], ownerId: number) {
  if (rows.length === 0) {
    return [];
  }

  const db = getDb();
  const bookIds = rows.map((row) => row.id);
  const allCategoryIds = [
    ...new Set(rows.map((row) => row.category_id).filter((v): v is number => v != null)),
    ...new Set(rows.map((row) => row.genre_category_id).filter((v): v is number => v != null)),
  ];

  const categoryMap = new Map<number, { name: string; type: string }>();
  if (allCategoryIds.length > 0) {
    const categoryRows = db
      .select({ id: categories.id, name: categories.name, type: categories.type })
      .from(categories)
      .where(and(eq(categories.owner_id, ownerId), inArray(categories.id, allCategoryIds)))
      .all();

    for (const categoryRow of categoryRows) {
      categoryMap.set(categoryRow.id, { name: categoryRow.name, type: categoryRow.type });
    }
  }

  const tagMap = new Map<number, { tag_ids: number[]; tag_names: string[] }>();
  const tagRows = db
    .select({
      book_id: bookTags.book_id,
      tag_id: tags.id,
      tag_name: tags.name,
    })
    .from(bookTags)
    .innerJoin(tags, eq(bookTags.tag_id, tags.id))
    .where(inArray(bookTags.book_id, bookIds))
    .all();

  for (const tagRow of tagRows) {
    const existing = tagMap.get(tagRow.book_id) ?? { tag_ids: [], tag_names: [] };
    existing.tag_ids.push(tagRow.tag_id);
    existing.tag_names.push(tagRow.tag_name);
    tagMap.set(tagRow.book_id, existing);
  }

  const fileMap = new Map<number, boolean>();
  const fileRows = db
    .select({ book_id: bookFiles.book_id })
    .from(bookFiles)
    .where(inArray(bookFiles.book_id, bookIds))
    .all();
  for (const f of fileRows) {
    if (f.book_id != null) fileMap.set(f.book_id, true);
  }

  return rows.map((row) => {
    const tagMeta = tagMap.get(row.id) ?? { tag_ids: [], tag_names: [] };
    const personalCategory = row.category_id ? categoryMap.get(row.category_id) : null;
    const genreCategory = row.genre_category_id ? categoryMap.get(row.genre_category_id) : null;

    return {
      ...row,
      custom_attributes: parseCustomAttributes(row.custom_attributes),
      category_name: personalCategory?.name ?? null,
      genre_category_name: genreCategory?.name ?? null,
      tag_ids: tagMeta.tag_ids,
      tag_names: tagMeta.tag_names,
      has_files: fileMap.get(row.id) ?? false,
    };
  });
}

function buildBookListQuery(input: BookQueryInput, ownerId: number) {
  const db = getDb();
  const conditions: ReturnType<typeof and>[] = [eq(books.owner_id, ownerId)];
  const page = input.page ?? 1;
  const pageSize = input.page_size ?? 20;

  if (input.in_trash) {
    conditions.push(sql`${books.deleted_at} IS NOT NULL`);
  } else {
    conditions.push(sql`${books.deleted_at} IS NULL`);
  }

  if (input.q) {
    conditions.push(
      sql`${books.id} IN (SELECT rowid FROM books_fts WHERE books_fts MATCH ${input.q})`,
    );
  }

  if (input.status) {
    const statuses = input.status
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean);

    if (statuses.length > 0) {
      conditions.push(inArray(books.status, statuses));
    }
  }

  if (input.category_id != null) {
    conditions.push(eq(books.category_id, input.category_id));
  }

  if (input.tag_id) {
    const tagIds = input.tag_id
      .split(',')
      .map((tagId) => Number(tagId))
      .filter((tagId) => !Number.isNaN(tagId));

    if (tagIds.length > 0) {
      conditions.push(
        sql`${books.id} IN (SELECT book_id FROM book_tags WHERE tag_id IN (${sql.join(tagIds, sql`, `)}))`,
      );
    }
  }

  if (input.visibility) {
    conditions.push(eq(books.visibility, input.visibility));
  }

  if (input.favorited) {
    conditions.push(sql`${books.favorited_at} IS NOT NULL`);
  }

  if (input.genre_category_id != null) {
    conditions.push(eq(books.genre_category_id, input.genre_category_id));
  }

  if (input.has_files === true) {
    conditions.push(
      sql`${books.id} IN (SELECT book_id FROM book_files WHERE book_id IS NOT NULL)`,
    );
  } else if (input.has_files === false) {
    conditions.push(
      notExists(
        db.select({ one: sql`1` }).from(bookFiles).where(eq(bookFiles.book_id, books.id)).limit(1),
      ),
    );
  }

  const where = and(...conditions);
  const total = db
    .select({ value: count() })
    .from(books)
    .where(where)
    .get()?.value ?? 0;

  let orderBy: ReturnType<typeof desc> | ReturnType<typeof asc> | undefined;
  if (input.sort) {
    const descending = input.sort.startsWith('-');
    const field = descending ? input.sort.slice(1) : input.sort;

    if (field === 'updated_at') {
      orderBy = descending ? desc(books.updated_at) : asc(books.updated_at);
    } else if (field === 'created_at') {
      orderBy = descending ? desc(books.created_at) : asc(books.created_at);
    } else if (field === 'title') {
      orderBy = descending ? desc(books.title) : asc(books.title);
    } else if (field === 'author') {
      orderBy = descending ? desc(books.author) : asc(books.author);
    } else if (field === 'rating') {
      orderBy = descending ? desc(books.rating) : asc(books.rating);
    } else if (field === 'publish_year') {
      orderBy = descending ? desc(books.publish_year) : asc(books.publish_year);
    }
  }

  if (!orderBy) {
    orderBy = desc(books.updated_at);
  }

  const offset = (page - 1) * pageSize;
  const rows = db
    .select(bookSelect())
    .from(books)
    .where(where)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset)
    .all();

  return { rows, total, page, pageSize };
}

export async function bookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/books', async (req) => {
    const userId = requireUserId(req);
    const timestamp = now();
    const db = getDb();

    const contentType = req.headers['content-type'] ?? '';

    let input;
    let uploadedFile: { filepath: string; filename: string } | null = null;

    if (contentType.includes('multipart/form-data')) {
      const data = await req.file();
      if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供数据');

      const fieldVal = (key: string): string | undefined => {
        const v = data.fields[key];
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object' && 'value' in v) return v.value as string;
        if (Array.isArray(v) && v.length > 0) {
          const first = v[0];
          if (typeof first === 'string') return first;
          if (first && typeof first === 'object' && 'value' in first) return first.value as string;
        }
        return undefined;
      };

      input = validate(createBookSchema, {
        title: fieldVal('title') ?? '',
        author: fieldVal('author') ?? null,
        subtitle: fieldVal('subtitle') ?? null,
        isbn: fieldVal('isbn') ?? null,
        publisher: fieldVal('publisher') ?? null,
        publish_year: fieldVal('publish_year') ? Number(fieldVal('publish_year')) : null,
        description: fieldVal('description') ?? null,
        language: fieldVal('language') ?? null,
        category_id: fieldVal('category_id') ? Number(fieldVal('category_id')) : null,
        genre_category_id: fieldVal('genre_category_id') ? Number(fieldVal('genre_category_id')) : null,
        status: fieldVal('status') ?? undefined,
        visibility: fieldVal('visibility') ?? undefined,
        reading_purpose: fieldVal('reading_purpose') ?? null,
        rating: fieldVal('rating') ? Number(fieldVal('rating')) : null,
        tag_ids: fieldVal('tag_ids') ? JSON.parse(fieldVal('tag_ids')!) : undefined,
        custom_attributes: fieldVal('custom_attributes') ? JSON.parse(fieldVal('custom_attributes')!) : null,
        metadata_source: fieldVal('metadata_source') ?? undefined,
        source_url: fieldVal('source_url') ?? null,
        translator: fieldVal('translator') ?? null,
        original_title: fieldVal('original_title') ?? null,
        page_count: fieldVal('page_count') ? Number(fieldVal('page_count')) : null,
      });

      if (data.file && data.filename) {
        const ext = extname(data.filename).toLowerCase();
        if (EXTENSION_FORMAT[ext]) {
          const tmpDir = join(config.storageDir, 'tmp');
          if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
          const tmpPath = join(tmpDir, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
          await pipeline(data.file, createWriteStream(tmpPath));
          uploadedFile = { filepath: tmpPath, filename: data.filename };
        }
      }
    } else {
      input = validate(createBookSchema, req.body);
    }

    const book = db
      .insert(books)
      .values({
        owner_id: userId,
        title: input.title,
        author: input.author ?? null,
        subtitle: input.subtitle ?? null,
        isbn: input.isbn ?? null,
        publisher: input.publisher ?? null,
        publish_year: input.publish_year ?? null,
        description: input.description ?? null,
        language: input.language ?? null,
        category_id: input.category_id ?? null,
        genre_category_id: input.genre_category_id ?? null,
        status: input.status ?? 'COLLECTED',
        visibility: input.visibility ?? 'PRIVATE',
        reading_purpose: input.reading_purpose ?? null,
        rating: input.rating ?? null,
        custom_attributes: input.custom_attributes ? JSON.stringify(input.custom_attributes) : null,
        metadata_source: input.metadata_source ?? 'manual',
        source_url: input.source_url ?? null,
        translator: input.translator ?? null,
        original_title: input.original_title ?? null,
        page_count: input.page_count ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning(bookSelect())
      .get();

    syncBookTags(book.id, input.tag_ids);
    recordStatusChange(book.id, null, book.status);

    if (uploadedFile) {
      await saveUploadedFile(book.id, uploadedFile.filename, uploadedFile.filepath, true);
    }

    return { data: serializeBooks([book], userId)[0] };
  });

  app.get('/books', async (req) => {
    const userId = requireUserId(req);
    const input = validate(bookQuerySchema, req.query);
    const { rows, total, page, pageSize } = buildBookListQuery(input, userId);

    return {
      data: serializeBooks(rows, userId),
      pagination: {
        page,
        page_size: pageSize,
        total,
      },
    };
  });

  app.get('/books/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const book = getDb()
      .select(bookSelect())
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!book) {
      throw notFound('书籍不存在');
    }

    return { data: serializeBooks([book], userId)[0] };
  });

  app.patch('/books/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const input = validate(updateBookSchema, req.body);
    const db = getDb();
    const existing = db
      .select({
        id: books.id,
        status: books.status,
        started_at: books.started_at,
        finished_at: books.finished_at,
      })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!existing) {
      throw notFound('书籍不存在');
    }

    const updateData: Record<string, unknown> = { updated_at: now() };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.author !== undefined) updateData.author = input.author;
    if (input.subtitle !== undefined) updateData.subtitle = input.subtitle;
    if (input.isbn !== undefined) updateData.isbn = input.isbn;
    if (input.publisher !== undefined) updateData.publisher = input.publisher;
    if (input.publish_year !== undefined) updateData.publish_year = input.publish_year;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.language !== undefined) updateData.language = input.language;
    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.genre_category_id !== undefined) updateData.genre_category_id = input.genre_category_id;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.reading_purpose !== undefined) updateData.reading_purpose = input.reading_purpose;
    if (input.rating !== undefined) updateData.rating = input.rating;
    if (input.metadata_source !== undefined) updateData.metadata_source = input.metadata_source;
    if (input.source_url !== undefined) updateData.source_url = input.source_url;
    if (input.translator !== undefined) updateData.translator = input.translator;
    if (input.original_title !== undefined) updateData.original_title = input.original_title;
    if (input.page_count !== undefined) updateData.page_count = input.page_count;
    if (input.custom_attributes !== undefined) {
      updateData.custom_attributes = input.custom_attributes ? JSON.stringify(input.custom_attributes) : null;
    }

    // Manual time overrides
    if (input.started_at !== undefined) updateData.started_at = input.started_at;
    if (input.finished_at !== undefined) updateData.finished_at = input.finished_at;

    // Auto-fill started_at when status → READING and started_at is empty
    if (input.status !== undefined && input.status !== existing.status) {
      updateData.status = input.status;
      recordStatusChange(bookId, existing.status, input.status);

      if (input.status === 'READING' && !existing.started_at && input.started_at === undefined) {
        updateData.started_at = now();
      }
      if (input.status === 'READ' && !existing.finished_at && input.finished_at === undefined) {
        updateData.finished_at = now();
      }
    }

    if (Object.keys(updateData).length > 1) {
      db.update(books).set(updateData).where(eq(books.id, bookId)).run();
    }

    if (input.tag_ids !== undefined) {
      syncBookTags(bookId, input.tag_ids);
    }

    const updated = db.select(bookSelect()).from(books).where(eq(books.id, bookId)).get();
    if (!updated) {
      throw notFound('书籍不存在');
    }

    return { data: serializeBooks([updated], userId)[0] };
  });

  app.delete('/books/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();
    const existing = db
      .select({ id: books.id, status: books.status })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!existing) {
      throw notFound('书籍不存在');
    }

    if (existing.status === 'STORED') {
      throw new AppError(ERROR_CODE.BUSINESS_ERROR, '存档状态的书籍不能移入回收站，请先变更状态。');
    }

    db.update(books)
      .set({
        deleted_at: now(),
        updated_at: now(),
      })
      .where(eq(books.id, bookId))
      .run();

    return { data: { id: bookId, deleted: true } };
  });

  app.post('/books/batch', async (req) => {
    const userId = requireUserId(req);
    const input = validate(batchBooksSchema, req.body);
    const db = getDb();
    const timestamp = now();

    const ownedBooks = db
      .select({ id: books.id, status: books.status })
      .from(books)
      .where(and(eq(books.owner_id, userId), inArray(books.id, input.ids)))
      .all();

    if (ownedBooks.length === 0) {
      throw notFound('未找到可操作的书籍');
    }

    const ownedIds = ownedBooks.map((b) => b.id);

    switch (input.action) {
      case 'set_status': {
        const newStatus = input.params?.status as string | undefined;
        if (!newStatus) {
          throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 status 参数');
        }
        db.update(books)
          .set({ status: newStatus, updated_at: timestamp })
          .where(and(eq(books.owner_id, userId), inArray(books.id, ownedIds)))
          .run();

        for (const book of ownedBooks) {
          if (book.status !== newStatus) {
            recordStatusChange(book.id, book.status, newStatus);
          }
        }
        break;
      }
      case 'set_category': {
        const categoryId = input.params?.category_id as number | null | undefined;
        if (categoryId === undefined) {
          throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 category_id 参数');
        }
        db.update(books)
          .set({ category_id: categoryId, updated_at: timestamp })
          .where(and(eq(books.owner_id, userId), inArray(books.id, ownedIds)))
          .run();
        break;
      }
      case 'set_genre_category': {
        const genreCategoryId = input.params?.genre_category_id as number | null | undefined;
        if (genreCategoryId === undefined) {
          throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 genre_category_id 参数');
        }
        db.update(books)
          .set({ genre_category_id: genreCategoryId, updated_at: timestamp })
          .where(and(eq(books.owner_id, userId), inArray(books.id, ownedIds)))
          .run();
        break;
      }
      case 'set_tags': {
        const tagIds = input.params?.tag_ids as number[] | undefined;
        if (!tagIds) {
          throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 tag_ids 参数');
        }
        for (const bookId of ownedIds) {
          syncBookTags(bookId, tagIds);
        }
        db.update(books)
          .set({ updated_at: timestamp })
          .where(and(eq(books.owner_id, userId), inArray(books.id, ownedIds)))
          .run();
        break;
      }
      case 'set_visibility': {
        const visibility = input.params?.visibility as string | undefined;
        if (!visibility) {
          throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 visibility 参数');
        }
        db.update(books)
          .set({ visibility, updated_at: timestamp })
          .where(and(eq(books.owner_id, userId), inArray(books.id, ownedIds)))
          .run();
        break;
      }
      case 'set_favorited': {
        const favorited = input.params?.favorited as boolean | undefined;
        if (favorited === undefined) {
          throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 favorited 参数');
        }
        db.update(books)
          .set({ favorited_at: favorited ? timestamp : null, updated_at: timestamp })
          .where(and(eq(books.owner_id, userId), inArray(books.id, ownedIds)))
          .run();
        break;
      }
      case 'delete': {
        const deletable = ownedBooks.filter((b) => b.status !== 'STORED');
        if (deletable.length === 0) {
          throw businessError('所选书籍均为存档状态，不能移入回收站。');
        }
        const deletableIds = deletable.map((b) => b.id);
        db.update(books)
          .set({ deleted_at: timestamp, updated_at: timestamp })
          .where(and(eq(books.owner_id, userId), inArray(books.id, deletableIds)))
          .run();
        break;
      }
    }

    return { data: { affected: ownedIds.length } };
  });

  app.get('/books/:id/status-history', async (req) => {
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

    const history = db
      .select({
        id: statusHistory.id,
        from_status: statusHistory.from_status,
        to_status: statusHistory.to_status,
        changed_at: statusHistory.changed_at,
      })
      .from(statusHistory)
      .where(eq(statusHistory.book_id, bookId))
      .orderBy(desc(statusHistory.changed_at))
      .all();

    return { data: history };
  });

  app.post('/books/:id/favorite', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();
    const existing = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!existing) {
      throw notFound('书籍不存在');
    }

    db.update(books)
      .set({ favorited_at: now(), updated_at: now() })
      .where(eq(books.id, bookId))
      .run();

    const updated = db.select(bookSelect()).from(books).where(eq(books.id, bookId)).get();
    return { data: serializeBooks([updated!], userId)[0] };
  });

  app.delete('/books/:id/favorite', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();
    const existing = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!existing) {
      throw notFound('书籍不存在');
    }

    db.update(books)
      .set({ favorited_at: null, updated_at: now() })
      .where(eq(books.id, bookId))
      .run();

    const updated = db.select(bookSelect()).from(books).where(eq(books.id, bookId)).get();
    return { data: serializeBooks([updated!], userId)[0] };
  });
  app.get('/books/duplicates', async (req) => {
    const userId = requireUserId(req);
    const input = validate(duplicateQuerySchema, req.query) as DuplicateQueryInput;
    const threshold = input.threshold ?? 0.6;
    const db = getDb();

    const allBooks = db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
      })
      .from(books)
      .where(and(eq(books.owner_id, userId), sql`${books.deleted_at} IS NULL`))
      .all();

    if (allBooks.length < 2) {
      return { data: [] };
    }

    const results: { book_id: number; duplicates: number[]; score: number }[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < allBooks.length; i++) {
      const bookA = allBooks[i];
      if (processed.has(bookA.id)) continue;

      const duplicates: number[] = [];

      for (let j = i + 1; j < allBooks.length; j++) {
        const bookB = allBooks[j];
        if (processed.has(bookB.id)) continue;

        const titleA = bookA.title.toLowerCase().replace(/\s+/g, '');
        const titleB = bookB.title.toLowerCase().replace(/\s+/g, '');
        const authorA = (bookA.author ?? '').toLowerCase().replace(/\s+/g, '');
        const authorB = (bookB.author ?? '').toLowerCase().replace(/\s+/g, '');

        let titleScore = 0;
        if (titleA === titleB) {
          titleScore = 1;
        } else if (titleA.includes(titleB) || titleB.includes(titleA)) {
          titleScore = 0.85;
        } else {
          const common = longestCommonSubstring(titleA, titleB);
          const maxLen = Math.max(titleA.length, titleB.length);
          titleScore = maxLen > 0 ? common / maxLen : 0;
        }

        let authorScore = 0;
        if (authorA === authorB) {
          authorScore = 1;
        } else if (authorA.includes(authorB) || authorB.includes(authorA)) {
          authorScore = 0.85;
        } else {
          const common = longestCommonSubstring(authorA, authorB);
          const maxLen = Math.max(authorA.length, authorB.length);
          authorScore = maxLen > 0 ? common / maxLen : 0;
        }

        const score = titleScore * 0.7 + authorScore * 0.3;

        if (score >= threshold) {
          duplicates.push(bookB.id);
          processed.add(bookB.id);
        }
      }

      if (duplicates.length > 0) {
        results.push({
          book_id: bookA.id,
          duplicates,
          score: Math.round(Math.min(1, 0.7 + duplicates.length * 0.1) * 100) / 100,
        });
        processed.add(bookA.id);
      }
    }

    return { data: results };
  });

  app.get('/trash', async (req) => {
    const userId = requireUserId(req);
    const input = validate(trashQuerySchema, req.query) as TrashQueryInput;
    const db = getDb();
    const page = input.page ?? 1;
    const pageSize = input.page_size ?? 20;

    const conditions: ReturnType<typeof and>[] = [
      eq(books.owner_id, userId),
      sql`${books.deleted_at} IS NOT NULL`,
    ];

    if (input.q) {
      conditions.push(
        sql`${books.id} IN (SELECT rowid FROM books_fts WHERE books_fts MATCH ${input.q})`,
      );
    }

    const where = and(...conditions);
    const total = db.select({ value: count() }).from(books).where(where).get()?.value ?? 0;

    let orderBy = desc(books.deleted_at);
    if (input.sort) {
      const descending = input.sort.startsWith('-');
      const field = descending ? input.sort.slice(1) : input.sort;
      if (field === 'updated_at') {
        orderBy = descending ? desc(books.updated_at) : asc(books.updated_at);
      } else if (field === 'title') {
        orderBy = descending ? desc(books.title) : asc(books.title);
      }
    }

    const offset = (page - 1) * pageSize;
    const rows = db
      .select(bookSelect())
      .from(books)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset)
      .all();

    return {
      data: serializeBooks(rows, userId),
      pagination: { page, page_size: pageSize, total },
    };
  });

  app.post('/trash/:bookId/restore', async (req) => {
    const userId = requireUserId(req);
    const { bookId: bookIdStr } = req.params as { bookId: string };
    const bookId = Number(bookIdStr);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();
    const book = db
      .select({ id: books.id, deleted_at: books.deleted_at })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!book) {
      throw notFound('书籍不存在');
    }

    if (!book.deleted_at) {
      throw businessError('该书籍不在回收站中');
    }

    db.update(books)
      .set({ deleted_at: null, updated_at: now() })
      .where(eq(books.id, bookId))
      .run();

    return { data: { id: bookId, restored: true } };
  });

  app.delete('/trash/:bookId', async (req) => {
    const userId = requireUserId(req);
    const { bookId: bookIdStr } = req.params as { bookId: string };
    const bookId = Number(bookIdStr);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();
    const book = db
      .select({ id: books.id, deleted_at: books.deleted_at })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!book) {
      throw notFound('书籍不存在');
    }

    if (!book.deleted_at) {
      throw businessError('只能彻底删除回收站中的书籍');
    }

    db.delete(bookTags).where(eq(bookTags.book_id, bookId)).run();
    db.delete(bookRelations).where(
      or(eq(bookRelations.source_book_id, bookId), eq(bookRelations.target_book_id, bookId)),
    ).run();
    db.delete(statusHistory).where(eq(statusHistory.book_id, bookId)).run();
    db.delete(books).where(eq(books.id, bookId)).run();

    return { data: { id: bookId, deleted: true } };
  });

  app.delete('/trash', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();

    const trashedBooks = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.owner_id, userId), sql`${books.deleted_at} IS NOT NULL`))
      .all();

    if (trashedBooks.length === 0) {
      return { data: { affected: 0 } };
    }

    const trashedIds = trashedBooks.map((b) => b.id);

    db.delete(bookTags).where(inArray(bookTags.book_id, trashedIds)).run();
    db.delete(bookRelations).where(
      or(
        inArray(bookRelations.source_book_id, trashedIds),
        inArray(bookRelations.target_book_id, trashedIds),
      ),
    ).run();
    db.delete(statusHistory).where(inArray(statusHistory.book_id, trashedIds)).run();
    db.delete(books).where(and(eq(books.owner_id, userId), inArray(books.id, trashedIds))).run();

    return { data: { affected: trashedBooks.length } };
  });
}
