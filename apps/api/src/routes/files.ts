import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { extname, basename } from 'node:path';
import { bookCovers, bookFiles, books, type StorageMode } from '@redesk/db';
import {
  BOOK_COVER_SOURCE_TYPE,
  ERROR_CODE,
  EXTENSION_FORMATS,
  MIME_TYPES,
  activateBookCoverSchema,
  applyFileMatchesSchema,
  batchSendFilesToCloudSchema,
  batchFetchBookCoversSchema,
  fileMatchCandidatesSchema,
  fetchBookCoverSchema,
  matchFileToBookSchema,
  storageModeSchema,
  updateFileSchema,
} from '@redesk/shared';
import { getDb } from '../db';
import { AppError, notFound } from '../lib/errors';
import { requireAdmin, requirePermission } from '../lib/auth';
import { validate } from '../lib/zod';
import {
  assertStorageModeAvailable,
  getCloudStorageForUsage,
  getStorageByConnectionId,
  getDefaultStorageMode,
  getStorageByDriver,
  resolvePrimaryLocation,
} from '../lib/storage-factory';
import type { Storage } from '../lib/storage';
import { fetchBookMetadataFromUrl } from '../lib/book-metadata';
import { fetchPage } from '../lib/fetch-utils';
import { randomStorageToken, storageDebug, storageError } from '../lib/storage-debug';

export const EXTENSION_FORMAT: Record<string, string> = EXTENSION_FORMATS;
const MIME_MAP: Record<string, string> = MIME_TYPES;

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

function fileStorageKey(prefix: string, filename: string): string {
  const ext = extname(basename(filename)).toLowerCase();
  return `${prefix}/${randomStorageToken()}${ext}`;
}

export function bookFileKey(bookId: number, filename: string): string {
  return fileStorageKey(`books/${bookId}`, filename);
}

export function unassociatedFileKey(ownerId: number, filename: string): string {
  return fileStorageKey(`unassociated/${ownerId}`, filename);
}

export function buildContentDisposition(filename: string): string {
  const safeFilename = basename(filename).replace(/[\r\n]/g, '');
  const ext = extname(safeFilename).replace(/[^a-zA-Z0-9.]/g, '');
  const fallback = `download${ext || '.bin'}`;
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
}

function bookCoverKey(bookId: number, ext: string): string {
  return `covers/${bookId}/cover_${Date.now()}_${randomStorageToken()}${ext}`;
}

