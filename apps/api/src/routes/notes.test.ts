import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';
import { hashPassword } from '../lib/auth';

const testEnv = vi.hoisted(() => {
  const root = `${process.env.TEMP ?? process.env.TMP ?? '.'}/redesk-notes-${process.pid}-${Date.now()}-${globalThis.crypto.randomUUID()}`;

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

interface SeedResult {
  userId: number;
  bookId: number;
  fileId: number;
}

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

  return {
    app,
    sqlite,
  };
}

async function seedBase(sqlite: SqliteDatabase): Promise<SeedResult> {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM reading_progress;
    DELETE FROM highlights;
    DELETE FROM notes;
    DELETE FROM bookmarks;
    DELETE FROM book_files;
    DELETE FROM books;
    DELETE FROM users;
    DELETE FROM notes_fts;
    DELETE FROM highlights_fts;
    PRAGMA foreign_keys = ON;
  `);

  const ts = now();
  const suffix = `${Date.now()}-${process.pid}`;
  const passwordHash = await hashPassword('password123');
  const userId = Number(sqlite.prepare(`
    INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(`notes-tester-${suffix}`, passwordHash, '笔记测试用户', 1, 1, 0, ts, ts).lastInsertRowid);
  const bookId = Number(sqlite.prepare(`
    INSERT INTO books (owner_id, title, author, status, visibility, import_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, '笔记分页测试书', '测试作者', 'READING', 'PRIVATE', 1, ts, ts).lastInsertRowid);
  const fileId = Number(sqlite.prepare(`
    INSERT INTO book_files (owner_id, book_id, storage_mode, primary_location, sync_status, original_filename, file_format, file_size, is_primary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, bookId, 'local_only', 'local', 'synced', 'main.epub', 'EPUB', 100, 1, ts, ts).lastInsertRowid);

  return { userId, bookId, fileId };
}

function seedMarks(sqlite: SqliteDatabase, seeded: SeedResult, count: number, options: { includeBookmarks?: boolean } = {}) {
  const includeBookmarks = options.includeBookmarks ?? true;
  const insertHighlight = sqlite.prepare(`
    INSERT INTO highlights (book_id, owner_id, cfi_start, cfi_end, text, type, color, note, mark_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNote = sqlite.prepare(`
    INSERT INTO notes (book_id, owner_id, cfi, title, content_html, content_markdown, mark_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertBookmark = sqlite.prepare(`
    INSERT INTO bookmarks (book_id, owner_id, cfi, label, percentage, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertNoteFts = sqlite.prepare('INSERT INTO notes_fts(rowid, title, content_markdown, content_html) VALUES (?, ?, ?, ?)');
  const insertHighlightFts = sqlite.prepare('INSERT INTO highlights_fts(rowid, text, note) VALUES (?, ?, ?)');

  for (let index = 1; index <= count; index += 1) {
    const ts = new Date(Date.UTC(2026, 0, index, 0, 0, 0)).toISOString();
    const noteResult = insertNote.run(
      seeded.bookId,
      seeded.userId,
      `epubcfi(/6/2[test]!/4/2/${index})`,
      `笔记 ${index}`,
      `<p>共同搜索词 HTML ${index}</p>`,
      `共同搜索词 Markdown ${index}`,
      'INSIGHT',
      ts,
      ts,
    );
    insertNoteFts.run(Number(noteResult.lastInsertRowid), `笔记 ${index}`, `共同搜索词 Markdown ${index}`, `<p>共同搜索词 HTML ${index}</p>`);

    const highlightResult = insertHighlight.run(
      seeded.bookId,
      seeded.userId,
      `epubcfi(/6/2[test]!/4/4/${index})`,
      `epubcfi(/6/2[test]!/4/6/${index})`,
      `共同搜索词 高亮 ${index}`,
      'HIGHLIGHT',
      '#facc15',
      `共同搜索词 备注 ${index}`,
      'QUESTION',
      ts,
      ts,
    );
    insertHighlightFts.run(Number(highlightResult.lastInsertRowid), `共同搜索词 高亮 ${index}`, `共同搜索词 备注 ${index}`);

    if (includeBookmarks) {
      insertBookmark.run(
        seeded.bookId,
        seeded.userId,
        `epubcfi(/6/2[test]!/4/8/${index})`,
        `书签 ${index}`,
        index,
        ts,
      );
    }
  }
}

async function authCookie(app: TestAppContext['app']): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { password: 'password123' },
  });
  expect(response.statusCode).toBe(200);
  const setCookie = response.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!cookie) throw new Error('登录响应缺少会话 Cookie');
  return cookie.split(';')[0];
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

describe('backup permission boundaries', () => {
  it('rejects full backup and manual backup trigger for non-admin users', async () => {
    const { app, sqlite } = sharedContext!;
    await seedBase(sqlite);
    const ts = now();
    const passwordHash = await hashPassword('reader-password');
    sqlite.prepare(`
      INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`reader-${Date.now()}`, passwordHash, '普通读者', 1, 0, 0, ts, ts);
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { password: 'reader-password' },
    });
    expect(loginResponse.statusCode).toBe(200);
    const setCookie = loginResponse.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0];
    if (!cookie) throw new Error('普通用户登录响应缺少会话 Cookie');

    const fullResponse = await app.inject({ method: 'POST', url: '/api/v1/backup/full', headers: { cookie } });
    const triggerResponse = await app.inject({ method: 'POST', url: '/api/v1/backup/trigger', headers: { cookie } });

    expect(fullResponse.statusCode).toBe(403);
    expect(fullResponse.json().error.code).toBe('FORBIDDEN');
    expect(triggerResponse.statusCode).toBe(403);
    expect(triggerResponse.json().error.code).toBe('FORBIDDEN');
  });
});

