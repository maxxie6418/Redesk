import type { Storage } from './storage';
import { LocalStorage } from './storage';
import { S3Storage, type S3StorageConfig } from './s3-storage';
import { config } from '../config';
import { eq, and, asc } from 'drizzle-orm';
import { cloudConnections, cloudUsageAssignments, settings, users, type CloudConnectionType, type CloudUsage, type StorageMode } from '@redesk/db';
import { WebDavStorage } from './webdav-storage';
import { getDb } from '../db';
import { storageDebug, storageError } from './storage-debug';

export const SETTINGS_KEYS = {
  defaultStorageMode: 'default_storage_mode',
  driver: 'storage_driver',
  provider: 'oss_provider',
  endpoint: 'oss_endpoint',
  bucket: 'oss_bucket',
  accessKey: 'oss_access_key',
  secretKey: 'oss_secret_key',
  region: 'oss_region',
  publicUrl: 'oss_public_url',
} as const;

export type StorageDriver = 'local' | 's3';
export type StorageLocation = 'local' | 'cloud';

export interface StorageStatus {
  defaultStorageMode: StorageMode;
  cloudAvailable: boolean;
  configured: boolean;
  provider: string | null;
  bucket: string | null;
  endpoint: string | null;
  hasAccessKey: boolean;
  hasSecretKey: boolean;
  region: string | null;
  publicUrl: string | null;
  reason: string | null;
}

export class StorageNotConfiguredError extends Error {
  constructor(public readonly driver: StorageDriver) {
    super(`存储后端未配置: ${driver}`);
  }
}

export class StorageModeNotAvailableError extends Error {
  constructor(public readonly mode: StorageMode, reason?: string) {
    super(`存储模式不可用: ${mode}${reason ? ` (${reason})` : ''}`);
  }
}

function parseCloudConfig(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function createCloudStorage(type: CloudConnectionType, raw: string): Storage {
  const cfg = parseCloudConfig(raw);
  if (type === 's3') {
    return new S3Storage({
      endpoint: String(cfg.endpoint ?? ''), region: String(cfg.region ?? 'auto'), bucket: String(cfg.bucket ?? ''),
      accessKeyId: String(cfg.access_key ?? ''), secretAccessKey: String(cfg.secret_key ?? ''),
      publicUrlBase: typeof cfg.public_url === 'string' && cfg.public_url ? cfg.public_url : undefined, forcePathStyle: true,
    });
  }
  return new WebDavStorage({ url: String(cfg.url ?? ''), username: typeof cfg.username === 'string' ? cfg.username : null, password: String(cfg.password ?? ''), basePath: typeof cfg.base_path === 'string' ? cfg.base_path : null });
}

function getActiveConnection(id: number) {
  const ownerId = getSettingsOwnerId();
  if (!ownerId) return null;
  return getDb().select().from(cloudConnections).where(and(eq(cloudConnections.id, id), eq(cloudConnections.owner_id, ownerId), eq(cloudConnections.is_active, true))).get() ?? null;
}

export function getStorageByConnectionId(connectionId: number): Storage {
  const connection = getActiveConnection(connectionId);
  if (!connection) throw new StorageNotConfiguredError('s3');
  return createCloudStorage(connection.type, connection.config);
}

export function getCloudStoragesForUsage(usage: CloudUsage): Array<{ connectionId: number; storage: Storage }> {
  const ownerId = getSettingsOwnerId();
  if (!ownerId) return [];
  const rows = getDb().select({ connection_id: cloudUsageAssignments.connection_id, type: cloudConnections.type, config: cloudConnections.config })
    .from(cloudUsageAssignments)
    .innerJoin(cloudConnections, eq(cloudUsageAssignments.connection_id, cloudConnections.id))
    .where(and(eq(cloudUsageAssignments.owner_id, ownerId), eq(cloudUsageAssignments.usage, usage), eq(cloudConnections.is_active, true)))
    .orderBy(asc(cloudUsageAssignments.priority))
    .all();
  return rows.map((row) => ({ connectionId: row.connection_id, storage: createCloudStorage(row.type, row.config) }));
}

export function getCloudStorageForUsage(usage: CloudUsage): { connectionId: number; storage: Storage } {
  const target = getCloudStoragesForUsage(usage)[0];
  if (!target) throw new StorageNotConfiguredError('s3');
  return target;
}

function readSettingsValue(key: string): string | null {
  try {
    const ownerId = getSettingsOwnerId();
    if (!ownerId) return null;
    const row = getDb()
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.owner_id, ownerId), eq(settings.key, key)))
      .get();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function getSettingsOwnerId(): number | null {
  try {
    const row = getDb()
      .select({ id: users.id })
      .from(users)
      .orderBy(asc(users.id))
      .limit(1)
      .get();
    return row?.id ?? null;
  } catch {
    return null;
  }
}

export function readStorageSetting(key: string): string | null {
  return readSettingsValue(key);
}

function buildS3Config(): S3StorageConfig {
  return {
    endpoint: readSettingsValue(SETTINGS_KEYS.endpoint) ?? '',
    region: readSettingsValue(SETTINGS_KEYS.region) ?? 'auto',
    bucket: readSettingsValue(SETTINGS_KEYS.bucket) ?? '',
    accessKeyId: readSettingsValue(SETTINGS_KEYS.accessKey) ?? '',
    secretAccessKey: readSettingsValue(SETTINGS_KEYS.secretKey) ?? '',
    publicUrlBase: readSettingsValue(SETTINGS_KEYS.publicUrl) ?? undefined,
    forcePathStyle: true,
  };
}

