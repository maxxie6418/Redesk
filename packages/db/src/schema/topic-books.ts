import { primaryKey, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { topics } from './topics';
import { books } from './books';

export const topicBooks = sqliteTable('topic_books', {
  topic_id: integer('topic_id').notNull().references(() => topics.id),
  book_id: integer('book_id').notNull().references(() => books.id),
  added_at: text('added_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.topic_id, table.book_id] }),
]);

export type TopicBook = typeof topicBooks.$inferSelect;
export type NewTopicBook = typeof topicBooks.$inferInsert;
