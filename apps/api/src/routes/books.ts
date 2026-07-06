import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { and, asc, count, desc, eq, inArray, notExists, or, sql } from 'drizzle-orm';
import { bookCovers, bookFiles, bookRelations, bookTags, books, categories, statusHistory, tags, type StorageMode } from '@redesk/db';
import {
  ERROR_CODE,
  bookQuerySchema,
  createBookSchema,
  updateBookSchema,
  batchBooksSchema,
  trashQuerySchema,
  duplicateQuerySchema,
  metadataApplySchema,
} from '@redesk/shared';
import type { BookQueryInput, CreateBookInput, TrashQueryInput, DuplicateQueryInput } from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound, businessError } from '../lib/errors';
import { requireUserId, getPublicUserId } from '../lib/auth';
import { validate } from '../lib/zod';
import { deleteFilesForBooks, saveUploadedFile, EXTENSION_FORMAT, downloadRemoteCover } from './files';
import { extname } from 'node:path';

interface LinkMetadata {
  title?: string;
  author?: string;
  translator?: string;
  publisher?: string;
  publish_year?: number;
  isbn?: string;
  page_count?: number;
  original_title?: string;
  description?: string;
  cover_url?: string;
  douban_rating?: number;
  source_url: string;
  metadata_source: 'douban' | 'neodb' | 'manual';
}

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
  import_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function now(): string {
  return new Date().toISOString();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function stripLeadingMetadataLabel(value: string): string {
  return value
    .replace(/^(?:作者|译者|出版社|出版年|页数|原作名|ISBN|publishing house)\s*[:：]\s*/i, '')
    .replace(/^[:：]\s*/, '')
    .trim();
}

function pickMeta(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripHtml(match[1]);
  }
  return undefined;
}

