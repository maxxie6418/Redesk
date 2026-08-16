import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type * as FilesModule from './files';
import { hashPassword } from '../lib/auth';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';

const testEnv = vi.hoisted(() => {
  const root = `${process.env.TEMP ?? process.env.TMP ?? '.'}/redesk-agent-books-${process.pid}-${Date.now()}-${globalThis.crypto.randomUUID()}`;
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

vi.mock('../lib/book-metadata', () => ({
  fetchBookMetadataFromUrl: vi.fn(),
}));

vi.mock('./files', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof FilesModule;
  return {
    ...actual,
    downloadRemoteCover: vi.fn().mockResolvedValue({ id: 1, local_path: 'covers/test.jpg', remote_key: null, storage_mode: 'local_only' }),
  };
});

import { fetchBookMetadataFromUrl } from '../lib/book-metadata';
import { downloadRemoteCover } from './files';

const mockedFetch = vi.mocked(fetchBookMetadataFromUrl);
const mockedDownloadCover = vi.mocked(downloadRemoteCover);

let app: FastifyInstance;
let sqlite: ReturnType<typeof getSqlite>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

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

beforeEach(async () => {
  mockedDownloadCover.mockClear();
});

async function createAgentToken(scopes: string[]): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/agent/connections',
    payload: { name: '测试Agent', scopes },
  });
  const { code } = created.json().data;
  const ex = await app.inject({ method: 'POST', url: '/agent/token/exchange', payload: { code } });
  return ex.json().data.access_token;
}

async function createBookViaAgent(token: string, payload: Record<string, unknown>): Promise<{ id: number }> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/books', headers: auth(token), payload });
  return res.json().data as { id: number };
}

async function createBookViaSession(payload: Record<string, unknown>): Promise<{ id: number }> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/books', payload });
  return res.json().data as { id: number };
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

