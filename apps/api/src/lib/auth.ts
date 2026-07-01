import { hash, verify } from '@node-rs/argon2';
import type { FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { users } from '@redesk/db';
import { DEFAULT_ADMIN_PASSWORD } from '../config';
import { config } from '../config';
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

const CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 12): string {
  const bytes = randomBytes(length * 2);
  let result = '';
  for (let i = 0; i < length; i++) {
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
  const admin = getDb()
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.is_admin} = 1`)
    .limit(1)
    .get();
  return admin?.id;
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

export function getOptionalUserId(req: FastifyRequest): number | undefined {
  const userId = getSessionUserId(req);
  if (userId) return userId;
  if (config.authDisabled) {
    return getAdminUserId();
  }
  return undefined;
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

  // 管理员口令优先匹配，避免与普通口令冲突时误登为普通用户
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
