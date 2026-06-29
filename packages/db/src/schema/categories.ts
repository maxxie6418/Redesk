import { sqliteTable, text, integer, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const CATEGORY_TYPE = {
  GENRE: 'GENRE',
  PERSONAL: 'PERSONAL',
} as const;
export type CategoryType = (typeof CATEGORY_TYPE)[keyof typeof CATEGORY_TYPE];

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  owner_id: integer('owner_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  type: text('type').notNull().default('PERSONAL'),
  parent_id: integer('parent_id').references((): AnySQLiteColumn => categories.id),
  sort_order: integer('sort_order').default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
