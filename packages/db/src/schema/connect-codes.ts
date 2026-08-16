import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { apiTokens } from './api-tokens';

export const connectCodes = sqliteTable(
  'connect_codes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner_id: integer('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_id: integer('token_id')
      .notNull()
      .references(() => apiTokens.id, { onDelete: 'cascade' }),
    code_hash: text('code_hash').notNull(),
    expires_at: text('expires_at').notNull(),
    used_at: text('used_at'),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    uqCodeHash: uniqueIndex('uq_connect_codes_code_hash').on(table.code_hash),
    idxToken: index('idx_connect_codes_token').on(table.token_id),
  }),
);

export type ConnectCode = typeof connectCodes.$inferSelect;
export type NewConnectCode = typeof connectCodes.$inferInsert;