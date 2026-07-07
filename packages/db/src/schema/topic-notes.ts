import { primaryKey, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { topics } from './topics';
import { notes } from './notes';

export const topicNotes = sqliteTable('topic_notes', {
  topic_id: integer('topic_id').notNull().references(() => topics.id),
  note_id: integer('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  added_at: text('added_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.topic_id, table.note_id] }),
]);

export type TopicNote = typeof topicNotes.$inferSelect;
export type NewTopicNote = typeof topicNotes.$inferInsert;
