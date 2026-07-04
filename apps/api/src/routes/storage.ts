import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { settings } from '@redesk/db';
import { storageSettingsSchema } from '@redesk/shared';
import { z } from 'zod';
import { Buffer } from 'node:buffer';
import { getDb } from '../db';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';
import { AppError, businessError } from '../lib/errors';
import { ERROR_CODE } from '@redesk/shared';
import {
  SETTINGS_KEYS,
  getStorageStatus,
  refreshStorage,
  resetStorageCache,
  getS3Storage,
  getSettingsOwnerId,
} from '../lib/storage-factory';
import { S3Storage, type S3StorageConfig } from '../lib/s3-storage';

const SENSITIVE_KEYS = new Set(['oss_secret_key', 'oss_access_key']);

function readSetting(key: string): string | null {
  const ownerId = getSettingsOwnerId();
  if (!ownerId) return null;
  const row = getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.owner_id, ownerId), eq(settings.key, key)))
    .get();
  return row?.value ?? null;
}

function writeSetting(key: string, value: string | null): void {
  const db = getDb();
  const ownerId = getSettingsOwnerId();
  if (!ownerId) {
    throw businessError('系统设置归属用户不存在');
  }
  if (value == null || value === '') {
    db.delete(settings)
      .where(and(eq(settings.owner_id, ownerId), eq(settings.key, key)))
      .run();
    return;
  }
  const existing = readSetting(key);
  if (existing != null) {
    db.update(settings)
      .set({ value, updated_at: new Date().toISOString() })
      .where(and(eq(settings.owner_id, ownerId), eq(settings.key, key)))
      .run();
  } else {
    db.insert(settings)
      .values({ owner_id: ownerId, key, value, updated_at: new Date().toISOString() })
      .run();
  }
}

export function normalizeSecretSettingInput(value: string | null | undefined): string | undefined {
  if (value == null || value === '') return undefined;
  return value;
}

export function resolveSecretSettingInput(
  value: string | null | undefined,
  clear = false,
): string | null | undefined {
  if (clear) return null;
  return normalizeSecretSettingInput(value);
}

function writeSecretSetting(key: string, value: string | null | undefined, clear = false): void {
  const nextValue = resolveSecretSettingInput(value, clear);
  if (nextValue === undefined) return;
  writeSetting(key, nextValue);
}

function maskSensitive(key: string, value: string | null): string | null {
  if (value == null || value === '') return null;
  if (SENSITIVE_KEYS.has(key)) {
    if (value.length <= 4) return '****';
    return `${value.slice(0, 2)}${'*'.repeat(Math.min(8, value.length - 4))}${value.slice(-2)}`;
  }
  return value;
}

const testBodySchema = z.object({
  bucket: z.string().max(200).optional(),
  endpoint: z.string().max(500).optional(),
  region: z.string().max(64).optional(),
  access_key: z.string().max(500).optional(),
  secret_key: z.string().max(500).optional(),
  public_url: z.string().max(500).optional(),
});

export async function storageRoutes(app: FastifyInstance): Promise<void> {
  app.get('/storage/status', async (req) => {
    requireUserId(req);
    return { data: getStorageStatus() };
  });

  app.get('/storage/settings', async (req) => {
    requireUserId(req);
    const result: Record<string, string | null> = {};
    for (const key of Object.values(SETTINGS_KEYS)) {
      const raw = readSetting(key);
      result[key] = maskSensitive(key, raw);
    }
    return { data: result };
  });

  app.patch('/storage/settings', async (req) => {
    requireUserId(req);
    const input = validate(storageSettingsSchema, req.body);

    const isPresent = (v: string | null | undefined): v is string => v != null && v !== '';

    writeSetting(SETTINGS_KEYS.defaultStorageMode, input.default_storage_mode);

    if (isPresent(input.driver)) writeSetting(SETTINGS_KEYS.driver, input.driver);
    else writeSetting(SETTINGS_KEYS.driver, null);

    if (isPresent(input.provider)) writeSetting(SETTINGS_KEYS.provider, input.provider);
    else writeSetting(SETTINGS_KEYS.provider, null);

    if (isPresent(input.endpoint)) writeSetting(SETTINGS_KEYS.endpoint, input.endpoint);
    else writeSetting(SETTINGS_KEYS.endpoint, null);

    if (isPresent(input.bucket)) writeSetting(SETTINGS_KEYS.bucket, input.bucket);
    else writeSetting(SETTINGS_KEYS.bucket, null);

    writeSecretSetting(SETTINGS_KEYS.accessKey, input.access_key, input.clear_access_key === true);

    writeSecretSetting(SETTINGS_KEYS.secretKey, input.secret_key, input.clear_secret_key === true);

    if (isPresent(input.region)) writeSetting(SETTINGS_KEYS.region, input.region);
    else writeSetting(SETTINGS_KEYS.region, null);

    if (isPresent(input.public_url)) writeSetting(SETTINGS_KEYS.publicUrl, input.public_url);
    else writeSetting(SETTINGS_KEYS.publicUrl, null);

    const status = refreshStorage();
    return { data: status };
  });

  app.post('/storage/refresh', async (req) => {
    requireUserId(req);
    resetStorageCache();
    return { data: refreshStorage() };
  });

  app.post('/storage/test', async (req) => {
    requireUserId(req);
    const input = validate(testBodySchema, req.body ?? {});

    const cfg: S3StorageConfig = {
      endpoint: input.endpoint ?? readSetting(SETTINGS_KEYS.endpoint) ?? '',
      region: input.region ?? readSetting(SETTINGS_KEYS.region) ?? 'auto',
      bucket: input.bucket ?? readSetting(SETTINGS_KEYS.bucket) ?? '',
      accessKeyId: input.access_key ?? readSetting(SETTINGS_KEYS.accessKey) ?? '',
      secretAccessKey: input.secret_key ?? readSetting(SETTINGS_KEYS.secretKey) ?? '',
      publicUrlBase: input.public_url ?? readSetting(SETTINGS_KEYS.publicUrl) ?? undefined,
      forcePathStyle: true,
    };

    if (!cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
      throw new AppError(
        ERROR_CODE.VALIDATION_ERROR,
        '缺少必要的连接参数：endpoint / bucket / access_key / secret_key',
      );
    }

    let s3: S3Storage;
    try {
      s3 = new S3Storage(cfg);
    } catch (err) {
      throw businessError(`S3 客户端初始化失败: ${(err as Error).message}`);
    }

    const probeKey = `__redesk_probe__/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.bin`;
    const probeBody = Buffer.from(`redesk-storage-probe-${Date.now()}`);

    try {
      await s3.putBytes(probeKey, probeBody, { contentType: 'text/plain' });
      const readBack = await s3.getBytes(probeKey);
      const matches = readBack.equals(probeBody);
      const size = await s3.size(probeKey);
      await s3.delete(probeKey);

      if (!matches) {
        throw businessError('写入与回读内容不一致，请检查 bucket 权限');
      }
      return { data: { ok: true, message: '连接成功', details: { bucket: cfg.bucket, endpoint: cfg.endpoint, probe_size: size } } };
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      const s3Err = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      return {
        data: {
          ok: false,
          message: `测试失败: ${message}`,
          details: {
            error_name: s3Err.name ?? null,
            http_status: s3Err.$metadata?.httpStatusCode ?? null,
          },
        },
      };
    } finally {
      try { getS3Storage().delete(probeKey).catch(() => undefined); } catch { /* ignore */ }
    }
  });
}
