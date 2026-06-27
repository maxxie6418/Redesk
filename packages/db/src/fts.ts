import type { AppDatabase } from './client';
import { sql } from 'drizzle-orm';

export function setupFts5(db: AppDatabase): void {
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
}
