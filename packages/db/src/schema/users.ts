import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  display_name: text('display_name'),
  is_active: integer('is_active').notNull().default(1),
  session_expires_days: integer('session_expires_days').notNull().default(30),
  must_change_password: integer('must_change_password').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
