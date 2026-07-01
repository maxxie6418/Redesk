import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books';
import { users } from './users';

export const STORAGE_MODES = ['local_only', 'cloud_only', 'dual'] as const;
export type StorageMode = (typeof STORAGE_MODES)[number];

export const SYNC_STATUSES = ['synced', 'pending', 'partial_failed', 'failed'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const STORAGE_DRIVERS = ['local', 's3'] as const;
export type StorageDriver = (typeof STORAGE_DRIVERS)[number];

export const bookFiles = sqliteTable('book_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  owner_id: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  book_id: integer('book_id').references(() => books.id, { onDelete: 'set null' }),
  storage_mode: text('storage_mode', { enum: STORAGE_MODES }).notNull().default('local_only'),
  local_path: text('local_path'),
  remote_key: text('remote_key'),
  primary_location: text('primary_location', { enum: ['local', 'cloud'] }).notNull().default('local'),
  sync_status: text('sync_status', { enum: SYNC_STATUSES }).notNull().default('synced'),
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
