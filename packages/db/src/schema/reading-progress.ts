import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { books } from './books';

export const readingProgress = sqliteTable(
  'reading_progress',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    book_id: integer('book_id').notNull().references(() => books.id),
    owner_id: integer('owner_id').notNull().references(() => users.id),
    file_id: integer('file_id').notNull(),
    cfi: text('cfi').notNull(),
    percentage: real('percentage').notNull().default(0),
    last_read_at: text('last_read_at').notNull(),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (table) => ({
    unqBookOwner: uniqueIndex('uq_reading_progress_book_owner').on(table.book_id, table.owner_id),
    idxOwnerLastRead: index('idx_reading_progress_owner_last_read').on(table.owner_id, table.last_read_at),
  }),
);

export type ReadingProgress = typeof readingProgress.$inferSelect;
export type NewReadingProgress = typeof readingProgress.$inferInsert;