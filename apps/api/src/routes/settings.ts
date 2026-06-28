import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { settings } from '@redesk/db';
import { updateSettingsSchema } from '@redesk/shared';
import { getDb } from '../db';
import { requireUserId } from '../lib/auth';
import { validate } from '../lib/zod';

const SENSITIVE_KEYS = new Set(['oss_secret_key', 'oss_access_key', 'llm_api_key']);

const SETTINGS_OWNER_ID = 1;

function redactValue(key: string, value: string): string {
  if (!SENSITIVE_KEYS.has(key)) return value;
  if (value.length <= 4) return '****';
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function now(): string {
  return new Date().toISOString();
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/settings', async (req) => {
    requireUserId(req);
    const db = getDb();
    const rows = db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(eq(settings.owner_id, SETTINGS_OWNER_ID))
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
    requireUserId(req);
    const input = validate(updateSettingsSchema, req.body);
    const db = getDb();
    const timestamp = now();

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;

      const existing = db
        .select({ key: settings.key })
        .from(settings)
        .where(and(eq(settings.owner_id, SETTINGS_OWNER_ID), eq(settings.key, key)))
        .get();

      if (existing) {
        db.update(settings)
          .set({ value, updated_at: timestamp })
          .where(and(eq(settings.owner_id, SETTINGS_OWNER_ID), eq(settings.key, key)))
          .run();
      } else {
        db.insert(settings)
          .values({
            owner_id: SETTINGS_OWNER_ID,
            key,
            value,
            updated_at: timestamp,
          })
          .run();
      }
    }

    const rows = db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(eq(settings.owner_id, SETTINGS_OWNER_ID))
      .all();

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = redactValue(row.key, row.value);
    }

    return { data: result };
  });
}
