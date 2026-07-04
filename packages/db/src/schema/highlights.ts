import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { books } from './books';

export const highlights = sqliteTable('highlights', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  book_id: integer('book_id').notNull().references(() => books.id),
  owner_id: integer('owner_id').notNull().references(() => users.id),
  cfi_start: text('cfi_start').notNull(),
  cfi_end: text('cfi_end').notNull(),
  text: text('text').notNull(),
  type: text('type').notNull().default('HIGHLIGHT'),
  color: text('color'),
  note: text('note'),
  mark_type: text('mark_type').default('NONE'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  deleted_at: text('deleted_at'),
});

export type Highlight = typeof highlights.$inferSelect;
export type NewHighlight = typeof highlights.$inferInsert;
