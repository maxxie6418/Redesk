import type { Storage } from './storage';
import { LocalStorage } from './storage';
import { S3Storage, type S3StorageConfig } from './s3-storage';
import { config } from '../config';
import { eq, and } from 'drizzle-orm';
import { settings } from '@redesk/db';
import { getDb } from '../db';

export const STORAGE_SETTINGS_OWNER_ID = 1;

export const SETTINGS_KEYS = {
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
export type WriteDriver = StorageDriver;

export interface StorageStatus {
  writeDriver: WriteDriver;
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

function readSettingsValue(key: string): string | null {
  try {
    const row = getDb()
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.owner_id, STORAGE_SETTINGS_OWNER_ID), eq(settings.key, key)))
      .get();
    return row?.value ?? null;
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

interface Cache {
  local: LocalStorage;
  s3: S3Storage | null;
  s3Error: string | null;
  writeDriver: WriteDriver;
  writeReason: string | null;
}

let cached: Cache | null = null;

function buildCache(): Cache {
  const local = new LocalStorage(config.storageDir);
  const cfg = buildS3Config();
  const completeness = isS3ConfigComplete(cfg);
  let s3: S3Storage | null = null;
  let s3Error: string | null = null;
  if (completeness.ok) {
    try {
      s3 = new S3Storage(cfg);
    } catch (err) {
      s3Error = (err as Error).message;
    }
  } else {
    s3Error = `配置不完整，缺少：${completeness.missing.join(', ')}`;
  }

  const driverPref = (readSettingsValue(SETTINGS_KEYS.driver) ?? 'local').toLowerCase();
  let writeDriver: WriteDriver = 'local';
  let writeReason: string | null = null;
  if (driverPref === 's3' || driverPref === 'r2') {
    if (s3) {
      writeDriver = 's3';
    } else {
      writeReason = `云存储不可用（${s3Error ?? '未知原因'}），新文件将写入本地存储`;
    }
  }
  return { local, s3, s3Error, writeDriver, writeReason };
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

export function getReadStorage(driver: StorageDriver): Storage {
  const c = ensureCache();
  if (driver === 's3') {
    if (!c.s3) throw new StorageNotConfiguredError('s3');
    return c.s3;
  }
  return c.local;
}

export function getWriteStorage(): Storage {
  const c = ensureCache();
  return c.writeDriver === 's3' && c.s3 ? c.s3 : c.local;
}

export function getWriteDriver(): WriteDriver {
  return ensureCache().writeDriver;
}

export function getStorageStatus(): StorageStatus {
  const c = ensureCache();
  const cfg = buildS3Config();
  return {
    writeDriver: c.writeDriver,
    configured: c.s3 != null,
    provider: readSettingsValue(SETTINGS_KEYS.provider),
    bucket: cfg.bucket || null,
    endpoint: cfg.endpoint || null,
    hasAccessKey: Boolean(cfg.accessKeyId),
    hasSecretKey: Boolean(cfg.secretAccessKey),
    region: cfg.region,
    publicUrl: cfg.publicUrlBase ?? null,
    reason: c.writeReason,
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
