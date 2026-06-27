import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { users } from '@redesk/db';
import { loginSchema, setupSchema, ERROR_CODE } from '@redesk/shared';
import { getDb } from '../db';
import { validate } from '../lib/zod';
import { AppError, unauthorized } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/auth';
import { setSessionUserId, clearSession, getSessionUserId } from '../lib/session';

function requireUserId(req: FastifyRequest): number {
  const userId = getSessionUserId(req);
  if (!userId) throw unauthorized();
  return userId;
}

function userCount(): number {
  return getDb().select({ c: sql<number>`count(*)` }).from(users).get()?.c ?? 0;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/auth/status', async () => {
    return { data: { needs_setup: userCount() === 0 } };
  });

  app.post('/auth/setup', async (req) => {
    if (userCount() > 0) {
      throw new AppError(ERROR_CODE.BUSINESS_ERROR, '初始账户已存在，无法重复创建');
    }
    const input = validate(setupSchema, req.body);
    const passwordHash = await hashPassword(input.password);
    const ts = new Date().toISOString();
    const created = getDb()
      .insert(users)
      .values({
        username: input.username,
        password_hash: passwordHash,
        display_name: input.display_name ?? null,
        created_at: ts,
        updated_at: ts,
      })
      .returning({
        id: users.id,
        username: users.username,
        display_name: users.display_name,
      })
      .get();

    setSessionUserId(req, created.id);
    return { data: created };
  });

  app.post('/auth/login', async (req) => {
    const input = validate(loginSchema, req.body);
    const user = getDb().select().from(users).where(eq(users.username, input.username)).get();
    if (!user) {
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '用户名或密码错误');
    }
    const ok = await verifyPassword(input.password, user.password_hash);
    if (!ok) {
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '用户名或密码错误');
    }
    setSessionUserId(req, user.id);
    return {
      data: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
      },
    };
  });

  app.post('/auth/logout', async (req) => {
    await clearSession(req);
    return { data: { success: true } };
  });

  app.get('/auth/me', async (req) => {
    const userId = requireUserId(req);
    const user = getDb()
      .select({
        id: users.id,
        username: users.username,
        display_name: users.display_name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!user) throw unauthorized();
    return { data: user };
  });
}
