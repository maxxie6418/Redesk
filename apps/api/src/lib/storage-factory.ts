import type { Storage } from './storage';
import { LocalStorage } from './storage';
import { S3Storage, type S3StorageConfig } from './s3-storage';
import { config } from '../config';
import { eq, and, asc } from 'drizzle-orm';
import { settings, users, type StorageMode } from '@redesk/db';
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
  return ensureCache().s3 != null;
}

export function assertStorageModeAvailable(mode: StorageMode): void {
  if (mode === 'local_only') return;
  const c = ensureCache();
  if (!c.s3) {
    throw new StorageModeNotAvailableError(mode, c.s3Error ?? '云存储未配置');
  }
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
  const cfg = buildS3Config();
  return {
    defaultStorageMode: c.defaultStorageMode,
    cloudAvailable: c.s3 != null,
    configured: c.s3 != null,
    provider: readSettingsValue(SETTINGS_KEYS.provider),
    bucket: cfg.bucket || null,
    endpoint: cfg.endpoint || null,
    hasAccessKey: Boolean(cfg.accessKeyId),
    hasSecretKey: Boolean(cfg.secretAccessKey),
    region: cfg.region,
    publicUrl: cfg.publicUrlBase ?? null,
    reason: c.s3 ? null : c.s3Error,
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
