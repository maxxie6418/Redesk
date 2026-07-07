import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from './client';
import { setupFts5 } from './fts';

let workDir: string;
let handle: DatabaseHandle;

function createMinimalTables(sqlite: DatabaseHandle['sqlite']): void {
  sqlite.exec(`
    CREATE TABLE books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT,
      author TEXT,
      isbn TEXT,
      deleted_at TEXT
    );
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      book_id INTEGER,
      title TEXT,
      content_markdown TEXT,
      content_html TEXT,
      deleted_at TEXT
    );
    CREATE TABLE highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      book_id INTEGER,
      text TEXT,
      note TEXT,
      deleted_at TEXT
    );
  `);
}

function searchBooks(term: string): unknown[] {
  return handle.sqlite
    .prepare(`SELECT rowid, title, author, isbn FROM books_fts WHERE books_fts MATCH ?`)
    .all(term);
}

function searchNotes(term: string): unknown[] {
  return handle.sqlite
    .prepare(`SELECT rowid, title FROM notes_fts WHERE notes_fts MATCH ?`)
    .all(term);
}

function searchHighlights(term: string): unknown[] {
  return handle.sqlite
    .prepare(`SELECT rowid, text FROM highlights_fts WHERE highlights_fts MATCH ?`)
    .all(term);
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'redesk-fts-'));
  handle = createDatabase({ url: join(workDir, 'redesk.db') });
  createMinimalTables(handle.sqlite);
  setupFts5(handle.db, { sqlite: handle.sqlite });
});

