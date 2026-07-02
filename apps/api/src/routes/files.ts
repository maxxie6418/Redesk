import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { extname, basename } from 'node:path';
import { bookCovers, bookFiles, books, type StorageMode } from '@redesk/db';
import {
  BOOK_COVER_SOURCE_TYPE,
  ERROR_CODE,
  activateBookCoverSchema,
  batchFetchBookCoversSchema,
  fetchBookCoverSchema,
  storageModeSchema,
  updateFileSchema,
} from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';
import {
  assertStorageModeAvailable,
  getDefaultStorageMode,
  getStorageByDriver,
  getStorageDriversForMode,
  resolvePrimaryLocation,
} from '../lib/storage-factory';
import type { Storage } from '../lib/storage';
import { fetchBookMetadataFromUrl } from '../lib/book-metadata';

const MIME_MAP: Record<string, string> = {
  '.epub': 'application/epub+zip',
  '.pdf': 'application/pdf',
  '.mobi': 'application/x-mobipocket-ebook',
  '.txt': 'text/plain',
  '.azw3': 'application/vnd.amazon.mobi8-ebook',
  '.azw': 'application/vnd.amazon.mobi8-ebook',
  '.djvu': 'image/vnd.djvu',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.fb2': 'application/x-fictionbook+xml',
};

export const EXTENSION_FORMAT: Record<string, string> = {
  '.epub': 'EPUB',
  '.pdf': 'PDF',
  '.mobi': 'MOBI',
  '.txt': 'TXT',
  '.azw3': 'AZW3',
  '.azw': 'AZW3',
  '.djvu': 'DJVU',
  '.docx': 'DOCX',
  '.fb2': 'FB2',
};

const COVER_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

// 把指定 book 的指定 file 升为主文件（按"无主则升、有主不动"规则），并把同书其他主文件降级。
// 未关联文件关联入书时使用，等同于 isPrimary=undefined 的语义。
function applyPrimaryOnLink(
  db: ReturnType<typeof getDb>,
  bookId: number,
  linkedFileId: number,
): void {
  const existingPrimary = db
    .select({ id: bookFiles.id })
    .from(bookFiles)
    .where(and(eq(bookFiles.book_id, bookId), eq(bookFiles.is_primary, 1)))
    .get();
  if (existingPrimary) return;
  db.update(bookFiles)
    .set({ is_primary: 1, updated_at: now() })
    .where(eq(bookFiles.id, linkedFileId))
    .run();
}

function now(): string {
  return new Date().toISOString();
}

// multipart 字段中的布尔值：仅接受字符串 'true' / 'false'，未传合法，其他值抛 400。
function readMultipartBool(field: unknown): 'true' | 'false' | undefined {
  if (field === undefined || field === null) return undefined;
  const value = (field as { value?: unknown }).value;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'is_primary 必须是字符串 true 或 false');
  }
  if (value === 'true') return 'true';
  if (value === 'false') return 'false';
  throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'is_primary 仅接受字符串 true 或 false');
}

function safeName(ext: string): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
}

function bookFileKey(bookId: number, ext: string): string {
  return `books/${bookId}/${safeName(ext)}`;
}

function unassociatedFileKey(ext: string): string {
  return `unassociated/${safeName(ext)}`;
}

function bookCoverKey(bookId: number, ext: string): string {
  return `covers/${bookId}/cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
}

function remoteCoverKey(bookId: number, ext: string): string {
  return `covers/${bookId}/remote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
}

async function streamSha256(stream: NodeJS.ReadableStream): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of stream) {
    hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return hash.digest('hex');
}

async function fileSha256(storage: Storage, key: string): Promise<string> {
  const stream = await storage.getStream(key);
  return streamSha256(stream);
}

function detectFormat(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return EXTENSION_FORMAT[ext] ?? (ext.slice(1).toUpperCase() || 'UNKNOWN');
}

