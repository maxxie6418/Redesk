import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';
import { hashPassword } from '../lib/auth';
import { generateAgentToken } from '../lib/agent-token';

const testEnv = vi.hoisted(() => {
  const root = `${process.env.TEMP ?? process.env.TMP ?? '.'}/redesk-agent-scope-${process.pid}-${Date.now()}-${globalThis.crypto.randomUUID()}`;
  process.env.NODE_ENV = 'test';
  process.env.AUTH_DISABLED = 'true';
  process.env.DATABASE_URL = `${root}/redesk.db`;
  process.env.STORAGE_DIR = `${root}/storage`;
  process.env.SPA_DIR = `${root}/spa`;
  process.env.SESSION_SECRET = 'test-session-secret-12345678901234567890';
  process.env.WEB_URL = 'http://localhost:5173';
  process.env.LOG_LEVEL = 'silent';
  return { root };
});

let app: FastifyInstance;
let sqlite: ReturnType<typeof getSqlite>;
let ownerId: number;

async function seedUser(): Promise<number> {
  const ts = new Date().toISOString();
  const suffix = `${Date.now()}-${process.pid}`;
  const passwordHash = await hashPassword('password123');
  return Number(
    sqlite
      .prepare(
        `INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(`agent-user-${suffix}`, passwordHash, 'Agent测试用户', 1, 1, 0, ts, ts).lastInsertRowid,
  );
}

function seedToken(scopes: string[], opts: { revoked?: boolean; expiresAt?: string | null } = {}) {
  const { plaintext, hash } = generateAgentToken();
  const ts = new Date().toISOString();
  const id = Number(
    sqlite
      .prepare(
        `INSERT INTO api_tokens (owner_id, name, token_hash, scopes, expires_at, last_used_at, revoked_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run(ownerId, '测试Agent', hash, JSON.stringify(scopes), opts.expiresAt ?? null, opts.revoked ? ts : null, ts)
      .lastInsertRowid,
  );
  return { id, plaintext };
}

beforeAll(async () => {
  initDatabase();
  sqlite = getSqlite();
  ownerId = await seedUser();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try {
    getSqlite().close();
  } catch {
    void 0;
  }
  rmSync(testEnv.root, { recursive: true, force: true });
});

describe('Agent scope 白名单守卫', () => {
  it('白名单路由 + 匹配 scope → 放行', async () => {
    const { plaintext } = seedToken(['books:read']);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/books',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('非白名单路由（settings）→ 403', async () => {
    const { plaintext } = seedToken(['books:read']);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('scope 不匹配（无 books:create）→ 403', async () => {
    const { plaintext } = seedToken(['books:read']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      headers: { authorization: `Bearer ${plaintext}` },
      payload: { title: '测试' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('已吊销令牌 → 401', async () => {
    const { plaintext } = seedToken(['books:read'], { revoked: true });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/books',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('已过期令牌 → 401', async () => {
    const { plaintext } = seedToken(['books:read'], { expiresAt: '2020-01-01T00:00:00.000Z' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/books',
      headers: { authorization: `Bearer ${plaintext}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('未知令牌 → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/books',
      headers: { authorization: 'Bearer rdk_live_unknown' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('不带 Bearer → 走原会话逻辑', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/books' });
    expect(res.statusCode).toBe(200);
  });
});