afterEach(() => {
  handle.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('setupFts5 幂等性', () => {
  it('重复执行 setupFts5 不应抛错', () => {
    expect(() => setupFts5(handle.db, { sqlite: handle.sqlite })).not.toThrow();
    expect(() => setupFts5(handle.db, { sqlite: handle.sqlite })).not.toThrow();
  });

  it('schema_version 应被正确写入 meta 表', () => {
    const rows = handle.sqlite
      .prepare(`SELECT value FROM _redesk_fts_meta WHERE key = 'schema_version'`)
      .all() as { value: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('v5-noext-content');
  });

  it('每张 FTS 表应有 5 个触发器：insert/delete/update/soft_delete/restore', () => {
    const expected = [
      'books_fts_insert',
      'books_fts_delete',
      'books_fts_update',
      'books_fts_soft_delete',
      'books_fts_restore',
      'notes_fts_insert',
      'notes_fts_delete',
      'notes_fts_update',
      'notes_fts_soft_delete',
      'notes_fts_restore',
      'highlights_fts_insert',
      'highlights_fts_delete',
      'highlights_fts_update',
      'highlights_fts_soft_delete',
      'highlights_fts_restore',
    ];
    for (const name of expected) {
      const r = handle.sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND name = ?`)
        .all(name);
      expect(r, `trigger ${name} should exist`).toHaveLength(1);
    }
  });
});

describe('B1 软删除感知', () => {
  it('插入时 deleted_at 为 NULL：书应可被搜索到', () => {
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn) VALUES (?, ?, ?, ?)')
      .run(1, '深入理解计算机系统', 'Bryant', '9787111321330');
    const matches = searchBooks('计算机系统');
    expect(matches).toHaveLength(1);
  });

  it('插入时 deleted_at 显式为 NULL：书应可被搜索到', () => {
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn, deleted_at) VALUES (?, ?, ?, ?, ?)')
      .run(1, '代码大全第二版', 'Steve McConnell', '9787121022982', null);
    const matches = searchBooks('代码大全');
    expect(matches).toHaveLength(1);
  });

  it('英文 / ISBN 也能被搜索到', () => {
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn) VALUES (?, ?, ?, ?)')
      .run(1, 'Clean Code', 'Robert Martin', '9780132350884');
    const matchesTitle = searchBooks('Clean');
    expect(matchesTitle.length).toBeGreaterThanOrEqual(1);
    const matchesIsbn = searchBooks('9780132350884');
    expect(matchesIsbn.length).toBeGreaterThanOrEqual(1);
  });

  it('插入时已带 deleted_at：书不应被搜索到', () => {
    handle.sqlite
      .prepare(
        'INSERT INTO books (owner_id, title, author, isbn, deleted_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(1, '已删除的废书', 'noone', 'isbn-x', '2026-07-01T00:00:00.000Z');
    const matches = searchBooks('废书');
    expect(matches).toHaveLength(0);
  });

  it('软删除书（UPDATE deleted_at）：书应从搜索结果中消失', () => {
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn) VALUES (?, ?, ?, ?)')
      .run(1, '活的书', 'author', 'isbn-y');
    expect(searchBooks('活的书')).toHaveLength(1);

    handle.sqlite
      .prepare('UPDATE books SET deleted_at = ? WHERE title = ?')
      .run('2026-07-02T00:00:00.000Z', '活的书');

    expect(searchBooks('活的书')).toHaveLength(0);
  });

  it('恢复软删除的书（UPDATE deleted_at 回到 NULL）：书应重新可被搜索到', () => {
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn, deleted_at) VALUES (?, ?, ?, ?, ?)')
      .run(1, '先死后活', 'author', 'isbn-z', '2026-07-03T00:00:00.000Z');
    expect(searchBooks('先死后活')).toHaveLength(0);

    handle.sqlite.prepare('UPDATE books SET deleted_at = NULL WHERE title = ?').run('先死后活');
    expect(searchBooks('先死后活')).toHaveLength(1);
  });

  it('更新非删除字段：FTS 应同步新内容', () => {
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn) VALUES (?, ?, ?, ?)')
      .run(1, '旧标题', 'author', 'isbn-w');
    expect(searchBooks('旧标题')).toHaveLength(1);
    expect(searchBooks('新标题')).toHaveLength(0);

    handle.sqlite.prepare('UPDATE books SET title = ? WHERE id = 1').run('新标题');

    expect(searchBooks('旧标题')).toHaveLength(0);
    expect(searchBooks('新标题')).toHaveLength(1);
  });

  it('对已软删除的书做其他字段更新：FTS 不应变化（仍不可搜到）', () => {
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn, deleted_at) VALUES (?, ?, ?, ?, ?)')
      .run(1, '幽灵', 'author', 'isbn-g', '2026-07-04T00:00:00.000Z');
    expect(searchBooks('幽灵')).toHaveLength(0);

    handle.sqlite.prepare('UPDATE books SET author = ? WHERE title = ?').run('new author', '幽灵');
    expect(searchBooks('幽灵')).toHaveLength(0);
  });

  it('硬删除（DELETE FROM books）：FTS 应清理', () => {
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn) VALUES (?, ?, ?, ?)')
      .run(1, '终有一删', 'author', 'isbn-d');
    expect(searchBooks('终有一删')).toHaveLength(1);

    handle.sqlite.prepare('DELETE FROM books WHERE title = ?').run('终有一删');
    expect(searchBooks('终有一删')).toHaveLength(0);
  });

  it('notes / highlights 同样软删除感知', () => {
    handle.sqlite
      .prepare('INSERT INTO notes (owner_id, title, content_markdown, content_html) VALUES (?, ?, ?, ?)')
      .run(1, '活笔记', '活内容', '<p>活内容</p>');
    handle.sqlite
      .prepare(
        'INSERT INTO notes (owner_id, title, content_markdown, content_html, deleted_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(1, '死笔记', '死内容', '<p>死内容</p>', '2026-07-05T00:00:00.000Z');

    expect(searchNotes('活内容')).toHaveLength(1);
    expect(searchNotes('死内容')).toHaveLength(0);

    handle.sqlite
      .prepare('INSERT INTO highlights (owner_id, text, note) VALUES (?, ?, ?)')
      .run(1, '活高亮', null);
    handle.sqlite
      .prepare(
        'INSERT INTO highlights (owner_id, text, note, deleted_at) VALUES (?, ?, ?, ?)',
      )
      .run(1, '死高亮', null, '2026-07-06T00:00:00.000Z');

    expect(searchHighlights('活高亮')).toHaveLength(1);
    expect(searchHighlights('死高亮')).toHaveLength(0);
  });
});

describe('B2 books_fts 回填', () => {
  it('建表先于 setupFts5 且已有数据时，setupFts5 应回填非删除数据', () => {
    handle.close();

    workDir = mkdtempSync(join(tmpdir(), 'redesk-fts-bf-'));
    handle = createDatabase({ url: join(workDir, 'redesk.db') });
    createMinimalTables(handle.sqlite);
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn) VALUES (?, ?, ?, ?)')
      .run(1, '回填活书', 'author', 'isbn-bf1');
    handle.sqlite
      .prepare(
        'INSERT INTO books (owner_id, title, author, isbn, deleted_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(1, '回填死书', 'author', 'isbn-bf2', '2026-07-01T00:00:00.000Z');

    setupFts5(handle.db, { sqlite: handle.sqlite });

    expect(searchBooks('回填活书')).toHaveLength(1);
    expect(searchBooks('回填死书')).toHaveLength(0);
  });

  it('重复 setupFts5 不应重复回填', () => {
    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn) VALUES (?, ?, ?, ?)')
      .run(1, '不重复回填', 'author', 'isbn-dup');

    setupFts5(handle.db, { sqlite: handle.sqlite });

    const metaKey = 'backfill:books_fts';
    const rows = handle.sqlite
      .prepare(`SELECT value FROM _redesk_fts_meta WHERE key = ?`)
      .all(metaKey) as { value: string }[];
    expect(rows[0].value).toBe('done');

    expect(searchBooks('不重复回填')).toHaveLength(1);
  });
});

describe('schema 升级', () => {
  it('从旧版 (v3) 升级到 v4：旧 FTS 表应被丢弃并以 trigram 重建', () => {
    handle.close();
    workDir = mkdtempSync(join(tmpdir(), 'redesk-fts-upgrade-'));
    handle = createDatabase({ url: join(workDir, 'redesk.db') });
    createMinimalTables(handle.sqlite);

    handle.sqlite.exec(`
      CREATE VIRTUAL TABLE books_fts USING fts5(
        title, author, isbn,
        content='books', content_rowid='id'
      );
    `);

    handle.sqlite.exec(`
      CREATE TRIGGER books_fts_insert
      AFTER INSERT ON books
      WHEN NEW.deleted_at IS NULL
      BEGIN
        INSERT INTO books_fts(rowid, title, author, isbn)
        VALUES (new.id, new.title, new.author, new.isbn);
      END;
    `);

    handle.sqlite.exec(`
      CREATE TABLE _redesk_fts_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO _redesk_fts_meta(key, value) VALUES ('schema_version', 'v3-soft-delete-aware');
    `);

    handle.sqlite
      .prepare('INSERT INTO books (owner_id, title, author, isbn) VALUES (?, ?, ?, ?)')
      .run(1, '升级前的老书', 'author', 'isbn-pre');

    setupFts5(handle.db, { sqlite: handle.sqlite });

    const v = handle.sqlite
      .prepare(`SELECT value FROM _redesk_fts_meta WHERE key = 'schema_version'`)
      .all() as { value: string }[];
    expect(v[0].value).toBe('v5-noext-content');

    const matches = searchBooks('升级前的');
    expect(matches).toHaveLength(1);
  });
});
