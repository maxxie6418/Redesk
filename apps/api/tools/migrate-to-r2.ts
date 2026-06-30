import { and, eq, isNotNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from '../src/config';
import { getDb, initDatabase } from '../src/db';
import { bookCovers, bookFiles, settings } from '@redesk/db';
import { LocalStorage } from '../src/lib/storage';
import { S3Storage, type S3StorageConfig } from '../src/lib/s3-storage';
import { SETTINGS_KEYS, STORAGE_SETTINGS_OWNER_ID } from '../src/lib/storage-factory';

interface CliOptions {
  dryRun: boolean;
  batch: number;
  ownerId: number;
  keepLocal: boolean;
  onlyBookId: number | null;
  limit: number | null;
  forceReupload: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    batch: 20,
    ownerId: 0,
    keepLocal: true,
    onlyBookId: null,
    limit: null,
    forceReupload: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--no-keep-local') opts.keepLocal = false;
    else if (arg === '--force') opts.forceReupload = true;
    else if (arg === '--batch') opts.batch = Math.max(1, Number(argv[++i]));
    else if (arg === '--owner') opts.ownerId = Number(argv[++i]);
    else if (arg === '--book') opts.onlyBookId = Number(argv[++i]);
    else if (arg === '--limit') opts.limit = Math.max(1, Number(argv[++i]));
    else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`[migrate] unknown arg: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`migrate-to-r2 — 将 storage_driver='local' 的文件批量上传到 R2/S3

Usage:
  tsx tools/migrate-to-r2.ts [options]

Options:
  --dry-run              只统计，不上传、不写库、不删本地
  --no-keep-local        上传成功且校验通过后删除本地副本
  --force                重新上传已 storage_driver='s3' 的文件
  --batch N              每批处理 N 条（默认 20）
  --owner ID             仅迁移某用户（默认全部）
  --book ID              仅迁移某 book
  --limit N              最多处理 N 条
  -h, --help             打印本帮助

示例:
  tsx tools/migrate-to-r2.ts --dry-run
  tsx tools/migrate-to-r2.ts --batch 10
  tsx tools/migrate-to-r2.ts --book 42 --no-keep-local
`);
}

function readSettingValue(key: string, ownerId: number): string | null {
  const row = getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.owner_id, ownerId), eq(settings.key, key)))
    .get();
  return row?.value ?? null;
}

function buildS3Config(ownerId: number): S3StorageConfig {
  return {
    endpoint: readSettingValue(SETTINGS_KEYS.endpoint, ownerId) ?? '',
    region: readSettingValue(SETTINGS_KEYS.region, ownerId) ?? 'auto',
    bucket: readSettingValue(SETTINGS_KEYS.bucket, ownerId) ?? '',
    accessKeyId: readSettingValue(SETTINGS_KEYS.accessKey, ownerId) ?? '',
    secretAccessKey: readSettingValue(SETTINGS_KEYS.secretKey, ownerId) ?? '',
    publicUrlBase: readSettingValue(SETTINGS_KEYS.publicUrl, ownerId) ?? undefined,
    forcePathStyle: true,
  };
}

function validateConfig(cfg: S3StorageConfig): string[] {
  const missing: string[] = [];
  if (!cfg.endpoint) missing.push('oss_endpoint');
  if (!cfg.bucket) missing.push('oss_bucket');
  if (!cfg.accessKeyId) missing.push('oss_access_key');
  if (!cfg.secretAccessKey) missing.push('oss_secret_key');
  return missing;
}

interface FileRow {
  id: number;
  owner_id: number;
  book_id: number | null;
  file_path: string;
  storage_driver: string;
  file_size: number | null;
  checksum: string | null;
  file_format: string;
}

interface CoverRow {
  id: number;
  owner_id: number;
  book_id: number;
  file_path: string;
  storage_driver: string;
  file_size: number | null;
  checksum: string | null;
  mime_type: string | null;
}

interface MigrationStats {
  scanned: number;
  uploaded: number;
  skipped: number;
  failed: number;
  bytesLocalRead: number;
  bytesRemoteWritten: number;
  durationMs: number;
  failures: Array<{ kind: string; id: number; reason: string }>;
}

async function migrateFiles(opts: CliOptions, s3: S3Storage | null, local: LocalStorage): Promise<MigrationStats> {
  const db = getDb();
  const t0 = Date.now();
  const stats: MigrationStats = {
    scanned: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    bytesLocalRead: 0,
    bytesRemoteWritten: 0,
    durationMs: 0,
    failures: [],
  };

  const conditions = [isNotNull(bookFiles.id)];
  if (opts.ownerId > 0) conditions.push(eq(bookFiles.owner_id, opts.ownerId));
  if (opts.onlyBookId != null) conditions.push(eq(bookFiles.book_id, opts.onlyBookId));
  if (!opts.forceReupload) conditions.push(eq(bookFiles.storage_driver, 'local'));
  if (opts.limit != null) conditions.push(eq(bookFiles.owner_id, opts.ownerId || bookFiles.owner_id));

  const baseWhere = and(...conditions);
  const total = db.select({ c: bookFiles.id }).from(bookFiles).where(baseWhere).all().length;
  console.log(`[migrate] file candidates: ${total}`);

  let offset = 0;
  let processed = 0;
  while (true) {
    const batch: FileRow[] = db
      .select()
      .from(bookFiles)
      .where(baseWhere)
      .orderBy(bookFiles.id)
      .limit(opts.batch)
      .offset(offset)
      .all();

    if (batch.length === 0) break;
    for (const row of batch) {
      processed++;
      stats.scanned++;
      const label = `book_file#${row.id} (${row.file_path})`;
      try {
        if (opts.dryRun) {
          console.log(`[dry-run] would upload ${label} size=${row.file_size ?? '?'}`);
          stats.skipped++;
          continue;
        }

        if (!(await local.exists(row.file_path))) {
          stats.failed++;
          stats.failures.push({ kind: 'book_file', id: row.id, reason: 'local file missing' });
          console.error(`[skip] ${label} — local file missing`);
          continue;
        }

        const bytes = await local.getBytes(row.file_path);
        stats.bytesLocalRead += bytes.length;

        const recomputed = createHash('sha256').update(bytes).digest('hex');
        if (row.checksum && row.checksum !== recomputed) {
          stats.failed++;
          stats.failures.push({ kind: 'book_file', id: row.id, reason: `checksum mismatch (db=${row.checksum.slice(0, 8)}, actual=${recomputed.slice(0, 8)})` });
          console.error(`[fail] ${label} — checksum mismatch`);
          continue;
        }

        const remoteKey = `migrated/${row.file_path.replace(/^\/+/, '')}`;
        await s3.putBytes(remoteKey, bytes, { contentType: 'application/octet-stream' });
        stats.bytesRemoteWritten += bytes.length;

        const remoteBytes = await s3.getBytes(remoteKey);
        const remoteHash = createHash('sha256').update(remoteBytes).digest('hex');
        if (remoteHash !== recomputed) {
          await s3.delete(remoteKey).catch(() => undefined);
          stats.failed++;
          stats.failures.push({ kind: 'book_file', id: row.id, reason: 'remote roundtrip hash mismatch' });
          console.error(`[fail] ${label} — remote roundtrip hash mismatch`);
          continue;
        }

        const remoteSize = await s3.size(remoteKey);
        if (remoteSize !== bytes.length) {
          await s3.delete(remoteKey).catch(() => undefined);
          stats.failed++;
          stats.failures.push({ kind: 'book_file', id: row.id, reason: `remote size mismatch (${remoteSize} vs ${bytes.length})` });
          continue;
        }

        db.update(bookFiles)
          .set({ storage_driver: 's3', file_path: remoteKey, updated_at: new Date().toISOString() })
          .where(eq(bookFiles.id, row.id))
          .run();

        if (!opts.keepLocal) {
          await local.delete(row.file_path).catch(() => undefined);
        }

        stats.uploaded++;
        console.log(`[ok] ${label} → ${remoteKey} (${bytes.length} bytes)`);
      } catch (err) {
        stats.failed++;
        const reason = err instanceof Error ? err.message : String(err);
        stats.failures.push({ kind: 'book_file', id: row.id, reason });
        console.error(`[err] ${label}: ${reason}`);
      }
    }
    offset += batch.length;
    if (opts.limit != null && processed >= opts.limit) {
      console.log(`[migrate] reached --limit ${opts.limit}, stop`);
      break;
    }
  }

  stats.durationMs = Date.now() - t0;
  return stats;
}

