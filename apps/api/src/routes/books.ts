import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { and, asc, count, desc, eq, exists, inArray, notExists, or, sql } from 'drizzle-orm';
import { bookCovers, bookFiles, bookRelations, bookTags, books, categories, statusHistory, tags, highlights, notes, bookmarks, readingProgress, type StorageMode } from '@redesk/db';
import {
  ERROR_CODE,
  READABLE_FILE_FORMATS,
  isReadableFileFormat,
  bookQuerySchema,
  createBookSchema,
  updateBookSchema,
  batchBooksSchema,
  trashQuerySchema,
  duplicateQuerySchema,
  metadataApplySchema,
  batchPreviewSchema,
  batchApplySchema,
  maintenanceListSchema,
} from '@redesk/shared';
import type { BookQueryInput, CreateBookInput, TrashQueryInput, DuplicateQueryInput, MaintenanceListInput } from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound, businessError } from '../lib/errors';
import { requireUserId, getOptionalUserId, requirePermission } from '../lib/auth';
import { validate } from '../lib/zod';
import { extname } from 'node:path';
import { fetchBookMetadataFromUrl } from '../lib/book-metadata';
import { deleteFilesForBooks, saveUploadedFile, EXTENSION_FORMAT, downloadRemoteCover } from './files';
import { serializeBookRow, type RawBookRow } from './book-serialization';
import { readStorageSetting } from '../lib/storage-factory';

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
    entry_reason: books.entry_reason,
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
    import_order: books.import_order,
    deleted_at: books.deleted_at,
    created_at: books.created_at,
    updated_at: books.updated_at,
  };
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

function normalizeTagIds(tagIds: number[] | undefined): number[] {
  return [...new Set((tagIds ?? []).filter((tagId) => Number.isInteger(tagId)))];
}

function validateCategoryOwnership(ownerId: number, categoryId: number | null | undefined, expectedType: 'PERSONAL' | 'GENRE'): number | null {
  if (categoryId == null) return null;
  const category = getDb()
    .select({ id: categories.id, type: categories.type })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.owner_id, ownerId)))
    .get();

  if (!category) {
    throw businessError('分类不存在或无权限访问');
  }
  if (category.type !== expectedType) {
    throw businessError(expectedType === 'PERSONAL' ? '个人分类类型不正确' : '常规分类类型不正确');
  }
  return category.id;
}

function validateTagOwnership(ownerId: number, tagIds: number[] | undefined): number[] {
  const normalized = normalizeTagIds(tagIds);
  if (normalized.length === 0) return [];

  const rows = getDb()
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.owner_id, ownerId), inArray(tags.id, normalized)))
    .all();

  if (rows.length !== normalized.length) {
    throw businessError('标签不存在或无权限访问');
  }
  return normalized;
}

