import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { topics } from './topics';
import { highlights } from './highlights';

export const topicHighlights = sqliteTable('topic_highlights', {
  topic_id: integer('topic_id').notNull().references(() => topics.id),
  highlight_id: integer('highlight_id').notNull().references(() => highlights.id, { onDelete: 'cascade' }),
  added_at: text('added_at').notNull(),
});

export type TopicHighlight = typeof topicHighlights.$inferSelect;
export type NewTopicHighlight = typeof topicHighlights.$inferInsert;
