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
  topicId: number;
  bookId: number;
  highlightId: number;
  noteId: number;
}

interface TestAppContext {
  app: Awaited<ReturnType<typeof buildServer>>;
  sqlite: ReturnType<typeof createDatabase>['sqlite'];
}

const cleanupDirs: string[] = [];
let sharedContext: TestAppContext | undefined;

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

    CREATE TABLE topics (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      owner_id integer NOT NULL,
      name text NOT NULL,
      description text,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      deleted_at text,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE topic_books (
      topic_id integer NOT NULL,
      book_id integer NOT NULL,
      added_at text NOT NULL,
      PRIMARY KEY (topic_id, book_id),
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    );

    CREATE TABLE topic_highlights (
      topic_id integer NOT NULL,
      highlight_id integer NOT NULL,
      added_at text NOT NULL,
      PRIMARY KEY (topic_id, highlight_id),
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE CASCADE
    );

    CREATE TABLE topic_notes (
      topic_id integer NOT NULL,
      note_id integer NOT NULL,
      added_at text NOT NULL,
      PRIMARY KEY (topic_id, note_id),
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE topic_segments (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      topic_id integer NOT NULL,
      book_id integer NOT NULL,
      cfi_start text NOT NULL,
      cfi_end text NOT NULL,
      label text,
      added_at text NOT NULL,
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    );

    CREATE TABLE topic_entries (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      topic_id integer NOT NULL,
      entry_type text NOT NULL,
      content text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );
  `);
}

async function createApp(): Promise<TestAppContext> {
  const root = mkdtempSync(join(tmpdir(), 'redesk-topics-'));
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
    DELETE FROM topic_highlights;
    DELETE FROM topic_notes;
    DELETE FROM topic_segments;
    DELETE FROM topic_entries;
    DELETE FROM topic_books;
    DELETE FROM highlights;
    DELETE FROM notes;
    DELETE FROM topics;
    DELETE FROM books;
    DELETE FROM users;
    PRAGMA foreign_keys = ON;
  `);

  const ts = now();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await hashPassword('password123');

  const insertUser = sqlite.prepare(`
    INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const userResult = insertUser.run(`tester-${suffix}`, passwordHash, '测试用户', 1, 1, 0, ts, ts);
  const userId = Number(userResult.lastInsertRowid);

  const insertBook = sqlite.prepare(`
    INSERT INTO books (owner_id, title, status, visibility, import_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const bookResult = insertBook.run(userId, '主题阅读测试书', 'READING', 'PRIVATE', 1, ts, ts);
  const bookId = Number(bookResult.lastInsertRowid);

  const insertTopic = sqlite.prepare(`
    INSERT INTO topics (owner_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const topicResult = insertTopic.run(userId, '测试话题', '用于接口测试', ts, ts);
  const topicId = Number(topicResult.lastInsertRowid);

  const insertHighlight = sqlite.prepare(`
    INSERT INTO highlights (book_id, owner_id, cfi_start, cfi_end, text, type, color, note, mark_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const highlightResult = insertHighlight.run(
    bookId,
    userId,
    'epubcfi(/6/2[test]!/4/2/2)',
    'epubcfi(/6/2[test]!/4/2/4)',
    '这是一条高亮',
    'HIGHLIGHT',
    '#facc15',
    '高亮备注',
    'QUESTION',
    ts,
    ts,
  );
  const highlightId = Number(highlightResult.lastInsertRowid);

  const insertNote = sqlite.prepare(`
    INSERT INTO notes (book_id, owner_id, cfi, title, content_markdown, mark_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const noteResult = insertNote.run(
    bookId,
    userId,
    'epubcfi(/6/2[test]!/4/2/6)',
    '独立笔记',
    '笔记正文',
    'INSIGHT',
    ts,
    ts,
  );
  const noteId = Number(noteResult.lastInsertRowid);

  return {
    userId,
    topicId,
    bookId,
    highlightId,
    noteId,
  };
}

beforeAll(async () => {
  sharedContext = await createApp();
});

afterAll(async () => {
  if (sharedContext) {
    await sharedContext.app.close();
  }

  try {
    getSqlite().close();
  } catch {
  }

  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('topic routes', () => {
  it('adds and removes highlight references on a topic', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);

    const addResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/topics/${seeded.topicId}/highlights`,
      payload: { highlight_id: seeded.highlightId },
    });

    expect(addResponse.statusCode).toBe(200);
    expect(addResponse.json()).toEqual({ data: { added: true } });

    const topicResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/topics/${seeded.topicId}`,
    });

    expect(topicResponse.statusCode).toBe(200);
    expect(topicResponse.json().data.highlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ highlight_id: seeded.highlightId, text: '这是一条高亮' }),
      ]),
    );

    const removeResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/topics/${seeded.topicId}/highlights/${seeded.highlightId}`,
    });

    expect(removeResponse.statusCode).toBe(200);
    expect(removeResponse.json()).toEqual({ data: { removed: true } });
  });

  it('adds and removes note references on a topic', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);

    const addResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/topics/${seeded.topicId}/notes`,
      payload: { note_id: seeded.noteId },
    });

    expect(addResponse.statusCode).toBe(200);
    expect(addResponse.json()).toEqual({ data: { added: true } });

    const topicResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/topics/${seeded.topicId}`,
    });

    expect(topicResponse.statusCode).toBe(200);
    expect(topicResponse.json().data.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note_id: seeded.noteId, title: '独立笔记' }),
      ]),
    );

    const removeResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/topics/${seeded.topicId}/notes/${seeded.noteId}`,
    });

    expect(removeResponse.statusCode).toBe(200);
    expect(removeResponse.json()).toEqual({ data: { removed: true } });
  });

  it('creates, updates and returns topic segments in topic detail', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);

    const createResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/topics/${seeded.topicId}/segments`,
      payload: {
        book_id: seeded.bookId,
        cfi_start: 'epubcfi(/6/2[test]!/4/4/2)',
        cfi_end: 'epubcfi(/6/2[test]!/4/4/8)',
        label: '第一章片段',
      },
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json().data;
    expect(created).toEqual(
      expect.objectContaining({
        topic_id: seeded.topicId,
        book_id: seeded.bookId,
        label: '第一章片段',
      }),
    );

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/topics/${seeded.topicId}/segments/${created.id}`,
      payload: { label: '修订后的片段标题' },
    });

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().data).toEqual(
      expect.objectContaining({ id: created.id, label: '修订后的片段标题' }),
    );

    const topicResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/topics/${seeded.topicId}`,
    });

    expect(topicResponse.statusCode).toBe(200);
    expect(topicResponse.json().data.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.id, label: '修订后的片段标题' }),
      ]),
    );
  });

  it('automatically drops topic references after original highlight deletion', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);

    const addResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/topics/${seeded.topicId}/highlights`,
      payload: { highlight_id: seeded.highlightId },
    });

    expect(addResponse.statusCode).toBe(200);

    sqlite.prepare('DELETE FROM highlights WHERE id = ?').run(seeded.highlightId);

    const topicResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/topics/${seeded.topicId}`,
    });

    expect(topicResponse.statusCode).toBe(200);
    expect(topicResponse.json().data.highlights).toEqual([]);
  });
});
