import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const CLOUD_CONNECTION_TYPES = ['s3', 'webdav'] as const;
export type CloudConnectionType = (typeof CLOUD_CONNECTION_TYPES)[number];

export const CLOUD_USAGES = ['book_files', 'covers', 'notes', 'backup_db', 'backup_full'] as const;
export type CloudUsage = (typeof CLOUD_USAGES)[number];

export const cloudConnections = sqliteTable(
  'cloud_connections',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner_id: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', { enum: CLOUD_CONNECTION_TYPES }).notNull(),
    config: text('config').notNull().default('{}'),
    is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    tested_at: text('tested_at'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => ({
    idxOwner: index('idx_cloud_connections_owner').on(table.owner_id),
  }),
);

export const cloudUsageAssignments = sqliteTable(
  'cloud_usage_assignments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner_id: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    usage: text('usage', { enum: CLOUD_USAGES }).notNull(),
    connection_id: integer('connection_id').notNull().references(() => cloudConnections.id, { onDelete: 'cascade' }),
    priority: integer('priority').notNull().default(0),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    uniqueUsageConnection: uniqueIndex('uq_cloud_usage_connection').on(table.owner_id, table.usage, table.connection_id),
    idxOwnerUsage: index('idx_cloud_usage_assignments_owner_usage').on(table.owner_id, table.usage, table.priority),
  }),
);

export const cloudNoteSnapshots = sqliteTable(
  'cloud_note_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner_id: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    connection_id: integer('connection_id').notNull().references(() => cloudConnections.id, { onDelete: 'cascade' }),
    format: text('format', { enum: ['markdown', 'json'] as const }).notNull(),
    remote_key: text('remote_key').notNull(),
    checksum: text('checksum'),
    note_count: integer('note_count').notNull().default(0),
    generated_at: text('generated_at').notNull(),
    sync_status: text('sync_status', { enum: ['synced', 'failed'] as const }).notNull().default('synced'),
    error_message: text('error_message'),
  },
  (table) => ({
    uniqueSnapshot: uniqueIndex('uq_cloud_note_snapshots_connection_format').on(table.owner_id, table.connection_id, table.format),
  }),
);

export type CloudConnection = typeof cloudConnections.$inferSelect;
export type NewCloudConnection = typeof cloudConnections.$inferInsert;
