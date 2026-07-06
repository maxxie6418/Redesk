import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase } from '@redesk/db';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';
import { hashPassword } from '../lib/auth';

interface SeedResult {
  userId: number;
  bookId: number;
}

interface TestAppContext {
  app: Awaited<ReturnType<typeof buildServer>>;
  sqlite: ReturnType<typeof createDatabase>['sqlite'];
}

const cleanupDirs: string[] = [];
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

function createSchema(sqlite: ReturnType<typeof createDatabase>['sqlite']) {
  sqlite.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE users (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      display_name text,
      is_active integer NOT NULL DEFAULT 1,
      is_admin integer NOT NULL DEFAULT 0,
      must_change_password integer NOT NULL DEFAULT 0,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE books (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      owner_id integer NOT NULL,
      title text NOT NULL,
      author text,
      cover_path text,
      status text NOT NULL DEFAULT 'COLLECTED',
      visibility text NOT NULL DEFAULT 'PRIVATE',
      import_order integer NOT NULL DEFAULT 0,
      deleted_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE highlights (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      book_id integer NOT NULL,
      owner_id integer NOT NULL,
      cfi_start text NOT NULL,
      cfi_end text NOT NULL,
      text text NOT NULL,
      type text NOT NULL DEFAULT 'HIGHLIGHT',
      color text,
      note text,
      mark_type text DEFAULT 'NONE',
      created_at text NOT NULL,
      updated_at text NOT NULL,
      deleted_at text,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE notes (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      book_id integer NOT NULL,
      owner_id integer NOT NULL,
      cfi text,
      title text,
      content_html text,
      content_markdown text,
      mark_type text DEFAULT 'NONE',
      created_at text NOT NULL,
      updated_at text NOT NULL,
      deleted_at text,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE bookmarks (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      book_id integer NOT NULL,
      owner_id integer NOT NULL,
      cfi text NOT NULL,
      label text,
      percentage real,
      created_at text NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE VIRTUAL TABLE notes_fts USING fts5(title, content_markdown, content_html, content='notes', content_rowid='id');
    CREATE VIRTUAL TABLE highlights_fts USING fts5(text, note, content='highlights', content_rowid='id');
  `);
}

async function createApp(): Promise<TestAppContext> {
  const root = mkdtempSync(join(tmpdir(), 'redesk-notes-'));
  cleanupDirs.push(root);

  process.env.NODE_ENV = 'test';
  process.env.AUTH_DISABLED = 'true';
  process.env.DATABASE_URL = join(root, 'redesk.db');
  process.env.STORAGE_DIR = join(root, 'storage');
  process.env.SPA_DIR = join(root, 'spa');
  process.env.SESSION_SECRET = 'test-session-secret-123456';
  process.env.WEB_URL = 'http://localhost:5173';

  const handle = createDatabase({ url: join(root, 'redesk.db') });
  createSchema(handle.sqlite);
  handle.sqlite.close();

  initDatabase();
  const sqlite = getSqlite();
  const app = await buildServer();
  await app.ready();

  return {
    app,
    sqlite,
  };
}

async function seedBase(sqlite: ReturnType<typeof createDatabase>['sqlite']): Promise<SeedResult> {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM highlights;
    DELETE FROM notes;
    DELETE FROM bookmarks;
    DELETE FROM books;
    DELETE FROM users;
    DELETE FROM notes_fts;
    DELETE FROM highlights_fts;
    PRAGMA foreign_keys = ON;
  `);

  const ts = now();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await hashPassword('password123');
  const userId = Number(sqlite.prepare(`
    INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(`notes-tester-${suffix}`, passwordHash, '笔记测试用户', 1, 1, 0, ts, ts).lastInsertRowid);
  const bookId = Number(sqlite.prepare(`
    INSERT INTO books (owner_id, title, author, status, visibility, import_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, '笔记分页测试书', '测试作者', 'READING', 'PRIVATE', 1, ts, ts).lastInsertRowid);

  return { userId, bookId };
}

function seedMarks(sqlite: ReturnType<typeof createDatabase>['sqlite'], seeded: SeedResult, count: number) {
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
  const insertNoteFts = sqlite.prepare(`INSERT INTO notes_fts(rowid, title, content_markdown, content_html) VALUES (?, ?, ?, ?)`);
  const insertHighlightFts = sqlite.prepare(`INSERT INTO highlights_fts(rowid, text, note) VALUES (?, ?, ?)`);

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

beforeAll(async () => {
  sharedContext = await createApp();
});

afterAll(async () => {
  if (sharedContext) {
    await sharedContext.app.close();
  }

  closeSqliteSafely();

  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('note routes query validation and pagination', () => {
  it('caps notes pagination query and returns pagination metadata', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    seedMarks(sqlite, seeded, 505);

    const response = await app.inject({ method: 'GET', url: `/api/v1/notes?page=1&page_size=999&book_id=${seeded.bookId}` });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[]; pagination: { page: number; page_size: number; total: number } };
    expect(body.data).toHaveLength(500);
    expect(body.pagination).toEqual({ page: 1, page_size: 500, total: 505 });
  });

  it('rejects invalid highlights pagination query', async () => {
    const { app, sqlite } = sharedContext!;
    await seedBase(sqlite);

    const response = await app.inject({ method: 'GET', url: '/api/v1/highlights?page=0&page_size=20' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid bookmarks book_id and returns paginated bookmark list', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    seedMarks(sqlite, seeded, 3);

    const invalidResponse = await app.inject({ method: 'GET', url: '/api/v1/bookmarks?book_id=abc' });
    expect(invalidResponse.statusCode).toBe(400);
    expect(invalidResponse.json().error.code).toBe('VALIDATION_ERROR');

    const response = await app.inject({ method: 'GET', url: `/api/v1/bookmarks?page=1&page_size=2&book_id=${seeded.bookId}` });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[]; pagination: { page: number; page_size: number; total: number } };
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 1, page_size: 2, total: 3 });
  });

  it('returns pagination metadata for notes search', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    seedMarks(sqlite, seeded, 3);

    const response = await app.inject({ method: 'GET', url: `/api/v1/notes/search?q=共同搜索词&page=1&page_size=2&book_id=${seeded.bookId}` });

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

    const response = await app.inject({ method: 'GET', url: `/api/v1/highlights/search?q=共同搜索词&page=2&page_size=2&book_id=${seeded.bookId}` });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[]; pagination: { page: number; page_size: number; total: number }; type: string };
    expect(body.type).toBe('highlights');
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 2, page_size: 2, total: 4 });
  });
});
