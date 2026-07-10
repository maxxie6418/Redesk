import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { users } from '@redesk/db';
import { changePasswordSchema, loginSchema, ERROR_CODE } from '@redesk/shared';
import { getDb } from '../db';
import { validate } from '../lib/zod';
import { AppError, unauthorized } from '../lib/errors';
import { hashPassword, verifyPassword, userCount, tryLoginByPassword, isAdmin, requireUserId, getAdminUserId } from '../lib/auth';
import { clearSession, getSessionUserId } from '../lib/session';
import {
  getAuthMode,
  isMultiUserEnabled,
  setAdminPasswordChangedAt,
  getAdminPasswordChangedAt,
} from '../lib/settings-store';
import { config } from '../config';
import {
  checkBruteForce,
  recordFailedAttempt,
  resetBruteForce,
} from '../lib/brute-force';

function userToResponse(user: {
  id: number;
  username: string | null;
  display_name: string | null;
  is_active: number;
  is_admin: number;
  permission_level?: string;
  must_change_password?: number | null;
}) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    is_active: user.is_active === 1,
    is_admin: user.is_admin === 1,
    permission_level: user.permission_level ?? 'use',
    must_change_password: (user.must_change_password ?? 0) === 1,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/auth/status', async () => {
    return { data: { needs_setup: userCount() === 0 } };
  });

  app.get('/auth/init', async () => {
    const db = getDb();
    const admin = db
      .select({
        mcp: users.must_change_password,
        is_admin: users.is_admin,
      })
      .from(users)
      .where(eq(users.is_admin, 1))
      .limit(1)
      .get();
    return {
      data: {
        initial: !admin || admin.mcp === 1,
        has_admin: !!admin,
        multi_user: isMultiUserEnabled(),
      },
    };
  });

  app.post('/auth/login', async (req) => {
    const input = validate(loginSchema, req.body);
    const remoteIp =
      ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown');
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

    const result = await tryLoginByPassword(req, input.password);
    if (!result) {
      recordFailedAttempt(bruteKey);
      throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '口令错误');
    }

    resetBruteForce(bruteKey);
    const user = getDb().select().from(users).where(eq(users.id, result.id)).get()!;
    return { data: userToResponse(user) };
  });

  app.post('/auth/logout', async (req) => {
    await clearSession(req);
    return { data: { success: true } };
  });

  app.post('/auth/change-password', async (req) => {
    const userId = requireUserId(req);
    const input = validate(changePasswordSchema, req.body);
    const existing = getDb()
      .select({
        id: users.id,
        password_hash: users.password_hash,
        must_change_password: users.must_change_password,
        is_admin: users.is_admin,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!existing) throw unauthorized();

    const needsForcedChange = existing.must_change_password === 1;
    if (!needsForcedChange) {
      if (!input.current_password) {
        throw new AppError(ERROR_CODE.VALIDATION_ERROR, '缺少当前口令');
      }
      const ok = await verifyPassword(input.current_password, existing.password_hash);
      if (!ok) {
        throw new AppError(ERROR_CODE.INVALID_CREDENTIALS, '当前口令错误');
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

    if (existing.is_admin === 1) {
      setAdminPasswordChangedAt(Date.now());
    }

    return { data: userToResponse(updated) };
  });

  app.get('/auth/mode', async () => {
    return { data: { mode: getAuthMode(), multi_user: isMultiUserEnabled() } };
  });

  app.get('/auth/me', async (req) => {
    let userId = getSessionUserId(req);
    if (!userId) {
      if (config.authDisabled) {
        userId = getAdminUserId();
      }
      if (!userId) throw unauthorized();
    }
    const user = getDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!user) throw unauthorized();

    // 管理员改密后，普通会话失效
    if (!isAdmin(userId)) {
      const adminChangedAt = getAdminPasswordChangedAt();
      if (adminChangedAt > 0 && req.session.createdAt && req.session.createdAt < adminChangedAt) {
        throw unauthorized();
      }
    }

    return { data: userToResponse(user) };
  });
}
