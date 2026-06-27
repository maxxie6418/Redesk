import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books';

export const statusHistory = sqliteTable('status_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  book_id: integer('book_id').notNull().references(() => books.id),
  from_status: text('from_status'),
  to_status: text('to_status').notNull(),
  changed_at: text('changed_at').notNull(),
});

export type StatusHistory = typeof statusHistory.$inferSelect;
export type NewStatusHistory = typeof statusHistory.$inferInsert;