async function migrateCovers(opts: CliOptions, s3: S3Storage, local: LocalStorage): Promise<MigrationStats> {
  const db = getDb();
  const t0 = Date.now();
  const stats: MigrationStats = {
    scanned: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    bytesLocalRead: 0,
    bytesRemoteWritten: 0,
    durationMs: 0,
    failures: [],
  };

  const conditions = [isNotNull(bookCovers.id)];
  if (opts.ownerId > 0) conditions.push(eq(bookCovers.owner_id, opts.ownerId));
  if (opts.onlyBookId != null) conditions.push(eq(bookCovers.book_id, opts.onlyBookId));
  if (!opts.forceReupload) conditions.push(eq(bookCovers.storage_driver, 'local'));

  const baseWhere = and(...conditions);
  const total = db.select({ c: bookCovers.id }).from(bookCovers).where(baseWhere).all().length;
  console.log(`[migrate] cover candidates: ${total}`);

  if (total === 0) {
    stats.durationMs = Date.now() - t0;
    return stats;
  }

  let offset = 0;
  while (true) {
    const batch: CoverRow[] = db
      .select()
      .from(bookCovers)
      .where(baseWhere)
      .orderBy(bookCovers.id)
      .limit(opts.batch)
      .offset(offset)
      .all();
    if (batch.length === 0) break;

    for (const row of batch) {
      stats.scanned++;
      const label = `book_cover#${row.id} (${row.file_path})`;
      try {
        if (opts.dryRun) {
          console.log(`[dry-run] would upload ${label}`);
          stats.skipped++;
          continue;
        }
        if (!(await local.exists(row.file_path))) {
          stats.failed++;
          stats.failures.push({ kind: 'book_cover', id: row.id, reason: 'local file missing' });
          console.error(`[skip] ${label} — local file missing`);
          continue;
        }
        const bytes = await local.getBytes(row.file_path);
        stats.bytesLocalRead += bytes.length;
        const recomputed = createHash('sha256').update(bytes).digest('hex');
        if (row.checksum && row.checksum !== recomputed) {
          stats.failed++;
          stats.failures.push({ kind: 'book_cover', id: row.id, reason: 'checksum mismatch' });
          continue;
        }
        const remoteKey = `migrated/${row.file_path.replace(/^\/+/, '')}`;
        await s3.putBytes(remoteKey, bytes, { contentType: row.mime_type ?? 'image/jpeg' });
        stats.bytesRemoteWritten += bytes.length;
        const remoteBytes = await s3.getBytes(remoteKey);
        const remoteHash = createHash('sha256').update(remoteBytes).digest('hex');
        if (remoteHash !== recomputed) {
          await s3.delete(remoteKey).catch(() => undefined);
          stats.failed++;
          stats.failures.push({ kind: 'book_cover', id: row.id, reason: 'remote roundtrip hash mismatch' });
          continue;
        }
        db.update(bookCovers)
          .set({ storage_driver: 's3', file_path: remoteKey, updated_at: new Date().toISOString() })
          .where(eq(bookCovers.id, row.id))
          .run();
        if (!opts.keepLocal) {
          await local.delete(row.file_path).catch(() => undefined);
        }
        stats.uploaded++;
        console.log(`[ok] ${label} → ${remoteKey}`);
      } catch (err) {
        stats.failed++;
        const reason = err instanceof Error ? err.message : String(err);
        stats.failures.push({ kind: 'book_cover', id: row.id, reason });
        console.error(`[err] ${label}: ${reason}`);
      }
    }
    offset += batch.length;
  }
  stats.durationMs = Date.now() - t0;
  return stats;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function printStats(name: string, s: MigrationStats): void {
  console.log(`\n=== ${name} ===`);
  console.log(`scanned         : ${s.scanned}`);
  console.log(`uploaded        : ${s.uploaded}`);
  console.log(`skipped         : ${s.skipped}`);
  console.log(`failed          : ${s.failed}`);
  console.log(`bytes read      : ${fmtBytes(s.bytesLocalRead)}`);
  console.log(`bytes written   : ${fmtBytes(s.bytesRemoteWritten)}`);
  console.log(`duration        : ${(s.durationMs / 1000).toFixed(1)}s`);
  if (s.failures.length > 0) {
    console.log(`first failures  :`);
    for (const f of s.failures.slice(0, 5)) {
      console.log(`  - ${f.kind}#${f.id}: ${f.reason}`);
    }
    if (s.failures.length > 5) console.log(`  ... and ${s.failures.length - 5} more`);
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  try {
    initDatabase();
  } catch (err) {
    console.error(`[migrate] initDatabase failed: ${(err as Error).message}`);
    console.error(`[migrate] stack: ${(err as Error).stack?.split('\n').slice(0, 5).join('\n')}`);
    process.exit(1);
  }
  console.log(`[migrate] mode: ${opts.dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`[migrate] keep_local: ${opts.keepLocal}`);
  console.log(`[migrate] force_reupload: ${opts.forceReupload}`);
  console.log(`[migrate] batch: ${opts.batch}, owner: ${opts.ownerId || 'all'}, book: ${opts.onlyBookId ?? 'all'}`);

  const cfg = buildS3Config(STORAGE_SETTINGS_OWNER_ID);
  const missing = validateConfig(cfg);
  if (missing.length > 0) {
    if (opts.dryRun) {
      console.log(`[migrate] (dry-run) R2/S3 配置未填写，仅做本地文件统计：${missing.join(', ')}`);
    } else {
      console.error(`[migrate] R2/S3 配置缺失: ${missing.join(', ')}. 在「设置 → 云存储」填写。`);
      process.exit(1);
    }
  }

  const s3 = missing.length > 0 ? null : new S3Storage(cfg);
  const local = new LocalStorage(resolve(config.storageDir));
  console.log(`[migrate] local dir: ${resolve(config.storageDir)}`);
  if (s3) console.log(`[migrate] remote: ${cfg.endpoint} / ${cfg.bucket}`);

  if (!opts.dryRun && s3) {
    try {
      const probeKey = `__redesk_migrate_probe__/${Date.now()}.bin`;
      const probeBody = Buffer.from(`probe-${Date.now()}`);
      await s3.putBytes(probeKey, probeBody);
      const got = await s3.getBytes(probeKey);
      if (!got.equals(probeBody)) {
        console.error('[migrate] R2 探针校验失败，中止。');
        process.exit(1);
      }
      await s3.delete(probeKey);
      console.log('[migrate] R2 探针 OK');
    } catch (err) {
      console.error(`[migrate] R2 探针失败: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  const fileStats = await migrateFiles(opts, s3, local);
  printStats('book_files', fileStats);

  const coverStats = await migrateCovers(opts, s3, local);
  printStats('book_covers', coverStats);

  const total = fileStats.failed + coverStats.failed;
  if (total > 0 && !opts.dryRun) process.exit(1);
}

main().catch((err) => {
  console.error(`[migrate] fatal: ${(err as Error).message}`);
  process.exit(1);
});
