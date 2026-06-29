import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books';

export const bookFiles = sqliteTable('book_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  book_id: integer('book_id').references(() => books.id, { onDelete: 'set null' }),
  file_path: text('file_path').notNull(),
  original_filename: text('original_filename'),
  file_format: text('file_format').notNull(),
  mime_type: text('mime_type'),
  file_size: integer('file_size'),
  checksum: text('checksum'),
  is_primary: integer('is_primary').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type BookFile = typeof bookFiles.$inferSelect;
export type NewBookFile = typeof bookFiles.$inferInsert;
