import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';
import { hashPassword } from '../lib/auth';
import { generateAgentToken } from '../lib/agent-token';

const testEnv = vi.hoisted(() => {
  const root = `${process.env.TEMP ?? process.env.TMP ?? '.'}/redesk-agent-categories-${process.pid}-${Date.now()}-${globalThis.crypto.randomUUID()}`;
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

function seedToken(scopes: string[]) {
  const { plaintext, hash } = generateAgentToken();
  const ts = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO api_tokens (owner_id, name, token_hash, scopes, expires_at, last_used_at, revoked_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
    )
    .run(ownerId, '测试Agent', hash, JSON.stringify(scopes), null, ts);
  return plaintext;
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

describe('Agent 分类/标签边界', () => {
  it('列出分类 → 200', async () => {
    const token = seedToken(['categories:manage']);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/categories',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it('新建分类成功且归属当前 owner', async () => {
    const token = seedToken(['categories:manage']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '推理小说', type: 'PERSONAL' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('推理小说');
    const row = sqlite.prepare('SELECT owner_id FROM categories WHERE id = ?').get(res.json().data.id) as { owner_id: number };
    expect(row.owner_id).toBe(ownerId);
  });

  it('重名分类 → 409', async () => {
    const token = seedToken(['categories:manage']);
    const headers = { authorization: `Bearer ${token}` };
    await app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: { name: '已存在', type: 'PERSONAL' } });
    const dup = await app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: { name: '已存在', type: 'PERSONAL' } });
    expect(dup.statusCode).toBe(409);
  });

  it('列出标签 → 200', async () => {
    const token = seedToken(['tags:manage']);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tags',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('新建标签成功', async () => {
    const token = seedToken(['tags:manage']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tags',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '待读' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('待读');
  });

  it('修改分类 → 403（scope 未授权，ROUTE_SCOPE_MAP 未登记 PATCH）', async () => {
    const token = seedToken(['categories:manage']);
    const headers = { authorization: `Bearer ${token}` };
    const created = await app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: { name: '禁改' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/categories/${created.json().data.id}`,
      headers,
      payload: { name: '改名' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('删除标签 → 403（scope 未授权）', async () => {
    const token = seedToken(['tags:manage']);
    const headers = { authorization: `Bearer ${token}` };
    const created = await app.inject({ method: 'POST', url: '/api/v1/tags', headers, payload: { name: '不可删' } });
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/tags/${created.json().data.id}`, headers });
    expect(res.statusCode).toBe(403);
  });

  it('新建分类/标签写入审计日志', async () => {
    const token = seedToken(['categories:manage', 'tags:manage']);
    const headers = { authorization: `Bearer ${token}` };
    await app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: { name: '审计分类' } });
    await app.inject({ method: 'POST', url: '/api/v1/tags', headers, payload: { name: '审计标签' } });
    const catAudit = sqlite.prepare(`SELECT action FROM audit_logs WHERE owner_id = ? AND action = 'categories.create'`).all(ownerId);
    const tagAudit = sqlite.prepare(`SELECT action FROM audit_logs WHERE owner_id = ? AND action = 'tags.create'`).all(ownerId);
    expect(catAudit.length).toBeGreaterThanOrEqual(1);
    expect(tagAudit.length).toBeGreaterThanOrEqual(1);
  });
});