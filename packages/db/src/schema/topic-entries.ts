import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { topics } from './topics';

export const topicEntries = sqliteTable('topic_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topic_id: integer('topic_id').notNull().references(() => topics.id),
  entry_type: text('entry_type').notNull(),
  content: text('content').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type TopicEntry = typeof topicEntries.$inferSelect;
export type NewTopicEntry = typeof topicEntries.$inferInsert;