async function createBookRecord(userId: number, input: CreateBookInput, uploadedFile?: { stream: NodeJS.ReadableStream; filename: string } | null, uploadMode?: StorageMode) {
  const db = getDb();
  const timestamp = now();
  const categoryId = validateCategoryOwnership(userId, input.category_id, 'PERSONAL');
  const genreCategoryId = validateCategoryOwnership(userId, input.genre_category_id, 'GENRE');
  const tagIds = validateTagOwnership(userId, input.tag_ids);

  const maxOrderResult = db
    .select({ max_order: sql<number>`COALESCE(MAX(${books.import_order}), 0)` })
    .from(books)
    .where(eq(books.owner_id, userId))
    .get();
  const nextImportOrder = (maxOrderResult?.max_order ?? 0) + 1;

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
      category_id: categoryId,
      genre_category_id: genreCategoryId,
      status: input.status ?? 'COLLECTED',
      visibility: input.visibility ?? 'PRIVATE',
      reading_purpose: input.reading_purpose ?? null,
      entry_reason: input.entry_reason ?? null,
      rating: input.rating ?? null,
      custom_attributes: input.custom_attributes ? JSON.stringify(input.custom_attributes) : null,
      metadata_source: input.metadata_source ?? 'manual',
      source_url: input.source_url ?? null,
      translator: input.translator ?? null,
      original_title: input.original_title ?? null,
      page_count: input.page_count ?? null,
      import_order: nextImportOrder,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .returning(bookSelect())
    .get();

  syncBookTags(book.id, tagIds);
  recordStatusChange(book.id, null, book.status);

  if (uploadedFile) {
    await saveUploadedFile(userId, book.id, uploadedFile.filename, uploadedFile.stream, true, uploadMode);
  }

  if (input.cover_url) {
    try {
      const shouldActivateCover = !hasActiveBookCover(book.id);
      await downloadRemoteCover({
        ownerId: userId,
        bookId: book.id,
        coverUrl: input.cover_url,
        sourceLabel: input.metadata_source ?? 'manual',
        activate: shouldActivateCover,
      });
    } catch { /* 封面下载失败不影响书籍创建 */ }
  }

  return book;
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

function hasActiveBookCover(bookId: number): boolean {
  const activeCover = getDb()
    .select({ id: bookCovers.id })
    .from(bookCovers)
    .where(and(eq(bookCovers.book_id, bookId), eq(bookCovers.is_active, 1)))
    .get();

  return Boolean(activeCover);
}

function serializeBooks(rows: RawBookRow[], userId?: number) {
  if (rows.length === 0) {
    return [];
  }

  const db = getDb();
  const bookIds = rows.map((row) => row.id);

  // 未登录用户不返回分类、标签等私有信息
  const categoryMap = new Map<number, { name: string; type: string }>();
  const tagMap = new Map<number, { tag_ids: number[]; tag_names: string[] }>();

  if (userId) {
    const allCategoryIds = [
      ...new Set(rows.map((row) => row.category_id).filter((v): v is number => v != null)),
      ...new Set(rows.map((row) => row.genre_category_id).filter((v): v is number => v != null)),
    ];

    if (allCategoryIds.length > 0) {
      const categoryRows = db
        .select({ id: categories.id, name: categories.name, type: categories.type })
        .from(categories)
        .where(and(eq(categories.owner_id, userId), inArray(categories.id, allCategoryIds)))
        .all();

      for (const categoryRow of categoryRows) {
        categoryMap.set(categoryRow.id, { name: categoryRow.name, type: categoryRow.type });
      }
    }

    const tagRows = db
      .select({
        book_id: bookTags.book_id,
        tag_id: tags.id,
        tag_name: tags.name,
      })
      .from(bookTags)
      .innerJoin(tags, eq(bookTags.tag_id, tags.id))
      .where(and(inArray(bookTags.book_id, bookIds), eq(tags.owner_id, userId)))
      .all();

    for (const tagRow of tagRows) {
      const existing = tagMap.get(tagRow.book_id) ?? { tag_ids: [], tag_names: [] };
      existing.tag_ids.push(tagRow.tag_id);
      existing.tag_names.push(tagRow.tag_name);
      tagMap.set(tagRow.book_id, existing);
    }
  }

  // 未登录用户不返回文件相关信息
  const fileMap = new Map<number, boolean>();
  const readableFileMap = new Map<number, boolean>();

  if (userId) {
    const fileRows = db
      .select({ book_id: bookFiles.book_id, is_primary: bookFiles.is_primary, file_format: bookFiles.file_format })
      .from(bookFiles)
      .where(inArray(bookFiles.book_id, bookIds))
      .all();
    for (const f of fileRows) {
      if (f.book_id != null) {
        fileMap.set(f.book_id, true);
        if (f.is_primary === 1 && isReadableFileFormat(f.file_format)) {
          readableFileMap.set(f.book_id, true);
        }
      }
    }
  }

  return rows.map((row) =>
    serializeBookRow(row, {
      personalCategory: row.category_id ? categoryMap.get(row.category_id) : null,
      genreCategory: row.genre_category_id ? categoryMap.get(row.genre_category_id) : null,
      tags: tagMap.get(row.id),
      hasFiles: fileMap.get(row.id) ?? false,
      hasReadableFile: readableFileMap.get(row.id) ?? false,
    }),
  );
}

function buildSearchCondition(q: string) {
  const trimmed = q.trim();
  if (!trimmed) return undefined;

  const escapedLike = trimmed.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const likePattern = `%${escapedLike}%`;

  const escapedFts = trimmed.replace(/"/g, '""');
  const ftsQuery = `"${escapedFts}"`;

  return or(
    sql`${books.id} IN (SELECT rowid FROM books_fts WHERE books_fts MATCH ${ftsQuery})`,
    sql`${books.title} LIKE ${likePattern} ESCAPE '\\'`,
    sql`${books.author} LIKE ${likePattern} ESCAPE '\\'`,
    sql`${books.isbn} LIKE ${likePattern} ESCAPE '\\'`,
  );
}

function buildBookListQuery(input: BookQueryInput, userId?: number) {
  const db = getDb();
  const conditions: ReturnType<typeof and>[] = [];

  // 未登录用户：只返回公开书籍；已登录用户：返回自己的书籍 + 公开书籍
  if (userId) {
    conditions.push(or(eq(books.owner_id, userId), eq(books.visibility, 'PUBLIC')));
  } else {
    conditions.push(eq(books.visibility, 'PUBLIC'));
  }

  const page = input.page ?? 1;
  const pageSize = input.page_size ?? 20;

  if (input.in_trash) {
    conditions.push(sql`${books.deleted_at} IS NOT NULL`);
  } else {
    conditions.push(sql`${books.deleted_at} IS NULL`);
  }

  if (input.q) {
    const searchCondition = buildSearchCondition(input.q);
    if (searchCondition) {
      conditions.push(searchCondition);
    }
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
      conditions.push(sql`${books.id} IN (
        SELECT book_id
        FROM book_tags
        WHERE tag_id IN (${sql.join(tagIds, sql`, `)})
        GROUP BY book_id
        HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}
      )`);
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

  if (input.has_readable_file === true) {
    conditions.push(
      sql`${books.id} IN (SELECT book_id FROM book_files WHERE book_id IS NOT NULL AND is_primary = 1 AND file_format IN (${sql.join([...READABLE_FILE_FORMATS], sql`, `)}))`,
    );
  } else if (input.has_readable_file === false) {
    conditions.push(
      notExists(
        db
          .select({ one: sql`1` })
          .from(bookFiles)
          .where(and(eq(bookFiles.book_id, books.id), eq(bookFiles.is_primary, 1), inArray(bookFiles.file_format, [...READABLE_FILE_FORMATS])))
          .limit(1),
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
    } else if (field === 'import_order') {
      orderBy = descending ? desc(books.import_order) : asc(books.import_order);
    }
  }

  if (!orderBy) {
    orderBy = asc(books.import_order);
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

const BOOK_IMPORT_HEADERS = [
  'title',
  'subtitle',
  'author',
  'translator',
  'original_title',
  'isbn',
  'publisher',
  'publish_year',
  'page_count',
  'language',
  'status',
  'visibility',
  'rating',
  'reading_purpose',
  'entry_reason',
  'category_name',
  'genre_category_name',
  'tag_names',
  'source_url',
  'description',
] as const;

function csvEscape(value: unknown): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((items) => items.some((item) => item.trim() !== ''));
}

function readCsvFile(data: MultipartFile): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    data.file.on('data', (chunk: Buffer) => chunks.push(chunk));
    data.file.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8').replace(/^\uFEFF/, '')));
    data.file.on('error', reject);
  });
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function optionalText(value: string | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function optionalInt(value: string | undefined, field: string, errors: string[]): number | null {
  const text = value?.trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isInteger(parsed)) {
    errors.push(`${field} 必须是整数`);
    return null;
  }
  return parsed;
}

function normalizeStatus(value: string | undefined, errors: string[]): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  const map: Record<string, string> = {
    COLLECTED: 'COLLECTED',
    PLANNED: 'PLANNED',
    READING: 'READING',
    READ: 'READ',
    STORED: 'STORED',
    收录: 'COLLECTED',
    计划读: 'PLANNED',
    想读: 'PLANNED',
    在读: 'READING',
    已读: 'READ',
    存档: 'STORED',
  };
  const status = map[text.toUpperCase()] ?? map[text];
  if (!status) {
    errors.push('status 只能是 COLLECTED/PLANNED/READING/READ/STORED');
    return undefined;
  }
  return status;
}

function normalizeVisibility(value: string | undefined, errors: string[]): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  const map: Record<string, string> = {
    PUBLIC: 'PUBLIC',
    PRIVATE: 'PRIVATE',
    公开: 'PUBLIC',
    私密: 'PRIVATE',
  };
  const visibility = map[text.toUpperCase()] ?? map[text];
  if (!visibility) {
    errors.push('visibility 只能是 PUBLIC 或 PRIVATE');
    return undefined;
  }
  return visibility;
}

function splitNames(value: string | undefined): string[] {
  return [...new Set((value ?? '')
    .split(/[;；、|/，]/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

function findOrCreateCategory(ownerId: number, name: string, type: 'GENRE' | 'PERSONAL'): number {
  const db = getDb();
  const existing = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.owner_id, ownerId), eq(categories.name, name), eq(categories.type, type)))
    .get();
  if (existing) return existing.id;

  const timestamp = now();
  return db
    .insert(categories)
    .values({ owner_id: ownerId, name, type, parent_id: null, sort_order: 0, created_at: timestamp, updated_at: timestamp })
    .returning({ id: categories.id })
    .get().id;
}

function findOrCreateTag(ownerId: number, name: string): number {
  const db = getDb();
  const existing = db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.owner_id, ownerId), eq(tags.name, name)))
    .get();
  if (existing) return existing.id;

  return db
    .insert(tags)
    .values({ owner_id: ownerId, name, created_at: now() })
    .returning({ id: tags.id })
    .get().id;
}

