import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase } from '@redesk/db';
import { collectBackupPreviewStats } from './preview-stats';

describe('collectBackupPreviewStats', () => {
  it('counts owner scoped active books and reading data', () => {
    const root = mkdtempSync(join(tmpdir(), 'redesk-backup-preview-'));
    const handle = createDatabase({ url: join(root, 'redesk.db') });

    try {
      const sqlite = handle.sqlite;
      sqlite.exec(`
        CREATE TABLE users (id integer PRIMARY KEY, username text, password_hash text, display_name text, is_admin integer, is_active integer, must_change_password integer, created_at text, updated_at text);
        CREATE TABLE settings (key text, owner_id integer, value text, updated_at text);
        CREATE TABLE books (id integer PRIMARY KEY, owner_id integer, title text, status text, visibility text, deleted_at text, created_at text, updated_at text);
        CREATE TABLE categories (id integer PRIMARY KEY, owner_id integer);
        CREATE TABLE tags (id integer PRIMARY KEY, owner_id integer);
        CREATE TABLE book_relations (id integer PRIMARY KEY, source_book_id integer, target_book_id integer, relation_type text, created_at text);
        CREATE TABLE book_files (id integer PRIMARY KEY, owner_id integer, book_id integer, file_format text, file_size integer, is_primary integer, created_at text, updated_at text);
        CREATE TABLE book_covers (id integer PRIMARY KEY, owner_id integer, book_id integer, file_size integer, deleted_at text);
        CREATE TABLE reading_progress (id integer PRIMARY KEY, owner_id integer);
        CREATE TABLE highlights (id integer PRIMARY KEY, book_id integer, owner_id integer, cfi_start text, cfi_end text, text text, deleted_at text, created_at text, updated_at text);
        CREATE TABLE notes (id integer PRIMARY KEY, book_id integer, owner_id integer, content_markdown text, deleted_at text, created_at text, updated_at text);
        CREATE TABLE bookmarks (id integer PRIMARY KEY, owner_id integer);
        CREATE TABLE topics (id integer PRIMARY KEY, owner_id integer, name text, deleted_at text, created_at text, updated_at text);
        CREATE TABLE topic_books (topic_id integer, book_id integer, added_at text);
        CREATE TABLE topic_highlights (topic_id integer, highlight_id integer, added_at text);
        CREATE TABLE topic_notes (topic_id integer, note_id integer, added_at text);
        CREATE TABLE topic_segments (id integer PRIMARY KEY, topic_id integer, book_id integer, cfi_start text, cfi_end text, label text, added_at text);
        CREATE TABLE topic_entries (id integer PRIMARY KEY, topic_id integer, entry_type text, content text, created_at text, updated_at text);
      `);
      sqlite.prepare("INSERT INTO users (id, username, password_hash, display_name, is_admin, is_active, must_change_password, created_at, updated_at) VALUES (1, 'u1', 'x', 'u1', 1, 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
      sqlite.prepare("INSERT INTO users (id, username, password_hash, display_name, is_admin, is_active, must_change_password, created_at, updated_at) VALUES (2, 'u2', 'x', 'u2', 0, 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
      sqlite.prepare("INSERT INTO books (id, owner_id, title, status, visibility, created_at, updated_at) VALUES (1, 1, 'A', 'COLLECTED', 'PRIVATE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
      sqlite.prepare("INSERT INTO books (id, owner_id, title, status, visibility, deleted_at, created_at, updated_at) VALUES (2, 1, 'B', 'COLLECTED', 'PRIVATE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
      sqlite.prepare("INSERT INTO books (id, owner_id, title, status, visibility, created_at, updated_at) VALUES (3, 2, 'C', 'COLLECTED', 'PRIVATE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
      sqlite.prepare("INSERT INTO notes (book_id, owner_id, content_markdown, created_at, updated_at) VALUES (1, 1, 'note', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
      sqlite.prepare("INSERT INTO notes (book_id, owner_id, content_markdown, deleted_at, created_at, updated_at) VALUES (1, 1, 'deleted', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
      sqlite.prepare("INSERT INTO highlights (book_id, owner_id, cfi_start, cfi_end, text, created_at, updated_at) VALUES (1, 1, 'a', 'b', 'quote', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
      sqlite.prepare("INSERT INTO topics (owner_id, name, created_at, updated_at) VALUES (1, 'topic', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
      sqlite.prepare("INSERT INTO book_files (owner_id, book_id, file_format, file_size, is_primary, created_at, updated_at) VALUES (1, 1, 'epub', 2048, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();

      const stats = collectBackupPreviewStats(handle.db, 1, 4096);

      expect(stats.book_count).toBe(1);
      expect(stats.note_count).toBe(1);
      expect(stats.highlight_count).toBe(1);
      expect(stats.topic_count).toBe(1);
      expect(stats.module_counts['library.books']).toBe(1);
      expect(stats.module_counts['reading.notes']).toBe(1);
      expect(stats.module_counts['assets.file_index']).toBe(1);
      expect(stats.module_sizes['database.snapshot']).toBe(4096);
    } finally {
      handle.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
