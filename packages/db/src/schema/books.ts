import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { categories } from './categories';

export const books = sqliteTable('books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  owner_id: integer('owner_id').notNull().references(() => users.id),
  category_id: integer('category_id').references(() => categories.id),
  title: text('title').notNull(),
  author: text('author').notNull(),
  isbn: text('isbn'),
  publisher: text('publisher'),
  publish_year: integer('publish_year'),
  description: text('description'),
  language: text('language'),
  cover_path: text('cover_path'),
  status: text('status').notNull().default('COLLECTED'),
  visibility: text('visibility').notNull().default('PRIVATE'),
  reading_purpose: text('reading_purpose'),
  rating: integer('rating'),
  custom_attributes: text('custom_attributes'),
  metadata_source: text('metadata_source'),
  deleted_at: text('deleted_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
