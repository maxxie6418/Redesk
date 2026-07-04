import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { books } from './books';

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  book_id: integer('book_id').notNull().references(() => books.id),
  owner_id: integer('owner_id').notNull().references(() => users.id),
  cfi: text('cfi'),
  title: text('title'),
  content_html: text('content_html'),
  content_markdown: text('content_markdown'),
  mark_type: text('mark_type').default('NONE'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  deleted_at: text('deleted_at'),
});

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
