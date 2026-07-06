import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { settings } from '@redesk/db';
import { ERROR_CODE, updateSettingsSchema } from '@redesk/shared';
import { getDb } from '../db';
import { AppError } from '../lib/errors';
import { requireUserId, isAdmin } from '../lib/auth';
import { getSettingsOwnerId } from '../lib/storage-factory';
import { validate } from '../lib/zod';

const SENSITIVE_KEYS = new Set(['oss_secret_key', 'oss_access_key', 'llm_api_key']);

function redactValue(key: string, value: string): string {
  if (!SENSITIVE_KEYS.has(key)) return value;
  if (value.length <= 4) return '****';
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function now(): string {
  return new Date().toISOString();
}

function serializeSettingValue(value: string | number | boolean | null): string | null {
  if (value === null) return null;
  return String(value);
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/settings', async (req) => {
    requireUserId(req);
    const db = getDb();
    const ownerId = getSettingsOwnerId();
    if (!ownerId) return { data: {} };
    const rows = db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(eq(settings.owner_id, ownerId))
      .all();

    if (rows.length === 0) {
      return { data: {} };
    }

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = redactValue(row.key, row.value);
    }

    return { data: result };
  });

  app.patch('/settings', async (req) => {
    const userId = requireUserId(req);
    if (!isAdmin(userId)) {
      throw new AppError(ERROR_CODE.FORBIDDEN, '只有管理员可以修改系统设置');
    }
    const input = validate(updateSettingsSchema, req.body);
    const db = getDb();
    const timestamp = now();
    const ownerId = getSettingsOwnerId();
    if (!ownerId) {
      throw new Error('settings owner not found');
    }

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      const serializedValue = serializeSettingValue(value);
      if (serializedValue === null) continue;

      const existing = db
        .select({ key: settings.key })
        .from(settings)
        .where(and(eq(settings.owner_id, ownerId), eq(settings.key, key)))
        .get();

      if (existing) {
        db.update(settings)
          .set({ value: serializedValue, updated_at: timestamp })
          .where(and(eq(settings.owner_id, ownerId), eq(settings.key, key)))
          .run();
      } else {
        db.insert(settings)
          .values({
            owner_id: ownerId,
            key,
            value: serializedValue,
            updated_at: timestamp,
          })
          .run();
      }
    }

    const rows = db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(eq(settings.owner_id, ownerId))
      .all();

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = redactValue(row.key, row.value);
    }

    return { data: result };
  });
}
