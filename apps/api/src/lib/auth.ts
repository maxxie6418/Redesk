import { hash, verify } from '@node-rs/argon2';
import type { FastifyRequest } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { settings, users } from '@redesk/db';
import { config, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD } from '../config';
import { getDb } from '../db';
import { unauthorized } from './errors';
import { getSessionUserId, setSessionUserId } from './session';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

function getAdminUserId(): number | undefined {
  const existing = getDb()
    .select({ id: users.id })
    .from(users)
    .limit(1)
    .get();

  return existing?.id;
}

export function isMultiUserEnabled(): boolean {
  if (!config.authDisabled) return true;

  const row = getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.owner_id, 1), eq(settings.key, 'multi_user')))
    .get();

  return row?.value === 'true';
}

export function userCount(): number {
  return getDb().select({ c: sql<number>`count(*)` }).from(users).get()?.c ?? 0;
}

export async function ensureDefaultAdmin(): Promise<void> {
  if (isMultiUserEnabled()) return;
  if (userCount() > 0) return;

  const ts = new Date().toISOString();
  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  getDb()
    .insert(users)
    .values({
      username: DEFAULT_ADMIN_USERNAME,
      password_hash: passwordHash,
      display_name: '管理员',
      created_at: ts,
      updated_at: ts,
    })
    .run();
}

export function requireUserId(req: FastifyRequest): number {
  if (!isMultiUserEnabled()) {
    const adminId = getAdminUserId();
    if (adminId) return adminId;
  }

  const userId = getSessionUserId(req);
  if (!userId) throw unauthorized();

  return userId;
}

export function tryLoginAsAdmin(req: FastifyRequest): boolean {
  if (isMultiUserEnabled()) return false;

  const admin = getDb()
    .select({ id: users.id })
    .from(users)
    .limit(1)
    .get();

  if (!admin) return false;

  setSessionUserId(req, admin.id);
  return true;
}
