import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner_id: integer('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_id: integer('token_id'),
    request_id: text('request_id'),
    method: text('method'),
    path: text('path'),
    action: text('action').notNull(),
    resource_type: text('resource_type'),
    resource_id: text('resource_id'),
    result: text('result').notNull(),
    ip: text('ip'),
    user_agent: text('user_agent'),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    idxOwnerTime: index('idx_audit_logs_owner_created_at').on(table.owner_id, table.created_at),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;