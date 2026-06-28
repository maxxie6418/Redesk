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

export const batchBooksSchema = z.object({
  ids: z.array(z.number().int()).min(1).max(200),
  action: z.enum(['set_status', 'set_category', 'set_tags', 'set_visibility', 'delete']),
  params: z.record(z.unknown()).optional(),
});
export type BatchBooksInput = z.infer<typeof batchBooksSchema>;

export const trashQuerySchema = paginationSchema.extend({
  q: z.string().max(200).optional(),
});
export type TrashQueryInput = z.output<typeof trashQuerySchema>;

export const updateSettingsSchema = z.record(z.string(), z.string().optional());
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const createUserSchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(6).max(128),
  display_name: z.string().max(64).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  display_name: z.string().max(64).optional().nullable(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(6).max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parent_id: z.number().int().optional().nullable(),
  sort_order: z.number().int().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parent_id: z.number().int().optional().nullable(),
  sort_order: z.number().int().optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({
  name: z.string().min(1).max(100),
});
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export const createRelationSchema = z.object({
  target_book_id: z.number().int(),
  relation_type: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
});
export type CreateRelationInput = z.infer<typeof createRelationSchema>;

export const duplicateQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(1).optional(),
});
export type DuplicateQueryInput = z.output<typeof duplicateQuerySchema>;

export const updateFileSchema = z.object({
  is_primary: z.boolean().optional(),
  original_filename: z.string().max(500).optional(),
});
export type UpdateFileInput = z.infer<typeof updateFileSchema>;

export const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).optional().default('json'),
  ids: z.string().optional(),
});

export const importNotesSchema = z.object({
  dry_run: z.coerce.boolean().optional().default(false),
});
export type ImportNotesInput = z.output<typeof importNotesSchema>;