function remoteCoverKey(bookId: number, ext: string): string {
  return `covers/${bookId}/remote_${Date.now()}_${randomStorageToken()}${ext}`;
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

const FILE_MATCH_MODE_CONFIG = {
  conservative: { accept: 0.9, review: 0.75, gap: 0.08 },
  balanced: { accept: 0.78, review: 0.58, gap: 0.06 },
  loose: { accept: 0.68, review: 0.48, gap: 0.04 },
} as const;

const FILE_MATCH_NOISE = [
  'epub',
  'pdf',
  'mobi',
  'txt',
  'azw3',
  'azw',
  'djvu',
  'docx',
  'fb2',
  'ebook',
  'z-library',
  'zlibrary',
  'z lib',
  '完整版',
  '扫描版',
  '文字版',
  '校对版',
  '插图版',
  '精校',
  '全集',
  'volume',
  'vol',
];

type FileMatchMode = keyof typeof FILE_MATCH_MODE_CONFIG;
type FileMatchLevel = 'high' | 'medium' | 'low';

interface FileDerivedMetadata {
  filename_title: string | null;
  filename_author: string | null;
  normalized_filename: string;
  epub_title: string | null;
  epub_author: string | null;
  epub_publisher: string | null;
  epub_identifier: string | null;
}

interface FileMatchCandidate {
  book_id: number;
  title: string;
  author: string | null;
  score: number;
  confidence: FileMatchLevel;
  ambiguous: boolean;
  reason: string;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function normalizeMatchText(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripExtension(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/(?:【|\[)z[\s-]*library(?:】|\])/gi, ' ')
    .replace(/\((?:z[\s-]*library|zlib)\)/gi, ' ')
    .replace(/（(?:z[\s-]*library|zlib)）/gi, ' ')
    .replace(/[=＝]/g, ' ')
    .replace(/[_\-+]+/g, ' ')
    .replace(/[·•:：,，/\\|]/g, ' ')
    .replace(/\b(v|vol|volume)\s*\d+\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const noise of FILE_MATCH_NOISE) {
    text = text.replace(new RegExp(`\\b${noise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ');
  }

  return text.replace(/\s+/g, ' ').trim();
}

function compactMatchText(value: string | null | undefined): string {
  return normalizeMatchText(value).replace(/\s+/g, '');
}

function tokenizeMatchText(value: string | null | undefined): string[] {
  return normalizeMatchText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function normalizeIdentifier(value: string | null | undefined): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^0-9X]/g, '');
}

function buildBigrams(value: string): Set<string> {
  if (!value) return new Set();
  if (value.length === 1) return new Set([value]);
  const grams = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) {
    grams.add(value.slice(index, index + 2));
  }
  return grams;
}

function diceCoefficient(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftGrams = buildBigrams(left);
  const rightGrams = buildBigrams(right);
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;

  let overlap = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) overlap += 1;
  }

  return (2 * overlap) / (leftGrams.size + rightGrams.size);
}

function extractFilenameTitle(filename: string | null | undefined): string | null {
  const raw = stripExtension(filename ?? '').trim();
  if (!raw) return null;

  const cutTokens = [' = ', '=', '（', '(', '【', '['];
  let cutIndex = raw.length;
  for (const token of cutTokens) {
    const index = raw.indexOf(token);
    if (index > 0) cutIndex = Math.min(cutIndex, index);
  }

  const title = raw.slice(0, cutIndex).replace(/[\s\-_:：]+$/g, '').trim();
  return title || raw;
}

function extractFilenameAuthor(filename: string | null | undefined): string | null {
  const raw = stripExtension(filename ?? '');
  if (!raw) return null;
  const groups = [...raw.matchAll(/(?:（|\(|【|\[)([^（）()【】\]]+)(?:）|\)|】|\])/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .filter((part) => !/z[\s-]*library|zlib/i.test(part))
    .filter((part) => !/丛书|全集|套装|volume|vol|edition|修订/i.test(part));

  return groups.at(-1) ?? null;
}

function containsCompactText(haystack: string, needle: string): boolean {
  return needle.length >= 2 && haystack.includes(needle);
}

function buildMatchReason(parts: string[]): string {
  const unique = [...new Set(parts.filter(Boolean))];
  return unique.length > 0 ? unique.join('，') : '按文件名近似匹配';
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
  usage: 'book_files' | 'covers',
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ size: number; checksum: string; localPath: string | null; remoteKey: string | null; connectionId: number | null; syncStatus: 'synced' | 'partial_failed' }> {
  const cloudTarget = mode === 'local_only' ? null : getCloudStorageForUsage(usage);
  const targets = mode === 'local_only'
    ? [{ driver: 'local' as const, storage: getStorageByDriver('local'), connectionId: null }]
    : mode === 'cloud_only'
      ? [{ driver: 'cloud' as const, storage: cloudTarget!.storage, connectionId: cloudTarget!.connectionId }]
      : [{ driver: 'local' as const, storage: getStorageByDriver('local'), connectionId: null }, { driver: 'cloud' as const, storage: cloudTarget!.storage, connectionId: cloudTarget!.connectionId }];
  storageDebug(`[Storage] writeBytesForMode: mode=${mode}, usage=${usage}, targets=${targets.length}, size=${bytes.length}`);

  const results = await Promise.allSettled(
    targets.map(async (target) => {
      try {
        const storage = target.storage;
        storageDebug(`[Storage] Writing to ${target.driver}`);
        const { size } = await storage.putBytes(key, bytes, { contentType });
        storageDebug(`[Storage] Written to ${target.driver}: size=${size}`);
        const checksum = await fileSha256(storage, key);
        storageDebug(`[Storage] Checksum calculated for ${target.driver}`);
        return { driver: target.driver, connectionId: target.connectionId, size, checksum };
      } catch (err) {
        const errorName = err instanceof Error ? err.name : 'UnknownError';
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        storageError(`[Storage] Failed to write to ${target.driver}: error_name=${errorName}, message=${errorMessage}`);
        throw err;
      }
    }),
  );

  const successes = results
    .filter((item): item is PromiseFulfilledResult<{ driver: 'local' | 'cloud'; connectionId: number | null; size: number; checksum: string }> => item.status === 'fulfilled')
    .map((item) => item.value);

  storageDebug(`[Storage] writeBytesForMode result: successes=${successes.map((s) => s.driver).join(',')}, failures=${results.filter((r) => r.status === 'rejected').length}`);

  if (successes.length === 0) {
    throw new AppError(ERROR_CODE.INTERNAL_ERROR, '文件写入失败');
  }

  return {
    size: successes[0].size,
    checksum: successes[0].checksum,
    localPath: successes.some((item) => item.driver === 'local') ? key : null,
    remoteKey: successes.some((item) => item.driver === 'cloud') ? key : null,
    connectionId: successes.find((item) => item.driver === 'cloud')?.connectionId ?? null,
    syncStatus: successes.length === targets.length ? 'synced' : 'partial_failed',
  };
}

async function writeStreamForMode(
  mode: StorageMode,
  usage: 'book_files' | 'covers',
  key: string,
  stream: NodeJS.ReadableStream,
  contentType: string,
): Promise<{ size: number; checksum: string; localPath: string | null; remoteKey: string | null; connectionId: number | null; syncStatus: 'synced' | 'partial_failed' }> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return writeBytesForMode(mode, usage, key, Buffer.concat(chunks), contentType);
}

async function sendFileRecordToCloud(file: typeof bookFiles.$inferSelect): Promise<typeof bookFiles.$inferSelect> {
  if (!file.local_path) {
    throw new AppError(ERROR_CODE.BUSINESS_ERROR, '该文件没有可用的本地副本，无法发送到云端');
  }

  assertStorageModeAvailable('cloud_only');

  const localStorage = getStorageByDriver('local');
  const cloudTarget = getCloudStorageForUsage('book_files');
  const cloudStorage = cloudTarget.storage;
  const existsLocally = await localStorage.exists(file.local_path).catch(() => false);
  if (!existsLocally) {
    throw new AppError(ERROR_CODE.BUSINESS_ERROR, '本地文件不存在，无法补发到云端');
  }

  const bytes = await localStorage.getBytes(file.local_path);
  const remoteKey = file.remote_key ?? file.local_path;
  const contentType = file.mime_type ?? detectMime(file.original_filename ?? file.file_format);
  const { size } = await cloudStorage.putBytes(remoteKey, bytes, { contentType });
  const checksum = await fileSha256(cloudStorage, remoteKey);

  const db = getDb();
  db.update(bookFiles)
    .set({
      remote_key: remoteKey,
      connection_id: cloudTarget.connectionId,
      storage_mode: file.storage_mode === 'local_only' ? 'dual' : file.storage_mode,
      sync_status: 'synced',
      file_size: size,
      checksum,
      updated_at: now(),
    })
    .where(eq(bookFiles.id, file.id))
    .run();

  const updated = db.select().from(bookFiles).where(eq(bookFiles.id, file.id)).get();
  if (!updated) {
    throw new AppError(ERROR_CODE.INTERNAL_ERROR, '发送到云端后无法读取文件记录');
  }
  return updated;
}

async function resolveReadableAsset(input: { local_path: string | null; remote_key: string | null; connection_id: number | null; primary_location: 'local' | 'cloud' }) {
  const candidates =
    input.primary_location === 'cloud'
      ? [
          { driver: 'cloud' as const, key: input.remote_key },
          { driver: 'local' as const, key: input.local_path },
        ]
      : [
          { driver: 'local' as const, key: input.local_path },
          { driver: 'cloud' as const, key: input.remote_key },
        ];

  for (const candidate of candidates) {
    if (!candidate.key) continue;
    try {
      const storage = candidate.driver === 'cloud'
        ? input.connection_id ? getStorageByConnectionId(input.connection_id) : getStorageByDriver('s3')
        : getStorageByDriver('local');
      const exists = await storage.exists(candidate.key).catch(() => false);
      if (exists) {
        return { storage, key: candidate.key };
      }
    } catch {
      continue;
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
  localPath?: string | null;
  remoteKey?: string | null;
  connectionId?: number | null;
  activate?: boolean;
}): number {
  const db = getDb();
  const timestamp = now();
  const { localPath: modeLocalPath, remoteKey: modeRemoteKey } = filePathForStorage(input.storageMode, input.key);
  const localPath = input.localPath ?? modeLocalPath;
  const remoteKey = input.remoteKey ?? modeRemoteKey;
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
        connection_id: input.connectionId ?? null,
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
      connection_id: input.connectionId ?? null,
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

async function extractEpubMetadata(
  storage: Storage,
  srcKey: string,
): Promise<Pick<FileDerivedMetadata, 'epub_title' | 'epub_author' | 'epub_publisher' | 'epub_identifier'>> {
  try {
    const bytes = await storage.getBytes(srcKey);
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(bytes);

    const containerEntry = zip.getEntry('META-INF/container.xml');
    if (!containerEntry) {
      return { epub_title: null, epub_author: null, epub_publisher: null, epub_identifier: null };
    }

    const containerXml = containerEntry.getData().toString('utf-8');
    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootfileMatch?.[1]) {
      return { epub_title: null, epub_author: null, epub_publisher: null, epub_identifier: null };
    }

    const opfEntry = zip.getEntry(rootfileMatch[1]);
    if (!opfEntry) {
      return { epub_title: null, epub_author: null, epub_publisher: null, epub_identifier: null };
    }

    const opfXml = opfEntry.getData().toString('utf-8');
    const extractTag = (tag: string): string | null => {
      const match = opfXml.match(new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)</dc:${tag}>`, 'i'));
      const value = match?.[1]?.replace(/<[^>]+>/g, '').trim();
      return value || null;
    };

    return {
      epub_title: extractTag('title'),
      epub_author: extractTag('creator'),
      epub_publisher: extractTag('publisher'),
      epub_identifier: extractTag('identifier'),
    };
  } catch {
    return { epub_title: null, epub_author: null, epub_publisher: null, epub_identifier: null };
  }
}

async function deriveFileMetadata(file: typeof bookFiles.$inferSelect): Promise<FileDerivedMetadata> {
  const filename_title = extractFilenameTitle(file.original_filename);
  const filename_author = extractFilenameAuthor(file.original_filename);
  let epub_title: string | null = null;
  let epub_author: string | null = null;
  let epub_publisher: string | null = null;
  let epub_identifier: string | null = null;

  if (file.file_format === 'EPUB') {
    const readable = await resolveReadableAsset(file);
    if (readable) {
      const metadata = await extractEpubMetadata(readable.storage, readable.key);
      epub_title = metadata.epub_title;
      epub_author = metadata.epub_author;
      epub_publisher = metadata.epub_publisher;
      epub_identifier = metadata.epub_identifier;
    }
  }

  return {
    filename_title,
    filename_author,
    normalized_filename: normalizeMatchText(file.original_filename),
    epub_title,
    epub_author,
    epub_publisher,
    epub_identifier,
  };
}

function buildFileMatchCandidate(
  derived: FileDerivedMetadata,
  book: Pick<typeof books.$inferSelect, 'id' | 'title' | 'author' | 'isbn' | 'original_title'>,
  mode: FileMatchMode,
  secondScore: number,
): FileMatchCandidate {
  const filenameCompact = compactMatchText(derived.filename_title || derived.normalized_filename);
  const filenameFullCompact = compactMatchText(derived.normalized_filename);
  const epubTitleCompact = compactMatchText(derived.epub_title);
  const titleCompact = compactMatchText(book.title);
  const originalTitleCompact = compactMatchText(book.original_title);
  const authorCompact = compactMatchText(book.author);
  const filenameAuthorCompact = compactMatchText(derived.filename_author);
  const epubAuthorCompact = compactMatchText(derived.epub_author);

  const titleScore = Math.max(
    diceCoefficient(filenameCompact, titleCompact),
    diceCoefficient(filenameFullCompact, titleCompact),
    diceCoefficient(epubTitleCompact, titleCompact),
    originalTitleCompact ? diceCoefficient(filenameCompact, originalTitleCompact) : 0,
    originalTitleCompact ? diceCoefficient(epubTitleCompact, originalTitleCompact) : 0,
  );

  const containsTitle =
    containsCompactText(filenameCompact, titleCompact) ||
    containsCompactText(filenameFullCompact, titleCompact) ||
    containsCompactText(epubTitleCompact, titleCompact) ||
    (originalTitleCompact ? containsCompactText(filenameCompact, originalTitleCompact) || containsCompactText(epubTitleCompact, originalTitleCompact) : false);

  const startsWithTitle =
    (titleCompact.length >= 2 && filenameCompact.startsWith(titleCompact)) ||
    (originalTitleCompact.length >= 2 && filenameCompact.startsWith(originalTitleCompact));

  const titleTokens = tokenizeMatchText(book.title);
  const filenameTokenSource = normalizeMatchText(derived.filename_title || derived.normalized_filename);
  const tokenHits = titleTokens.filter((token) => filenameTokenSource.includes(token)).length;
  const tokenScore = titleTokens.length > 0 ? tokenHits / titleTokens.length : 0;

  const authorScore = Math.max(
    authorCompact ? diceCoefficient(filenameAuthorCompact, authorCompact) : 0,
    authorCompact ? diceCoefficient(filenameFullCompact, authorCompact) : 0,
    authorCompact ? diceCoefficient(epubAuthorCompact, authorCompact) : 0,
  );

  const containsAuthor =
    (authorCompact.length >= 2 && containsCompactText(filenameAuthorCompact, authorCompact)) ||
    (authorCompact.length >= 2 && containsCompactText(filenameFullCompact, authorCompact)) ||
    (authorCompact.length >= 2 && containsCompactText(epubAuthorCompact, authorCompact));

  const identifierMatch =
    normalizeIdentifier(derived.epub_identifier).length >= 8 &&
    normalizeIdentifier(derived.epub_identifier) === normalizeIdentifier(book.isbn);

  const epubExactTitle =
    titleCompact.length >= 2 &&
    (epubTitleCompact === titleCompact || (originalTitleCompact.length >= 2 && epubTitleCompact === originalTitleCompact));

  let score = Math.min(
    1,
    titleScore * 0.64 +
      tokenScore * 0.14 +
      authorScore * 0.1 +
      (containsTitle ? 0.08 : 0) +
      (startsWithTitle ? 0.1 : 0) +
      (containsAuthor ? 0.05 : 0) +
      (epubExactTitle ? 0.08 : 0),
  );

  if (identifierMatch) score = 1;

  const config = FILE_MATCH_MODE_CONFIG[mode];
  const ambiguous = score >= config.review && Math.abs(score - secondScore) < config.gap;

  let confidence: FileMatchLevel = 'low';
  if (score >= config.accept && !ambiguous) confidence = 'high';
  else if (score >= config.review) confidence = 'medium';

  const reasons: string[] = [];
  if (identifierMatch) reasons.push('EPUB 标识符与 ISBN 一致');
  if (epubExactTitle) reasons.push('EPUB 书名直接命中');
  else if (derived.epub_title && containsTitle) reasons.push('EPUB 书名接近');
  if (startsWithTitle) reasons.push('文件名起始书名命中');
  else if (containsTitle) reasons.push('文件名包含书名主体');
  if (containsAuthor) reasons.push('作者命中');
  else if (authorScore >= 0.45) reasons.push('作者较接近');
  if (ambiguous) reasons.push('存在接近候选');

  return {
    book_id: book.id,
    title: book.title,
    author: book.author,
    score,
    confidence,
    ambiguous,
    reason: buildMatchReason(reasons),
  };
}

async function buildFileMatchResult(
  userId: number,
  file: typeof bookFiles.$inferSelect,
  mode: FileMatchMode,
): Promise<{
  file_id: number;
  original_filename: string | null;
  file_format: string;
  derived: FileDerivedMetadata;
  recommended_book_id: number | null;
  confidence: FileMatchLevel;
  reason: string | null;
  candidates: FileMatchCandidate[];
}> {
  const db = getDb();
  const derived = await deriveFileMetadata(file);
  const candidateBooks = db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      isbn: books.isbn,
      original_title: books.original_title,
    })
    .from(books)
    .where(and(eq(books.owner_id, userId), isNull(books.deleted_at)))
    .all();

  const preliminary = candidateBooks
    .map((book) => ({
      book,
      score: buildFileMatchCandidate(derived, book, mode, 0).score,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const candidates = preliminary
    .map((entry, index) => buildFileMatchCandidate(derived, entry.book, mode, preliminary[index + 1]?.score ?? 0))
    .sort((left, right) => right.score - left.score);

  const recommended = candidates[0] ?? null;
  const confidence = recommended?.confidence ?? 'low';

  return {
    file_id: file.id,
    original_filename: file.original_filename,
    file_format: file.file_format,
    derived,
    recommended_book_id: recommended && recommended.confidence !== 'low' ? recommended.book_id : null,
    confidence,
    reason: recommended?.reason ?? null,
    candidates,
  };
}

function applyFileMatch(
  db: ReturnType<typeof getDb>,
  userId: number,
  fileId: number,
  bookId: number,
): typeof bookFiles.$inferSelect {
  const file = db
    .select()
    .from(bookFiles)
    .where(and(eq(bookFiles.id, fileId), eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
    .get();
  if (!file) throw notFound('文件不存在或已关联');

  const book = db
    .select({ id: books.id })
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.owner_id, userId), isNull(books.deleted_at)))
    .get();
  if (!book) throw notFound('目标书籍不存在');

  db.update(bookFiles)
    .set({ book_id: bookId, updated_at: now() })
    .where(eq(bookFiles.id, fileId))
    .run();

  applyPrimaryOnLink(db, bookId, fileId);

  const updated = db.select().from(bookFiles).where(eq(bookFiles.id, fileId)).get();
  if (!updated) throw new AppError(ERROR_CODE.INTERNAL_ERROR, '匹配后无法读取文件记录');
  return updated;
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

  try {
    const res = await fetchPage({
      url: url.toString(),
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      referer: 'https://book.douban.com/',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) return null;

    const ext = coverExtFromResponse(url.toString(), contentType);
    const key = remoteCoverKey(input.bookId, ext);
    const writeResult = await writeBytesForMode(defaultMode, 'covers', key, bytes, contentType ?? coverMimeFromExt(ext));

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

  const format = detectFormat(filename);
  const mime = detectMime(filename);
  const key = bookId != null ? bookFileKey(bookId, filename) : unassociatedFileKey(ownerId, filename);
  const writeResult = await writeStreamForMode(mode, 'book_files', key, stream, mime);
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
      connection_id: writeResult.connectionId,
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
      const primaryStorage = primary === 'cloud' ? getCloudStorageForUsage('book_files').storage : getStorageByDriver('local');
      const coverInfo = await extractEpubCover(primaryStorage, key, bookId);
      if (coverInfo) {
        const coverWriteResult = await writeBytesForMode(mode, 'covers', coverInfo.key, coverInfo.bytes, coverMimeFromExt(coverInfo.ext));
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
          localPath: coverWriteResult.localPath,
          remoteKey: coverWriteResult.remoteKey,
          connectionId: coverWriteResult.connectionId,
          activate: true,
        });
      }
    } catch {
      // 提取封面失败不影响主文件保存
    }
  }

  return inserted;
}

