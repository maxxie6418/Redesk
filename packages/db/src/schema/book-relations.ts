import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { books } from './books';

export const bookRelations = sqliteTable(
  'book_relations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source_book_id: integer('source_book_id')
      .notNull()
      .references(() => books.id),
    target_book_id: integer('target_book_id')
      .notNull()
      .references(() => books.id),
    relation_type: text('relation_type'),
    note: text('note'),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    uniqueRelIdx: uniqueIndex('idx_book_rel_unique').on(
      table.source_book_id,
      table.target_book_id,
      table.relation_type,
    ),
  }),
);

export type BookRelation = typeof bookRelations.$inferSelect;
export type NewBookRelation = typeof bookRelations.$inferInsert;
