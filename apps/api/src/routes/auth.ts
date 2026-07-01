import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { users } from '@redesk/db';
import { changePasswordSchema, loginSchema, setupSchema, ERROR_CODE } from '@redesk/shared';
import { getDb } from '../db';
import { validate } from '../lib/zod';
import { AppError, unauthorized } from '../lib/errors';
import {
  hashPassword,
  verifyPassword,
  userCount,
  tryLoginAsAdmin,
  isMultiUserEnabled,
} from '../lib/auth';
import { getSessionUserId, setSessionUserId, clearSession } from '../lib/session';
import { isSingleTokenMode, getAuthMode } from '../lib/settings-store';
import {
  checkBruteForce,
  recordFailedAttempt,
  resetBruteForce,
} from '../lib/brute-force';

function userToResponse(user: {
  id: number;
  username: string;
  display_name: string | null;
  is_active: number;
  session_expires_days: number;
  must_change_password?: number | null;
}) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    is_active: user.is_active === 1,
    session_expires_days: user.session_expires_days,
    must_change_password: (user.must_change_password ?? 0) === 1,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/auth/status', async () => {
    if (!isMultiUserEnabled()) {
      return { data: { needs_setup: false } };
    }
    return { data: { needs_setup: userCount() === 0 } };
  });

  app.get('/auth/init', async () => {
    const db = getDb();
    const row = db
      .select({ mcp: users.must_change_password })
      .from(users)
      .limit(1)
      .get();
    return {
      data: {
        initial: row?.mcp === 1,
        has_admin: !!row,
      },
    };
  });

  app.post('/auth/setup', async (req) => {
    if (!isMultiUserEnabled()) {
      const input = validate(loginSchema, req.body);
      const loggedIn = await tryLoginAsAdmin(req, input.password);
      if (!loggedIn) {
        throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '口令错误');
      }
      const user = getDb().select().from(users).limit(1).get()!;
      return { data: userToResponse(user) };
    }
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
      .returning()
      .get();

    setSessionUserId(req, created.id);
    return { data: userToResponse(created) };
  });

  app.post('/auth/login', async (req) => {
    if (!isMultiUserEnabled()) {
      const input = validate(loginSchema, req.body);
      const remoteIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      const bruteKey = `login:${remoteIp}`;
      const checkResult = checkBruteForce(bruteKey);
      if (!checkResult.allowed) {
        const lockRemaining = checkResult.lockedUntil
          ? Math.ceil((checkResult.lockedUntil - Date.now()) / 1000 / 60)
          : 0;
        throw new AppError(
          ERROR_CODE.INVALID_CREDENTIALS,
          `登录尝试过多，请${lockRemaining}分钟后再试`,
        );
      }
      const loggedIn = await tryLoginAsAdmin(req, input.password);
      if (!loggedIn) {
        recordFailedAttempt(bruteKey);
        throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '口令错误');
      }
      resetBruteForce(bruteKey);
      const user = getDb().select().from(users).limit(1).get()!;
      return { data: userToResponse(user) };
    }

    const input = validate(loginSchema, req.body);
    const remoteIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

    if (isSingleTokenMode()) {
      const bruteKey = `login:${remoteIp}`;
      const checkResult = checkBruteForce(bruteKey);
      if (!checkResult.allowed) {
        const lockRemaining = checkResult.lockedUntil
          ? Math.ceil((checkResult.lockedUntil - Date.now()) / 1000 / 60)
          : 0;
        throw new AppError(
          ERROR_CODE.INVALID_CREDENTIALS,
          `登录尝试过多，请${lockRemaining}分钟后再试`,
        );
      }

      const allUsers = getDb().select().from(users).all();
      let matchedUser: typeof allUsers[0] | undefined;

      for (const user of allUsers) {
        if (!user.is_active) continue;
        const ok = await verifyPassword(input.password, user.password_hash);
        if (ok) {
          matchedUser = user;
          break;
        }
      }

      if (!matchedUser) {
        recordFailedAttempt(bruteKey);
        throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '口令错误');
      }

      resetBruteForce(bruteKey);
      setSessionUserId(req, matchedUser.id);
      return { data: userToResponse(matchedUser) };
    }

    if (!input.username) {
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '请输入用户名');
    }

    const bruteKey = `login:${input.username}:${remoteIp}`;
    const checkResult = checkBruteForce(bruteKey);
    if (!checkResult.allowed) {
      const lockRemaining = checkResult.lockedUntil
        ? Math.ceil((checkResult.lockedUntil - Date.now()) / 1000 / 60)
        : 0;
      throw new AppError(
        ERROR_CODE.INVALID_CREDENTIALS,
        `登录尝试过多，请${lockRemaining}分钟后再试`,
      );
    }

    const user = getDb().select().from(users).where(eq(users.username, input.username)).get();
    if (!user) {
      recordFailedAttempt(bruteKey);
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '用户名或密码错误');
    }

    if (!user.is_active) {
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '该账户已被禁用');
    }

    const ok = await verifyPassword(input.password, user.password_hash);
    if (!ok) {
      recordFailedAttempt(bruteKey);
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '用户名或密码错误');
    }

    resetBruteForce(bruteKey);
    setSessionUserId(req, user.id);
    return { data: userToResponse(user) };
  });

  app.post('/auth/logout', async (req) => {
    await clearSession(req);
    return { data: { success: true } };
  });

  app.post('/auth/change-password', async (req) => {
    const userId = getSessionUserId(req);
    if (!userId) throw unauthorized();
    const input = validate(changePasswordSchema, req.body);
    const existing = getDb()
      .select({
        id: users.id,
        password_hash: users.password_hash,
        must_change_password: users.must_change_password,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!existing) throw unauthorized();

    const needsForcedChange = existing.must_change_password === 1;
    if (!needsForcedChange) {
      if (!input.current_password) {
        throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少当前密码');
      }
      const ok = await verifyPassword(input.current_password, existing.password_hash);
      if (!ok) {
        throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '当前密码错误');
      }
    }

    const ts = new Date().toISOString();
    const newHash = await hashPassword(input.new_password);
    const updated = getDb()
      .update(users)
      .set({
        password_hash: newHash,
        must_change_password: 0,
        updated_at: ts,
      })
      .where(eq(users.id, userId))
      .returning()
      .get();
    if (!updated) throw unauthorized();
    return { data: userToResponse(updated) };
  });

  app.get('/auth/mode', async () => {
    return { data: { mode: getAuthMode() } };
  });

  app.get('/auth/me', async (req) => {
    const userId = getSessionUserId(req);
    if (!userId) throw unauthorized();
    const user = getDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!user) throw unauthorized();
    return { data: userToResponse(user) };
  });
}
