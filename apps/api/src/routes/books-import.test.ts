import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';
import { hashPassword } from '../lib/auth';

const testEnv = vi.hoisted(() => {
  const root = `${process.env.TEMP ?? process.env.TMP ?? '.'}/redesk-books-import-${process.pid}-${Date.now()}-${globalThis.crypto.randomUUID()}`;

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

type SqliteDatabase = ReturnType<typeof getSqlite>;

interface TestAppContext {
  app: Awaited<ReturnType<typeof buildServer>>;
  sqlite: SqliteDatabase;
}

let sharedContext: TestAppContext | undefined;

function closeSqliteSafely() {
  try {
    getSqlite().close();
  } catch {
    void 0;
  }
}

function now() {
  return new Date().toISOString();
}

async function createApp(): Promise<TestAppContext> {
  initDatabase();
  const sqlite = getSqlite();
  const app = await buildServer();
  await app.ready();

  return { app, sqlite };
}

async function seedBase(sqlite: SqliteDatabase): Promise<number> {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM status_history;
    DELETE FROM book_tags;
    DELETE FROM book_files;
    DELETE FROM books;
    DELETE FROM tags;
    DELETE FROM categories;
    DELETE FROM users;
    PRAGMA foreign_keys = ON;
  `);

  const ts = now();
  const suffix = `${Date.now()}-${process.pid}`;
  const passwordHash = await hashPassword('password123');
  const userId = Number(sqlite.prepare(`
    INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(`import-tester-${suffix}`, passwordHash, '导入测试用户', 1, 1, 0, ts, ts).lastInsertRowid);

  return userId;
}

function bookCount(sqlite: SqliteDatabase, userId: number): number {
  const row = sqlite.prepare(`
    SELECT COUNT(*) AS c FROM books WHERE owner_id = ? AND deleted_at IS NULL
  `).get(userId) as { c: number } | undefined;
  return Number(row?.c ?? 0);
}

function csvText(headers: string[], rows: string[][]): string {
  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function multipartBody(csv: string, boundary: string): Buffer {
  const parts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="books.csv"',
    'Content-Type: text/csv',
    '',
    csv,
    `--${boundary}--`,
    '',
  ];
  return Buffer.from(parts.join('\r\n'), 'utf-8');
}

function makeBoundary(): string {
  return `----redesk-test-${Date.now()}-${process.pid}`;
}

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

function parseSse(body: string): SseEvent[] {
  return body
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const lines = block.split('\n');
      const event = lines.find((line) => line.startsWith('event: '))?.slice(7) ?? 'message';
      const dataLine = lines.find((line) => line.startsWith('data: '));
      return { event, data: dataLine ? JSON.parse(dataLine.slice(6)) : {} };
    });
}

beforeAll(async () => {
  sharedContext = await createApp();
});

afterAll(async () => {
  if (sharedContext) {
    await sharedContext.app.close();
  }
  closeSqliteSafely();
  rmSync(testEnv.root, { recursive: true, force: true });
});

const HEADERS = ['title', 'author', 'isbn', 'status', 'visibility', 'publish_year'];

