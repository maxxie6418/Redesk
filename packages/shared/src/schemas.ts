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
