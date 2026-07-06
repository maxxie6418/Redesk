import { z } from 'zod';
import { BOOK_STATUS, VISIBILITY, TOPIC_ENTRY_TYPE } from './enums';
import type { ErrorCode } from './errors';

const positiveInt = z.coerce.number().int().positive();
const BOOK_STATUS_VALUES = Object.values(BOOK_STATUS) as [string, ...string[]];
const VISIBILITY_VALUES = Object.values(VISIBILITY) as [string, ...string[]];
const STORAGE_MODE_VALUES = ['local_only', 'cloud_only', 'dual'] as [string, ...string[]];

export const idParamSchema = z.object({
  id: positiveInt,
});

export const paginationSchema = z.object({
  page: positiveInt.default(1),
  page_size: z.coerce.number().int().min(1).max(500).default(20),
  sort: z.string().optional(),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const createBookSchema = z.object({
  title: z.string().min(1).max(500),
  subtitle: z.string().max(500).optional().nullable(),
  author: z.string().max(500).optional().nullable(),
  translator: z.string().max(500).optional().nullable(),
  original_title: z.string().max(500).optional().nullable(),
  isbn: z.string().max(50).optional().nullable(),
  publisher: z.string().max(255).optional().nullable(),
  publish_year: z.number().int().min(0).max(3000).optional().nullable(),
  description: z.string().optional().nullable(),
  language: z.string().max(50).optional().nullable(),
  category_id: positiveInt.optional().nullable(),
  genre_category_id: positiveInt.optional().nullable(),
  status: z.enum(BOOK_STATUS_VALUES).optional().default('COLLECTED'),
  visibility: z.enum(VISIBILITY_VALUES).optional().default('PRIVATE'),
  reading_purpose: z.string().max(255).optional().nullable(),
  entry_reason: z.string().max(500).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  page_count: z.number().int().min(1).max(100000).optional().nullable(),
  source_url: z.string().max(2000).optional().nullable(),
  tag_ids: z.array(positiveInt).optional().default([]),
  custom_attributes: z.record(z.unknown()).optional().nullable(),
  storage_mode: z.enum(STORAGE_MODE_VALUES).optional(),
});
export type CreateBookInput = z.infer<typeof createBookSchema>;

export const updateBookSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    subtitle: z.string().max(500).optional().nullable(),
    author: z.string().max(500).optional().nullable(),
    translator: z.string().max(500).optional().nullable(),
    original_title: z.string().max(500).optional().nullable(),
    isbn: z.string().max(50).optional().nullable(),
    publisher: z.string().max(255).optional().nullable(),
    publish_year: z.number().int().min(0).max(3000).optional().nullable(),
    description: z.string().optional().nullable(),
    language: z.string().max(50).optional().nullable(),
    category_id: positiveInt.optional().nullable(),
    genre_category_id: positiveInt.optional().nullable(),
    status: z.enum(BOOK_STATUS_VALUES).optional(),
    visibility: z.enum(VISIBILITY_VALUES).optional(),
    reading_purpose: z.string().max(255).optional().nullable(),
    entry_reason: z.string().max(500).optional().nullable(),
    rating: z.number().int().min(1).max(5).optional().nullable(),
    page_count: z.number().int().min(1).max(100000).optional().nullable(),
    source_url: z.string().max(2000).optional().nullable(),
    tag_ids: z.array(positiveInt).optional(),
    custom_attributes: z.record(z.unknown()).optional().nullable(),
    metadata_source: z.string().max(50).optional().nullable(),
    cover_path: z.string().max(1024).optional().nullable(),
    started_at: z.string().datetime().optional().nullable(),
    finished_at: z.string().datetime().optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' });
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const batchBookActionSchema = z.discriminatedUnion('action', [
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('set_status'),
    params: z.object({ status: z.enum(Object.values(BOOK_STATUS) as [string, ...string[]]) }),
  }),
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('set_category'),
    params: z.object({ category_id: positiveInt.nullable() }),
  }),
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('set_tags'),
    params: z.object({ tag_ids: z.array(positiveInt) }),
  }),
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('set_visibility'),
    params: z.object({ visibility: z.enum(VISIBILITY_VALUES) }),
  }),
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('delete'),
    params: z.object({}),
  }),
]);
export type BatchBookActionInput = z.infer<typeof batchBookActionSchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PERSONAL', 'GENRE']).optional().default('PERSONAL'),
  parent_id: positiveInt.optional().nullable(),
  sort_order: z.number().int().min(0).optional().default(0),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    type: z.enum(['PERSONAL', 'GENRE']).optional(),
    parent_id: positiveInt.optional().nullable(),
    sort_order: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50),
});
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export const createRelationSchema = z.object({
  target_book_id: positiveInt,
  relation_type: z.string().min(1).max(100).optional().nullable(),
});
export type CreateRelationInput = z.infer<typeof createRelationSchema>;

export const createFileMetaSchema = z.object({
  original_filename: z.string().min(1).max(1024),
  is_primary: z.boolean().optional().default(false),
});
export type CreateFileMetaInput = z.infer<typeof createFileMetaSchema>;

