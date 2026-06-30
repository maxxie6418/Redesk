import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books';
import { users } from './users';
import { bookFiles } from './book-files';

export const bookCovers = sqliteTable('book_covers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  owner_id: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  book_id: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  book_file_id: integer('book_file_id').references(() => bookFiles.id, { onDelete: 'set null' }),
  source_type: text('source_type').notNull(),
  source_label: text('source_label'),
  original_url: text('original_url'),
  file_path: text('file_path').notNull(),
  mime_type: text('mime_type'),
  file_size: integer('file_size'),
  checksum: text('checksum'),
  is_active: integer('is_active').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type BookCover = typeof bookCovers.$inferSelect;
export type NewBookCover = typeof bookCovers.$inferInsert;