// 替换书籍文件（保留记录 ID 与身份），与决策记录 2026-07-02 / WL-003 同步。
// 流程：写新文件到临时 key → DB 更新到新 key → storage.move 临时 → 正式 → 删除旧物理文件。
// 任一步失败回滚到旧 path，绝不允许"DB 已指向新文件但新文件不可用"的半成功状态。
export async function replaceBookFile(
  ownerId: number,
  bookId: number,
  fileId: number,
  filename: string,
  stream: NodeJS.ReadableStream,
): Promise<typeof bookFiles.$inferSelect> {
  const db = getDb();
  const old = db
    .select()
    .from(bookFiles)
    .where(
      and(
        eq(bookFiles.id, fileId),
        eq(bookFiles.book_id, bookId),
        eq(bookFiles.owner_id, ownerId),
      ),
    )
    .get();
  if (!old) throw notFound('文件不存在');

  const ext = extname(filename).toLowerCase();
  if (!EXTENSION_FORMAT[ext]) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `不支持的文件格式：${ext}`);
  }
  const format = detectFormat(filename);
  const mime = detectMime(filename);
  const mode = old.storage_mode;
  const newKey = bookFileKey(bookId, filename);
  const tmpKey = `books/${bookId}/.tmp/replace-${fileId}-${Date.now()}${ext}`;
  const primary = resolvePrimaryLocation(mode);

  // 1) 写新文件到临时 key。失败时旧文件未动，无副作用。
  const writeResult = await writeStreamForMode(mode, 'book_files', tmpKey, stream, mime);
  const newLocalPath = writeResult.localPath ? newKey : null;
  const newRemoteKey = writeResult.remoteKey ? newKey : null;
  const timestamp = now();

  // 2) DB 一次更新：metadata + path 全部指向 newKey。
  // 主/非主身份由 is_primary 字段本身决定，本接口不改动。
  db.update(bookFiles)
    .set({
      storage_mode: mode,
      local_path: newLocalPath,
      remote_key: newRemoteKey,
      connection_id: writeResult.connectionId,
      primary_location: primary,
      sync_status: writeResult.syncStatus,
      original_filename: basename(filename),
      file_format: format,
      mime_type: mime,
      file_size: writeResult.size,
      checksum: writeResult.checksum,
      updated_at: timestamp,
    })
    .where(eq(bookFiles.id, fileId))
    .run();

  // 3) storage.move 临时 → 正式。失败回滚 DB 到旧 path 并清理 tmp。
  const primaryStorage = primary === 'cloud' ? getCloudStorageForUsage('book_files').storage : getStorageByDriver('local');
  try {
    const storage = primaryStorage;
    await storage.move(tmpKey, newKey);
  } catch (err) {
    db.update(bookFiles)
      .set({
        storage_mode: old.storage_mode,
        local_path: old.local_path,
        remote_key: old.remote_key,
        primary_location: old.primary_location,
        sync_status: old.sync_status,
        original_filename: old.original_filename,
        file_format: old.file_format,
        mime_type: old.mime_type,
        file_size: old.file_size,
        checksum: old.checksum,
        updated_at: now(),
      })
      .where(eq(bookFiles.id, fileId))
      .run();
    try {
      await primaryStorage.delete(tmpKey);
    } catch {
      // 临时文件清理失败不阻塞回滚；孤儿文件留给未来清理任务
    }
    throw err;
  }

  // 4) 删除旧物理文件（best-effort；与 newKey 不同才需要；同 ext 替换时已被 move 覆盖）
  if (old.local_path && old.local_path !== newKey) {
    try {
      getStorageByDriver('local').delete(old.local_path).catch(() => undefined);
    } catch {
      // ignore
    }
  }
  if (old.remote_key && old.remote_key !== newKey) {
    try {
      if (old.connection_id) getStorageByConnectionId(old.connection_id).delete(old.remote_key).catch(() => undefined);
    } catch {
      // ignore
    }
  }

  const updated = db.select().from(bookFiles).where(eq(bookFiles.id, fileId)).get();
  if (!updated) throw new AppError(ERROR_CODE.INTERNAL_ERROR, '替换后无法读取文件记录');
  return updated;
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
      if (file.connection_id) {
        const s = getStorageByConnectionId(file.connection_id);
        s.delete(file.remote_key).catch(() => undefined);
      }
    } catch {
      // ignore
    }
  }
}

