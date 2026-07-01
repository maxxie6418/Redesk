import { and, eq } from 'drizzle-orm';
import { settings } from '@redesk/db';
import {
  SETTINGS_KEY,
  AUTH_MODE,
  BRUTE_FORCE_DEFAULTS,
  DEFAULT_SESSION_EXPIRES_DAYS,
} from '@redesk/shared';
import type { AuthMode } from '@redesk/shared';
import { getDb } from '../db';

export function getAuthMode(): AuthMode {
  const row = getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.owner_id, 1), eq(settings.key, SETTINGS_KEY.AUTH_MODE)))
    .get();
  return row?.value === AUTH_MODE.MULTI_TOKEN ? AUTH_MODE.MULTI_TOKEN : AUTH_MODE.SINGLE_TOKEN;
}

export function isSingleTokenMode(): boolean {
  return getAuthMode() === AUTH_MODE.SINGLE_TOKEN;
}

export function isMultiTokenMode(): boolean {
  return getAuthMode() === AUTH_MODE.MULTI_TOKEN;
}

export function isMultiUserEnabled(): boolean {
  return isMultiTokenMode();
}

export function getNumberSetting(key: string, defaultVal: number): number {
  const row = getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.owner_id, 1), eq(settings.key, key)))
    .get();
  if (!row) return defaultVal;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : defaultVal;
}

export function getStringSetting(key: string, defaultVal: string): string {
  const row = getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.owner_id, 1), eq(settings.key, key)))
    .get();
  return row?.value ?? defaultVal;
}

export function setSetting(key: string, value: string, ownerId = 1): void {
  const ts = new Date().toISOString();
  getDb()
    .insert(settings)
    .values({ key, owner_id: ownerId, value, updated_at: ts })
    .onConflictDoUpdate({
      target: [settings.owner_id, settings.key],
      set: { value, updated_at: ts },
    })
    .run();
}

export function getSessionExpiresDays(): number {
  return getNumberSetting(SETTINGS_KEY.SESSION_EXPIRES_DAYS, DEFAULT_SESSION_EXPIRES_DAYS);
}

export function getAdminPasswordChangedAt(): number {
  return getNumberSetting(SETTINGS_KEY.ADMIN_PASSWORD_CHANGED_AT, 0);
}

export function setAdminPasswordChangedAt(timestamp: number): void {
  setSetting(SETTINGS_KEY.ADMIN_PASSWORD_CHANGED_AT, String(timestamp));
}

export function getBruteForceWindowMs(): number {
  return getNumberSetting(SETTINGS_KEY.BRUTE_FORCE_WINDOW_MINUTES, BRUTE_FORCE_DEFAULTS.WINDOW_MINUTES) * 60 * 1000;
}

export function getBruteForceMaxAttempts(): number {
  return getNumberSetting(SETTINGS_KEY.BRUTE_FORCE_MAX_ATTEMPTS, BRUTE_FORCE_DEFAULTS.MAX_ATTEMPTS);
}

export function getBruteForceLockMs(): number {
  return getNumberSetting(SETTINGS_KEY.BRUTE_FORCE_LOCK_MINUTES, BRUTE_FORCE_DEFAULTS.LOCK_MINUTES) * 60 * 1000;
}
