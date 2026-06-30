import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { extname, basename } from 'node:path';
import { bookCovers, bookFiles, books, type StorageDriver } from '@redesk/db';
import {
  BOOK_COVER_SOURCE_TYPE,
  ERROR_CODE,
  activateBookCoverSchema,
  batchFetchBookCoversSchema,
  fetchBookCoverSchema,
  updateFileSchema,
} from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';
import { getReadStorage, getWriteDriver, getWriteStorage } from '../lib/storage-factory';
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

function now(): string {
  return new Date().toISOString();
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

function tmpUploadKey(ext: string): string {
  return `tmp/upload_${safeName(ext)}`;
}

function tmpCoverUploadKey(ext: string): string {
  return `tmp/cover_upload_${safeName(ext)}`;
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

function syncBookCoverPath(bookId: number): void {
  const db = getDb();
  const active = db
    .select({ file_path: bookCovers.file_path })
    .from(bookCovers)
    .where(and(eq(bookCovers.book_id, bookId), eq(bookCovers.is_active, 1)))
    .orderBy(desc(bookCovers.updated_at), desc(bookCovers.id))
    .get();

  db.update(books)
    .set({ cover_path: active?.file_path ?? null, updated_at: now() })
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
  filePath: string;
  storageDriver: StorageDriver;
  mimeType: string;
  fileSize: number;
  checksum: string;
  activate?: boolean;
}): number {
  const db = getDb();
  const timestamp = now();
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
        file_path: input.filePath,
        storage_driver: input.storageDriver,
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
      file_path: input.filePath,
      storage_driver: input.storageDriver,
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
}): Promise<{ id: number; file_path: string; storage_driver: StorageDriver } | null> {
  let url: URL;
  try {
    url = new URL(input.coverUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;

  const db = getDb();
  if (!input.force) {
    const existing = db
      .select({ id: bookCovers.id, file_path: bookCovers.file_path, storage_driver: bookCovers.storage_driver })
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
      return { id: existing.id, file_path: existing.file_path, storage_driver: existing.storage_driver };
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
    const storage = getWriteStorage();
    const key = remoteCoverKey(input.bookId, ext);
    await storage.putBytes(key, bytes, { contentType: contentType ?? coverMimeFromExt(ext) });
    const checksum = await fileSha256(storage, key);
    const driver = getWriteDriver();

    const coverId = upsertBookCover({
      ownerId: input.ownerId,
      bookId: input.bookId,
      sourceType: BOOK_COVER_SOURCE_TYPE.REMOTE_FETCHED,
      sourceLabel: input.sourceLabel ?? url.hostname,
      originalUrl: input.coverUrl,
      filePath: key,
      storageDriver: driver,
      mimeType: contentType ?? coverMimeFromExt(ext),
      fileSize: bytes.length,
      checksum,
      activate: input.activate ?? true,
    });

    return { id: coverId, file_path: key, storage_driver: driver };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function saveUploadedFile(
  ownerId: number,
  bookId: number | null,
  originalFilename: string,
  sourceStream: NodeJS.ReadableStream,
  isPrimary: boolean,
  replaceFileId?: number,
): Promise<{ id: number; file_format: string; file_path: string; storage_driver: StorageDriver }> {
  const fileFormat = detectFormat(originalFilename);
  const mimeType = detectMime(originalFilename);
  const ext = extname(originalFilename).toLowerCase();
  const storage = getWriteStorage();
  const driver = getWriteDriver();

  const tmpKey = tmpUploadKey(ext);
  const teeStream = (async function* () {
    for await (const chunk of sourceStream) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
  })();

  const { size } = await storage.putStream(tmpKey, teeStream as unknown as NodeJS.ReadableStream, { contentType: mimeType });

  let finalKey: string;
  if (bookId != null) finalKey = bookFileKey(bookId, ext);
  else finalKey = unassociatedFileKey(ext);

  await storage.move(tmpKey, finalKey);

  const checksum = await fileSha256(storage, finalKey);

  const db = getDb();
  const timestamp = now();
  const dupConditions = [eq(bookFiles.owner_id, ownerId), eq(bookFiles.checksum, checksum)];
  if (replaceFileId != null) dupConditions.push(ne(bookFiles.id, replaceFileId));

  const dup = db
    .select({ id: bookFiles.id, original_filename: bookFiles.original_filename })
    .from(bookFiles)
    .where(and(...dupConditions))
    .get();

  if (dup) {
    try { await storage.delete(finalKey); } catch { /* ignore */ }
    throw new AppError(
      ERROR_CODE.DUPLICATE_FILE,
      `书库已存在相同文件: ${dup.original_filename ?? '未知文件'}`,
      [{ field: 'existing_file_id', issue: String(dup.id) }],
    );
  }

  let coverKey: string | null = null;
  if (fileFormat === 'EPUB' && bookId != null) {
    const cover = await extractEpubCover(storage, finalKey, bookId);
    if (cover) {
      await storage.putBytes(cover.key, cover.bytes, { contentType: coverMimeFromExt(cover.ext) });
      coverKey = cover.key;
    }
  }

  if (replaceFileId && bookId != null) {
    const existing = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, replaceFileId), eq(bookFiles.owner_id, ownerId), eq(bookFiles.book_id, bookId)))
      .get();

    if (existing) {
      const oldKey = existing.file_path;
      try {
        const oldStorage = getReadStorage(existing.storage_driver);
        await oldStorage.delete(oldKey);
      } catch { /* ignore */ }
      db.update(bookFiles)
        .set({
          file_path: finalKey,
          storage_driver: driver,
          original_filename: originalFilename,
          file_format: fileFormat,
          mime_type: mimeType,
          file_size: size,
          checksum,
          is_primary: isPrimary ? 1 : 0,
          updated_at: timestamp,
        })
        .where(eq(bookFiles.id, replaceFileId))
        .run();

      if (coverKey) {
        upsertBookCover({
          ownerId,
          bookId,
          bookFileId: replaceFileId,
          sourceType: BOOK_COVER_SOURCE_TYPE.EPUB_EXTRACTED,
          sourceLabel: 'epub',
          filePath: coverKey,
          storageDriver: driver,
          mimeType: coverMimeFromExt(extname(coverKey)),
          fileSize: (await storage.size(coverKey)),
          checksum: await fileSha256(storage, coverKey),
          activate: true,
        });
      }

      return { id: replaceFileId, file_format: fileFormat, file_path: finalKey, storage_driver: driver };
    }
  }

  if (isPrimary && bookId != null) {
    db.update(bookFiles).set({ is_primary: 0 }).where(and(eq(bookFiles.owner_id, ownerId), eq(bookFiles.book_id, bookId))).run();
  }

  const result = db
    .insert(bookFiles)
    .values({
      owner_id: ownerId,
      book_id: bookId,
      file_path: finalKey,
      storage_driver: driver,
      original_filename: originalFilename,
      file_format: fileFormat,
      mime_type: mimeType,
      file_size: size,
      checksum,
      is_primary: isPrimary ? 1 : 0,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .returning()
    .get();

  if (coverKey && bookId != null) {
    upsertBookCover({
      ownerId,
      bookId,
      bookFileId: result.id,
      sourceType: BOOK_COVER_SOURCE_TYPE.EPUB_EXTRACTED,
      sourceLabel: 'epub',
      filePath: coverKey,
      storageDriver: driver,
      mimeType: coverMimeFromExt(extname(coverKey)),
      fileSize: (await storage.size(coverKey)),
      checksum: await fileSha256(storage, coverKey),
      activate: true,
    });
  }

  return { id: result.id, file_format: fileFormat, file_path: finalKey, storage_driver: driver };
}

export function deleteFilesForBooks(ownerId: number, bookIds: number[]): void {
  if (bookIds.length === 0) return;
  const db = getDb();

  const fileRows = db
    .select({ id: bookFiles.id, file_path: bookFiles.file_path, storage_driver: bookFiles.storage_driver })
    .from(bookFiles)
    .where(and(eq(bookFiles.owner_id, ownerId), inArray(bookFiles.book_id, bookIds)))
    .all();

  for (const row of fileRows) {
    try {
      const s = getReadStorage(row.storage_driver);
      s.delete(row.file_path).catch(() => undefined);
    } catch { /* ignore */ }
  }
  if (fileRows.length > 0) {
    db.delete(bookFiles).where(inArray(bookFiles.id, fileRows.map((row) => row.id))).run();
  }

  const coverRows = db
    .select({ id: bookCovers.id, file_path: bookCovers.file_path, storage_driver: bookCovers.storage_driver })
    .from(bookCovers)
    .where(and(eq(bookCovers.owner_id, ownerId), inArray(bookCovers.book_id, bookIds)))
    .all();

  for (const row of coverRows) {
    try {
      const s = getReadStorage(row.storage_driver);
      s.delete(row.file_path).catch(() => undefined);
    } catch { /* ignore */ }
  }
  if (coverRows.length > 0) {
    db.delete(bookCovers).where(inArray(bookCovers.id, coverRows.map((row) => row.id))).run();
  }
}

export async function fileRoutes(app: FastifyInstance): Promise<void> {
  const ownerBookCheck = (bookId: number, userId: number) => {
    const book = getDb()
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();
    if (!book) throw notFound('书籍不存在');
  };

  app.get('/books/:id/files', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    ownerBookCheck(bookId, userId);
    return {
      data: getDb()
        .select()
        .from(bookFiles)
        .where(and(eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
        .all(),
    };
  });

  app.get('/books/:id/files/:fileId', async (req) => {
    const userId = requireUserId(req);
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    ownerBookCheck(bookId, userId);

    const file = getDb()
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
      .get();
    if (!file) throw notFound('文件不存在');
    return { data: file };
  });

  app.get('/books/:id/files/:fileId/download', async (req, reply) => {
    const userId = requireUserId(req);
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    ownerBookCheck(bookId, userId);

    const file = getDb()
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
      .get();
    if (!file) throw notFound('文件不存在');

    const storage = getReadStorage(file.storage_driver);
    const exists = await storage.exists(file.file_path).catch(() => false);
    if (!exists) throw notFound('文件已丢失');

    const fileSize = await storage.size(file.file_path);
    const mime = file.mime_type ?? 'application/octet-stream';
    const filename = file.original_filename ?? basename(file.file_path);
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize) {
        return reply.code(416).header('Content-Range', `bytes */${fileSize}`).send();
      }

      const chunkSize = end - start + 1;
      const stream = await storage.getStream(file.file_path, { range: { start, end } });
      reply
        .code(206)
        .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Length', chunkSize)
        .header('Content-Type', mime)
        .header('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);

      return reply.send(stream);
    }

    const stream = await storage.getStream(file.file_path);
    reply
      .header('Content-Length', fileSize)
      .header('Content-Type', mime)
      .header('Accept-Ranges', 'bytes')
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);

    return reply.send(stream);
  });

  app.patch('/books/:id/files/:fileId', async (req) => {
    const userId = requireUserId(req);
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    ownerBookCheck(bookId, userId);

    const input = validate(updateFileSchema, req.body);
    const db = getDb();
    const file = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
      .get();
    if (!file) throw notFound('文件不存在');

    const updateData: Record<string, unknown> = { updated_at: now() };
    if (input.is_primary === true) {
      db.update(bookFiles).set({ is_primary: 0 }).where(and(eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId))).run();
      updateData.is_primary = 1;
    } else if (input.is_primary === false) {
      updateData.is_primary = 0;
    }
    if (input.original_filename !== undefined) {
      updateData.original_filename = input.original_filename;
    }

    db.update(bookFiles).set(updateData).where(eq(bookFiles.id, fid)).run();
    const updated = db.select().from(bookFiles).where(eq(bookFiles.id, fid)).get();
    return { data: updated };
  });

  app.delete('/books/:id/files/:fileId', async (req) => {
    const userId = requireUserId(req);
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    ownerBookCheck(bookId, userId);

    const db = getDb();
    const file = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
      .get();
    if (!file) throw notFound('文件不存在');

    try {
      const s = getReadStorage(file.storage_driver);
      await s.delete(file.file_path);
    } catch { /* ignore */ }

    const relatedCovers = db
      .select({ id: bookCovers.id, file_path: bookCovers.file_path, storage_driver: bookCovers.storage_driver })
      .from(bookCovers)
      .where(and(eq(bookCovers.book_id, bookId), eq(bookCovers.book_file_id, fid)))
      .all();
    for (const cover of relatedCovers) {
      try {
        const s = getReadStorage(cover.storage_driver);
        await s.delete(cover.file_path);
      } catch { /* ignore */ }
    }
    if (relatedCovers.length > 0) {
      db.delete(bookCovers).where(inArray(bookCovers.id, relatedCovers.map((cover) => cover.id))).run();
    }

    db.delete(bookFiles).where(eq(bookFiles.id, fid)).run();
    syncBookCoverPath(bookId);
    return { data: { id: fid, deleted: true } };
  });

  app.post('/books/:id/files', async (req, reply) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    ownerBookCheck(bookId, userId);

    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供文件');

    const originalFilename = data.filename || 'unknown';
    const ext = extname(originalFilename).toLowerCase();
    if (!EXTENSION_FORMAT[ext]) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, `不支持的文件格式: ${ext || '未知'}`);
    }

    const isPrimary = data.fields?.is_primary != null
      ? String(data.fields.is_primary as unknown as string) === 'true'
      : false;

    const result = await saveUploadedFile(userId, bookId, originalFilename, data.file, isPrimary);
    reply.code(201);
    return { data: result };
  });

  app.post('/books/:id/files/:fileId/replace', async (req) => {
    const userId = requireUserId(req);
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    ownerBookCheck(bookId, userId);

    const existing = getDb()
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
      .get();
    if (!existing) throw notFound('文件不存在');

    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供文件');

    const originalFilename = data.filename || 'unknown';
    const ext = extname(originalFilename).toLowerCase();
    if (!EXTENSION_FORMAT[ext]) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, `不支持的文件格式: ${ext || '未知'}`);
    }

    const result = await saveUploadedFile(userId, bookId, originalFilename, data.file, existing.is_primary === 1, fid);
    return { data: result };
  });

  app.post('/files/unassociated', async (req, reply) => {
    const userId = requireUserId(req);
    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供文件');

    const originalFilename = data.filename || 'unknown';
    const ext = extname(originalFilename).toLowerCase();
    if (!EXTENSION_FORMAT[ext]) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, `不支持的文件格式: ${ext || '未知'}`);
    }

    const result = await saveUploadedFile(userId, null, originalFilename, data.file, false);
    reply.code(201);
    return { data: result };
  });

  app.get('/files/unassociated', async (req) => {
    const userId = requireUserId(req);
    return {
      data: getDb().select().from(bookFiles).where(and(eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id))).all(),
    };
  });

  const matchUnassociatedFile = async (req: FastifyRequest) => {
    const userId = requireUserId(req);
    const { fileId } = req.params as { fileId: string };
    const fid = Number(fileId);
    if (Number.isNaN(fid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的文件 ID');

    const body = req.body as { book_id?: number };
    const targetBookId = body.book_id;
    if (!targetBookId || Number.isNaN(targetBookId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少有效的 book_id');
    }
    ownerBookCheck(targetBookId, userId);

    const db = getDb();
    const file = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
      .get();
    if (!file) throw notFound('文件不存在或已关联书籍');

    if (file.checksum) {
      const dup = db
        .select({ id: bookFiles.id, original_filename: bookFiles.original_filename })
        .from(bookFiles)
        .where(and(eq(bookFiles.owner_id, userId), eq(bookFiles.checksum, file.checksum), ne(bookFiles.id, fid)))
        .get();
      if (dup) {
        throw new AppError(
          ERROR_CODE.DUPLICATE_FILE,
          `目标书籍已存在相同文件: ${dup.original_filename ?? '未知文件'}`,
          [{ field: 'existing_file_id', issue: String(dup.id) }],
        );
      }
    }

    const writeStorage = getWriteStorage();
    const writeDriver = getWriteDriver();
    const ext = extname(file.file_path).toLowerCase();
    const dstKey = bookFileKey(targetBookId, ext);

    if (file.storage_driver === writeDriver) {
      await writeStorage.move(file.file_path, dstKey);
    } else {
      const srcStorage = getReadStorage(file.storage_driver);
      const bytes = await srcStorage.getBytes(file.file_path);
      await writeStorage.putBytes(dstKey, bytes, { contentType: file.mime_type ?? undefined });
      await srcStorage.delete(file.file_path).catch(() => undefined);
    }

    db.update(bookFiles)
      .set({
        book_id: targetBookId,
        file_path: dstKey,
        storage_driver: writeDriver,
        updated_at: now(),
      })
      .where(eq(bookFiles.id, fid))
      .run();

    if (file.file_format === 'EPUB') {
      const cover = await extractEpubCover(writeStorage, dstKey, targetBookId);
      if (cover) {
        await writeStorage.putBytes(cover.key, cover.bytes, { contentType: coverMimeFromExt(cover.ext) });
        upsertBookCover({
          ownerId: userId,
          bookId: targetBookId,
          bookFileId: fid,
          sourceType: BOOK_COVER_SOURCE_TYPE.EPUB_EXTRACTED,
          sourceLabel: 'epub',
          filePath: cover.key,
          storageDriver: writeDriver,
          mimeType: coverMimeFromExt(cover.ext),
          fileSize: (await writeStorage.size(cover.key)),
          checksum: await fileSha256(writeStorage, cover.key),
          activate: true,
        });
      }
    }

    const updated = db.select().from(bookFiles).where(eq(bookFiles.id, fid)).get();
    return { data: updated };
  };

  app.post('/files/:fileId/match', matchUnassociatedFile);
  app.post('/files/unassociated/:fileId/match', matchUnassociatedFile);

  app.delete('/files/unassociated/:fileId', async (req) => {
    const userId = requireUserId(req);
    const { fileId } = req.params as { fileId: string };
    const fid = Number(fileId);
    if (Number.isNaN(fid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的文件 ID');

    const file = getDb()
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
      .get();
    if (!file) throw notFound('文件不存在或已关联书籍');

    try {
      const s = getReadStorage(file.storage_driver);
      await s.delete(file.file_path);
    } catch { /* ignore */ }
    getDb().delete(bookFiles).where(eq(bookFiles.id, fid)).run();
    return { data: { id: fid, deleted: true } };
  });

  app.get('/files', async (req) => {
    const userId = requireUserId(req);
    const query = req.query as Record<string, string>;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(query.page_size) || 20));

    const conditions: ReturnType<typeof and>[] = [eq(bookFiles.owner_id, userId)];
    if (query.format) conditions.push(eq(bookFiles.file_format, query.format.toUpperCase()));
    if (query.associated === 'true') {
      conditions.push(sql`${bookFiles.book_id} IS NOT NULL`);
    } else if (query.associated === 'false') {
      conditions.push(isNull(bookFiles.book_id));
    }
    const where = and(...conditions);

    const total = getDb()
      .select({ value: count() })
      .from(bookFiles)
      .where(where)
      .get()?.value ?? 0;

    const rows = getDb()
      .select({ file: bookFiles, book_title: books.title })
      .from(bookFiles)
      .leftJoin(books, eq(bookFiles.book_id, books.id))
      .where(where)
      .orderBy(sql`${bookFiles.created_at} DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      data: rows.map((row) => ({ ...row.file, book_title: row.book_title })),
      pagination: { page, page_size: pageSize, total },
    };
  });

  app.get('/books/:id/covers', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    ownerBookCheck(bookId, userId);

    return {
      data: getDb()
        .select()
        .from(bookCovers)
        .where(and(eq(bookCovers.owner_id, userId), eq(bookCovers.book_id, bookId)))
        .orderBy(desc(bookCovers.is_active), desc(bookCovers.updated_at), desc(bookCovers.id))
        .all(),
    };
  });

  app.post('/books/:id/covers/fetch', async (req) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');
    ownerBookCheck(bookId, userId);

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
    ownerBookCheck(bookId, userId);

    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供图片文件');

    const originalFilename = data.filename || 'cover.jpg';
    const ext = extname(originalFilename).toLowerCase();
    const allowedImageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    if (!allowedImageExts.includes(ext)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, `仅支持 jpg/png/webp/gif/bmp 格式，当前格式: ${ext || '未知'}`);
    }

    const storage = getWriteStorage();
    const driver = getWriteDriver();
    const tmpKey = tmpCoverUploadKey(ext);
    const { size } = await storage.putStream(tmpKey, data.file, { contentType: coverMimeFromExt(ext) });

    if (size > 5 * 1024 * 1024) {
      try { await storage.delete(tmpKey); } catch { /* ignore */ }
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '图片大小不能超过 5MB');
    }

    const finalKey = bookCoverKey(bookId, ext);
    await storage.move(tmpKey, finalKey);
    const checksum = await fileSha256(storage, finalKey);

    const coverId = upsertBookCover({
      ownerId: userId,
      bookId,
      sourceType: BOOK_COVER_SOURCE_TYPE.MANUAL_UPLOAD,
      sourceLabel: 'upload',
      filePath: finalKey,
      storageDriver: driver,
      mimeType: coverMimeFromExt(ext),
      fileSize: size,
      checksum,
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
    ownerBookCheck(bookId, userId);
    validate(activateBookCoverSchema, req.body);

    const cover = getDb()
      .select({ id: bookCovers.id })
      .from(bookCovers)
      .where(and(eq(bookCovers.id, cid), eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId)))
      .get();
    if (!cover) throw notFound('封面不存在');

    activateBookCover(bookId, cid);
    return { data: getDb().select().from(bookCovers).where(eq(bookCovers.id, cid)).get() };
  });

  app.delete('/books/:id/covers/:coverId', async (req) => {
    const userId = requireUserId(req);
    const { id, coverId } = req.params as { id: string; coverId: string };
    const bookId = Number(id);
    const cid = Number(coverId);
    if (Number.isNaN(bookId) || Number.isNaN(cid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    ownerBookCheck(bookId, userId);

    const cover = getDb()
      .select()
      .from(bookCovers)
      .where(and(eq(bookCovers.id, cid), eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId)))
      .get();
    if (!cover) throw notFound('封面不存在');

    try {
      const s = getReadStorage(cover.storage_driver);
      await s.delete(cover.file_path);
    } catch { /* ignore */ }
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
    ownerBookCheck(bookId, userId);

    const cover = getDb()
      .select({ file_path: bookCovers.file_path, mime_type: bookCovers.mime_type, storage_driver: bookCovers.storage_driver })
      .from(bookCovers)
      .where(and(eq(bookCovers.id, cid), eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId)))
      .get();
    if (!cover) return reply.code(404).send();

    const storage = getReadStorage(cover.storage_driver);
    const exists = await storage.exists(cover.file_path).catch(() => false);
    if (!exists) return reply.code(404).send();

    const stream = await storage.getStream(cover.file_path);
    return reply
      .header('Content-Type', cover.mime_type ?? coverMimeFromExt(extname(cover.file_path)))
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

    if (!book?.cover_path) return reply.code(404).send();
    const driver: StorageDriver = 'local';
    const storage = getReadStorage(driver);
    const exists = await storage.exists(book.cover_path).catch(() => false);
    if (!exists) return reply.code(404).send();

    const stream = await storage.getStream(book.cover_path);
    return reply
      .header('Content-Type', coverMimeFromExt(extname(book.cover_path)))
      .header('Cache-Control', 'public, max-age=86400')
      .send(stream);
  });
}
