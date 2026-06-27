import { z } from 'zod';
import { BOOK_STATUS, VISIBILITY, METADATA_SOURCE } from './enums';
import { MAX_PAGE_SIZE } from './types';

export const bookStatusSchema = z.enum([
  BOOK_STATUS.COLLECTED,
  BOOK_STATUS.PLANNED,
  BOOK_STATUS.READING,
  BOOK_STATUS.READ,
  BOOK_STATUS.STORED,
]);

export const visibilitySchema = z.enum([VISIBILITY.PUBLIC, VISIBILITY.PRIVATE]);

export const metadataSourceSchema = z.enum([
  METADATA_SOURCE.MANUAL,
  METADATA_SOURCE.NEODB,
  METADATA_SOURCE.DOUBAN,
]);

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const setupSchema = z
  .object({
    username: z.string().min(2).max(64),
    password: z.string().min(8).max(128),
    display_name: z.string().max(64).optional(),
  })
  .strict();
export type SetupInput = z.infer<typeof setupSchema>;

export const userSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  display_name: z.string().nullable(),
});
export type User = z.infer<typeof userSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  sort: z.string().max(64).optional(),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const createBookSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().min(1).max(500),
  isbn: z.string().max(20).optional().nullable(),
  publisher: z.string().max(200).optional().nullable(),
  publish_year: z.number().int().min(0).max(2100).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  language: z.string().max(20).optional().nullable(),
  category_id: z.number().int().optional().nullable(),
  status: bookStatusSchema.optional(),
  visibility: visibilitySchema.optional(),
  reading_purpose: z.string().max(500).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  tag_ids: z.array(z.number().int()).optional(),
  custom_attributes: z.record(z.unknown()).optional().nullable(),
  metadata_source: metadataSourceSchema.optional(),
});
export type CreateBookInput = z.infer<typeof createBookSchema>;

export const updateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  author: z.string().min(1).max(500).optional(),
  isbn: z.string().max(20).optional().nullable(),
  publisher: z.string().max(200).optional().nullable(),
  publish_year: z.number().int().min(0).max(2100).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  language: z.string().max(20).optional().nullable(),
  category_id: z.number().int().optional().nullable(),
  status: bookStatusSchema.optional(),
  visibility: visibilitySchema.optional(),
  reading_purpose: z.string().max(500).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  tag_ids: z.array(z.number().int()).optional(),
  custom_attributes: z.record(z.unknown()).optional().nullable(),
  metadata_source: metadataSourceSchema.optional(),
});
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const bookQuerySchema = paginationSchema.extend({
  q: z.string().max(200).optional(),
  status: z.string().max(200).optional(),
  category_id: z.coerce.number().int().optional(),
  tag_id: z.string().max(200).optional(),
  visibility: visibilitySchema.optional(),
  in_trash: z.coerce.boolean().optional(),
});
export type BookQueryInput = z.output<typeof bookQuerySchema>;
