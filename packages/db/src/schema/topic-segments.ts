import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { topics } from './topics';
import { books } from './books';

export const topicSegments = sqliteTable('topic_segments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topic_id: integer('topic_id').notNull().references(() => topics.id),
  book_id: integer('book_id').notNull().references(() => books.id),
  cfi_start: text('cfi_start').notNull(),
  cfi_end: text('cfi_end').notNull(),
  label: text('label'),
  added_at: text('added_at').notNull(),
});

export type TopicSegment = typeof topicSegments.$inferSelect;
export type NewTopicSegment = typeof topicSegments.$inferInsert;