describe('POST /api/v1/books/import (dry_run 预览)', () => {
  it('返回每行校验结果，且不写入数据库', async () => {
    const { app, sqlite } = sharedContext!;
    const userId = await seedBase(sqlite);
    const boundary = makeBoundary();
    const csv = csvText(HEADERS, [
      ['三体', '刘慈欣', '9787536692930', 'READING', 'PRIVATE', '2008'],
      ['', '无名作者', '', 'READ', 'PRIVATE', '2020'],
      ['坏状态书', '作者', '', 'NOPE', 'PRIVATE', '2021'],
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/books/import?dry_run=true',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(csv, boundary),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.dry_run).toBe(true);
    expect(body.total).toBe(3);
    expect(body.created).toBe(0);
    expect(body.valid).toBe(1);
    expect(body.failed).toBe(2);
    expect(body.rows).toHaveLength(3);
    expect(body.rows[0]).toMatchObject({ row: 2, title: '三体', success: true, error: null });
    expect(body.rows[0]).not.toHaveProperty('input');
    expect(body.rows[1]).toMatchObject({ success: false, error: expect.stringContaining('title 不能为空') });
    expect(body.rows[2]).toMatchObject({ success: false, error: expect.stringContaining('status 只能是') });
    expect(bookCount(sqlite, userId)).toBe(0);
  });

  it('同一文件内重复 ISBN 标记为跳过', async () => {
    const { app, sqlite } = sharedContext!;
    await seedBase(sqlite);
    const boundary = makeBoundary();
    const csv = csvText(HEADERS, [
      ['书A', '作者', '9787536692930', 'READ', 'PRIVATE', '2020'],
      ['书B', '作者', '9787536692930', 'READ', 'PRIVATE', '2020'],
      ['书C', '作者', '9787536692931', 'READ', 'PRIVATE', '2020'],
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/books/import?dry_run=true',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(csv, boundary),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.skipped).toBe(1);
    expect(body.rows[1]).toMatchObject({ success: false, skipped: true, error: expect.stringContaining('已存在') });
  });

  it('缺少 title 表头时返回 400', async () => {
    const { app, sqlite } = sharedContext!;
    await seedBase(sqlite);
    const boundary = makeBoundary();
    const csv = csvText(['author', 'isbn'], [['作者', '9787536692930']]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/books/import?dry_run=true',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(csv, boundary),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/books/import (实际导入)', () => {
  it('校验通过的行写入数据库，失败行不写入', async () => {
    const { app, sqlite } = sharedContext!;
    const userId = await seedBase(sqlite);
    const boundary = makeBoundary();
    const csv = csvText(HEADERS, [
      ['三体', '刘慈欣', '9787536692930', 'READING', 'PRIVATE', '2008'],
      ['', '无名作者', '', 'READ', 'PRIVATE', '2020'],
      ['流浪地球', '刘慈欣', '9787536692947', 'READ', 'PRIVATE', '2008'],
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/books/import',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(csv, boundary),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.dry_run).toBe(false);
    expect(body.created).toBe(2);
    expect(body.valid).toBe(2);
    expect(body.failed).toBe(1);
    expect(bookCount(sqlite, userId)).toBe(2);
    const first = body.rows.find((row: { title: string }) => row.title === '三体');
    expect(first.book_id).toBeGreaterThan(0);
  });

  it('与库中已有书籍重复时跳过', async () => {
    const { app, sqlite } = sharedContext!;
    const userId = await seedBase(sqlite);
    const ts = now();
    sqlite.prepare(`
      INSERT INTO books (owner_id, title, author, isbn, status, visibility, import_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, '三体', '刘慈欣', '9787536692930', 'READ', 'PRIVATE', 1, ts, ts);

    const boundary = makeBoundary();
    const csv = csvText(HEADERS, [
      ['三体', '刘慈欣', '9787536692930', 'READ', 'PRIVATE', '2008'],
      ['新书', '新作者', '', 'READ', 'PRIVATE', '2022'],
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/books/import',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(csv, boundary),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.skipped).toBe(1);
    expect(body.created).toBe(1);
    expect(bookCount(sqlite, userId)).toBe(2);
  });
});

describe('POST /api/v1/books/import/run (SSE 流式导入)', () => {
  it('逐行推送 progress 事件并以 complete 结束，全部写入数据库', async () => {
    const { app, sqlite } = sharedContext!;
    const userId = await seedBase(sqlite);
    const boundary = makeBoundary();
    const csv = csvText(HEADERS, [
      ['三体', '刘慈欣', '9787536692930', 'READING', 'PRIVATE', '2008'],
      ['流浪地球', '刘慈欣', '9787536692947', 'READ', 'PRIVATE', '2008'],
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/books/import/run',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(csv, boundary),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    const events = parseSse(response.body);
    const progresses = events.filter((event) => event.event === 'progress');
    const completes = events.filter((event) => event.event === 'complete');

    expect(progresses).toHaveLength(2);
    expect(progresses[0].data).toMatchObject({ processed: 1, total: 2, status: 'created', title: '三体' });
    expect(progresses[1].data).toMatchObject({ processed: 2, total: 2, status: 'created', title: '流浪地球' });
    expect(completes).toHaveLength(1);
    expect(completes[0].data).toMatchObject({ created: 2, skipped: 0, failed: 0, cancelled: false });
    expect(bookCount(sqlite, userId)).toBe(2);
  });

  it('失败行与重复行计入对应计数', async () => {
    const { app, sqlite } = sharedContext!;
    const userId = await seedBase(sqlite);
    const ts = now();
    sqlite.prepare(`
      INSERT INTO books (owner_id, title, author, isbn, status, visibility, import_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, '三体', '刘慈欣', '9787536692930', 'READ', 'PRIVATE', 1, ts, ts);

    const boundary = makeBoundary();
    const csv = csvText(HEADERS, [
      ['三体', '刘慈欣', '9787536692930', 'READ', 'PRIVATE', '2008'],
      ['', '无名', '', 'READ', 'PRIVATE', '2020'],
      ['新书', '新作者', '', 'READ', 'PRIVATE', '2022'],
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/books/import/run',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(csv, boundary),
    });

    expect(response.statusCode).toBe(200);
    const events = parseSse(response.body);
    const statuses = events.filter((event) => event.event === 'progress').map((event) => event.data.status);
    expect(statuses).toEqual(['skipped', 'failed', 'created']);
    const complete = events.find((event) => event.event === 'complete')!.data;
    expect(complete).toMatchObject({ created: 1, skipped: 1, failed: 1, cancelled: false });
    expect(bookCount(sqlite, userId)).toBe(2);
  });

  it('缺少 title 表头时返回 400 且不建立流', async () => {
    const { app, sqlite } = sharedContext!;
    await seedBase(sqlite);
    const boundary = makeBoundary();
    const csv = csvText(['author'], [['作者']]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/books/import/run',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody(csv, boundary),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/books/import/run (取消语义)', () => {
  it('客户端断开连接后，已处理行保留，未处理行不写入', async () => {
    const { app, sqlite } = sharedContext!;
    const userId = await seedBase(sqlite);
    await app.listen({ port: 0 });
    try {
      const { port } = app.server.address() as AddressInfo;
      const boundary = makeBoundary();

      const rows: string[][] = [];
      for (let i = 1; i <= 3000; i += 1) {
        rows.push([`取消测试书${i}`, `作者${i}`, `978700000000${String(i).padStart(4, '0')}`, 'READ', 'PRIVATE', '2020']);
      }
      const csv = csvText(HEADERS, rows);
      const body = multipartBody(csv, boundary);

      await new Promise<void>((resolve) => {
        const req = http.request({
          host: '127.0.0.1',
          port,
          path: '/api/v1/books/import/run',
          method: 'POST',
          headers: {
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': body.length,
          },
        }, (res) => {
          res.on('data', () => {
            req.destroy();
          });
          res.on('close', () => resolve());
          res.on('error', () => resolve());
        });
        req.on('error', () => resolve());
        req.end(body);
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const processed = bookCount(sqlite, userId);
      expect(processed).toBeGreaterThan(0);
      expect(processed).toBeLessThan(3000);
    } finally {
      await new Promise<void>((resolve) => app.server.close(() => resolve()));
    }
  });
});
