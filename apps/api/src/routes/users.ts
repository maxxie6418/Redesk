import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { users } from '@redesk/db';
import { ERROR_CODE, createUserSchema, updateUserSchema, resetPasswordSchema } from '@redesk/shared';
import { getDb } from '../db';
import { requireUserId, hashPassword, isAdmin } from '../lib/auth';
import { AppError, notFound, businessError, forbidden } from '../lib/errors';
import { validate } from '../lib/zod';

function now(): string {
  return new Date().toISOString();
}

function userSelect() {
  return {
    id: users.id,
    username: users.username,
    display_name: users.display_name,
    is_active: users.is_active,
    is_admin: users.is_admin,
    created_at: users.created_at,
  };
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users', async (req) => {
    const currentUserId = requireUserId(req);
    if (!isAdmin(currentUserId)) {
      throw forbidden('只有管理员可以管理用户');
    }

    const rows = getDb()
      .select(userSelect())
      .from(users)
      .orderBy(users.id)
      .all();

    return { data: rows };
  });

  app.post('/users', async (req) => {
    const currentUserId = requireUserId(req);
    if (!isAdmin(currentUserId)) {
      throw forbidden('只有管理员可以创建用户');
    }

    const input = validate(createUserSchema, req.body);
    const db = getDb();

    const passwordHash = await hashPassword(input.password);
    const timestamp = now();

    const created = db
      .insert(users)
      .values({
        username: null,
        password_hash: passwordHash,
        display_name: input.display_name ?? null,
        is_admin: 0,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning(userSelect())
      .get();

    return { data: created };
  });

  app.patch('/users/:id', async (req) => {
    const currentUserId = requireUserId(req);
    if (!isAdmin(currentUserId)) {
      throw forbidden('只有管理员可以修改用户');
    }

    const { id: targetIdStr } = req.params as { id: string };
    const targetId = Number(targetIdStr);

    if (Number.isNaN(targetId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的用户 ID');
    }

    const input = validate(updateUserSchema, req.body);
    const db = getDb();
    const target = db.select({ id: users.id, is_admin: users.is_admin }).from(users).where(eq(users.id, targetId)).get();

    if (!target) {
      throw notFound('用户不存在');
    }

    if (target.is_admin === 1) {
      throw businessError('不能修改管理员账户');
    }

    const setData: Record<string, unknown> = { updated_at: now() };
    if (input.display_name !== undefined) {
      setData.display_name = input.display_name;
    }
    if (input.is_active !== undefined) {
      setData.is_active = input.is_active ? 1 : 0;
    }

    db.update(users)
      .set(setData)
      .where(eq(users.id, targetId))
      .run();

    const updated = db.select(userSelect()).from(users).where(eq(users.id, targetId)).get();

    return { data: updated };
  });

  app.delete('/users/:id', async (req) => {
    const currentUserId = requireUserId(req);
    if (!isAdmin(currentUserId)) {
      throw forbidden('只有管理员可以删除用户');
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
    const target = db.select({ id: users.id, is_admin: users.is_admin }).from(users).where(eq(users.id, targetId)).get();

    if (!target) {
      throw notFound('用户不存在');
    }

    if (target.is_admin === 1) {
      throw businessError('不能删除管理员账户');
    }

    db.delete(users).where(eq(users.id, targetId)).run();

    return { data: { id: targetId, deleted: true } };
  });

  app.post('/users/:id/reset-password', async (req) => {
    const currentUserId = requireUserId(req);
    if (!isAdmin(currentUserId)) {
      throw forbidden('只有管理员可以重置用户口令');
    }

    const { id: targetIdStr } = req.params as { id: string };
    const targetId = Number(targetIdStr);

    if (Number.isNaN(targetId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的用户 ID');
    }

    const input = validate(resetPasswordSchema, req.body);
    const db = getDb();
    const target = db.select({ id: users.id, is_admin: users.is_admin }).from(users).where(eq(users.id, targetId)).get();

    if (!target) {
      throw notFound('用户不存在');
    }

    if (target.is_admin === 1) {
      throw businessError('不能通过此处重置管理员口令');
    }

    const passwordHash = await hashPassword(input.password);
    db.update(users)
      .set({ password_hash: passwordHash, updated_at: now() })
      .where(eq(users.id, targetId))
      .run();

    return { data: { id: targetId, reset: true } };
  });

  app.post('/users/:id/toggle-active', async (req) => {
    const currentUserId = requireUserId(req);
    if (!isAdmin(currentUserId)) {
      throw forbidden('只有管理员可以启用/禁用用户');
    }

    const { id: targetIdStr } = req.params as { id: string };
    const targetId = Number(targetIdStr);

    if (Number.isNaN(targetId)) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, '无效的用户 ID');
    }

    if (targetId === currentUserId) {
      throw businessError('不能停用当前登录的用户');
    }

    const db = getDb();
    const target = db.select({ id: users.id, is_active: users.is_active, is_admin: users.is_admin }).from(users).where(eq(users.id, targetId)).get();

    if (!target) {
      throw notFound('用户不存在');
    }

    if (target.is_admin === 1) {
      throw businessError('不能停用管理员账户');
    }

    const newActive = target.is_active === 1 ? 0 : 1;
    db.update(users)
      .set({ is_active: newActive, updated_at: now() })
      .where(eq(users.id, targetId))
      .run();

    const updated = db.select(userSelect()).from(users).where(eq(users.id, targetId)).get();

    return { data: updated };
  });
}
