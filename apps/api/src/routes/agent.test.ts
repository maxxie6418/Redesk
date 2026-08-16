import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { hashPassword } from '../lib/auth';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';

const testEnv = vi.hoisted(() => {
  const root = `${process.env.TEMP ?? process.env.TMP ?? '.'}/redesk-agent-${process.pid}-${Date.now()}-${globalThis.crypto.randomUUID()}`;
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

async function seedUser(): Promise<number> {
  const ts = new Date().toISOString();
  const suffix = `${Date.now()}-${process.pid}`;
  const passwordHash = await hashPassword('password123');
  sqlite.prepare(`DELETE FROM users`).run();
  return Number(
    sqlite
      .prepare(
        `INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(`agent-user-${suffix}`, passwordHash, 'Agent测试用户', 1, 1, 0, ts, ts).lastInsertRowid,
  );
}

async function createConnection(scopes: string[]) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/agent/connections',
    payload: { name: '测试Agent', scopes },
  });
  expect(res.statusCode).toBe(200);
  const data = res.json().data;
  const linkPath = new URL(data.link).pathname;
  return { id: data.id, code: data.code, linkPath };
}

beforeAll(async () => {
  initDatabase();
  sqlite = getSqlite();
  await seedUser();
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

describe('Agent 接入路由', () => {
  it('创建接入返回链接与一次性授权码', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agent/connections',
      payload: { name: '我的Claude', scopes: ['books:read', 'books:create'] },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.link).toMatch(/\/agent\/connect\//);
    expect(data.code).toBeTruthy();
  });

  it('读取 skill 链接返回能力清单（按 scope 过滤）', async () => {
    const created = await createConnection(['books:read', 'categories:manage']);
    const res = await app.inject({ method: 'GET', url: created.linkPath });
    expect(res.statusCode).toBe(200);
    const skill = res.json().data;
    expect(skill.skill_version).toBe(1);
    expect(skill.scopes).toEqual(['books:read', 'categories:manage']);
    expect(skill.base_url.endsWith('/api/v1')).toBe(true);
    const ids = skill.capabilities.map((c: { id: string }) => c.id);
    expect(ids).toContain('search_books');
    expect(ids).not.toContain('create_book');
    expect(ids).toContain('list_categories');
    expect(skill.connect_code).toBe(created.code);
  });

  it('授权码换令牌成功，且只能使用一次', async () => {
    const created = await createConnection(['books:read']);
    const res = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: created.code } });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.access_token.startsWith('rdk_live_')).toBe(true);
    const again = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: created.code } });
    expect(again.statusCode).toBe(400);
  });

  it('错误授权码 → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: 'invalid' } });
    expect(res.statusCode).toBe(400);
  });

  it('换发后的令牌可调用业务 API', async () => {
    const created = await createConnection(['books:read']);
    const ex = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: created.code } });
    const token = ex.json().data.access_token;
    const res = await app.inject({ method: 'GET', url: '/api/v1/books', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
  });

  it('列表展示接入且不泄露哈希', async () => {
    await createConnection(['books:read']);
    const res = await app.inject({ method: 'GET', url: '/api/v1/agent/connections' });
    expect(res.statusCode).toBe(200);
    const rows = res.json().data;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).not.toHaveProperty('token_hash');
    expect(rows[0]).not.toHaveProperty('code_hash');
  });

  it('吊销后令牌立即失效', async () => {
    const created = await createConnection(['books:read']);
    const ex = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code: created.code } });
    const token = ex.json().data.access_token;
    const revoke = await app.inject({ method: 'POST', url: `/api/v1/agent/connections/${created.id}/revoke` });
    expect(revoke.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: '/api/v1/books', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(401);
  });
});