function pickDoubanInfo(html: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<span[^>]+class=["'][^"']*\\bpl\\b[^"']*["'][^>]*>\\s*${escaped}:?\\s*</span>\\s*([\\s\\S]*?)(?=<br\\s*/?>|<span[^>]+class=["'][^"']*\\bpl\\b[^"']*["']|</div>)`, 'i'));
  if (!match?.[1]) return undefined;
  return stripLeadingMetadataLabel(stripHtml(match[1]));
}

function pickDoubanCover(html: string): string | undefined {
  const metaCover = pickMeta(html, 'og:image');
  if (metaCover) return metaCover;
  const mainPic = html.match(/<div[^>]+id=["']mainpic["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (mainPic) return decodeHtmlEntities(mainPic.trim());
  return html.match(/<img[^>]+rel=["']v:photo["'][^>]+src=["']([^"']+)["']/i)?.[1];
}

function pickDoubanRating(html: string): number | undefined {
  const raw =
    html.match(/<strong[^>]+class=["'][^"']*rating_num[^"']*["'][^>]*>\s*([\d.]+)\s*<\/strong>/i)?.[1] ??
    html.match(/property=["']v:average["'][^>]*>\s*([\d.]+)\s*</i)?.[1];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseJsonLdObjects(html: string): unknown[] {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const result: unknown[] = [];
  for (const match of matches) {
    try {
      result.push(JSON.parse(decodeHtmlEntities(match[1].trim())) as unknown);
    } catch {
      // ignore invalid structured data
    }
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readText(value: unknown): string | undefined {
  if (typeof value === 'string') return stripHtml(value);
  const record = asRecord(value);
  const name = record?.name;
  return typeof name === 'string' ? stripHtml(name) : undefined;
}

function readPersonList(value: unknown): string | undefined {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const names = items.map(readText).filter((item): item is string => Boolean(item));
  return names.length > 0 ? names.join(' / ') : undefined;
}

function pickNeoDBField(html: string, labelPattern: string): string | undefined {
  const match = html.match(new RegExp(`${labelPattern}:\\s*([\\s\\S]*?)(?=<\\/div>|<br\\s*/?>)`, 'i'));
  return match?.[1] ? stripHtml(match[1]) : undefined;
}

function pickNeoDBRating(html: string): number | undefined {
  if (/评分人数不足/.test(html)) return undefined;
  const ratingBlock = html.match(/<div[^>]+class=["'][^"']*\brating\b[^"']*["'][\s\S]*?<h3[^>]*>\s*([\d.]+)\s*<small>\s*\/\s*10/i)?.[1];
  if (!ratingBlock) return undefined;
  const value = Number(ratingBlock);
  return Number.isFinite(value) ? value : undefined;
}

function parseNeoDBHtml(html: string, sourceUrl: string): LinkMetadata {
  const jsonLd = parseJsonLdObjects(html)
    .map(asRecord)
    .find((item) => item?.['@type'] === 'Book');
  const publisher = asRecord(jsonLd?.publisher);
  const publishDate = readText(jsonLd?.datePublished) ?? pickNeoDBField(html, '发行时间');
  const pageCountRaw = jsonLd?.numberOfPages ?? pickNeoDBField(html, '页数');
  const pageCount = typeof pageCountRaw === 'number' ? pageCountRaw : String(pageCountRaw ?? '').match(/\d+/)?.[0];
  const rating = pickNeoDBRating(html);

  return {
    title: readText(jsonLd?.name) ?? pickMeta(html, 'og:title') ?? undefined,
    author: readPersonList(jsonLd?.author) ?? pickNeoDBField(html, '作者'),
    translator: pickNeoDBField(html, '译者'),
    publisher: readText(publisher?.name) ?? pickNeoDBField(html, '(?:publishing house|出版社)'),
    publish_year: publishDate?.match(/\d{4}/) ? Number(publishDate.match(/\d{4}/)?.[0]) : undefined,
    isbn: readText(jsonLd?.isbn)?.replace(/[^\dXx]/g, '') ?? pickNeoDBField(html, 'ISBN')?.replace(/[^\dXx]/g, ''),
    page_count: pageCount ? Number(pageCount) : undefined,
    original_title: readText(jsonLd?.alternateName),
    description: readText(jsonLd?.description) ?? pickMeta(html, 'og:description'),
    cover_url: readText(jsonLd?.image) ?? pickMeta(html, 'og:image'),
    douban_rating: rating,
    source_url: sourceUrl,
    metadata_source: 'neodb',
  };
}

function parseDoubanHtml(html: string, sourceUrl: string): LinkMetadata {
  const title =
    pickMeta(html, 'og:title') ??
    stripHtml(html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] ?? '').replace(/\(豆瓣\)$/, '').trim();

  const author = pickDoubanInfo(html, '作者');
  const publisher = pickDoubanInfo(html, '出版社');
  const publishDate = pickDoubanInfo(html, '出版年');
  const isbn = pickDoubanInfo(html, 'ISBN')?.replace(/[^\dXx]/g, '');
  const pageCountText = pickDoubanInfo(html, '页数');
  const translator = pickDoubanInfo(html, '译者');
  const originalTitle = pickDoubanInfo(html, '原作名');
  const description =
    pickMeta(html, 'og:description') ??
    stripHtml(html.match(/<div[^>]+class=["'][^"']*intro[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
  const coverUrl = pickDoubanCover(html);
  const doubanRating = pickDoubanRating(html);
  const publishYear = publishDate?.match(/\d{4}/)?.[0];
  const pageCount = pageCountText?.match(/\d+/)?.[0];

  return {
    title: title || undefined,
    author,
    translator,
    publisher,
    publish_year: publishYear ? Number(publishYear) : undefined,
    isbn,
    page_count: pageCount ? Number(pageCount) : undefined,
    original_title: originalTitle,
    description,
    cover_url: coverUrl,
    douban_rating: doubanRating,
    source_url: sourceUrl,
    metadata_source: 'douban',
  };
}

async function fetchBookMetadataFromUrl(sourceUrl: string): Promise<LinkMetadata> {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍介绍链接');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, '只支持 http 或 https 链接');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 Redesk/0.1 book metadata fetcher',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      throw new AppError(ERROR_CODE.BUSINESS_ERROR, `获取链接失败：HTTP ${res.status}`);
    }
    const html = await res.text();
    if (url.hostname.includes('douban.com')) {
      return parseDoubanHtml(html, url.toString());
    }
    if (url.hostname.includes('neodb.social')) {
      return parseNeoDBHtml(html, url.toString());
    }
    return {
      title: pickMeta(html, 'og:title') ?? stripHtml(html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] ?? ''),
      description: pickMeta(html, 'og:description'),
      cover_url: pickMeta(html, 'og:image'),
      source_url: url.toString(),
      metadata_source: 'manual',
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ERROR_CODE.BUSINESS_ERROR, '获取链接失败，请改用粘贴文本导入');
  } finally {
    clearTimeout(timeout);
  }
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
    import_order: books.import_order,
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
    .where(and(inArray(bookTags.book_id, bookIds), eq(tags.owner_id, ownerId)))
    .all();

  for (const tagRow of tagRows) {
    const existing = tagMap.get(tagRow.book_id) ?? { tag_ids: [], tag_names: [] };
    existing.tag_ids.push(tagRow.tag_id);
    existing.tag_names.push(tagRow.tag_name);
    tagMap.set(tagRow.book_id, existing);
  }

  const fileMap = new Map<number, boolean>();
  const readableFileMap = new Map<number, boolean>();
  const fileRows = db
    .select({ book_id: bookFiles.book_id, is_primary: bookFiles.is_primary, file_format: bookFiles.file_format })
    .from(bookFiles)
    .where(inArray(bookFiles.book_id, bookIds))
    .all();
  for (const f of fileRows) {
    if (f.book_id != null) {
      fileMap.set(f.book_id, true);
      if (f.is_primary === 1 && f.file_format === 'EPUB') {
        readableFileMap.set(f.book_id, true);
      }
    }
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
      has_readable_file: readableFileMap.get(row.id) ?? false,
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
      sql`${books.id} IN (SELECT book_id FROM book_files WHERE book_id IS NOT NULL AND is_primary = 1 AND file_format = 'EPUB')`,
    );
  } else if (input.has_readable_file === false) {
    conditions.push(
      notExists(
        db
          .select({ one: sql`1` })
          .from(bookFiles)
          .where(and(eq(bookFiles.book_id, books.id), eq(bookFiles.is_primary, 1), eq(bookFiles.file_format, 'EPUB')))
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
    const userId = requireUserId(req);
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
    requireUserId(req);
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
    const userId = requireUserId(req);
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
    requireUserId(req);
    const body = req.body as { source_url?: unknown };
    const sourceUrl = typeof body?.source_url === 'string' ? body.source_url.trim() : '';
    if (!sourceUrl) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '请先填写书籍介绍链接');
    }

    const metadata = await fetchBookMetadataFromUrl(sourceUrl);
    return { data: metadata };
  });

  app.post('/books/:id/metadata/apply', async (req) => {
    const userId = requireUserId(req);
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

  app.get('/books', async (req) => {
    const userId = getPublicUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    deleteFilesForBooks(userId, [bookId]);
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
    deleteFilesForBooks(userId, trashedIds);
    db.delete(books).where(and(eq(books.owner_id, userId), inArray(books.id, trashedIds))).run();

    return { data: { affected: trashedBooks.length } };
  });
}
