import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  display_name: text('display_name'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