function detectMime(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

function coverMimeFromExt(ext: string): string {
  const normalized = ext.toLowerCase();
  if (normalized === '.png') return 'image/png';
  if (normalized === '.gif') return 'image/gif';
  if (normalized === '.webp') return 'image/webp';
  if (normalized === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

function coverExtFromResponse(url: string, contentType: string | null): string {
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('gif')) return '.gif';
  if (contentType?.includes('svg')) return '.svg';
  const urlExt = extname(new URL(url).pathname).toLowerCase();
  if (COVER_EXTS.includes(urlExt)) return urlExt;
  return '.jpg';
}

function filePathForStorage(mode: StorageMode, key: string): { localPath: string | null; remoteKey: string | null } {
  return {
    localPath: mode === 'cloud_only' ? null : key,
    remoteKey: mode === 'local_only' ? null : key,
  };
}

async function writeBytesForMode(
  mode: StorageMode,
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ size: number; checksum: string; localPath: string | null; remoteKey: string | null; syncStatus: 'synced' | 'partial_failed' }> {
  const drivers = getStorageDriversForMode(mode);
  const results = await Promise.allSettled(
    drivers.map(async (driver) => {
      const storage = getStorageByDriver(driver);
      const { size } = await storage.putBytes(key, bytes, { contentType });
      const checksum = await fileSha256(storage, key);
      return { driver, size, checksum };
    }),
  );

  const successes = results
    .filter((item): item is PromiseFulfilledResult<{ driver: 'local' | 's3'; size: number; checksum: string }> => item.status === 'fulfilled')
    .map((item) => item.value);

  if (successes.length === 0) {
    throw new AppError(ERROR_CODE.INTERNAL_ERROR, '文件写入失败');
  }

  return {
    size: successes[0].size,
    checksum: successes[0].checksum,
    localPath: successes.some((item) => item.driver === 'local') ? key : null,
    remoteKey: successes.some((item) => item.driver === 's3') ? key : null,
    syncStatus: successes.length === drivers.length ? 'synced' : 'partial_failed',
  };
}

async function writeStreamForMode(
  mode: StorageMode,
  key: string,
  stream: NodeJS.ReadableStream,
  contentType: string,
): Promise<{ size: number; checksum: string; localPath: string | null; remoteKey: string | null; syncStatus: 'synced' | 'partial_failed' }> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return writeBytesForMode(mode, key, Buffer.concat(chunks), contentType);
}

async function resolveReadableAsset(input: { local_path: string | null; remote_key: string | null; primary_location: 'local' | 'cloud' }) {
  const candidates =
    input.primary_location === 'cloud'
      ? [
          { driver: 's3' as const, key: input.remote_key },
          { driver: 'local' as const, key: input.local_path },
        ]
      : [
          { driver: 'local' as const, key: input.local_path },
          { driver: 's3' as const, key: input.remote_key },
        ];

  for (const candidate of candidates) {
    if (!candidate.key) continue;
    const storage = getStorageByDriver(candidate.driver);
    const exists = await storage.exists(candidate.key).catch(() => false);
    if (exists) {
      return { storage, key: candidate.key };
    }
  }

  return null;
}

function syncBookCoverPath(bookId: number): void {
  const db = getDb();
  const active = db
    .select({ local_path: bookCovers.local_path, remote_key: bookCovers.remote_key, primary_location: bookCovers.primary_location })
    .from(bookCovers)
    .where(and(eq(bookCovers.book_id, bookId), eq(bookCovers.is_active, 1)))
    .orderBy(desc(bookCovers.updated_at), desc(bookCovers.id))
    .get();

  const coverPath = active?.primary_location === 'cloud' ? active.remote_key : active?.local_path;

  db.update(books)
    .set({ cover_path: coverPath ?? null, updated_at: now() })
    .where(eq(books.id, bookId))
    .run();
}

function activateBookCover(bookId: number, coverId: number): void {
  const db = getDb();
  db.update(bookCovers).set({ is_active: 0, updated_at: now() }).where(eq(bookCovers.book_id, bookId)).run();
  db.update(bookCovers)
    .set({ is_active: 1, updated_at: now() })
    .where(and(eq(bookCovers.book_id, bookId), eq(bookCovers.id, coverId)))
    .run();
  syncBookCoverPath(bookId);
}

function upsertBookCover(input: {
  ownerId: number;
  bookId: number;
  bookFileId?: number | null;
  sourceType: string;
  sourceLabel?: string | null;
  originalUrl?: string | null;
  key: string;
  storageMode: StorageMode;
  mimeType: string;
  fileSize: number;
  checksum: string;
  activate?: boolean;
}): number {
  const db = getDb();
  const timestamp = now();
  const { localPath, remoteKey } = filePathForStorage(input.storageMode, input.key);
  const primary = resolvePrimaryLocation(input.storageMode);

  const existing =
    input.bookFileId != null
      ? db
          .select({ id: bookCovers.id })
          .from(bookCovers)
          .where(and(eq(bookCovers.book_id, input.bookId), eq(bookCovers.book_file_id, input.bookFileId)))
          .get()
      : null;

  const shouldActivate =
    input.activate &&
    !db
      .select({ id: bookCovers.id })
      .from(bookCovers)
      .where(and(eq(bookCovers.book_id, input.bookId), eq(bookCovers.is_active, 1)))
      .get();

  if (existing) {
    db.update(bookCovers)
      .set({
        source_type: input.sourceType,
        source_label: input.sourceLabel ?? null,
        original_url: input.originalUrl ?? null,
        storage_mode: input.storageMode,
        local_path: localPath,
        remote_key: remoteKey,
        primary_location: primary,
        sync_status: 'synced',
        mime_type: input.mimeType,
        file_size: input.fileSize,
        checksum: input.checksum,
        updated_at: timestamp,
      })
      .where(eq(bookCovers.id, existing.id))
      .run();

    if (shouldActivate) activateBookCover(input.bookId, existing.id);
    return existing.id;
  }

  if (shouldActivate) {
    db.update(bookCovers).set({ is_active: 0, updated_at: timestamp }).where(eq(bookCovers.book_id, input.bookId)).run();
  }

  const created = db
    .insert(bookCovers)
    .values({
      owner_id: input.ownerId,
      book_id: input.bookId,
      book_file_id: input.bookFileId ?? null,
      source_type: input.sourceType,
      source_label: input.sourceLabel ?? null,
      original_url: input.originalUrl ?? null,
      storage_mode: input.storageMode,
      local_path: localPath,
      remote_key: remoteKey,
      primary_location: primary,
      sync_status: 'synced',
      mime_type: input.mimeType,
      file_size: input.fileSize,
      checksum: input.checksum,
      is_active: input.activate ? 1 : 0,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .returning({ id: bookCovers.id })
    .get();

  syncBookCoverPath(input.bookId);
  return created.id;
}

async function extractEpubCover(
  storage: Storage,
  srcKey: string,
  bookId: number,
): Promise<{ key: string; bytes: Buffer; ext: string } | null> {
  let zipBytes: Buffer;
  try {
    zipBytes = await storage.getBytes(srcKey);
  } catch {
    return null;
  }
  try {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(zipBytes);

    const containerEntry = zip.getEntry('META-INF/container.xml');
    if (!containerEntry) return null;

    const containerXml = containerEntry.getData().toString('utf-8');
    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootfileMatch) return null;

    const opfPath = rootfileMatch[1];
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
    const opfEntry = zip.getEntry(opfPath);
    if (!opfEntry) return null;

    const opfXml = opfEntry.getData().toString('utf-8');
    const coverIdMatch = opfXml.match(/<meta\s+[^>]*name="cover"\s+[^>]*content="([^"]+)"[^>]*\/?>/i);

    let coverHref: string | null = null;
    if (coverIdMatch) {
      const coverId = coverIdMatch[1];
      const itemMatch = opfXml.match(new RegExp(`<item\\s+[^>]*id="${coverId}"[^>]*href="([^"]+)"[^>]*\\/?>`, 'i'));
      if (itemMatch) coverHref = itemMatch[1];
    }

    if (!coverHref) {
      const fallbackMatch = opfXml.match(/<item\s+[^>]*id="[^"]*cover[^"]*"[^>]*href="([^"]+)"[^>]*\/?>/i);
      if (fallbackMatch) coverHref = fallbackMatch[1];
    }

    if (!coverHref) {
      for (const entry of zip.getEntries()) {
        const entryName = entry.entryName.toLowerCase();
        if (entryName.includes('cover') && COVER_EXTS.some((ext) => entryName.endsWith(ext))) {
          coverHref = entry.entryName;
          break;
        }
      }
    }

    if (!coverHref) return null;
    const fullCoverPath = opfDir ? `${opfDir}/${coverHref}`.replace(/\/+/g, '/') : coverHref;
    const coverEntry = zip.getEntry(fullCoverPath);
    if (!coverEntry) return null;

    const coverExt = extname(coverHref).toLowerCase();
    if (!COVER_EXTS.includes(coverExt)) return null;

    const bytes = coverEntry.getData();
    const key = bookCoverKey(bookId, coverExt);
    return { key, bytes, ext: coverExt };
  } catch {
    return null;
  }
}

