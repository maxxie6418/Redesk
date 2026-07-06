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
      category_id integer,
      genre_category_id integer,
      title text NOT NULL,
      author text,
      subtitle text,
      isbn text,
      publisher text,
      publish_year integer,
      description text,
      language text,
      cover_path text,
      status text NOT NULL DEFAULT 'COLLECTED',
      visibility text NOT NULL DEFAULT 'PRIVATE',
      reading_purpose text,
      entry_reason text,
      rating integer,
      custom_attributes text,
      metadata_source text,
      source_url text,
      translator text,
      original_title text,
      page_count integer,
      favorited_at text,
      started_at text,
      finished_at text,
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

    CREATE TABLE reading_progress (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      book_id integer NOT NULL,
      owner_id integer NOT NULL,
      file_id integer NOT NULL,
      cfi text NOT NULL,
      percentage real NOT NULL DEFAULT 0,
      last_read_at text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL,
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
    DELETE FROM bookmarks;
    DELETE FROM reading_progress;
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

  closeSqliteSafely();

  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('topic routes', () => {
  it('returns topic list counts without per-topic count queries', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    const ts = now();

    const secondBookId = Number(
      sqlite.prepare('INSERT INTO books (owner_id, title, status, visibility, import_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(seeded.userId, '第二本主题书', 'READING', 'PRIVATE', 2, ts, ts).lastInsertRowid,
    );
    const secondTopicId = Number(
      sqlite.prepare('INSERT INTO topics (owner_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(seeded.userId, '第二个话题', '用于列表统计', ts, ts).lastInsertRowid,
    );
    const thirdTopicId = Number(
      sqlite.prepare('INSERT INTO topics (owner_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(seeded.userId, '第三个话题', null, ts, ts).lastInsertRowid,
    );

    sqlite.prepare('INSERT INTO topic_books (topic_id, book_id, added_at) VALUES (?, ?, ?)').run(seeded.topicId, seeded.bookId, ts);
    sqlite.prepare('INSERT INTO topic_books (topic_id, book_id, added_at) VALUES (?, ?, ?)').run(secondTopicId, seeded.bookId, ts);
    sqlite.prepare('INSERT INTO topic_books (topic_id, book_id, added_at) VALUES (?, ?, ?)').run(secondTopicId, secondBookId, ts);
    sqlite.prepare('INSERT INTO topic_entries (topic_id, entry_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(seeded.topicId, 'QUESTION', '第一个问题', ts, ts);
    sqlite.prepare('INSERT INTO topic_entries (topic_id, entry_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(seeded.topicId, 'INSIGHT', '第一个判断', ts, ts);
    sqlite.prepare('INSERT INTO topic_entries (topic_id, entry_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(thirdTopicId, 'COMPARE', '第三个比较', ts, ts);

    const countQueries: string[] = [];
    const originalPrepare = sqlite.prepare.bind(sqlite);
    Object.defineProperty(sqlite, 'prepare', {
      configurable: true,
      value: ((source: string) => {
        const normalized = source.replace(/\s+/g, ' ').toLowerCase();
        if (normalized.includes('count') && (normalized.includes('topic_books') || normalized.includes('topic_entries'))) {
          countQueries.push(normalized);
        }
        return originalPrepare(source);
      }) as typeof sqlite.prepare,
    });

    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/topics' });

      expect(response.statusCode).toBe(200);
      const items = response.json().data as Array<{ name: string; book_count: number; entry_count: number }>;
      const countsByName = new Map(items.map((item) => [item.name, { book_count: item.book_count, entry_count: item.entry_count }]));
      expect(countsByName.get('测试话题')).toEqual({ book_count: 1, entry_count: 2 });
      expect(countsByName.get('第二个话题')).toEqual({ book_count: 2, entry_count: 0 });
      expect(countsByName.get('第三个话题')).toEqual({ book_count: 0, entry_count: 1 });
      expect(countQueries.filter((query) => query.includes('topic_books'))).toHaveLength(1);
      expect(countQueries.filter((query) => query.includes('topic_entries'))).toHaveLength(1);
    } finally {
      Object.defineProperty(sqlite, 'prepare', {
        configurable: true,
        value: originalPrepare,
      });
    }
  });
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

  it('rejects empty topic and entry updates', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);

    const topicResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/topics/${seeded.topicId}`,
      payload: {},
    });

    expect(topicResponse.statusCode).toBe(400);

    const createEntryResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/topics/${seeded.topicId}/entries`,
      payload: { entry_type: 'QUESTION', content: '原始沉淀' },
    });

    expect(createEntryResponse.statusCode).toBe(200);
    const entryId = createEntryResponse.json().data.id;

    const entryResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/topics/${seeded.topicId}/entries/${entryId}`,
      payload: {},
    });

    expect(entryResponse.statusCode).toBe(400);
  });

  it('hides soft-deleted resources from topic detail', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    const ts = now();

    sqlite.prepare('INSERT INTO topic_books (topic_id, book_id, added_at) VALUES (?, ?, ?)').run(seeded.topicId, seeded.bookId, ts);
    await app.inject({ method: 'POST', url: `/api/v1/topics/${seeded.topicId}/highlights`, payload: { highlight_id: seeded.highlightId } });
    await app.inject({ method: 'POST', url: `/api/v1/topics/${seeded.topicId}/notes`, payload: { note_id: seeded.noteId } });
    await app.inject({
      method: 'POST',
      url: `/api/v1/topics/${seeded.topicId}/segments`,
      payload: {
        book_id: seeded.bookId,
        cfi_start: 'epubcfi(/6/2[test]!/4/8/2)',
        cfi_end: 'epubcfi(/6/2[test]!/4/8/6)',
        label: '隐藏片段',
      },
    });

    sqlite.prepare('UPDATE books SET deleted_at = ? WHERE id = ?').run(ts, seeded.bookId);
    sqlite.prepare('UPDATE highlights SET deleted_at = ? WHERE id = ?').run(ts, seeded.highlightId);
    sqlite.prepare('UPDATE notes SET deleted_at = ? WHERE id = ?').run(ts, seeded.noteId);

    const topicResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/topics/${seeded.topicId}`,
    });

    expect(topicResponse.statusCode).toBe(200);
    expect(topicResponse.json().data.books).toEqual([]);
    expect(topicResponse.json().data.highlights).toEqual([]);
    expect(topicResponse.json().data.notes).toEqual([]);
    expect(topicResponse.json().data.segments).toEqual([]);
  });

  it('updates parent topic timestamp after entry changes', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    const oldTimestamp = '2000-01-01T00:00:00.000Z';

    const createEntryResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/topics/${seeded.topicId}/entries`,
      payload: { entry_type: 'QUESTION', content: '原始沉淀' },
    });

    expect(createEntryResponse.statusCode).toBe(200);
    const entryId = createEntryResponse.json().data.id;
    sqlite.prepare('UPDATE topics SET updated_at = ? WHERE id = ?').run(oldTimestamp, seeded.topicId);

    const updateEntryResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/topics/${seeded.topicId}/entries/${entryId}`,
      payload: { content: '更新后的沉淀' },
    });

    expect(updateEntryResponse.statusCode).toBe(200);
    const topic = sqlite.prepare('SELECT updated_at FROM topics WHERE id = ?').get(seeded.topicId) as { updated_at: string };
    expect(topic.updated_at).not.toBe(oldTimestamp);
  });

  it('returns a book review summary with recent marks and mark type counts', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    const ts = now();

    sqlite.prepare('INSERT INTO bookmarks (book_id, owner_id, cfi, label, percentage, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(seeded.bookId, seeded.userId, 'epubcfi(/6/2[test]!/4/2/8)', '关键页', 0.42, ts);
    sqlite.prepare('INSERT INTO reading_progress (book_id, owner_id, file_id, cfi, percentage, last_read_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(seeded.bookId, seeded.userId, 1, 'epubcfi(/6/2[test]!/4/2/10)', 0.56, ts, ts, ts);

    const response = await app.inject({ method: 'GET', url: `/api/v1/books/${seeded.bookId}/review` });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.objectContaining({
        book_id: seeded.bookId,
        counts: { highlights: 1, notes: 1, bookmarks: 1 },
        mark_type_counts: expect.objectContaining({ QUESTION: 1, INSIGHT: 1 }),
        reading_progress: expect.objectContaining({ percentage: 0.56 }),
      }),
    );
    expect(response.json().data.recent_marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'highlight', id: seeded.highlightId, cfi: 'epubcfi(/6/2[test]!/4/2/2)' }),
        expect.objectContaining({ type: 'note', id: seeded.noteId, cfi: 'epubcfi(/6/2[test]!/4/2/6)' }),
        expect.objectContaining({ type: 'bookmark', cfi: 'epubcfi(/6/2[test]!/4/2/8)' }),
      ]),
    );
  });

  it('returns a derived topic timeline ordered by event time', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedBase(sqlite);
    const base = new Date('2026-07-06T00:00:00.000Z');
    const at = (minutes: number) => new Date(base.getTime() + minutes * 60_000).toISOString();

    sqlite.prepare('UPDATE topics SET created_at = ?, updated_at = ? WHERE id = ?').run(at(0), at(0.5), seeded.topicId);
    sqlite.prepare('UPDATE highlights SET created_at = ?, updated_at = ? WHERE id = ?').run(at(2), at(2), seeded.highlightId);
    sqlite.prepare('UPDATE notes SET created_at = ?, updated_at = ? WHERE id = ?').run(at(3), at(3), seeded.noteId);
    sqlite.prepare('INSERT INTO topic_books (topic_id, book_id, added_at) VALUES (?, ?, ?)').run(seeded.topicId, seeded.bookId, at(1));
    sqlite.prepare('INSERT INTO topic_highlights (topic_id, highlight_id, added_at) VALUES (?, ?, ?)').run(seeded.topicId, seeded.highlightId, at(4));
    sqlite.prepare('INSERT INTO topic_notes (topic_id, note_id, added_at) VALUES (?, ?, ?)').run(seeded.topicId, seeded.noteId, at(5));
    sqlite.prepare('INSERT INTO topic_segments (topic_id, book_id, cfi_start, cfi_end, label, added_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(seeded.topicId, seeded.bookId, 'epubcfi(/6/2[test]!/4/4/2)', 'epubcfi(/6/2[test]!/4/4/6)', '第一章片段', at(6));
    sqlite.prepare('INSERT INTO topic_entries (topic_id, entry_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(seeded.topicId, 'QUESTION', '这个问题如何回答？', at(7), at(8));

    const response = await app.inject({ method: 'GET', url: `/api/v1/topics/${seeded.topicId}/timeline` });

    expect(response.statusCode).toBe(200);
    const events = response.json().data.events as Array<{ event_type: string; subject_type: string; created_at: string; title: string }>;
    expect(events.map((event) => event.event_type)).toEqual([
      'entry_updated',
      'entry_created',
      'segment_added',
      'note_added',
      'highlight_added',
      'book_added',
      'topic_updated',
      'topic_created',
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject_type: 'highlight', title: '这是一条高亮' }),
        expect.objectContaining({ subject_type: 'note', title: '独立笔记' }),
        expect.objectContaining({ subject_type: 'segment', title: '第一章片段' }),
        expect.objectContaining({ subject_type: 'entry', title: '问题' }),
      ]),
    );
  });
});
