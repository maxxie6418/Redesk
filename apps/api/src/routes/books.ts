import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, asc, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { bookTags, books, categories, statusHistory, tags, users } from '@redesk/db';
import { ERROR_CODE, bookQuerySchema, createBookSchema, updateBookSchema } from '@redesk/shared';
import type { BookQueryInput } from '@redesk/shared';
import { config } from '../config';
import { getDb } from '../db';
import { AppError, notFound, unauthorized } from '../lib/errors';
import { getSessionUserId } from '../lib/session';
import { validate } from '../lib/zod';

interface RawBookRow {
  id: number;
  owner_id: number;
  category_id: number | null;
  title: string;
  author: string;
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
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function requireUserId(req: FastifyRequest): number {
  const userId = getSessionUserId(req);
  if (!userId) {
    if (config.isDev && config.devAuthDisabled) {
      const localUser = getDb()
        .select({ id: users.id })
        .from(users)
        .orderBy(users.id)
        .limit(1)
        .get();

      if (localUser) {
        return localUser.id;
      }
    }

    throw unauthorized();
  }
  return userId;
}

function now(): string {
  return new Date().toISOString();
}

function bookSelect() {
  return {
    id: books.id,
    owner_id: books.owner_id,
    category_id: books.category_id,
    title: books.title,
    author: books.author,
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
  const categoryIds = [...new Set(rows.map((row) => row.category_id).filter((value): value is number => value != null))];

  const categoryMap = new Map<number, string>();
  if (categoryIds.length > 0) {
    const categoryRows = db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.owner_id, ownerId), inArray(categories.id, categoryIds)))
      .all();

    for (const categoryRow of categoryRows) {
      categoryMap.set(categoryRow.id, categoryRow.name);
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

  return rows.map((row) => {
    const tagMeta = tagMap.get(row.id) ?? { tag_ids: [], tag_names: [] };

    return {
      ...row,
      custom_attributes: parseCustomAttributes(row.custom_attributes),
      category_name: row.category_id ? (categoryMap.get(row.category_id) ?? null) : null,
      tag_ids: tagMeta.tag_ids,
      tag_names: tagMeta.tag_names,
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
    const q = `%${input.q}%`;
    conditions.push(or(like(books.title, q), like(books.author, q), like(books.isbn, q))!);
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
    const input = validate(createBookSchema, req.body);
    const timestamp = now();
    const db = getDb();

    const book = db
      .insert(books)
      .values({
        owner_id: userId,
        title: input.title,
        author: input.author,
        isbn: input.isbn ?? null,
        publisher: input.publisher ?? null,
        publish_year: input.publish_year ?? null,
        description: input.description ?? null,
        language: input.language ?? null,
        category_id: input.category_id ?? null,
        status: input.status ?? 'COLLECTED',
        visibility: input.visibility ?? 'PRIVATE',
        reading_purpose: input.reading_purpose ?? null,
        rating: input.rating ?? null,
        custom_attributes: input.custom_attributes ? JSON.stringify(input.custom_attributes) : null,
        metadata_source: input.metadata_source ?? 'manual',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning(bookSelect())
      .get();

    syncBookTags(book.id, input.tag_ids);
    recordStatusChange(book.id, null, book.status);

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
      .select({ id: books.id, status: books.status })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!existing) {
      throw notFound('书籍不存在');
    }

    const updateData: Record<string, unknown> = { updated_at: now() };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.author !== undefined) updateData.author = input.author;
    if (input.isbn !== undefined) updateData.isbn = input.isbn;
    if (input.publisher !== undefined) updateData.publisher = input.publisher;
    if (input.publish_year !== undefined) updateData.publish_year = input.publish_year;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.language !== undefined) updateData.language = input.language;
    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.reading_purpose !== undefined) updateData.reading_purpose = input.reading_purpose;
    if (input.rating !== undefined) updateData.rating = input.rating;
    if (input.metadata_source !== undefined) updateData.metadata_source = input.metadata_source;
    if (input.custom_attributes !== undefined) {
      updateData.custom_attributes = input.custom_attributes ? JSON.stringify(input.custom_attributes) : null;
    }

    if (input.status !== undefined && input.status !== existing.status) {
      updateData.status = input.status;
      recordStatusChange(bookId, existing.status, input.status);
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
}