function hasDuplicateBook(ownerId: number, title: string, author: string | null, isbn: string | null): boolean {
  const db = getDb();
  if (isbn) {
    const existingByIsbn = db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.owner_id, ownerId), eq(books.isbn, isbn), sql`${books.deleted_at} IS NULL`))
      .get();
    if (existingByIsbn) return true;
  }

  const titleKey = normalizeKey(title);
  const authorKey = normalizeKey(author);
  const existing = db
    .select({ title: books.title, author: books.author })
    .from(books)
    .where(and(eq(books.owner_id, ownerId), sql`${books.deleted_at} IS NULL`))
    .all();

  return existing.some((book) => normalizeKey(book.title) === titleKey && normalizeKey(book.author) === authorKey);
}

export async function bookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/books', async (req) => {
    const userId = requirePermission(req, 'use');
    const contentType = req.headers['content-type'] ?? '';

    let input;
    let uploadedFile: { stream: NodeJS.ReadableStream; filename: string } | null = null;

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
        entry_reason: fieldVal('entry_reason') ?? null,
        rating: fieldVal('rating') ? Number(fieldVal('rating')) : null,
        tag_ids: fieldVal('tag_ids') ? JSON.parse(fieldVal('tag_ids')!) : undefined,
        custom_attributes: fieldVal('custom_attributes') ? JSON.parse(fieldVal('custom_attributes')!) : null,
        metadata_source: fieldVal('metadata_source') ?? undefined,
        source_url: fieldVal('source_url') ?? null,
        translator: fieldVal('translator') ?? null,
        original_title: fieldVal('original_title') ?? null,
        page_count: fieldVal('page_count') ? Number(fieldVal('page_count')) : null,
      });

      let uploadMode: StorageMode | undefined;
      if (data.file && data.filename) {
        const ext = extname(data.filename).toLowerCase();
        if (EXTENSION_FORMAT[ext]) {
          uploadedFile = { stream: data.file, filename: data.filename };
        }
        const rawMode = (data.fields.storage_mode as { value?: string } | undefined)?.value;
        if (rawMode === 'cloud_only' || rawMode === 'dual' || rawMode === 'local_only') {
          uploadMode = rawMode;
        }
      }

      const book = await createBookRecord(userId, input, uploadedFile, uploadMode);

      return { data: serializeBooks([book], userId)[0] };
    }

    input = validate(createBookSchema, req.body);

    const book = await createBookRecord(userId, input, uploadedFile);

    return { data: serializeBooks([book], userId)[0] };
  });

  app.get('/books/import/template', async (req, reply) => {
    requirePermission(req, 'use');
    const sample = [
      '如何阅读一本书',
      '经典阅读指南',
      '莫提默 J. 艾德勒 / 查尔斯 范多伦',
      '郝明义 / 朱衣',
      'How to Read a Book',
      '9787100040945',
      '商务印书馆',
      '2004',
      '376',
      'zh',
      'COLLECTED',
      'PRIVATE',
      '5',
      '精读',
      '能力提升',
      '方法论',
      '阅读方法;经典',
      'https://book.douban.com/subject/1013208/',
      '',
      '这是一行示例，导入前可删除。',
    ];
    const csv = [
      BOOK_IMPORT_HEADERS.join(','),
      sample.map(csvEscape).join(','),
    ].join('\n');

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="redesk-books-import-template.csv"');
    return reply.send(`\uFEFF${csv}`);
  });

  app.post('/books/import', async (req) => {
    const userId = requirePermission(req, 'use');
    const dryRun = (req.query as { dry_run?: string | boolean } | undefined)?.dry_run === 'true';
    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供 CSV 文件');

    const content = await readCsvFile(data);
    const rows = parseCsv(content);
    if (rows.length < 2) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'CSV 至少需要表头和一行数据');
    }

    const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ''));
    const headerSet = new Set(headers);
    if (!headerSet.has('title')) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'CSV 表头必须包含 title');
    }

    const importRows: {
      row: number;
      title: string | null;
      success: boolean;
      skipped: boolean;
      book_id: number | null;
      error: string | null;
      raw_data?: Record<string, string | null>;
    }[] = [];
    const seenKeys = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const raw = rows[i];
      const rowNo = i + 1;
      const item: Record<string, string | undefined> = {};
      headers.forEach((header, index) => {
        item[header] = raw[index];
      });
      const rawData: Record<string, string | null> = {};
      for (const h of headers) {
        rawData[h] = item[h] != null ? item[h]! : null;
      }

      const errors: string[] = [];
      const title = optionalText(item.title);
      const author = optionalText(item.author);
      const isbn = optionalText(item.isbn)?.replace(/[^\dXx]/g, '') ?? null;
      if (!title) errors.push('title 不能为空');

      const publishYear = optionalInt(item.publish_year, 'publish_year', errors);
      const pageCount = optionalInt(item.page_count, 'page_count', errors);
      const rating = optionalInt(item.rating, 'rating', errors);
      const status = normalizeStatus(item.status, errors);
      const visibility = normalizeVisibility(item.visibility, errors);

      if (title) {
        const duplicateKey = isbn ? `isbn:${isbn}` : `book:${normalizeKey(title)}:${normalizeKey(author)}`;
        if (seenKeys.has(duplicateKey) || hasDuplicateBook(userId, title, author, isbn)) {
          importRows.push({
            row: rowNo,
            title,
            success: false,
            skipped: true,
            book_id: null,
            error: '已存在相同 ISBN 或书名+作者的书籍',
            raw_data: rawData,
          });
          seenKeys.add(duplicateKey);
          continue;
        }
        seenKeys.add(duplicateKey);
      }

      if (errors.length > 0 || !title) {
        importRows.push({
          row: rowNo,
          title,
          success: false,
          skipped: false,
          book_id: null,
          error: errors.join('；'),
          raw_data: rawData,
        });
        continue;
      }

      try {
        const categoryName = optionalText(item.category_name);
        const genreCategoryName = optionalText(item.genre_category_name);
        const tagNames = splitNames(item.tag_names);
        const input = validate(createBookSchema, {
          title,
          subtitle: optionalText(item.subtitle),
          author,
          translator: optionalText(item.translator),
          original_title: optionalText(item.original_title),
          isbn,
          publisher: optionalText(item.publisher),
          publish_year: publishYear,
          page_count: pageCount,
          language: optionalText(item.language),
          status,
          visibility,
          rating,
          reading_purpose: optionalText(item.reading_purpose),
          entry_reason: optionalText(item.entry_reason),
          category_id: !dryRun && categoryName ? findOrCreateCategory(userId, categoryName, 'PERSONAL') : null,
          genre_category_id: !dryRun && genreCategoryName ? findOrCreateCategory(userId, genreCategoryName, 'GENRE') : null,
          tag_ids: !dryRun && tagNames.length > 0 ? tagNames.map((name) => findOrCreateTag(userId, name)) : undefined,
          source_url: optionalText(item.source_url),
          cover_url: optionalText(item.cover_url),
          description: optionalText(item.description),
          metadata_source: 'manual',
        });

        if (dryRun) {
          importRows.push({ row: rowNo, title, success: true, skipped: false, book_id: null, error: null, raw_data: rawData });
          continue;
        }

        const book = await createBookRecord(userId, input, null);
        importRows.push({ row: rowNo, title, success: true, skipped: false, book_id: book.id, error: null, raw_data: rawData });
      } catch (err) {
        importRows.push({
          row: rowNo,
          title,
          success: false,
          skipped: false,
          book_id: null,
          error: err instanceof Error ? err.message : '导入失败',
          raw_data: rawData,
        });
      }
    }

    const created = importRows.filter((row) => row.success && row.book_id != null).length;
    const valid = importRows.filter((row) => row.success).length;
    const skipped = importRows.filter((row) => row.skipped).length;
    const failed = importRows.filter((row) => !row.success && !row.skipped).length;

    return {
      data: {
        dry_run: dryRun,
        total: importRows.length,
        created,
        valid,
        skipped,
        failed,
        rows: importRows,
      },
    };
  });

  app.post('/books/metadata/fetch', async (req) => {
    requirePermission(req, 'use');
    const body = req.body as { source_url?: unknown };
    const sourceUrl = typeof body?.source_url === 'string' ? body.source_url.trim() : '';
    if (!sourceUrl) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '请先填写书籍介绍链接');
    }

    const metadata = await fetchBookMetadataFromUrl(sourceUrl);
    return { data: metadata };
  });

  app.post('/books/:id/metadata/apply', async (req) => {
    const userId = requirePermission(req, 'use');
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const book = getDb()
      .select()
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId), sql`${books.deleted_at} IS NULL`))
      .get();
    if (!book) throw notFound('书籍不存在');

    const input = validate(metadataApplySchema, req.body);
    const fields = input.fields ?? {};
    const fetchCover = input.fetch_cover ?? false;

    const allowedFields = new Set([
      'title', 'author', 'subtitle', 'isbn', 'publisher', 'publish_year',
      'description', 'language', 'translator', 'original_title', 'page_count',
      'metadata_source',
    ]);

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.has(key) && value != null && String(value).trim() !== '') {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      const db = getDb();
      db.update(books)
        .set({ ...updates, updated_at: now() })
        .where(eq(books.id, bookId))
        .run();
    }

    if (fetchCover) {
      const sourceUrl = (updates.source_url as string | undefined) ?? book.source_url;
      if (sourceUrl) {
        try {
          const metadata = await fetchBookMetadataFromUrl(sourceUrl);
          if (metadata.cover_url) {
            const shouldActivateCover = !hasActiveBookCover(bookId);
            await downloadRemoteCover({
              ownerId: userId,
              bookId,
              coverUrl: metadata.cover_url,
              sourceLabel: metadata.metadata_source,
              activate: shouldActivateCover,
            });
          }
        } catch { /* 封面下载失败不影响元数据更新 */ }
      }
    }

    const updatedBook = getDb()
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .get();

    return { data: serializeBooks([updatedBook as RawBookRow], userId)[0] };
  });

  function getFetchConcurrency(): number {
    const raw = readStorageSetting('fetch_concurrency');
    if (!raw) return 1;
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 1) return 1;
    if (num > 5) return 5;
    return num;
  }

  app.post('/books/metadata/batch-preview', async (req) => {
    const userId = requirePermission(req, 'use');
    const input = validate(batchPreviewSchema, req.body);
    const db = getDb();

    const ownedBooks = db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        subtitle: books.subtitle,
        isbn: books.isbn,
        publisher: books.publisher,
        publish_year: books.publish_year,
        description: books.description,
        language: books.language,
        translator: books.translator,
        original_title: books.original_title,
        page_count: books.page_count,
        source_url: books.source_url,
      })
      .from(books)
      .where(and(eq(books.owner_id, userId), inArray(books.id, input.ids), sql`${books.deleted_at} IS NULL`))
      .all();

    if (ownedBooks.length === 0) throw notFound('未找到可操作的书籍');

    const concurrency = getFetchConcurrency();
    const allowedFields = ['title', 'author', 'subtitle', 'isbn', 'publisher', 'publish_year', 'description', 'language', 'translator', 'original_title', 'page_count'];

    interface PreviewRow {
      book_id: number;
      title: string;
      success: boolean;
      skipped?: boolean;
      reason?: string;
      error?: string;
      will_fill: string[];
      existing: string[];
      has_cover: boolean;
      cover_url: string | null;
    }
    const rows: PreviewRow[] = [];

    const coverMap = new Map<number, boolean>();
    if (input.ids.length > 0) {
      const coverRows = db
        .select({ book_id: bookCovers.book_id })
        .from(bookCovers)
        .where(and(inArray(bookCovers.book_id, input.ids), eq(bookCovers.is_active, 1)))
        .all();
      for (const c of coverRows) coverMap.set(c.book_id, true);
    }

    async function processOne(b: typeof ownedBooks[number]): Promise<PreviewRow> {
      if (!b.source_url) {
        return { book_id: b.id, title: b.title, success: false, skipped: true, reason: 'no_source_url', will_fill: [], existing: [], has_cover: coverMap.has(b.id), cover_url: null };
      }
      try {
        const metadata = await fetchBookMetadataFromUrl(b.source_url);
        const willFill: string[] = [];
        const existing: string[] = [];
        for (const field of allowedFields) {
          const currentVal = (b as Record<string, unknown>)[field];
          const hasValue = currentVal != null && String(currentVal).trim() !== '';
          if (hasValue) {
            existing.push(field);
          } else {
            const fetchedVal = (metadata as unknown as Record<string, unknown>)[field];
            if (fetchedVal != null && String(fetchedVal).trim() !== '') {
              willFill.push(field);
            }
          }
        }
        return { book_id: b.id, title: b.title, success: true, will_fill: willFill, existing: existing, has_cover: coverMap.has(b.id), cover_url: metadata.cover_url ?? null };
      } catch (err) {
        const message = err instanceof Error ? err.message : '抓取失败';
        return { book_id: b.id, title: b.title, success: false, error: message, will_fill: [], existing: [], has_cover: coverMap.has(b.id), cover_url: null };
      }
    }

    let running = 0;
    let cursor = 0;
    const queue = [...ownedBooks];

    await new Promise<void>((resolve) => {
      function next() {
        while (running < concurrency && cursor < queue.length) {
          const book = queue[cursor++];
          running++;
          processOne(book).then((row) => {
            rows.push(row);
            running--;
            next();
          });
        }
        if (running === 0 && cursor >= queue.length) {
          resolve();
        }
      }
      next();
    });

    rows.sort((a, b) => ownedBooks.findIndex((ob) => ob.id === a.book_id) - ownedBooks.findIndex((ob) => ob.id === b.book_id));

    return {
      data: rows,
    };
  });

  app.post('/books/metadata/batch-apply', async (req) => {
    const userId = requirePermission(req, 'use');
    const input = validate(batchApplySchema, req.body);
    const db = getDb();
    const timestamp = now();

    const ownedBooks = db
      .select({
        id: books.id,
        source_url: books.source_url,
      })
      .from(books)
      .where(and(eq(books.owner_id, userId), inArray(books.id, input.ids), sql`${books.deleted_at} IS NULL`))
      .all();

    if (ownedBooks.length === 0) throw notFound('未找到可操作的书籍');

    const allowedFields = new Set(['title', 'author', 'subtitle', 'isbn', 'publisher', 'publish_year', 'description', 'language', 'translator', 'original_title', 'page_count', 'metadata_source']);
    const restrictedFields = input.fields && input.fields.length > 0 ? new Set(input.fields) : null;
    const shouldFetchCover = restrictedFields == null || restrictedFields.has('cover');

    const rows: { book_id: number; success: boolean; error?: string; filled_fields: string[] }[] = [];

    for (const book of ownedBooks) {
      if (!book.source_url) {
        rows.push({ book_id: book.id, success: false, error: '无来源链接', filled_fields: [] });
        continue;
      }
      try {
        const metadata = await fetchBookMetadataFromUrl(book.source_url);
        const existing = db.select().from(books).where(eq(books.id, book.id)).get();
        const updates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(metadata)) {
          if (!allowedFields.has(key)) continue;
          if (restrictedFields && !restrictedFields.has(key)) continue;
          if (value == null || String(value).trim() === '') continue;
          const currentVal = (existing as Record<string, unknown>)[key];
          if (currentVal != null && String(currentVal).trim() !== '') continue;
          updates[key] = value;
        }
        if (Object.keys(updates).length > 0) {
          updates.updated_at = timestamp;
          db.update(books).set(updates).where(eq(books.id, book.id)).run();
        }
        const filledFields = Object.keys(updates);

        if (shouldFetchCover && metadata.cover_url) {
          try {
            const shouldActivateCover = !hasActiveBookCover(book.id);
            await downloadRemoteCover({
              ownerId: userId,
              bookId: book.id,
              coverUrl: metadata.cover_url,
              sourceLabel: metadata.metadata_source,
              activate: shouldActivateCover,
            });
            filledFields.push('cover');
          } catch { /* 封面下载失败不影响其他字段 */ }
        }

        rows.push({ book_id: book.id, success: true, filled_fields: filledFields });
      } catch (err) {
        const message = err instanceof Error ? err.message : '抓取失败';
        rows.push({ book_id: book.id, success: false, error: message, filled_fields: [] });
      }
    }

    return { data: rows };
  });

  app.get('/books', async (req) => {
    const userId = getOptionalUserId(req);
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

  app.get('/books/:id/review', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const db = getDb();
    const book = db
      .select({
        id: books.id,
        owner_id: books.owner_id,
        title: books.title,
        author: books.author,
        cover_path: books.cover_path,
        status: books.status,
        updated_at: books.updated_at,
      })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId), sql`${books.deleted_at} IS NULL`))
      .get();

    if (!book) {
      throw notFound('书籍不存在');
    }

    const highlightRows = db
      .select({
        id: highlights.id,
        book_id: highlights.book_id,
        cfi_start: highlights.cfi_start,
        cfi_end: highlights.cfi_end,
        text: highlights.text,
        mark_type: highlights.mark_type,
        color: highlights.color,
        note: highlights.note,
        created_at: highlights.created_at,
        updated_at: highlights.updated_at,
      })
      .from(highlights)
      .where(and(eq(highlights.book_id, bookId), eq(highlights.owner_id, userId), sql`${highlights.deleted_at} IS NULL`))
      .orderBy(desc(highlights.updated_at))
      .all();

    const noteRows = db
      .select({
        id: notes.id,
        book_id: notes.book_id,
        cfi: notes.cfi,
        title: notes.title,
        content_markdown: notes.content_markdown,
        mark_type: notes.mark_type,
        created_at: notes.created_at,
        updated_at: notes.updated_at,
      })
      .from(notes)
      .where(and(eq(notes.book_id, bookId), eq(notes.owner_id, userId), sql`${notes.deleted_at} IS NULL`))
      .orderBy(desc(notes.updated_at))
      .all();

    const bookmarkRows = db
      .select({
        id: bookmarks.id,
        book_id: bookmarks.book_id,
        cfi: bookmarks.cfi,
        label: bookmarks.label,
        percentage: bookmarks.percentage,
        created_at: bookmarks.created_at,
      })
      .from(bookmarks)
      .where(and(eq(bookmarks.book_id, bookId), eq(bookmarks.owner_id, userId)))
      .orderBy(desc(bookmarks.created_at))
      .all();

    const progress = db
      .select()
      .from(readingProgress)
      .where(and(eq(readingProgress.book_id, bookId), eq(readingProgress.owner_id, userId)))
      .get() ?? null;

    const markTypeCounts = new Map<string, number>();
    for (const row of [...highlightRows, ...noteRows]) {
      const markType = row.mark_type ?? 'NONE';
      markTypeCounts.set(markType, (markTypeCounts.get(markType) ?? 0) + 1);
    }

    const recentMarks = [
      ...highlightRows.map((row) => ({
        type: 'highlight' as const,
        id: row.id,
        book_id: row.book_id,
        cfi: row.cfi_start,
        cfi_start: row.cfi_start,
        cfi_end: row.cfi_end,
        text: row.text,
        mark_type: row.mark_type ?? 'NONE',
        color: row.color,
        note: row.note,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      ...noteRows.map((row) => ({
        type: 'note' as const,
        id: row.id,
        book_id: row.book_id,
        cfi: row.cfi,
        title: row.title,
        text: row.content_markdown,
        mark_type: row.mark_type ?? 'NONE',
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      ...bookmarkRows.map((row) => ({
        type: 'bookmark' as const,
        id: row.id,
        book_id: row.book_id,
        cfi: row.cfi,
        title: row.label,
        percentage: row.percentage,
        mark_type: 'BOOKMARK',
        created_at: row.created_at,
        updated_at: row.created_at,
      })),
    ].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 20);

    return {
      data: {
        book_id: bookId,
        book,
        counts: {
          highlights: highlightRows.length,
          notes: noteRows.length,
          bookmarks: bookmarkRows.length,
        },
        mark_type_counts: Object.fromEntries(markTypeCounts),
        reading_progress: progress,
        recent_marks: recentMarks,
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
    const userId = requirePermission(req, 'use');
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
    const categoryId = input.category_id !== undefined
      ? validateCategoryOwnership(userId, input.category_id, 'PERSONAL')
      : undefined;
    const genreCategoryId = input.genre_category_id !== undefined
      ? validateCategoryOwnership(userId, input.genre_category_id, 'GENRE')
      : undefined;
    const tagIds = input.tag_ids !== undefined
      ? validateTagOwnership(userId, input.tag_ids)
      : undefined;

    if (input.title !== undefined) updateData.title = input.title;
    if (input.author !== undefined) updateData.author = input.author;
    if (input.subtitle !== undefined) updateData.subtitle = input.subtitle;
    if (input.isbn !== undefined) updateData.isbn = input.isbn;
    if (input.publisher !== undefined) updateData.publisher = input.publisher;
    if (input.publish_year !== undefined) updateData.publish_year = input.publish_year;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.language !== undefined) updateData.language = input.language;
    if (categoryId !== undefined) updateData.category_id = categoryId;
    if (genreCategoryId !== undefined) updateData.genre_category_id = genreCategoryId;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.reading_purpose !== undefined) updateData.reading_purpose = input.reading_purpose;
    if (input.entry_reason !== undefined) updateData.entry_reason = input.entry_reason;
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

    if (tagIds !== undefined) {
      syncBookTags(bookId, tagIds);
    }

    const updated = db.select(bookSelect()).from(books).where(eq(books.id, bookId)).get();
    if (!updated) {
      throw notFound('书籍不存在');
    }

    return { data: serializeBooks([updated], userId)[0] };
  });

  app.delete('/books/:id', async (req) => {
    const userId = requirePermission(req, 'use');
    const { id } = req.params as { id: string };
    const bookId = Number(id);

    if (Number.isNaN(bookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    }

    const deleteFiles = String((req.query as Record<string, unknown>).delete_files ?? '').toLowerCase() === 'true';

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

    if (deleteFiles) {
      deleteFilesForBooks(userId, [bookId]);
    }

    return { data: { id: bookId, deleted: true, files_deleted: deleteFiles } };
  });

  app.post('/books/batch', async (req) => {
    const userId = requirePermission(req, 'use');
    const input = validate(batchBooksSchema, req.body);
    const db = getDb();
    const timestamp = now();

    const ownedBooks = db
      .select({ id: books.id, status: books.status, started_at: books.started_at, finished_at: books.finished_at })
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
        for (const book of ownedBooks) {
          if (book.status !== newStatus) {
            const updates: Record<string, unknown> = { status: newStatus, updated_at: timestamp };
            if (newStatus === 'READING' && !book.started_at) updates.started_at = timestamp;
            if (newStatus === 'READ' && !book.finished_at) updates.finished_at = timestamp;
            db.update(books).set(updates).where(eq(books.id, book.id)).run();
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
          .set({ category_id: validateCategoryOwnership(userId, categoryId, 'PERSONAL'), updated_at: timestamp })
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
          .set({ genre_category_id: validateCategoryOwnership(userId, genreCategoryId, 'GENRE'), updated_at: timestamp })
          .where(and(eq(books.owner_id, userId), inArray(books.id, ownedIds)))
          .run();
        break;
      }
      case 'set_tags': {
        const tagIds = input.params?.tag_ids as number[] | undefined;
        if (!tagIds) {
          throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 tag_ids 参数');
        }
        const validatedTagIds = validateTagOwnership(userId, tagIds);
        for (const bookId of ownedIds) {
          syncBookTags(bookId, validatedTagIds);
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
      case 'fetch_metadata': {
        for (const bookId of ownedIds) {
          const book = db.select({ source_url: books.source_url, title: books.title }).from(books).where(eq(books.id, bookId)).get();
          if (!book?.source_url) {
            continue;
          }
          try {
            const metadata = await fetchBookMetadataFromUrl(book.source_url);
            const allowedFields = new Set(['title', 'author', 'subtitle', 'isbn', 'publisher', 'publish_year', 'description', 'language', 'translator', 'original_title', 'page_count', 'metadata_source']);
            const updates: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(metadata)) {
              if (allowedFields.has(key) && value != null && String(value).trim() !== '') {
                updates[key] = value;
              }
            }
            if (Object.keys(updates).length > 0) {
              updates.updated_at = timestamp;
              db.update(books).set(updates).where(eq(books.id, bookId)).run();
            }
          } catch {
            continue;
          }
        }
        break;
      }
      case 'fetch_cover': {
        const force = input.params?.force === true;
        for (const bookId of ownedIds) {
          const book = db.select({ source_url: books.source_url, cover_path: books.cover_path }).from(books).where(eq(books.id, bookId)).get();
          if (!book?.source_url) {
            continue;
          }
          if (!force && book.cover_path) {
            continue;
          }
          try {
            const metadata = await fetchBookMetadataFromUrl(book.source_url);
            if (metadata.cover_url) {
              const shouldActivateCover = !hasActiveBookCover(bookId);
              await downloadRemoteCover({
                ownerId: userId,
                bookId,
                coverUrl: metadata.cover_url,
                sourceLabel: metadata.metadata_source,
                activate: shouldActivateCover,
              });
            }
          } catch {
            continue;
          }
        }
        break;
      }
    }

    return {
      data: {
        affected: input.action === 'delete'
          ? ownedBooks.filter((book) => book.status !== 'STORED').length
          : ownedIds.length,
      },
    };
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
    const userId = requirePermission(req, 'use');
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
    const userId = requirePermission(req, 'use');
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
      const searchCondition = buildSearchCondition(input.q);
      if (searchCondition) {
        conditions.push(searchCondition);
      }
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
      } else if (field === 'import_order') {
        orderBy = descending ? desc(books.import_order) : asc(books.import_order);
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
    const userId = requirePermission(req, 'use');
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
    const userId = requirePermission(req, 'use');
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
    deleteFilesForBooks(userId, [bookId]);
    db.delete(books).where(eq(books.id, bookId)).run();

    return { data: { id: bookId, deleted: true } };
  });

  app.delete('/trash', async (req) => {
    const userId = requirePermission(req, 'use');
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
    deleteFilesForBooks(userId, trashedIds);
    db.delete(books).where(and(eq(books.owner_id, userId), inArray(books.id, trashedIds))).run();

    return { data: { affected: trashedBooks.length } };
  });

  app.get('/books/maintenance/stats', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();

    const baseCondition = and(eq(books.owner_id, userId), sql`${books.deleted_at} IS NULL`);

    const total = db.select({ value: count() }).from(books).where(baseCondition).get()?.value ?? 0;

    const coreFields = ['author', 'isbn', 'publisher', 'publish_year', 'description'] as const;
    const allFields = [
      'author', 'isbn', 'publisher', 'publish_year', 'description',
      'translator', 'subtitle', 'original_title', 'page_count', 'language',
    ] as const;

    const missingFields: Record<string, number> = {};
    for (const field of allFields) {
      const c = db
        .select({ value: count() })
        .from(books)
        .where(and(baseCondition, sql`(${books[field]} IS NULL OR TRIM(CAST(${books[field]} AS TEXT)) = '')`))
        .get()?.value ?? 0;
      missingFields[field] = c;
    }

    const missingAnyConditions = coreFields.map(
      (f) => sql`(${books[f]} IS NULL OR TRIM(CAST(${books[f]} AS TEXT)) = '')`,
    );
    const missingAny = db
      .select({ value: count() })
      .from(books)
      .where(and(baseCondition, or(...missingAnyConditions)))
      .get()?.value ?? 0;

    const noSourceUrl = db
      .select({ value: count() })
      .from(books)
      .where(and(baseCondition, sql`${books.source_url} IS NULL OR TRIM(${books.source_url}) = ''`))
      .get()?.value ?? 0;

    const hasSourceNotFetched = db
      .select({ value: count() })
      .from(books)
      .where(and(
        baseCondition,
        sql`${books.source_url} IS NOT NULL AND TRIM(${books.source_url}) <> ''`,
        eq(books.metadata_source, 'manual'),
      ))
      .get()?.value ?? 0;

    const noCover = db
      .select({ value: count() })
      .from(books)
      .where(and(
        baseCondition,
        notExists(
          db.select({ _1: bookCovers.id }).from(bookCovers)
            .where(and(eq(bookCovers.book_id, books.id), eq(bookCovers.is_active, 1))),
        ),
      ))
      .get()?.value ?? 0;

    return {
      data: {
        total,
        complete: total - missingAny,
        missing_any: missingAny,
        missing_fields: missingFields,
        no_source_url: noSourceUrl,
        has_source_url_not_fetched: hasSourceNotFetched,
        no_cover: noCover,
      },
    };
  });

  app.get('/books/maintenance/list', async (req) => {
    const userId = requireUserId(req);
    const input = validate(maintenanceListSchema, req.query) as MaintenanceListInput;
    const db = getDb();
    const page = input.page ?? 1;
    const pageSize = Math.min(input.page_size ?? 50, 100);

    const conditions: ReturnType<typeof and>[] = [
      eq(books.owner_id, userId),
      sql`${books.deleted_at} IS NULL`,
    ];

    if (input.q) {
      const searchCondition = buildSearchCondition(input.q);
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (input.missing) {
      const fields = input.missing.split(',').map((f) => f.trim()).filter(Boolean);
      for (const field of fields) {
        if (['author', 'isbn', 'publisher', 'publish_year', 'description', 'translator', 'subtitle', 'original_title', 'page_count', 'language'].includes(field)) {
          const col = books[field as keyof typeof books];
          conditions.push(sql`(${col} IS NULL OR TRIM(CAST(${col} AS TEXT)) = '')`);
        }
      }
    }

    if (input.no_source_url) {
      conditions.push(sql`${books.source_url} IS NULL OR TRIM(${books.source_url}) = ''`);
    }

    if (input.has_source_url_not_fetched) {
      conditions.push(sql`${books.source_url} IS NOT NULL AND TRIM(${books.source_url}) <> ''`);
      conditions.push(eq(books.metadata_source, 'manual'));
    }

    if (input.no_cover) {
      conditions.push(
        notExists(
          db.select({ _1: bookCovers.id }).from(bookCovers)
            .where(and(eq(bookCovers.book_id, books.id), eq(bookCovers.is_active, 1))),
        ),
      );
    }

    if (input.category_id) {
      conditions.push(eq(books.category_id, input.category_id));
    }

    if (input.genre_category_id) {
      conditions.push(eq(books.genre_category_id, input.genre_category_id));
    }

    if (input.status) {
      const statuses = input.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(eq(books.status, statuses[0]));
      } else if (statuses.length > 1) {
        conditions.push(inArray(books.status, statuses));
      }
    }

    if (input.tag_ids) {
      const tagIdList = input.tag_ids.split(',').map((t) => Number(t.trim())).filter((n) => !Number.isNaN(n));
      if (tagIdList.length === 1) {
        conditions.push(
          exists(
            db.select({ _1: bookTags.book_id }).from(bookTags)
              .where(and(eq(bookTags.book_id, books.id), eq(bookTags.tag_id, tagIdList[0]))),
          ),
        );
      } else if (tagIdList.length > 1) {
        conditions.push(
          exists(
            db.select({ _1: bookTags.book_id }).from(bookTags)
              .where(and(eq(bookTags.book_id, books.id), inArray(bookTags.tag_id, tagIdList))),
          ),
        );
      }
    }

    if (input.book_ids) {
      const idList = input.book_ids.split(',').map((id) => Number(id.trim())).filter((n) => !Number.isNaN(n));
      if (idList.length > 0) {
        conditions.push(inArray(books.id, idList));
      }
    }

    const where = and(...conditions);
    const total = db.select({ value: count() }).from(books).where(where).get()?.value ?? 0;

    let orderBy = desc(books.updated_at);
    if (input.sort) {
      const descending = input.sort.startsWith('-');
      const field = descending ? input.sort.slice(1) : input.sort;
      const sortable: Record<string, ReturnType<typeof desc>> = {
        title: descending ? desc(books.title) : asc(books.title),
        author: descending ? desc(books.author) : asc(books.author),
        isbn: descending ? desc(books.isbn) : asc(books.isbn),
        publisher: descending ? desc(books.publisher) : asc(books.publisher),
        publish_year: descending ? desc(books.publish_year) : asc(books.publish_year),
        created_at: descending ? desc(books.created_at) : asc(books.created_at),
        updated_at: descending ? desc(books.updated_at) : asc(books.updated_at),
        import_order: descending ? desc(books.import_order) : asc(books.import_order),
      };
      if (sortable[field]) {
        orderBy = sortable[field];
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

    const bookIds = rows.map((r) => r.id);

    const activeCovers = bookIds.length > 0
      ? db
          .select({
            book_id: bookCovers.book_id,
            local_path: bookCovers.local_path,
            remote_key: bookCovers.remote_key,
            storage_mode: bookCovers.storage_mode,
            primary_location: bookCovers.primary_location,
          })
          .from(bookCovers)
          .where(and(inArray(bookCovers.book_id, bookIds), eq(bookCovers.is_active, 1)))
          .all()
      : [];
    const coverMap = new Map(activeCovers.map((c) => [c.book_id, c]));

    const data = serializeBooks(rows, userId).map((book) => {
      const bookId = book.id;
      const bookTagRows = db
        .select({ name: tags.name })
        .from(bookTags)
        .innerJoin(tags, eq(bookTags.tag_id, tags.id))
        .where(eq(bookTags.book_id, bookId))
        .all();
      const cover = coverMap.get(bookId);
      return {
        ...book,
        tags: bookTagRows.map((t) => t.name),
        has_cover: Boolean(cover),
      };
    });

    return {
      data,
      pagination: { page, page_size: pageSize, total },
    };
  });
}