describe('Agent 书籍操作边界', () => {
  it('metadata/fetch：白名单外源链接 → 403 且不触发抓取', async () => {
    const token = await createAgentToken(['books:read']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books/metadata/fetch',
      headers: auth(token),
      payload: { source_url: 'https://evil.example.com/book' },
    });
    expect(res.statusCode).toBe(403);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('metadata/fetch：豆瓣链接 → 放行并返回元数据', async () => {
    mockedFetch.mockResolvedValueOnce({ title: '测试书', author: '作者', metadata_source: 'douban', source_url: 'https://book.douban.com/subject/123/' });
    const token = await createAgentToken(['books:read']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books/metadata/fetch',
      headers: auth(token),
      payload: { source_url: 'https://book.douban.com/subject/123/' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.title).toBe('测试书');
    expect(mockedFetch).toHaveBeenCalledWith('https://book.douban.com/subject/123/');
  });

  it('创建：白名单外 source_url → 403', async () => {
    const token = await createAgentToken(['books:create']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      headers: auth(token),
      payload: { title: '测试书', source_url: 'https://evil.example.com/book' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('创建：status 等非白名单字段 → 403', async () => {
    const token = await createAgentToken(['books:create']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      headers: auth(token),
      payload: { title: '测试书', status: 'READING' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('创建：豆瓣 source_url 正常创建', async () => {
    const token = await createAgentToken(['books:create']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      headers: auth(token),
      payload: { title: '测试书', author: '作者', source_url: 'https://book.douban.com/subject/123/' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.title).toBe('测试书');
  });

  it('更新：visibility 等非白名单字段 → 403', async () => {
    const token = await createAgentToken(['books:create', 'books:update_metadata']);
    const created = await createBookViaAgent(token, { title: '旧标题', source_url: 'https://book.douban.com/subject/123/' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/books/${created.id}`,
      headers: auth(token),
      payload: { visibility: 'PUBLIC' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('更新：title 等白名单字段 → 200', async () => {
    const token = await createAgentToken(['books:create', 'books:update_metadata']);
    const created = await createBookViaAgent(token, { title: '旧标题' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/books/${created.id}`,
      headers: auth(token),
      payload: { title: '新标题' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.title).toBe('新标题');
  });

  it('更新：白名单外 source_url → 403', async () => {
    const token = await createAgentToken(['books:update_metadata']);
    const created = await createBookViaSession({ title: '浏览器录入', source_url: 'https://example.com/x' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/books/${created.id}`,
      headers: auth(token),
      payload: { source_url: 'https://evil.example.com/y' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('apply fetch_cover：非白名单书源 → 403 且字段不落库', async () => {
    const token = await createAgentToken(['books:update_metadata']);
    const created = await createBookViaSession({ title: '浏览器录入', source_url: 'https://example.com/x' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/books/${created.id}/metadata/apply`,
      headers: auth(token),
      payload: { fields: { title: '不应生效' }, fetch_cover: true },
    });
    expect(res.statusCode).toBe(403);
    const book = sqlite.prepare('SELECT title FROM books WHERE id = ?').get(created.id) as { title: string };
    expect(book.title).toBe('浏览器录入');
  });

  it('apply：白名单书源 → 200', async () => {
    const token = await createAgentToken(['books:create', 'books:update_metadata']);
    const created = await createBookViaAgent(token, { title: '旧标题', source_url: 'https://book.douban.com/subject/123/' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/books/${created.id}/metadata/apply`,
      headers: auth(token),
      payload: { fields: { title: '新标题' } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('apply：fields.source_url 白名单外 → 403 且不落库', async () => {
    const token = await createAgentToken(['books:create', 'books:update_metadata']);
    const created = await createBookViaAgent(token, { title: '测试书', source_url: 'https://book.douban.com/subject/123/' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/books/${created.id}/metadata/apply`,
      headers: auth(token),
      payload: { fields: { source_url: 'https://evil.example.com/y' } },
    });
    expect(res.statusCode).toBe(403);
    const book = sqlite.prepare('SELECT source_url FROM books WHERE id = ?').get(created.id) as { source_url: string };
    expect(book.source_url).toBe('https://book.douban.com/subject/123/');
  });

  it('apply：fields.source_url 白名单内 → 200 且 source_url 落库', async () => {
    const token = await createAgentToken(['books:create', 'books:update_metadata']);
    const created = await createBookViaAgent(token, { title: '测试书' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/books/${created.id}/metadata/apply`,
      headers: auth(token),
      payload: { fields: { source_url: 'https://book.douban.com/subject/456/' } },
    });
    expect(res.statusCode).toBe(200);
    const book = sqlite.prepare('SELECT source_url FROM books WHERE id = ?').get(created.id) as { source_url: string };
    expect(book.source_url).toBe('https://book.douban.com/subject/456/');
  });

  it('apply：fetch_cover=true 且 fields.source_url 白名单内 → 抓取并下载封面', async () => {
    mockedFetch.mockResolvedValueOnce({
      title: '测试书',
      author: '作者',
      cover_url: 'https://img2.doubanio.com/view/subject/l/public/s123.jpg',
      source_url: 'https://book.douban.com/subject/123/',
      metadata_source: 'douban',
    });
    const token = await createAgentToken(['books:create', 'books:update_metadata']);
    const created = await createBookViaAgent(token, { title: '测试书' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/books/${created.id}/metadata/apply`,
      headers: auth(token),
      payload: { fields: { source_url: 'https://book.douban.com/subject/123/' }, fetch_cover: true },
    });
    expect(res.statusCode).toBe(200);
    expect(mockedDownloadCover).toHaveBeenCalled();
    const call = mockedDownloadCover.mock.calls[0][0] as { coverUrl: string; bookId: number };
    expect(call.coverUrl).toBe('https://img2.doubanio.com/view/subject/l/public/s123.jpg');
    expect(call.bookId).toBe(created.id);
    const book = sqlite.prepare('SELECT source_url FROM books WHERE id = ?').get(created.id) as { source_url: string };
    expect(book.source_url).toBe('https://book.douban.com/subject/123/');
  });

  it('apply：fetch_cover=true 但书内 source_url 白名单外 → 403', async () => {
    const token = await createAgentToken(['books:update_metadata']);
    const created = await createBookViaSession({ title: '浏览器录入', source_url: 'https://example.com/x' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/books/${created.id}/metadata/apply`,
      headers: auth(token),
      payload: { fields: { title: '不应生效' }, fetch_cover: true },
    });
    expect(res.statusCode).toBe(403);
    const book = sqlite.prepare('SELECT title FROM books WHERE id = ?').get(created.id) as { title: string };
    expect(book.title).toBe('浏览器录入');
  });

  it('浏览器（非 agent）创建不受源链接白名单限制', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/books',
      payload: { title: '浏览器录入', source_url: 'https://example.com/x' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('审计日志记录 agent 写操作', async () => {
    const token = await createAgentToken(['books:create']);
    await app.inject({ method: 'POST', url: '/api/v1/books', headers: auth(token), payload: { title: '审计测试' } });
    const row = sqlite.prepare(`SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'books.create' AND result = 'success'`).get() as { c: number };
    expect(Number(row.c)).toBeGreaterThanOrEqual(1);
  });
});