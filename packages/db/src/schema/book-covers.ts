import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books';
import { users } from './users';
import { bookFiles, type StorageMode, type SyncStatus } from './book-files';

export const bookCovers = sqliteTable('book_covers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  owner_id: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  book_id: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  book_file_id: integer('book_file_id').references(() => bookFiles.id, { onDelete: 'set null' }),
  source_type: text('source_type').notNull(),
  source_label: text('source_label'),
  original_url: text('original_url'),
  storage_mode: text('storage_mode', { enum: ['local_only', 'cloud_only', 'dual'] as const }).notNull().default('local_only'),
  local_path: text('local_path'),
  remote_key: text('remote_key'),
  primary_location: text('primary_location', { enum: ['local', 'cloud'] as const }).notNull().default('local'),
  sync_status: text('sync_status', { enum: ['synced', 'pending', 'partial_failed', 'failed'] as const }).notNull().default('synced'),
  mime_type: text('mime_type'),
  file_size: integer('file_size'),
  checksum: text('checksum'),
  is_active: integer('is_active').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type { StorageMode, SyncStatus };

export type BookCover = typeof bookCovers.$inferSelect;
export type NewBookCover = typeof bookCovers.$inferInsert;
