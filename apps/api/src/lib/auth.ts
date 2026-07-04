import { hash, verify } from '@node-rs/argon2';
import type { FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { users } from '@redesk/db';
import { DEFAULT_ADMIN_PASSWORD, config } from '../config';
import { getDb } from '../db';
import { forbidden, unauthorized } from './errors';
import { getSessionUserId, setSessionUserId } from './session';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

const CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 12): string {
  const bytes = randomBytes(length * 2);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += CHARS[bytes[i * 2] % CHARS.length];
  }
  return result;
}

export function userCount(): number {
  return getDb().select({ c: sql<number>`count(*)` }).from(users).get()?.c ?? 0;
}

export async function ensureDefaultAdmin(): Promise<void> {
  if (userCount() === 0) {
    const ts = new Date().toISOString();
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

    getDb()
      .insert(users)
      .values({
        username: 'admin',
        password_hash: passwordHash,
        display_name: '管理员',
        is_admin: 1,
        must_change_password: 1,
        created_at: ts,
        updated_at: ts,
      })
      .run();

    console.log('[redesk] 默认管理员已创建：口令为 admin，首次登录后必须修改口令。');
  }
}

export function getAdminUserId(): number | undefined {
  return getDb()
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.is_admin} = 1`)
    .limit(1)
    .get()?.id;
}

export function isAdmin(userId: number): boolean {
  const user = getDb()
    .select({ is_admin: users.is_admin })
    .from(users)
    .where(sql`${users.id} = ${userId}`)
    .get();
  return user?.is_admin === 1;
}

export function requireUserId(req: FastifyRequest): number {
  const userId = getSessionUserId(req);
  if (userId) return userId;
  if (config.authDisabled) {
    const adminId = getAdminUserId();
    if (adminId) return adminId;
  }
  throw unauthorized();
}

export function requireAdmin(req: FastifyRequest): number {
  const userId = requireUserId(req);
  if (!isAdmin(userId)) {
    throw forbidden('需要管理员权限');
  }
  return userId;
}

export function getOptionalUserId(req: FastifyRequest): number | undefined {
  const userId = getSessionUserId(req);
  if (userId) return userId;
  if (config.authDisabled) return getAdminUserId();
  return undefined;
}

export function isAdminRequest(req: FastifyRequest): boolean {
  const userId = getOptionalUserId(req);
  return userId !== undefined && isAdmin(userId);
}

export function getPublicUserId(req: FastifyRequest): number {
  const optional = getOptionalUserId(req);
  if (optional) return optional;
  const adminId = getAdminUserId();
  if (adminId) return adminId;
  throw unauthorized();
}

export async function tryLoginByPassword(
  req: FastifyRequest,
  password: string,
): Promise<{ id: number; isAdmin: boolean; mustChangePassword: boolean } | null> {
  const allUsers = getDb()
    .select({
      id: users.id,
      password_hash: users.password_hash,
      is_admin: users.is_admin,
      is_active: users.is_active,
      must_change_password: users.must_change_password,
    })
    .from(users)
    .all();

  const ordered = [...allUsers].sort((a, b) => (b.is_admin ?? 0) - (a.is_admin ?? 0));

  for (const user of ordered) {
    if (user.is_active !== 1) continue;
    const ok = await verifyPassword(password, user.password_hash);
    if (ok) {
      setSessionUserId(req, user.id);
      return {
        id: user.id,
        isAdmin: user.is_admin === 1,
        mustChangePassword: user.must_change_password === 1,
      };
    }
  }

  return null;
}