export const updateFileSchema = z
  .object({
    original_filename: z.string().min(1).max(1024).optional(),
    is_primary: z.boolean().optional(),
    storage_mode: z.string().optional(),
    primary_location: z.string().optional(),
    sync_status: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' });
export type UpdateFileInput = z.infer<typeof updateFileSchema>;

export const matchFileToBookSchema = z.object({
  book_id: positiveInt,
  is_primary: z.boolean().optional(),
});
export type MatchFileToBookInput = z.infer<typeof matchFileToBookSchema>;

export const defaultStorageModeSchema = z.object({
  default_storage_mode: z.string(),
});
export type DefaultStorageModeInput = z.infer<typeof defaultStorageModeSchema>;

export const bookImportRecordSchema = z.object({
  title: z.string().min(1).max(500),
  subtitle: z.string().max(500).optional().nullable(),
  author: z.string().max(500).optional().nullable(),
  translator: z.string().max(500).optional().nullable(),
  original_title: z.string().max(500).optional().nullable(),
  isbn: z.string().max(50).optional().nullable(),
  publisher: z.string().max(255).optional().nullable(),
  publish_year: z.number().int().min(0).max(3000).optional().nullable(),
  description: z.string().optional().nullable(),
  language: z.string().max(50).optional().nullable(),
  category_name: z.string().max(100).optional().nullable(),
  genre_category_name: z.string().max(100).optional().nullable(),
  status: z.enum(Object.values(BOOK_STATUS) as [string, ...string[]]).optional().default('COLLECTED'),
  visibility: z.enum(Object.values(VISIBILITY) as [string, ...string[]]).optional().default('PRIVATE'),
  reading_purpose: z.string().max(255).optional().nullable(),
  entry_reason: z.string().max(500).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  page_count: z.number().int().min(1).max(100000).optional().nullable(),
  source_url: z.string().max(2000).optional().nullable(),
  tag_names: z.array(z.string().min(1).max(50)).optional().default([]),
  favorite: z.boolean().optional().default(false),
});
export type BookImportRecordInput = z.infer<typeof bookImportRecordSchema>;

export const storageConfigSchema = z.object({
  storage_driver: z.enum(['local', 's3']).optional(),
  s3_endpoint: z.string().max(500).optional().nullable(),
  s3_region: z.string().max(100).optional().nullable(),
  s3_bucket: z.string().max(255).optional().nullable(),
  s3_access_key: z.string().max(255).optional().nullable(),
  s3_secret_key: z.string().max(255).optional().nullable(),
  s3_public_base_url: z.string().max(500).optional().nullable(),
  s3_force_path_style: z.boolean().optional(),
});
export type StorageConfigInput = z.infer<typeof storageConfigSchema>;

export const settingsPatchSchema = z.record(z.string(), z.unknown());
export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;

export const createUserSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(6).max(200),
  display_name: z.string().max(100).optional().nullable(),
  is_admin: z.boolean().optional().default(false),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    password: z.string().min(6).max(200).optional(),
    display_name: z.string().max(100).optional().nullable(),
    is_active: z.boolean().optional(),
    is_admin: z.boolean().optional(),
    must_change_password: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const loginSchema = z.object({
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const setupSchema = z.object({
  password: z.string().min(8).max(200),
  display_name: z.string().max(100).optional().nullable(),
});
export type SetupInput = z.infer<typeof setupSchema>;

export const createHighlightSchema = z.object({
  book_id: positiveInt,
  cfi_start: z.string().min(1).max(1024),
  cfi_end: z.string().min(1).max(1024),
  text: z.string().min(1),
  type: z.enum(['HIGHLIGHT', 'UNDERLINE', 'WAVY']).optional().default('HIGHLIGHT'),
  color: z.string().max(50).optional().nullable(),
  note: z.string().optional().nullable(),
  mark_type: z.enum(['NONE', 'IMPORTANT', 'QUESTION', 'INSIGHT']).optional().default('NONE'),
});
export type CreateHighlightInput = z.infer<typeof createHighlightSchema>;

export const updateHighlightSchema = z.object({
  cfi_start: z.string().min(1).max(1024).optional(),
  cfi_end: z.string().min(1).max(1024).optional(),
  text: z.string().min(1).optional(),
  type: z.enum(['HIGHLIGHT', 'UNDERLINE', 'WAVY']).optional(),
  color: z.string().max(50).optional().nullable(),
  note: z.string().optional().nullable(),
  mark_type: z.enum(['NONE', 'IMPORTANT', 'QUESTION', 'INSIGHT']).optional(),
});
export type UpdateHighlightInput = z.infer<typeof updateHighlightSchema>;

export const createBookmarkSchema = z.object({
  book_id: positiveInt,
  cfi: z.string().min(1).max(1024),
  title: z.string().max(500).optional().nullable(),
});
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;

export const createNoteSchema = z.object({
  book_id: positiveInt,
  cfi: z.string().max(1024).optional().nullable(),
  title: z.string().max(500).optional().nullable(),
  content_html: z.string().optional().nullable(),
  content_markdown: z.string().optional().nullable(),
  mark_type: z.enum(['NONE', 'IMPORTANT', 'QUESTION', 'INSIGHT']).optional().default('NONE'),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({
  cfi: z.string().optional().nullable(),
  title: z.string().max(500).optional().nullable(),
  content_html: z.string().optional().nullable(),
  content_markdown: z.string().optional().nullable(),
  mark_type: z.enum(['NONE', 'IMPORTANT', 'QUESTION', 'INSIGHT']).optional(),
});
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

// 话题 schemas
export const createTopicSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
});
export type CreateTopicInput = z.infer<typeof createTopicSchema>;

export const updateTopicSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
});
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;

export const createTopicEntrySchema = z.object({
  entry_type: z.enum(Object.values(TOPIC_ENTRY_TYPE) as [string, ...string[]]),
  content: z.string().min(1).max(5000),
});
export type CreateTopicEntryInput = z.infer<typeof createTopicEntrySchema>;

export const updateTopicEntrySchema = z.object({
  content: z.string().min(1).max(5000).optional(),
});
export type UpdateTopicEntryInput = z.infer<typeof updateTopicEntrySchema>;

export const linkTopicHighlightSchema = z.object({
  highlight_id: positiveInt,
});
export type LinkTopicHighlightInput = z.infer<typeof linkTopicHighlightSchema>;

export const linkTopicNoteSchema = z.object({
  note_id: positiveInt,
});
export type LinkTopicNoteInput = z.infer<typeof linkTopicNoteSchema>;

export const createTopicSegmentSchema = z.object({
  book_id: positiveInt,
  cfi_start: z.string().min(1).max(1024),
  cfi_end: z.string().min(1).max(1024),
  label: z.string().max(500).optional().nullable(),
});
export type CreateTopicSegmentInput = z.infer<typeof createTopicSegmentSchema>;

export const updateTopicSegmentSchema = z.object({
  cfi_start: z.string().min(1).max(1024).optional(),
  cfi_end: z.string().min(1).max(1024).optional(),
  label: z.string().max(500).optional().nullable(),
});
export type UpdateTopicSegmentInput = z.infer<typeof updateTopicSegmentSchema>;

// 阅读进度 schemas
export const readingProgressSchema = z.object({
  id: z.number().int(),
  book_id: z.number().int(),
  owner_id: z.number().int(),
  file_id: z.number().int(),
  cfi: z.string(),
  percentage: z.number(),
  last_read_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ReadingProgressOutput = z.infer<typeof readingProgressSchema>;

export const updateReadingProgressSchema = z.object({
  file_id: z.number().int(),
  cfi: z.string().min(1),
  percentage: z.number().min(0).max(100),
});
export type UpdateReadingProgressInput = z.infer<typeof updateReadingProgressSchema>;

export interface ApiErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    details?: { field: string; issue: string }[];
    [key: string]: unknown;
  };
}

export const systemResetSchema = z.object({
  confirm: z.literal('RESET'),
  remove_files: z.boolean().optional().default(false),
});
export type SystemResetInput = z.infer<typeof systemResetSchema>;

export const updateScriptCreateSchema = z.object({
  version: z.string().min(1).max(50),
  filename: z.string().min(1).max(255),
  target_type: z.enum(['docker', 'local']),
  content: z.string().min(1),
  changelog: z.array(z.string()).optional().default([]),
  is_active: z.boolean().optional().default(false),
});
export type UpdateScriptCreateInput = z.infer<typeof updateScriptCreateSchema>;

export const updateScriptPatchSchema = z
  .object({
    filename: z.string().min(1).max(255).optional(),
    target_type: z.enum(['docker', 'local']).optional(),
    content: z.string().min(1).optional(),
    changelog: z.array(z.string()).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' });
export type UpdateScriptPatchInput = z.infer<typeof updateScriptPatchSchema>;

export const updateScriptActivateSchema = z.object({
  is_active: z.literal(true),
});
export type UpdateScriptActivateInput = z.infer<typeof updateScriptActivateSchema>;

export const matchCandidateRequestSchema = z.object({
  file_ids: z.array(positiveInt).min(1).max(500).optional(),
  limit: z.number().int().min(1).max(20).optional().default(5),
  min_score: z.number().min(0).max(1).optional().default(0.25),
  include_matched: z.boolean().optional().default(false),
});
export type MatchCandidateRequestInput = z.infer<typeof matchCandidateRequestSchema>;

export const applyBatchMatchItemSchema = z.object({
  file_id: positiveInt,
  book_id: positiveInt,
  is_primary: z.boolean().optional(),
});
export type ApplyBatchMatchItemInput = z.infer<typeof applyBatchMatchItemSchema>;

export const applyBatchMatchRequestSchema = z.object({
  matches: z.array(applyBatchMatchItemSchema).min(1).max(500),
});
export type ApplyBatchMatchRequestInput = z.infer<typeof applyBatchMatchRequestSchema>;
