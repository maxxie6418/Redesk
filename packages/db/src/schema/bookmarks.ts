import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { books } from './books';

export const bookmarks = sqliteTable('bookmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  book_id: integer('book_id').notNull().references(() => books.id),
  owner_id: integer('owner_id').notNull().references(() => users.id),
  cfi: text('cfi').notNull(),
  label: text('label'),
  percentage: integer('percentage'),
  created_at: text('created_at').notNull(),
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
