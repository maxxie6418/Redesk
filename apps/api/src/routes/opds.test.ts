import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { getSqlite, initDatabase } from '../db';
import { buildServer } from '../server';
import { hashPassword } from '../lib/auth';
import { getStorageByDriver, resetStorageCache } from '../lib/storage-factory';

const testEnv = vi.hoisted(() => {
  const root = `${process.env.TEMP ?? process.env.TMP ?? '.'}/redesk-opds-${process.pid}-${Date.now()}-${globalThis.crypto.randomUUID()}`;

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

function now() {
  return new Date().toISOString();
}

function basicAuth(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

async function seedReadableBook(sqlite: SqliteDatabase) {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM book_covers;
    DELETE FROM book_files;
    DELETE FROM books;
    DELETE FROM users;
    PRAGMA foreign_keys = ON;
  `);

  const ts = now();
  const username = `opds-${Date.now()}`;
  const password = 'password123';
  const passwordHash = await hashPassword(password);
  const userId = Number(sqlite.prepare(`
    INSERT INTO users (username, password_hash, display_name, is_active, is_admin, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(username, passwordHash, 'OPDS 用户', 1, 1, 0, ts, ts).lastInsertRowid);
  const bookId = Number(sqlite.prepare(`
    INSERT INTO books (owner_id, title, author, status, visibility, import_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, 'OPDS 测试书', '测试作者', 'READING', 'PRIVATE', 1, ts, ts).lastInsertRowid);
  const key = `books/${bookId}/opds-test.epub`;
  const bytes = Buffer.from('epub bytes for opds');
  await getStorageByDriver('local').putBytes(key, bytes, { contentType: 'application/epub+zip' });
  const fileId = Number(sqlite.prepare(`
    INSERT INTO book_files (owner_id, book_id, storage_mode, local_path, primary_location, sync_status, original_filename, file_format, mime_type, file_size, is_primary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, bookId, 'local_only', key, 'local', 'synced', 'opds-test.epub', 'EPUB', 'application/epub+zip', bytes.length, 1, ts, ts).lastInsertRowid);

  return { username, password, bookId, fileId, bytes };
}

async function createApp(): Promise<TestAppContext> {
  initDatabase();
  resetStorageCache();
  const sqlite = getSqlite();
  const app = await buildServer();
  await app.ready();

  return { app, sqlite };
}

beforeAll(async () => {
  sharedContext = await createApp();
});

afterAll(async () => {
  if (sharedContext) await sharedContext.app.close();
  try { getSqlite().close(); } catch { void 0; }
  rmSync(testEnv.root, { recursive: true, force: true });
});

describe('book cover file resolution', () => {
  it('serves the active cover record when book cover_path is not synchronized', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedReadableBook(sqlite);
    const authorization = basicAuth(seeded.username, seeded.password);
    const ts = now();
    const coverKey = `covers/${seeded.bookId}/active-cover.jpg`;
    const coverBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    await getStorageByDriver('local').putBytes(coverKey, coverBytes, { contentType: 'image/jpeg' });
    sqlite.prepare(`
      INSERT INTO book_covers (owner_id, book_id, source_type, source_label, storage_mode, local_path, primary_location, mime_type, file_size, checksum, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1, seeded.bookId, 'MANUAL_UPLOAD', 'upload', 'local_only', coverKey, 'local', 'image/jpeg', coverBytes.length, 'checksum', 1, ts, ts);
    sqlite.prepare('UPDATE books SET cover_path = NULL WHERE id = ?').run(seeded.bookId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/books/${seeded.bookId}/cover`,
      headers: { authorization },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/jpeg');
    expect(Buffer.from(response.rawPayload).equals(coverBytes)).toBe(true);
  });
});

describe('OPDS acquisition downloads', () => {
  it('uses OPDS Basic Auth download links and streams the primary file', async () => {
    const { app, sqlite } = sharedContext!;
    const seeded = await seedReadableBook(sqlite);
    const authorization = basicAuth(seeded.username, seeded.password);

    const feedResponse = await app.inject({
      method: 'GET',
      url: '/opds/by-status?status=READING',
      headers: { authorization },
    });

    expect(feedResponse.statusCode).toBe(200);
    expect(feedResponse.body).toContain(`/opds/acquisition/${seeded.fileId}`);
    expect(feedResponse.body).not.toContain(`/api/v1/books/${seeded.bookId}/files/${seeded.fileId}/download`);

    const downloadResponse = await app.inject({
      method: 'GET',
      url: `/opds/acquisition/${seeded.fileId}`,
      headers: { authorization },
    });

    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.headers['content-type']).toContain('application/epub+zip');
    expect(downloadResponse.body).toBe(seeded.bytes.toString());
  });
});