describe('reading progress ownership validation', () => {
  it('rejects progress updates when file does not belong to the target book', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    const ts = now();
    const otherBookId = Number(sqlite.prepare(`
      INSERT INTO books (owner_id, title, author, status, visibility, import_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(seeded.userId, '另一本书', '测试作者', 'READING', 'PRIVATE', 2, ts, ts).lastInsertRowid);
    const otherFileId = Number(sqlite.prepare(`
      INSERT INTO book_files (owner_id, book_id, storage_mode, primary_location, sync_status, original_filename, file_format, file_size, is_primary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(seeded.userId, otherBookId, 'local_only', 'local', 'synced', 'other.epub', 'EPUB', 100, 1, ts, ts).lastInsertRowid);
    const cookie = await authCookie(app);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/books/${seeded.bookId}/reading-progress`,
      headers: { cookie },
      payload: { file_id: otherFileId, cfi: 'epubcfi(/6/2!/4/2)', percentage: 10 },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('saves progress when file belongs to the target book', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    const cookie = await authCookie(app);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/books/${seeded.bookId}/reading-progress`,
      headers: { cookie },
      payload: { file_id: seeded.fileId, cfi: 'epubcfi(/6/2!/4/2)', percentage: 10 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ book_id: seeded.bookId, file_id: seeded.fileId, percentage: 10 });
  });
});

describe('note routes query validation and pagination', () => {
  it('caps notes pagination query and returns pagination metadata', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    seedMarks(sqlite, seeded, 505, { includeBookmarks: false });
    const cookie = await authCookie(app);

    const response = await app.inject({ method: 'GET', url: `/api/v1/notes?page=1&page_size=999&book_id=${seeded.bookId}`, headers: { cookie } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[]; pagination: { page: number; page_size: number; total: number } };
    expect(body.data).toHaveLength(500);
    expect(body.pagination).toEqual({ page: 1, page_size: 500, total: 505 });
  });

  it('rejects invalid highlights pagination query', async () => {
    const { app, sqlite } = sharedContext!;
    await seedBase(sqlite);
    const cookie = await authCookie(app);

    const response = await app.inject({ method: 'GET', url: '/api/v1/highlights?page=0&page_size=20', headers: { cookie } });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid bookmarks book_id and returns paginated bookmark list', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    seedMarks(sqlite, seeded, 3);
    const cookie = await authCookie(app);

    const invalidResponse = await app.inject({ method: 'GET', url: '/api/v1/bookmarks?book_id=abc', headers: { cookie } });
    expect(invalidResponse.statusCode).toBe(400);
    expect(invalidResponse.json().error.code).toBe('VALIDATION_ERROR');

    const response = await app.inject({ method: 'GET', url: `/api/v1/bookmarks?page=1&page_size=2&book_id=${seeded.bookId}`, headers: { cookie } });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[]; pagination: { page: number; page_size: number; total: number } };
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 1, page_size: 2, total: 3 });
  });

  it('returns pagination metadata for notes search', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    seedMarks(sqlite, seeded, 3);
    const cookie = await authCookie(app);

    const response = await app.inject({ method: 'GET', url: `/api/v1/notes/search?q=共同搜索词&page=1&page_size=2&book_id=${seeded.bookId}`, headers: { cookie } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[]; pagination: { page: number; page_size: number; total: number }; type: string };
    expect(body.type).toBe('notes');
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 1, page_size: 2, total: 3 });
  });

  it('returns pagination metadata for highlights search', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    seedMarks(sqlite, seeded, 4);
    const cookie = await authCookie(app);

    const response = await app.inject({ method: 'GET', url: `/api/v1/highlights/search?q=共同搜索词&page=2&page_size=2&book_id=${seeded.bookId}`, headers: { cookie } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[]; pagination: { page: number; page_size: number; total: number }; type: string };
    expect(body.type).toBe('highlights');
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 2, page_size: 2, total: 4 });
  });
});