export function fileRoutes(app: FastifyInstance): void {
  app.post('/files/unassociated', async (req, reply) => {
    const userId = requirePermission(req, 'use');
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
    const userId = requirePermission(req, 'read');
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
    const userId = requirePermission(req, 'read');
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
    const userId = requirePermission(req, 'use');
    const { id } = req.params as { id: string };
    const fileId = Number(id);
    if (Number.isNaN(fileId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的文件 ID');

    const input = validate(matchFileToBookSchema, req.body ?? {});
    const db = getDb();
    return { data: applyFileMatch(db, userId, fileId, input.book_id) };
  });

  app.post('/files/match/candidates', async (req) => {
    const userId = requirePermission(req, 'read');
    const input = validate(fileMatchCandidatesSchema, req.body ?? {});
    const db = getDb();

    const files = db
      .select()
      .from(bookFiles)
      .where(and(inArray(bookFiles.id, input.file_ids), eq(bookFiles.owner_id, userId), isNull(bookFiles.book_id)))
      .all();

    const fileMap = new Map(files.map((file) => [file.id, file]));
    const orderedFiles = input.file_ids
      .map((id) => fileMap.get(id))
      .filter((file): file is typeof bookFiles.$inferSelect => Boolean(file));

    const items = await Promise.all(orderedFiles.map((file) => buildFileMatchResult(userId, file, input.mode)));
    return { data: items };
  });

  app.post('/files/match/apply-batch', async (req) => {
    const userId = requirePermission(req, 'use');
    const input = validate(applyFileMatchesSchema, req.body ?? {});
    const db = getDb();

    const applied: typeof bookFiles.$inferSelect[] = [];
    const failed: Array<{ file_id: number; book_id: number; message: string }> = [];

    for (const item of input.items) {
      try {
        applied.push(applyFileMatch(db, userId, item.file_id, item.book_id));
      } catch (error) {
        failed.push({
          file_id: item.file_id,
          book_id: item.book_id,
          message: error instanceof Error ? error.message : '匹配失败',
        });
      }
    }

    return {
      data: {
        applied,
        failed,
        total: input.items.length,
        success_count: applied.length,
        failed_count: failed.length,
      },
    };
  });

  app.post('/files/batch/send-to-cloud', async (req) => {
    const userId = requireAdmin(req);
    const input = validate(batchSendFilesToCloudSchema, req.body ?? {});
    const db = getDb();

    const rows = db
      .select()
      .from(bookFiles)
      .where(and(eq(bookFiles.owner_id, userId), inArray(bookFiles.id, input.ids)))
      .all();

    if (rows.length === 0) {
      throw notFound('未找到可发送到云端的文件');
    }

    const synced: typeof bookFiles.$inferSelect[] = [];
    const failed: Array<{ file_id: number; message: string }> = [];

    for (const file of rows) {
      try {
        synced.push(await sendFileRecordToCloud(file));
      } catch (error) {
        failed.push({
          file_id: file.id,
          message: error instanceof Error ? error.message : '发送到云端失败',
        });
      }
    }

    return {
      data: {
        total: input.ids.length,
        success_count: synced.length,
        failed_count: failed.length,
        synced,
        failed,
      },
    };
  });

  app.post('/files/:id/match', async (req) => {
    const userId = requirePermission(req, 'use');
    const { id } = req.params as { id: string };
    const fileId = Number(id);
    if (Number.isNaN(fileId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的文件 ID');

    const input = validate(matchFileToBookSchema, req.body ?? {});
    const db = getDb();
    return { data: applyFileMatch(db, userId, fileId, input.book_id) };
  });

  app.delete('/files/unassociated/:id', async (req) => {
    const userId = requirePermission(req, 'use');
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
    const userId = requirePermission(req, 'read');
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
    const userId = requirePermission(req, 'use');
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
    const userId = requirePermission(req, 'use');
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
    }

    db.update(bookFiles).set(updates).where(eq(bookFiles.id, fid)).run();

    return { data: db.select().from(bookFiles).where(eq(bookFiles.id, fid)).get() };
  });

  app.post('/books/:id/files/:fileId/replace', async (req, reply) => {
    const userId = requirePermission(req, 'use');
    const { id, fileId } = req.params as { id: string; fileId: string };
    const bookId = Number(id);
    const fid = Number(fileId);
    if (Number.isNaN(bookId) || Number.isNaN(fid)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');
    }

    const data = await req.file();
    if (!data) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '未提供文件');

    const replaced = await replaceBookFile(userId, bookId, fid, data.filename, data.file);
    reply.code(200);
    return { data: replaced };
  });

  app.delete('/books/:id/files/:fileId', async (req) => {
    const userId = requirePermission(req, 'use');
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
    const userId = requirePermission(req, 'read');
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

    return reply
      .header('Content-Type', file.mime_type ?? 'application/octet-stream')
      .header('Content-Disposition', buildContentDisposition(file.original_filename ?? `book${extname(readable.key)}`))
      .send(stream);
  });

  app.get('/books/:id/covers', async (req) => {
    const userId = requirePermission(req, 'read');
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
    const userId = requirePermission(req, 'use');
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
    const userId = requirePermission(req, 'use');
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
    const writeResult = await writeBytesForMode(mode, 'covers', finalKey, bytes, coverMimeFromExt(ext));

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
    const userId = requirePermission(req, 'use');
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
    const userId = requirePermission(req, 'use');
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
    const userId = requirePermission(req, 'use');
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
      try { if (cover.connection_id) getStorageByConnectionId(cover.connection_id).delete(cover.remote_key); } catch { /* ignore */ }
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
    const userId = requirePermission(req, 'read');
    const { id, coverId } = req.params as { id: string; coverId: string };
    const bookId = Number(id);
    const cid = Number(coverId);
    if (Number.isNaN(bookId) || Number.isNaN(cid)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的参数');

    const cover = getDb()
      .select({
        local_path: bookCovers.local_path,
        remote_key: bookCovers.remote_key,
        connection_id: bookCovers.connection_id,
        mime_type: bookCovers.mime_type,
        primary_location: bookCovers.primary_location,
      })
      .from(bookCovers)
      .where(and(eq(bookCovers.id, cid), eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId)))
      .get();
    if (!cover) return reply.code(404).send();

    const readable = await resolveReadableAsset(cover);
    if (!readable) return reply.code(404).send();

    const stream = await readable.storage.getStream(readable.key);
    return reply
      .header('Content-Type', cover.mime_type ?? coverMimeFromExt(extname(readable.key)))
      .header('Cache-Control', 'public, max-age=86400')
      .send(stream);
  });

  app.get('/books/:id/cover', async (req, reply) => {
    const userId = requirePermission(req, 'read');
    const { id } = req.params as { id: string };
    const bookId = Number(id);
    if (Number.isNaN(bookId)) throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的书籍 ID');

    const db = getDb();
    const book = db
      .select({ cover_path: books.cover_path })
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.owner_id, userId)))
      .get();

    if (!book) {
      reply.header('Cache-Control', 'no-store');
      return reply.code(404).send();
    }

    const activeCover = db
      .select({
        local_path: bookCovers.local_path,
        remote_key: bookCovers.remote_key,
        connection_id: bookCovers.connection_id,
        primary_location: bookCovers.primary_location,
        mime_type: bookCovers.mime_type,
      })
      .from(bookCovers)
      .where(and(eq(bookCovers.book_id, bookId), eq(bookCovers.owner_id, userId), eq(bookCovers.is_active, 1)))
      .orderBy(desc(bookCovers.updated_at), desc(bookCovers.id))
      .get();

    if (activeCover) {
      const readable = await resolveReadableAsset(activeCover);
      if (readable) {
        const stream = await readable.storage.getStream(readable.key);
        return reply
          .header('Content-Type', activeCover.mime_type ?? coverMimeFromExt(extname(readable.key)))
          .header('Cache-Control', 'no-store')
          .send(stream);
      }
    }

    if (book.cover_path) {
      const storage = getStorageByDriver('local');
      const exists = await storage.exists(book.cover_path).catch(() => false);
      if (exists) {
        const stream = await storage.getStream(book.cover_path);
        return reply
          .header('Content-Type', coverMimeFromExt(extname(book.cover_path)))
          .header('Cache-Control', 'no-store')
          .send(stream);
      }
    }

    reply.header('Cache-Control', 'no-store');
    return reply.code(404).send();
  });
}
