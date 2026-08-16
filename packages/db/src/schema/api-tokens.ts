import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner_id: integer('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    token_hash: text('token_hash'),
    scopes: text('scopes').notNull(),
    expires_at: text('expires_at'),
    last_used_at: text('last_used_at'),
    revoked_at: text('revoked_at'),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    idxOwner: index('idx_api_tokens_owner').on(table.owner_id),
    uqTokenHash: uniqueIndex('uq_api_tokens_token_hash').on(table.token_hash),
  }),
);

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;