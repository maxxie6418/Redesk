import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { users } from '@redesk/db';
import { ERROR_CODE, createUserSchema, updateUserSchema, resetPasswordSchema } from '@redesk/shared';
import { getDb } from '../db';
import { requireUserId, hashPassword, isMultiUserEnabled } from '../lib/auth';
import { AppError, notFound, businessError } from '../lib/errors';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

function userSelect() {
  return {
    id: users.id,
    username: users.username,
    display_name: users.display_name,
    created_at: users.created_at,
  };
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users', async (req) => {
    requireUserId(req);
    if (!isMultiUserEnabled()) {
      throw businessError('当前为单用户模式，用户管理不可用');
    }

    const rows = getDb()
      .select(userSelect())
      .from(users)
      .orderBy(users.id)
      .all();

    return { data: rows };
  });

  app.post('/users', async (req) => {
    requireUserId(req);
    if (!isMultiUserEnabled()) {
      throw businessError('当前为单用户模式，用户管理不可用');
    }

    const input = validate(createUserSchema, req.body);
    const db = getDb();

    const existing = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, input.username))
      .get();

    if (existing) {
      throw new AppError(ERROR_CODE.CONFLICT, '用户名已存在');
    }

    const passwordHash = await hashPassword(input.password);
    const timestamp = now();

    const created = db
      .insert(users)
      .values({
        username: input.username,
        password_hash: passwordHash,
        display_name: input.display_name ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning(userSelect())
      .get();

    return { data: created };
  });

  app.patch('/users/:id', async (req) => {
    requireUserId(req);
    if (!isMultiUserEnabled()) {
      throw businessError('当前为单用户模式，用户管理不可用');
    }

    const { id: targetIdStr } = req.params as { id: string };
    const targetId = Number(targetIdStr);

    if (Number.isNaN(targetId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的用户 ID');
    }

    const input = validate(updateUserSchema, req.body);
    const db = getDb();
    const target = db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).get();

    if (!target) {
      throw notFound('用户不存在');
    }

    db.update(users)
      .set({ display_name: input.display_name ?? undefined, updated_at: now() })
      .where(eq(users.id, targetId))
      .run();

    const updated = db.select(userSelect()).from(users).where(eq(users.id, targetId)).get();

    return { data: updated };
  });

  app.delete('/users/:id', async (req) => {
    const currentUserId = requireUserId(req);
    if (!isMultiUserEnabled()) {
      throw businessError('当前为单用户模式，用户管理不可用');
    }

    const { id: targetIdStr } = req.params as { id: string };
    const targetId = Number(targetIdStr);

    if (Number.isNaN(targetId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的用户 ID');
    }

    if (targetId === currentUserId) {
      throw businessError('不能删除当前登录的用户');
    }

    const db = getDb();
    const target = db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).get();

    if (!target) {
      throw notFound('用户不存在');
    }

    db.delete(users).where(eq(users.id, targetId)).run();

    return { data: { id: targetId, deleted: true } };
  });

  app.post('/users/:id/reset-password', async (req) => {
    requireUserId(req);
    if (!isMultiUserEnabled()) {
      throw businessError('当前为单用户模式，用户管理不可用');
    }

    const { id: targetIdStr } = req.params as { id: string };
    const targetId = Number(targetIdStr);

    if (Number.isNaN(targetId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的用户 ID');
    }

    const input = validate(resetPasswordSchema, req.body);
    const db = getDb();
    const target = db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).get();

    if (!target) {
      throw notFound('用户不存在');
    }

    const passwordHash = await hashPassword(input.password);
    db.update(users)
      .set({ password_hash: passwordHash, updated_at: now() })
      .where(eq(users.id, targetId))
      .run();

    return { data: { id: targetId, reset: true } };
  });
}
