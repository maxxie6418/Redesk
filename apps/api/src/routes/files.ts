import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, eq, count, inArray, isNull, ne, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, createReadStream, renameSync, unlinkSync, statSync, copyFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { bookFiles, books } from '@redesk/db';
import { ERROR_CODE, updateFileSchema } from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';
import { config } from '../config';

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

function computeHash(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: string | Buffer) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function detectFormat(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return EXTENSION_FORMAT[ext] ?? (ext.slice(1).toUpperCase() || 'UNKNOWN');
}

function detectMime(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

function bookDir(bookId: number): string {
  const dir = join(config.storageDir, 'books', String(bookId));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function unassociatedDir(): string {
  const dir = join(config.storageDir, 'unassociated');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function coverDir(bookId: number): string {
  const dir = join(config.storageDir, 'covers', String(bookId));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

async function extractEpubCover(filePath: string, bookId: number): Promise<string | null> {
  try {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(filePath);

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
      const itemRegex = new RegExp(`<item\\s+[^>]*id="${coverId}"[^>]*href="([^"]+)"[^>]*\\/?>`, 'i');
      const itemMatch = opfXml.match(itemRegex);
      if (itemMatch) coverHref = itemMatch[1];
    }

    if (!coverHref) {
      const fallbackMatch = opfXml.match(/<item\s+[^>]*id="[^"]*cover[^"]*"[^>]*href="([^"]+)"[^>]*\/?>/i);
      if (fallbackMatch) coverHref = fallbackMatch[1];
    }

    if (!coverHref) {
      for (const entry of zip.getEntries()) {
        const ename = entry.entryName.toLowerCase();
        if (ename.includes('cover') && COVER_EXTS.some((ext) => ename.endsWith(ext))) {
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

    const targetDir = coverDir(bookId);
    const targetPath = join(targetDir, `cover${coverExt}`);
    zip.extractEntryTo(fullCoverPath, targetDir, false, true, false, `cover${coverExt}`);

    return targetPath;
  } catch { /* ignore */
    return null;
  }
}

export async function saveUploadedFile(
  ownerId: number,
  bookId: number | null,
  originalFilename: string,
  sourcePath: string,
  isPrimary: boolean,
  replaceFileId?: number,
): Promise<{ id: number; file_format: string; file_path: string }> {
  const fileFormat = detectFormat(originalFilename);
  const mimeType = detectMime(originalFilename);
  const ext = extname(originalFilename).toLowerCase();
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const targetDir = bookId != null ? bookDir(bookId) : unassociatedDir();
  const targetPath = join(targetDir, safeName);

  renameSync(sourcePath, targetPath);

  const fileSize = statSync(targetPath).size;
  const checksum = await computeHash(targetPath);

  const db = getDb();
  const timestamp = now();

  const dupConditions = [eq(bookFiles.owner_id, ownerId), eq(bookFiles.checksum, checksum)];
  if (replaceFileId != null) {
    dupConditions.push(ne(bookFiles.id, replaceFileId));
  }

  const dup = db
    .select({ id: bookFiles.id, original_filename: bookFiles.original_filename })
    .from(bookFiles)
    .where(and(...dupConditions))
    .get();
  if (dup) {
    try { unlinkSync(targetPath); } catch { /* ignore */ }
    throw new AppError(
      ERROR_CODE.DUPLICATE_FILE,
      `书库已存在相同文件: ${dup.original_filename ?? '未知'}`,
      [{ field: 'existing_file_id', issue: String(dup.id) }],
    );
  }

  let coverPath: string | null = null;
  if (fileFormat === 'EPUB' && bookId != null) {
    coverPath = await extractEpubCover(targetPath, bookId);
  }

  if (replaceFileId && bookId != null) {
    const existing = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, replaceFileId), eq(bookFiles.owner_id, ownerId), eq(bookFiles.book_id, bookId)))
      .get();

    if (existing) {
      try { unlinkSync(resolveStoragePath(existing.file_path)); } catch { /* ignore */ }

      db.update(bookFiles)
        .set({
          file_path: relativePath(targetPath),
          original_filename: originalFilename,
          file_format: fileFormat,
          mime_type: mimeType,
          file_size: fileSize,
          checksum,
          is_primary: isPrimary ? 1 : 0,
          updated_at: timestamp,
        })
        .where(eq(bookFiles.id, replaceFileId))
        .run();

      if (coverPath) {
        db.update(books)
          .set({ cover_path: relativePath(coverPath), updated_at: timestamp })
          .where(eq(books.id, bookId))
          .run();
      }

      return {
        id: replaceFileId,
        file_format: fileFormat,
        file_path: relativePath(targetPath),
      };
    }
  }

  if (isPrimary && bookId != null) {
    db.update(bookFiles)
      .set({ is_primary: 0 })
      .where(and(eq(bookFiles.owner_id, ownerId), eq(bookFiles.book_id, bookId)))
      .run();
  }

  const result = db
    .insert(bookFiles)
    .values({
      owner_id: ownerId,
      book_id: bookId,
      file_path: relativePath(targetPath),
      original_filename: originalFilename,
      file_format: fileFormat,
      mime_type: mimeType,
      file_size: fileSize,
      checksum,
      is_primary: isPrimary ? 1 : 0,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .returning()
    .get();

  if (coverPath && bookId != null) {
    db.update(books)
      .set({ cover_path: relativePath(coverPath), updated_at: timestamp })
      .where(eq(books.id, bookId))
      .run();
  }

  return {
    id: result.id,
    file_format: fileFormat,
    file_path: relativePath(targetPath),
  };
}

function relativePath(abs: string): string {
  const storageDir = config.storageDir.replace(/\\/g, '/');
  const absNormalized = abs.replace(/\\/g, '/');
  if (absNormalized.startsWith(storageDir)) {
    return absNormalized.slice(storageDir.length).replace(/^\//, '');
  }
  return abs;
}

function resolveStoragePath(rel: string): string {
  if (rel.includes('..')) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的文件路径');
  }
  return join(config.storageDir, rel);
}

export function deleteFilesForBooks(ownerId: number, bookIds: number[]): void {
  if (bookIds.length === 0) return;

  const db = getDb();
  const rows = db
    .select({ id: bookFiles.id, file_path: bookFiles.file_path })
    .from(bookFiles)
    .where(and(eq(bookFiles.owner_id, ownerId), inArray(bookFiles.book_id, bookIds)))
    .all();

  for (const row of rows) {
    try { unlinkSync(resolveStoragePath(row.file_path)); } catch { /* ignore */ }
  }

  if (rows.length > 0) {
    db.delete(bookFiles)
      .where(and(eq(bookFiles.owner_id, ownerId), inArray(bookFiles.id, rows.map((row) => row.id))))
      .run();
  }
}

export async function fileRoutes(app: FastifyInstance): Promise<void> {
  const ownerBookCheck = (bookId: number, userId: number) => {
    const db = getDb();
    const book = db
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

    const db = getDb();
    const rows = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
      .all();

    return { data: rows };
  });

  app.get('/books/:id/files/:fileId', async (req) => {
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
    return { data: file };
  });

  app.get('/books/:id/files/:fileId/download', async (req, reply) => {
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

    const absPath = resolveStoragePath(file.file_path);
    if (!existsSync(absPath)) throw notFound('文件已被移除');

    const fileSize = statSync(absPath).size;
    const mime = file.mime_type ?? 'application/octet-stream';
    const filename = file.original_filename ?? basename(absPath);

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize) {
        return reply
          .code(416)
          .header('Content-Range', `bytes */${fileSize}`)
          .send();
      }

      const chunkSize = end - start + 1;
      reply
        .code(206)
        .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Length', chunkSize)
        .header('Content-Type', mime)
        .header('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);

      return reply.send(createReadStream(absPath, { start, end }));
    }

    reply
      .header('Content-Length', fileSize)
      .header('Content-Type', mime)
      .header('Accept-Ranges', 'bytes')
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);

    return reply.send(createReadStream(absPath));
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
    const timestamp = now();

    const file = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
      .get();

    if (!file) throw notFound('文件不存在');

    const updateData: Record<string, unknown> = { updated_at: timestamp };

    if (input.is_primary === true) {
      db.update(bookFiles)
        .set({ is_primary: 0 })
        .where(and(eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
        .run();
      updateData.is_primary = 1;
    } else if (input.is_primary === false) {
      updateData.is_primary = 0;
    }

    if (input.original_filename !== undefined) {
      updateData.original_filename = input.original_filename;
    }

    db.update(bookFiles).set(updateData).where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId))).run();

    const updated = db.select().from(bookFiles).where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId))).get();
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

    try { unlinkSync(resolveStoragePath(file.file_path)); } catch { /* ignore */ }

    db.delete(bookFiles).where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId))).run();

    const remaining = db
      .select({ c: count() })
      .from(bookFiles)
      .where(and(eq(bookFiles.owner_id, userId), eq(bookFiles.book_id, bookId)))
      .get();

    if (remaining?.c === 0) {
      db.update(books)
        .set({ cover_path: null, updated_at: now() })
        .where(eq(books.id, bookId))
        .run();
    }

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
      throw new AppError(
        ERROR_CODE.VALIDATION_ERROR,
        `不支持的文件格式: ${ext || '未知'}`,
      );
    }

    const tmpDirPath = join(config.storageDir, 'tmp');
    if (!existsSync(tmpDirPath)) mkdirSync(tmpDirPath, { recursive: true });
    const tmpPath = join(tmpDirPath, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);

    try {
      await pipeline(data.file, createWriteStream(tmpPath));
    } catch { /* ignore */
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
      throw new AppError(ERROR_CODE.INTERNAL_ERROR, '文件保存失败');
    }

    const isPrimary = data.fields?.is_primary != null
      ? (data.fields.is_primary as unknown as string) === 'true'
      : false;

    const r = await saveUploadedFile(userId, bookId, originalFilename, tmpPath, isPrimary);
    reply.code(201);
    return { data: r };
  });

  app.post('/books/:id/files/:fileId/replace', async (req, _reply) => {
    const userId = requireUserId(req);
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    ownerBookCheck(bookId, userId);

    const db = getDb();
    const existing = db
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
      throw new AppError(
        ERROR_CODE.VALIDATION_ERROR,
        `不支持的文件格式: ${ext || '未知'}`,
      );
    }

    const tmpDirPath = join(config.storageDir, 'tmp');
    if (!existsSync(tmpDirPath)) mkdirSync(tmpDirPath, { recursive: true });
    const tmpPath = join(tmpDirPath, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);

    try {
      await pipeline(data.file, createWriteStream(tmpPath));
    } catch { /* ignore */
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
      throw new AppError(ERROR_CODE.INTERNAL_ERROR, '文件保存失败');
    }

    const r = await saveUploadedFile(
      userId,
      bookId,
      originalFilename,
      tmpPath,
      existing.is_primary === 1,
      fid,
    );

    return { data: r };
  });

  app.post('/files/unassociated', async (req, reply) => {
    const userId = requireUserId(req);

    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供文件');

    const originalFilename = data.filename || 'unknown';
    const ext = extname(originalFilename).toLowerCase();
    if (!EXTENSION_FORMAT[ext]) {
      throw new AppError(
        ERROR_CODE.VALIDATION_ERROR,
        `不支持的文件格式: ${ext || '未知'}`,
      );
    }

    const tmpDirPath = join(config.storageDir, 'tmp');
    if (!existsSync(tmpDirPath)) mkdirSync(tmpDirPath, { recursive: true });
    const tmpPath = join(tmpDirPath, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);

    try {
      await pipeline(data.file, createWriteStream(tmpPath));
    } catch { /* ignore */
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
      throw new AppError(ERROR_CODE.INTERNAL_ERROR, '文件保存失败');
    }

    const r = await saveUploadedFile(userId, null, originalFilename, tmpPath, false);
    reply.code(201);
    return { data: r };
  });

  app.get('/files/unassociated', async (req) => {
    const userId = requireUserId(req);
    const db = getDb();

    const rows = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
      .all();

    return { data: rows };
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
          `目标书籍已存在相同文件: ${dup.original_filename ?? '未知'}`,
          [{ field: 'existing_file_id', issue: String(dup.id) }],
        );
      }
    }

    const srcAbsPath = resolveStoragePath(file.file_path);
    const dstDir = bookDir(targetBookId);
    const dstPath = join(dstDir, basename(srcAbsPath));

    if (existsSync(srcAbsPath)) {
      copyFileSync(srcAbsPath, dstPath);
      try { unlinkSync(srcAbsPath); } catch { /* ignore */ }
    }

    const timestamp = now();
    const newPath = relativePath(dstPath);

    db.update(bookFiles)
      .set({
        book_id: targetBookId,
        file_path: newPath,
        updated_at: timestamp,
      })
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId)))
      .run();

    if (file.file_format === 'EPUB') {
      const coverPath = await extractEpubCover(dstPath, targetBookId);
      if (coverPath) {
        db.update(books)
          .set({ cover_path: relativePath(coverPath), updated_at: timestamp })
          .where(eq(books.id, targetBookId))
          .run();
      }
    }

    const updated = db.select().from(bookFiles).where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId))).get();
    return { data: updated };
  };

  app.post('/files/:fileId/match', matchUnassociatedFile);
  app.post('/files/unassociated/:fileId/match', matchUnassociatedFile);

  app.delete('/files/unassociated/:fileId', async (req) => {
    const userId = requireUserId(req);
    const { fileId } = req.params as { fileId: string };
    const fid = Number(fileId);
    if (Number.isNaN(fid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的文件 ID');

    const db = getDb();
    const file = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
      .get();

    if (!file) throw notFound('文件不存在或已关联书籍');

    try { unlinkSync(resolveStoragePath(file.file_path)); } catch { /* ignore */ }

    db.delete(bookFiles).where(and(eq(bookFiles.id, fid), eq(bookFiles.owner_id, userId))).run();

    return { data: { id: fid, deleted: true } };
  });

  app.get('/files', async (req) => {
    const userId = requireUserId(req);
    const query = req.query as Record<string, string>;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(query.page_size) || 20));

    const db = getDb();
    const conditions: ReturnType<typeof and>[] = [eq(bookFiles.owner_id, userId)];

    if (query.format) {
      conditions.push(eq(bookFiles.file_format, query.format.toUpperCase()));
    }

    if (query.associated === 'true') {
      conditions.push(sql`${bookFiles.book_id} IS NOT NULL`);
    } else if (query.associated === 'false') {
      conditions.push(isNull(bookFiles.book_id));
    }

    const where = and(...conditions);

    const totalResult = db
      .select({ value: count() })
      .from(bookFiles)
      .leftJoin(books, eq(bookFiles.book_id, books.id))
      .where(where)
      .get();

    const total = totalResult?.value ?? 0;

    const rows = db
      .select({
        file: bookFiles,
        book_title: books.title,
      })
      .from(bookFiles)
      .leftJoin(books, eq(bookFiles.book_id, books.id))
      .where(where)
      .orderBy(sql`${bookFiles.created_at} DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      data: rows.map((r) => ({
        ...r.file,
        book_title: r.book_title,
      })),
      pagination: { page, page_size: pageSize, total },
    };
  });

  app.get('/books/:id/cover', async (req, reply) => {
    const userId = requireUserId(req);
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const db = getDb();
    const book = db
      .select({ cover_path: books.cover_path })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!book?.cover_path) {
      return reply.code(404).send();
    }

    const absPath = resolveStoragePath(book.cover_path);
    if (!existsSync(absPath)) {
      return reply.code(404).send();
    }

    const ext = extname(absPath).toLowerCase();
    const mimeMapCover: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    return reply
      .header('Content-Type', mimeMapCover[ext] ?? 'image/jpeg')
      .header('Cache-Control', 'public, max-age=86400')
      .send(createReadStream(absPath));
  });
}
