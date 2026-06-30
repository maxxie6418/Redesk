import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books';
import { users } from './users';
import { bookFiles, type StorageDriver } from './book-files';

export const bookCovers = sqliteTable('book_covers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  owner_id: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  book_id: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  book_file_id: integer('book_file_id').references(() => bookFiles.id, { onDelete: 'set null' }),
  source_type: text('source_type').notNull(),
  source_label: text('source_label'),
  original_url: text('original_url'),
  file_path: text('file_path').notNull(),
  storage_driver: text('storage_driver', { enum: ['local', 's3'] as const }).notNull().default('local'),
  mime_type: text('mime_type'),
  file_size: integer('file_size'),
  checksum: text('checksum'),
  is_active: integer('is_active').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type { StorageDriver };

export type BookCover = typeof bookCovers.$inferSelect;
export type NewBookCover = typeof bookCovers.$inferInsert;
