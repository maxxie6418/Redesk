import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const settings = sqliteTable(
  'settings',
  {
    key: text('key').notNull(),
    owner_id: integer('owner_id').notNull().references(() => users.id),
    value: text('value').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.owner_id, table.key] }),
  }),
);

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