export async function downloadRemoteCover(input: {
  ownerId: number;
  bookId: number;
  coverUrl: string;
  sourceLabel?: string | null;
  force?: boolean;
  activate?: boolean;
}): Promise<{ id: number; local_path: string | null; remote_key: string | null; storage_mode: StorageMode } | null> {
  let url: URL;
  try {
    url = new URL(input.coverUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;

  const defaultMode = getDefaultStorageMode();
  assertStorageModeAvailable(defaultMode);

  const db = getDb();
  if (!input.force) {
    const existing = db
      .select({ id: bookCovers.id, local_path: bookCovers.local_path, remote_key: bookCovers.remote_key, storage_mode: bookCovers.storage_mode })
      .from(bookCovers)
      .where(
        and(
          eq(bookCovers.book_id, input.bookId),
          eq(bookCovers.source_type, BOOK_COVER_SOURCE_TYPE.REMOTE_FETCHED),
          eq(bookCovers.original_url, input.coverUrl),
        ),
      )
      .get();
    if (existing) {
      if (input.activate) activateBookCover(input.bookId, existing.id);
      return { id: existing.id, local_path: existing.local_path, remote_key: existing.remote_key, storage_mode: existing.storage_mode };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 Redesk/0.1 cover fetcher',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        Referer: 'https://book.douban.com/',
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) return null;

    const ext = coverExtFromResponse(url.toString(), contentType);
    const key = remoteCoverKey(input.bookId, ext);
    const writeResult = await writeBytesForMode(defaultMode, key, bytes, contentType ?? coverMimeFromExt(ext));

    const coverId = upsertBookCover({
      ownerId: input.ownerId,
      bookId: input.bookId,
      sourceType: BOOK_COVER_SOURCE_TYPE.REMOTE_FETCHED,
      sourceLabel: input.sourceLabel ?? url.hostname,
      originalUrl: input.coverUrl,
      key,
      storageMode: defaultMode,
      mimeType: contentType ?? coverMimeFromExt(ext),
      fileSize: writeResult.size,
      checksum: writeResult.checksum,
      activate: input.activate ?? true,
    });

    return {
      id: coverId,
      local_path: writeResult.localPath,
      remote_key: writeResult.remoteKey,
      storage_mode: defaultMode,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function saveUploadedFile(
  ownerId: number,
  bookId: number | null,
  filename: string,
  stream: NodeJS.ReadableStream,
  isPrimary: boolean | undefined,
  preferredMode?: StorageMode,
): Promise<typeof bookFiles.$inferSelect> {
  const mode = preferredMode ?? getDefaultStorageMode();
  assertStorageModeAvailable(mode);

  const ext = extname(filename).toLowerCase();
  const format = detectFormat(filename);
  const mime = detectMime(filename);
  const key = bookId != null ? bookFileKey(bookId, ext) : unassociatedFileKey(ext);
  const writeResult = await writeStreamForMode(mode, key, stream, mime);
  const primary = resolvePrimaryLocation(mode);
  const timestamp = now();

  const db = getDb();

  // 主文件升/降规则（与决策记录 2026-07-02 / WL-002 同步）：
  // - 未关联文件（bookId == null）永远为非主文件
  // - 关联到书籍的文件：书无主文件 → 必须升主；书有主文件 → 仅在 isPrimary='true' 时切换
  let becomesPrimary: boolean;
  if (bookId == null) {
    becomesPrimary = false;
  } else {
    const existingPrimary = db
      .select({ id: bookFiles.id })
      .from(bookFiles)
      .where(and(eq(bookFiles.book_id, bookId), eq(bookFiles.is_primary, 1)))
      .get();
    if (isPrimary === true) {
      becomesPrimary = true;
    } else if (!existingPrimary) {
      becomesPrimary = true;
    } else {
      becomesPrimary = false;
    }
  }

  const inserted = db
    .insert(bookFiles)
    .values({
      owner_id: ownerId,
      book_id: bookId,
      storage_mode: mode,
      local_path: writeResult.localPath,
      remote_key: writeResult.remoteKey,
      primary_location: primary,
      sync_status: writeResult.syncStatus,
      original_filename: basename(filename),
      file_format: format,
      mime_type: mime,
      file_size: writeResult.size,
      checksum: writeResult.checksum,
      is_primary: becomesPrimary ? 1 : 0,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .returning()
    .get();

  if (becomesPrimary && bookId != null) {
    db.update(bookFiles)
      .set({ is_primary: 0 })
      .where(and(eq(bookFiles.book_id, bookId), ne(bookFiles.id, inserted.id)))
      .run();
  }

  if (bookId != null) {
    try {
      const primaryStorage = getStorageByDriver(primary === 'cloud' ? 's3' : 'local');
      const coverInfo = await extractEpubCover(primaryStorage, key, bookId);
      if (coverInfo) {
        const coverWriteResult = await writeBytesForMode(mode, coverInfo.key, coverInfo.bytes, coverMimeFromExt(coverInfo.ext));
        upsertBookCover({
          ownerId,
          bookId,
          bookFileId: inserted.id,
          sourceType: BOOK_COVER_SOURCE_TYPE.EPUB_EXTRACTED,
          sourceLabel: 'epub',
          key: coverInfo.key,
          storageMode: mode,
          mimeType: coverMimeFromExt(coverInfo.ext),
          fileSize: coverInfo.bytes.length,
          checksum: coverWriteResult.checksum,
          activate: true,
        });
      }
    } catch {
      // 提取封面失败不影响主文件保存
    }
  }

  return inserted;
}

export function deleteFilesForBooks(ownerId: number, bookIds: number[]): void {
  const db = getDb();
  const rows = db
    .select()
    .from(bookFiles)
    .where(and(eq(bookFiles.owner_id, ownerId), inArray(bookFiles.book_id, bookIds)))
    .all();

  for (const file of rows) {
    deleteStoredBookFile(file);
  }
}

export function deleteStoredBookFile(file: typeof bookFiles.$inferSelect): void {
  if (file.local_path) {
    try {
      const s = getStorageByDriver('local');
      s.delete(file.local_path).catch(() => undefined);
    } catch {
      // ignore
    }
  }
  if (file.remote_key) {
    try {
      const s = getStorageByDriver('s3');
      s.delete(file.remote_key).catch(() => undefined);
    } catch {
      // ignore
    }
  }
}

export function fileRoutes(app: FastifyInstance): void {
  app.post('/files/unassociated', async (req, reply) => {
    const userId = requireUserId(req);
    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供文件');

    const ext = extname(data.filename).toLowerCase();
    if (!EXTENSION_FORMAT[ext]) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, `不支持的文件格式：${ext}`);
    }

    const modeField = (data.fields.storage_mode as { value?: string } | undefined)?.value;
    const mode = storageModeSchema.safeParse(modeField).data ?? getDefaultStorageMode();

    const saved = await saveUploadedFile(userId, null, data.filename, data.file, undefined, mode);
    reply.code(201);
    return { data: saved };
  });

  app.get('/files/unassociated', async (req) => {
    const userId = requireUserId(req);
    const page = Number((req.query as { page?: string }).page ?? '1');
    const pageSize = Number((req.query as { page_size?: string }).page_size ?? '20');

    const db = getDb();
    const conditions = [eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)];
    const total = db.select({ value: count() }).from(bookFiles).where(and(...conditions)).get()?.value ?? 0;

    const rows = db
      .select()
      .from(bookFiles)
      .where(and(...conditions))
      .orderBy(desc(bookFiles.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      data: rows,
      pagination: { page, page_size: pageSize, total },
    };
  });

  app.get('/files', async (req) => {
    const userId = requireUserId(req);
    const query = req.query as { page?: string; page_size?: string; format?: string; associated?: string };
    const page = Number(query.page ?? '1');
    const pageSize = Number(query.page_size ?? '20');
    const conditions = [eq(bookFiles.owner_id, userId)];

    if (query.format) {
      conditions.push(eq(bookFiles.file_format, query.format));
    }
    if (query.associated === 'true') {
      conditions.push(sql`${bookFiles.book_id} IS NOT NULL`);
    } else if (query.associated === 'false') {
      conditions.push(isNull(bookFiles.book_id));
    }

    const db = getDb();
    const where = and(...conditions);
    const total = db.select({ value: count() }).from(bookFiles).where(where).get()?.value ?? 0;
    const linked = db
      .select({ value: count() })
      .from(bookFiles)
      .where(and(eq(bookFiles.owner_id, userId), sql`${bookFiles.book_id} IS NOT NULL`))
      .get()?.value ?? 0;
    const unlinked = db
      .select({ value: count() })
      .from(bookFiles)
      .where(and(eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
      .get()?.value ?? 0;
    const totalSize = db
      .select({ value: sql<number>`coalesce(sum(${bookFiles.file_size}), 0)` })
      .from(bookFiles)
      .where(eq(bookFiles.owner_id, userId))
      .get()?.value ?? 0;

    const rows = db
      .select({
        id: bookFiles.id,
        owner_id: bookFiles.owner_id,
        book_id: bookFiles.book_id,
        storage_mode: bookFiles.storage_mode,
        local_path: bookFiles.local_path,
        remote_key: bookFiles.remote_key,
        primary_location: bookFiles.primary_location,
        sync_status: bookFiles.sync_status,
        original_filename: bookFiles.original_filename,
        file_format: bookFiles.file_format,
        mime_type: bookFiles.mime_type,
        file_size: bookFiles.file_size,
        checksum: bookFiles.checksum,
        is_primary: bookFiles.is_primary,
        created_at: bookFiles.created_at,
        updated_at: bookFiles.updated_at,
        book_title: books.title,
      })
      .from(bookFiles)
      .leftJoin(books, eq(bookFiles.book_id, books.id))
      .where(where)
      .orderBy(desc(bookFiles.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      data: rows,
      pagination: { page, page_size: pageSize, total },
      summary: {
        linked,
        unlinked,
        total_size: totalSize,
      },
    };
  });

  app.post('/files/unassociated/:id/associate', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const fileId = Number(id);
    if (Number.isNaN(fileId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的文件 ID');

    const { book_id } = req.body as { book_id?: unknown };
    if (typeof book_id !== 'number') throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 book_id');

    const db = getDb();
    const file = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fileId), eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
      .get();
    if (!file) throw notFound('文件不存在或已关联');

    db.update(bookFiles)
      .set({ book_id, updated_at: now() })
      .where(eq(bookFiles.id, fileId))
      .run();

    applyPrimaryOnLink(db, book_id, fileId);

    return { data: db.select().from(bookFiles).where(eq(bookFiles.id, fileId)).get() };
  });

  app.post('/files/:id/match', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const fileId = Number(id);
    if (Number.isNaN(fileId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的文件 ID');

    const { book_id } = req.body as { book_id?: unknown };
    if (typeof book_id !== 'number') throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少 book_id');

    const db = getDb();
    const file = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fileId), eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
      .get();
    if (!file) throw notFound('文件不存在或已关联');

    db.update(bookFiles)
      .set({ book_id, updated_at: now() })
      .where(eq(bookFiles.id, fileId))
      .run();

    applyPrimaryOnLink(db, book_id, fileId);

    return { data: db.select().from(bookFiles).where(eq(bookFiles.id, fileId)).get() };
  });

  app.delete('/files/unassociated/:id', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const fileId = Number(id);
    if (Number.isNaN(fileId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的文件 ID');

    const db = getDb();
    const file = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fileId), eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
      .get();
    if (!file) throw notFound('文件不存在或已关联');

    deleteStoredBookFile(file);
    db.delete(bookFiles).where(eq(bookFiles.id, fileId)).run();
    return { data: { id: fileId, deleted: true } };
  });

  app.get('/books/:id/files', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const rows = getDb()
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.book_id, bookId), eq(bookFiles.owner_id, userId)))
      .orderBy(desc(bookFiles.is_primary), desc(bookFiles.created_at))
      .all();

    return { data: rows };
  });

  app.post('/books/:id/files', async (req, reply) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供文件');

    const ext = extname(data.filename).toLowerCase();
    if (!EXTENSION_FORMAT[ext]) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, `不支持的文件格式：${ext}`);
    }

    const modeField = (data.fields.storage_mode as { value?: string } | undefined)?.value;
    const mode = storageModeSchema.safeParse(modeField).data ?? getDefaultStorageMode();

    // 显式读取并校验 is_primary：未传 / 'false' 均表示"不切换"；非法值 400。
    // 内部 saveUploadedFile 收到 boolean；undefined 表示"按规则自动判断"。
    const isPrimaryField = readMultipartBool(data.fields.is_primary);
    const isPrimary = isPrimaryField === undefined ? undefined : isPrimaryField === 'true';

    const saved = await saveUploadedFile(userId, bookId, data.filename, data.file, isPrimary, mode);
    reply.code(201);
    return { data: saved };
  });

  app.patch('/books/:id/files/:fileId', async (req) => {
    const userId = requireUserId(req);
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    }

    const input = validate(updateFileSchema, req.body ?? {});

    const db = getDb();
    const existing = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.book_id, bookId), eq(bookFiles.owner_id, userId)))
      .get();
    if (!existing) throw notFound('文件不存在');

    const updates: Record<string, unknown> = { updated_at: now() };
    if (input.is_primary === true) {
      updates.is_primary = 1;
      db.update(bookFiles)
        .set({ is_primary: 0 })
        .where(and(eq(bookFiles.book_id, bookId), ne(bookFiles.id, fid)))
        .run();
    } else if (input.is_primary === false) {
      updates.is_primary = 0;
    }

    db.update(bookFiles).set(updates).where(eq(bookFiles.id, fid)).run();

    return { data: db.select().from(bookFiles).where(eq(bookFiles.id, fid)).get() };
  });

  app.delete('/books/:id/files/:fileId', async (req) => {
    const userId = requireUserId(req);
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    }

    const db = getDb();
    const existing = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.book_id, bookId), eq(bookFiles.owner_id, userId)))
      .get();
    if (!existing) throw notFound('文件不存在');

    deleteStoredBookFile(existing);
    db.delete(bookFiles).where(eq(bookFiles.id, fid)).run();

    const remaining = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.book_id, bookId), eq(bookFiles.owner_id, userId)))
      .orderBy(desc(bookFiles.created_at))
      .get();
    if (remaining) {
      db.update(bookFiles).set({ is_primary: 1 }).where(eq(bookFiles.id, remaining.id)).run();
    }

    return { data: { id: fid, deleted: true } };
  });

  app.get('/books/:id/files/:fileId/download', async (req, reply) => {
    const userId = requireUserId(req);
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    }

    const file = getDb()
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.book_id, bookId), eq(bookFiles.owner_id, userId)))
      .get();
    if (!file) throw notFound('文件不存在');

    const key = file.primary_location === 'cloud' ? file.remote_key : file.local_path;
    if (!key) throw new AppError(ERROR_CODE.BUSINESS_ERROR, '文件路径不存在');

    const readable = await resolveReadableAsset(file);
    if (!readable) throw new AppError(ERROR_CODE.BUSINESS_ERROR, '文件不可用');

    const stream = await readable.storage.getStream(readable.key);

    const filename = encodeURIComponent(file.original_filename ?? `book${extname(readable.key)}`);
    return reply
      .header('Content-Type', file.mime_type ?? 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filename}`)
      .send(stream);
  });

  app.get('/books/:id/covers', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const book = getDb()
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();
    if (!book) throw notFound('书籍不存在');

    const rows = getDb()
      .select()
      .from(bookCovers)
      .where(and(eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId)))
      .orderBy(desc(bookCovers.is_active), desc(bookCovers.id))
      .all();

    return { data: rows };
  });

  app.post('/books/:id/covers/fetch', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const input = validate(fetchBookCoverSchema, req.body ?? {});
    const book = getDb()
      .select({ source_url: books.source_url })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();
    if (!book?.source_url) {
      throw new AppError(ERROR_CODE.BUSINESS_ERROR, '当前书籍缺少 source_url');
    }

    const metadata = await fetchBookMetadataFromUrl(book.source_url);
    if (!metadata.cover_url) {
      throw new AppError(ERROR_CODE.BUSINESS_ERROR, '未解析到封面图');
    }

    const created = await downloadRemoteCover({
      ownerId: userId,
      bookId,
      coverUrl: metadata.cover_url,
      sourceLabel: metadata.metadata_source,
      force: input.force,
    });
    if (!created) {
      throw new AppError(ERROR_CODE.BUSINESS_ERROR, '封面下载失败，请稍后重试');
    }

    return { data: getDb().select().from(bookCovers).where(eq(bookCovers.id, created.id)).get() };
  });

  app.post('/books/:id/covers/upload', async (req, reply) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供图片文件');

    const originalFilename = data.filename || 'cover.jpg';
    const ext = extname(originalFilename).toLowerCase();
    const allowedImageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    if (!allowedImageExts.includes(ext)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, `仅支持 jpg/png/webp/gif/bmp 格式，当前格式: ${ext || '未知'}`);
    }

    const modeField = (data.fields.storage_mode as { value?: string } | undefined)?.value;
    const mode = storageModeSchema.safeParse(modeField).data ?? getDefaultStorageMode();
    assertStorageModeAvailable(mode);

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);

    if (bytes.length > 5 * 1024 * 1024) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '图片大小不能超过 5MB');
    }

    const finalKey = bookCoverKey(bookId, ext);
    const writeResult = await writeBytesForMode(mode, finalKey, bytes, coverMimeFromExt(ext));

    const coverId = upsertBookCover({
      ownerId: userId,
      bookId,
      sourceType: BOOK_COVER_SOURCE_TYPE.MANUAL_UPLOAD,
      sourceLabel: 'upload',
      key: finalKey,
      storageMode: mode,
      mimeType: coverMimeFromExt(ext),
      fileSize: writeResult.size,
      checksum: writeResult.checksum,
      activate: false,
    });

    reply.code(201);
    return { data: getDb().select().from(bookCovers).where(eq(bookCovers.id, coverId)).get() };
  });

  app.post('/books/covers/batch-fetch', async (req) => {
    const userId = requireUserId(req);
    const input = validate(batchFetchBookCoversSchema, req.body);
    const rows: Array<{ book_id: number; success: boolean; error: string | null }> = [];

    const ownedBooks = getDb()
      .select({ id: books.id, source_url: books.source_url })
      .from(books)
      .where(and(eq(books.owner_id, userId), inArray(books.id, input.ids)))
      .all();

    for (const book of ownedBooks) {
      try {
        if (!book.source_url) {
          rows.push({ book_id: book.id, success: false, error: '缺少 source_url' });
          continue;
        }
        const metadata = await fetchBookMetadataFromUrl(book.source_url);
        if (!metadata.cover_url) {
          rows.push({ book_id: book.id, success: false, error: '未解析到封面图' });
          continue;
        }
        const created = await downloadRemoteCover({
          ownerId: userId,
          bookId: book.id,
          coverUrl: metadata.cover_url,
          sourceLabel: metadata.metadata_source,
          force: input.force,
        });
        rows.push({ book_id: book.id, success: Boolean(created), error: created ? null : '下载失败' });
      } catch (error) {
        rows.push({ book_id: book.id, success: false, error: error instanceof Error ? error.message : '下载失败' });
      }
    }

    return {
      data: {
        total: rows.length,
        success: rows.filter((row) => row.success).length,
        failed: rows.filter((row) => !row.success).length,
        rows,
      },
    };
  });

  app.patch('/books/:id/covers/:coverId', async (req) => {
    const userId = requireUserId(req);
    const { id, coverId } = req.params as { id: string; coverId: string };
    const bookId = Number(id);
    const cid = Number(coverId);
    if (Number.isNaN(bookId) || Number.isNaN(cid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');

    const input = validate(activateBookCoverSchema, req.body);

    const cover = getDb()
      .select({ id: bookCovers.id })
      .from(bookCovers)
      .where(and(eq(bookCovers.id, cid), eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId)))
      .get();
    if (!cover) throw notFound('封面不存在');

    if (input.is_active) activateBookCover(bookId, cid);
    return { data: getDb().select().from(bookCovers).where(eq(bookCovers.id, cid)).get() };
  });

  app.delete('/books/:id/covers/:coverId', async (req) => {
    const userId = requireUserId(req);
    const { id, coverId } = req.params as { id: string; coverId: string };
    const bookId = Number(id);
    const cid = Number(coverId);
    if (Number.isNaN(bookId) || Number.isNaN(cid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');

    const cover = getDb()
      .select()
      .from(bookCovers)
      .where(and(eq(bookCovers.id, cid), eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId)))
      .get();
    if (!cover) throw notFound('封面不存在');

    if (cover.local_path) {
      try { getStorageByDriver('local').delete(cover.local_path); } catch { /* ignore */ }
    }
    if (cover.remote_key) {
      try { getStorageByDriver('s3').delete(cover.remote_key); } catch { /* ignore */ }
    }
    getDb().delete(bookCovers).where(eq(bookCovers.id, cid)).run();

    const fallback = getDb()
      .select({ id: bookCovers.id })
      .from(bookCovers)
      .where(and(eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId)))
      .orderBy(desc(bookCovers.updated_at), desc(bookCovers.id))
      .get();

    if (fallback) activateBookCover(bookId, fallback.id);
    else syncBookCoverPath(bookId);

    return { data: { id: cid, deleted: true } };
  });

  app.get('/books/:id/covers/:coverId/file', async (req, reply) => {
    const userId = requireUserId(req);
    const { id, coverId } = req.params as { id: string; coverId: string };
    const bookId = Number(id);
    const cid = Number(coverId);
    if (Number.isNaN(bookId) || Number.isNaN(cid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');

    const cover = getDb()
      .select({
        local_path: bookCovers.local_path,
        remote_key: bookCovers.remote_key,
        mime_type: bookCovers.mime_type,
        primary_location: bookCovers.primary_location,
      })
      .from(bookCovers)
      .where(and(eq(bookCovers.id, cid), eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId)))
      .get();
    if (!cover) return reply.code(404).send();

    const key = cover.primary_location === 'cloud' ? cover.remote_key : cover.local_path;
    if (!key) return reply.code(404).send();

    const driver = cover.primary_location === 'cloud' ? 's3' : 'local';
    const storage = getStorageByDriver(driver);
    const exists = await storage.exists(key).catch(() => false);
    if (!exists) return reply.code(404).send();

    const stream = await storage.getStream(key);
    return reply
      .header('Content-Type', cover.mime_type ?? coverMimeFromExt(extname(key)))
      .header('Cache-Control', 'public, max-age=86400')
      .send(stream);
  });

  app.get('/books/:id/cover', async (req, reply) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const book = getDb()
      .select({ cover_path: books.cover_path })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!book?.cover_path) {
      reply.header('Cache-Control', 'no-store');
      return reply.code(404).send();
    }
    const storage = getStorageByDriver('local');
    const exists = await storage.exists(book.cover_path).catch(() => false);
    if (!exists) {
      reply.header('Cache-Control', 'no-store');
      return reply.code(404).send();
    }

    const stream = await storage.getStream(book.cover_path);
    return reply
      .header('Content-Type', coverMimeFromExt(extname(book.cover_path)))
      .header('Cache-Control', 'no-store')
      .send(stream);
  });
}