function isS3ConfigComplete(c: S3StorageConfig): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!c.endpoint) missing.push('oss_endpoint');
  if (!c.bucket) missing.push('oss_bucket');
  if (!c.accessKeyId) missing.push('oss_access_key');
  if (!c.secretAccessKey) missing.push('oss_secret_key');
  return { ok: missing.length === 0, missing };
}

function resolveDefaultStorageMode(): StorageMode {
  const raw = readSettingsValue(SETTINGS_KEYS.defaultStorageMode)?.toLowerCase();
  if (raw === 'cloud_only' || raw === 'dual') return raw;
  return 'local_only';
}

interface Cache {
  local: LocalStorage;
  s3: S3Storage | null;
  s3Error: string | null;
  defaultStorageMode: StorageMode;
}

let cached: Cache | null = null;

function buildCache(): Cache {
  const local = new LocalStorage(config.storageDir);
  const cfg = buildS3Config();
  const completeness = isS3ConfigComplete(cfg);
  storageDebug(`[Storage] Building cache: configured=${completeness.ok}, hasEndpoint=${Boolean(cfg.endpoint)}, hasBucket=${Boolean(cfg.bucket)}, region=${cfg.region}, hasAccessKey=${Boolean(cfg.accessKeyId)}, hasSecretKey=${Boolean(cfg.secretAccessKey)}, forcePathStyle=${cfg.forcePathStyle}`);
  storageDebug(`[Storage] Config completeness: ok=${completeness.ok}, missing=${completeness.missing.join(',')}`);
  let s3: S3Storage | null = null;
  let s3Error: string | null = null;
  if (completeness.ok) {
    try {
      s3 = new S3Storage(cfg);
      storageDebug('[Storage] S3 client initialized successfully');
    } catch (err) {
      s3Error = (err as Error).message;
      storageError(`[Storage] S3 client initialization failed: error_name=${(err as Error).name}, message=${s3Error}`);
    }
  } else {
    s3Error = `配置不完整，缺少：${completeness.missing.join(', ')}`;
    storageDebug(`[Storage] S3 not configured: missing=${completeness.missing.join(',')}`);
  }

  const defaultStorageMode = resolveDefaultStorageMode();
  storageDebug(`[Storage] Cache built: defaultStorageMode=${defaultStorageMode}, s3Available=${s3 != null}`);
  return { local, s3, s3Error, defaultStorageMode };
}

function ensureCache(): Cache {
  if (!cached) cached = buildCache();
  return cached;
}

export function getLocalStorage(): LocalStorage {
  return ensureCache().local;
}

export function getS3Storage(): S3Storage {
  const c = ensureCache();
  if (!c.s3) throw new StorageNotConfiguredError('s3');
  return c.s3;
}

export function getStorageByDriver(driver: StorageDriver): Storage {
  const c = ensureCache();
  if (driver === 's3') {
    if (!c.s3) throw new StorageNotConfiguredError('s3');
    return c.s3;
  }
  return c.local;
}

export function resolvePrimaryLocation(mode: StorageMode): StorageLocation {
  if (mode === 'cloud_only') return 'cloud';
  return 'local';
}

export function resolveStorageDriverForMode(mode: StorageMode): StorageDriver {
  return resolvePrimaryLocation(mode) === 'cloud' ? 's3' : 'local';
}

export function getStorageDriversForMode(mode: StorageMode): StorageDriver[] {
  if (mode === 'cloud_only') return ['s3'];
  if (mode === 'dual') return ['local', 's3'];
  return ['local'];
}

export function getStorageForMode(mode: StorageMode): Storage {
  return getStorageByDriver(resolveStorageDriverForMode(mode));
}

export function isCloudAvailable(): boolean {
  return getCloudStoragesForUsage('book_files').length > 0;
}

export function assertStorageModeAvailable(mode: StorageMode): void {
  if (mode === 'local_only') return;
  if (!isCloudAvailable()) throw new StorageModeNotAvailableError(mode, '书籍文件未分配可用的云连接');
}

export function getDefaultStorageMode(): StorageMode {
  return ensureCache().defaultStorageMode;
}

export function normalizeStorageMode(mode: unknown): StorageMode {
  if (mode === 'cloud_only' || mode === 'dual') return mode;
  return 'local_only';
}

export function getStorageStatus(): StorageStatus {
  const c = ensureCache();
  const target = getCloudStoragesForUsage('book_files')[0] ?? null;
  const connection = target ? getActiveConnection(target.connectionId) : null;
  const cfg = connection ? parseCloudConfig(connection.config) : null;
  return {
    defaultStorageMode: c.defaultStorageMode,
    cloudAvailable: target != null,
    configured: target != null,
    provider: typeof cfg?.provider === 'string' ? cfg.provider : connection?.type ?? null,
    bucket: typeof cfg?.bucket === 'string' ? cfg.bucket : null,
    endpoint: typeof cfg?.endpoint === 'string' ? cfg.endpoint : typeof cfg?.url === 'string' ? cfg.url : null,
    hasAccessKey: Boolean(cfg?.access_key ?? cfg?.username),
    hasSecretKey: Boolean(cfg?.secret_key ?? cfg?.password),
    region: typeof cfg?.region === 'string' ? cfg.region : null,
    publicUrl: typeof cfg?.public_url === 'string' ? cfg.public_url : null,
    reason: target ? null : '书籍文件尚未分配云连接',
  };
}

export function refreshStorage(): StorageStatus {
  cached = buildCache();
  return getStorageStatus();
}

export function resetStorageCache(): void {
  cached = null;
}

export function clearStorageCacheForTests(): void {
  cached = null;
}
