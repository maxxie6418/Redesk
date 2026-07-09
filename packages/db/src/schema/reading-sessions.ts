import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { books } from './books';

export const readingSessions = sqliteTable(
  'reading_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    book_id: integer('book_id').notNull().references(() => books.id),
    owner_id: integer('owner_id').notNull().references(() => users.id),
    started_at: text('started_at').notNull(),
    ended_at: text('ended_at'),
    duration_seconds: integer('duration_seconds').notNull().default(0),
    last_heartbeat_at: text('last_heartbeat_at').notNull(),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    idxBookOwner: index('idx_reading_sessions_book_owner').on(table.book_id, table.owner_id),
    idxOwnerStarted: index('idx_reading_sessions_owner_started').on(table.owner_id, table.started_at),
    idxStartedAt: index('idx_reading_sessions_started_at').on(table.started_at),
  }),
);

export type ReadingSession = typeof readingSessions.$inferSelect;
export type NewReadingSession = typeof readingSessions.$inferInsert;
