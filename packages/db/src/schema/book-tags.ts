import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { books } from './books';
import { tags } from './tags';

export const bookTags = sqliteTable(
  'book_tags',
  {
    book_id: integer('book_id').notNull().references(() => books.id),
    tag_id: integer('tag_id').notNull().references(() => tags.id),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.book_id, table.tag_id] }),
  }),
);

export type BookTag = typeof bookTags.$inferSelect;
export type NewBookTag = typeof bookTags.$inferInsert;
