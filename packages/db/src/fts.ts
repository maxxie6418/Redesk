import type { AppDatabase } from './client';
import { sql } from 'drizzle-orm';

export function setupFts5(db: AppDatabase): void {
  // === books_fts ===
  db.run(sql.raw(`
    CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
      title,
      author,
      isbn,
      content='books',
      content_rowid='id'
    );
  `));

  db.run(sql.raw(`
    CREATE TRIGGER IF NOT EXISTS books_fts_insert AFTER INSERT ON books BEGIN
      INSERT INTO books_fts(rowid, title, author, isbn)
      VALUES (new.id, new.title, new.author, new.isbn);
    END;
  `));

  db.run(sql.raw(`
    CREATE TRIGGER IF NOT EXISTS books_fts_delete AFTER DELETE ON books BEGIN
      INSERT INTO books_fts(books_fts, rowid, title, author, isbn)
      VALUES ('delete', old.id, old.title, old.author, old.isbn);
    END;
  `));

  db.run(sql.raw(`
    CREATE TRIGGER IF NOT EXISTS books_fts_update AFTER UPDATE ON books BEGIN
      INSERT INTO books_fts(books_fts, rowid, title, author, isbn)
      VALUES ('delete', old.id, old.title, old.author, old.isbn);
      INSERT INTO books_fts(rowid, title, author, isbn)
      VALUES (new.id, new.title, new.author, new.isbn);
    END;
  `));

  // === notes_fts ===
  db.run(sql.raw(`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title,
      content_markdown,
      content_html,
      content='notes',
      content_rowid='id'
    );
  `));

  db.run(sql.raw(`
    CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content_markdown, content_html)
      VALUES (new.id, new.title, new.content_markdown, new.content_html);
    END;
  `));

  db.run(sql.raw(`
    CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content_markdown, content_html)
      VALUES ('delete', old.id, old.title, old.content_markdown, old.content_html);
    END;
  `));

  db.run(sql.raw(`
    CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content_markdown, content_html)
      VALUES ('delete', old.id, old.title, old.content_markdown, old.content_html);
      INSERT INTO notes_fts(rowid, title, content_markdown, content_html)
      VALUES (new.id, new.title, new.content_markdown, new.content_html);
    END;
  `));

  // 回填已有数据
  db.run(sql.raw(`
    INSERT OR IGNORE INTO notes_fts(rowid, title, content_markdown, content_html)
    SELECT id, title, content_markdown, content_html FROM notes WHERE deleted_at IS NULL;
  `));

  // === highlights_fts ===
  db.run(sql.raw(`
    CREATE VIRTUAL TABLE IF NOT EXISTS highlights_fts USING fts5(
      text,
      note,
      content='highlights',
      content_rowid='id'
    );
  `));

  db.run(sql.raw(`
    CREATE TRIGGER IF NOT EXISTS highlights_fts_insert AFTER INSERT ON highlights BEGIN
      INSERT INTO highlights_fts(rowid, text, note)
      VALUES (new.id, new.text, new.note);
    END;
  `));

  db.run(sql.raw(`
    CREATE TRIGGER IF NOT EXISTS highlights_fts_delete AFTER DELETE ON highlights BEGIN
      INSERT INTO highlights_fts(highlights_fts, rowid, text, note)
      VALUES ('delete', old.id, old.text, old.note);
    END;
  `));

  db.run(sql.raw(`
    CREATE TRIGGER IF NOT EXISTS highlights_fts_update AFTER UPDATE ON highlights BEGIN
      INSERT INTO highlights_fts(highlights_fts, rowid, text, note)
      VALUES ('delete', old.id, old.text, old.note);
      INSERT INTO highlights_fts(rowid, text, note)
      VALUES (new.id, new.text, new.note);
    END;
  `));

  // 回填已有数据
  db.run(sql.raw(`
    INSERT OR IGNORE INTO highlights_fts(rowid, text, note)
    SELECT id, text, note FROM highlights WHERE deleted_at IS NULL;
  `));
}
