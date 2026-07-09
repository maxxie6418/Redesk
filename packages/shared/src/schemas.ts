import { z } from 'zod';
import { BOOK_STATUS, VISIBILITY, TOPIC_ENTRY_TYPE } from './enums';
import type { ErrorCode } from './errors';

const positiveInt = z.coerce.number().int().positive();
const BOOK_STATUS_VALUES = Object.values(BOOK_STATUS) as [string, ...string[]];
const VISIBILITY_VALUES = Object.values(VISIBILITY) as [string, ...string[]];
export const BACKUP_MODULE_ID_VALUES = [
  'settings.public',
  'settings.secrets',
  'users.auth',
  'library.books',
  'library.taxonomy',
  'library.relations',
  'assets.file_index',
  'assets.book_blobs',
  'assets.cover_blobs',
  'reading.progress',
  'reading.highlights',
  'reading.notes',
  'reading.bookmarks',
  'topics.workspace',
  'database.snapshot',
] as const;
export const BACKUP_PRESET_VALUES = ['system', 'books', 'notes', 'topics', 'full'] as const;
export const BACKUP_TARGET_TYPE_VALUES = ['download', 'oss', 'webdav'] as const;
export const BACKUP_JOB_STATUS_VALUES = [
  'preparing',
  'packing',
  'uploading',
  'completed',
  'failed',
  'cancelled',
] as const;
export const RESTORE_CONFLICT_STRATEGY_VALUES = ['skip', 'overwrite', 'rename', 'duplicate'] as const;

const STORAGE_MODE_VALUES = ['local_only', 'cloud_only', 'dual'] as const;
const FILE_MATCH_MODE_VALUES = ['conservative', 'balanced', 'loose'] as const;
const STORAGE_DRIVER_VALUES = ['local', 's3'] as const;

export const idParamSchema = z.object({
  id: positiveInt,
});

export const paginationSchema = z.object({
  page: positiveInt.default(1),
  page_size: z.coerce.number().int().min(1).max(500).default(20),
  sort: z.string().optional(),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const bookQuerySchema = paginationSchema.extend({
  q: z.string().optional(),
  status: z.string().optional(),
  category_id: positiveInt.optional(),
  genre_category_id: positiveInt.optional(),
  tag_id: z.string().optional(),
  visibility: z.enum(VISIBILITY_VALUES).optional(),
  in_trash: z.coerce.boolean().optional().default(false),
  favorited: z.coerce.boolean().optional().default(false),
  has_files: z.coerce.boolean().optional(),
  has_readable_file: z.coerce.boolean().optional(),
});
export type BookQueryInput = z.infer<typeof bookQuerySchema>;

export const trashQuerySchema = paginationSchema.extend({
  q: z.string().optional(),
});
export type TrashQueryInput = z.infer<typeof trashQuerySchema>;

export const maintenanceListSchema = paginationSchema.extend({
  q: z.string().optional(),
  missing: z.string().optional(),
  no_source_url: z.coerce.boolean().optional(),
  has_source_url_not_fetched: z.coerce.boolean().optional(),
  no_cover: z.coerce.boolean().optional(),
  category_id: positiveInt.optional(),
  genre_category_id: positiveInt.optional(),
  status: z.string().optional(),
  tag_ids: z.string().optional(),
  book_ids: z.string().optional(),
});
export type MaintenanceListInput = z.infer<typeof maintenanceListSchema>;

export const readingMarkListQuerySchema = z.object({
  page: positiveInt.default(1),
  page_size: z.coerce.number().int().min(1).transform((value) => Math.min(value, 500)).default(20),
  book_id: positiveInt.optional(),
});
export type ReadingMarkListQueryInput = z.infer<typeof readingMarkListQuerySchema>;

export const readingMarkSearchQuerySchema = readingMarkListQuerySchema.extend({
  q: z.string().trim().min(1),
});
export type ReadingMarkSearchQueryInput = z.infer<typeof readingMarkSearchQuerySchema>;

export const duplicateQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(1).optional().default(0.6),
});
export type DuplicateQueryInput = z.infer<typeof duplicateQuerySchema>;

export const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).optional().default('json'),
  ids: z.string().optional(),
});
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;

export const importNotesSchema = z.object({
  mode: z.enum(['append', 'replace']).optional().default('append'),
  dry_run: z.coerce.boolean().optional().default(false),
});
export type ImportNotesInput = z.infer<typeof importNotesSchema>;

export const backupModuleIdSchema = z.enum(BACKUP_MODULE_ID_VALUES);
export type BackupModuleId = z.infer<typeof backupModuleIdSchema>;

export const backupPresetSchema = z.enum(BACKUP_PRESET_VALUES);
export type BackupPreset = z.infer<typeof backupPresetSchema>;

export const backupTargetTypeSchema = z.enum(BACKUP_TARGET_TYPE_VALUES);
export type BackupTargetType = z.infer<typeof backupTargetTypeSchema>;

export const backupJobStatusSchema = z.enum(BACKUP_JOB_STATUS_VALUES);
export type BackupJobStatus = z.infer<typeof backupJobStatusSchema>;

export const restoreConflictStrategySchema = z.enum(RESTORE_CONFLICT_STRATEGY_VALUES);
export type RestoreConflictStrategy = z.infer<typeof restoreConflictStrategySchema>;

export const backupTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('download') }),
  z.object({ type: z.literal('oss'), remote_path: z.string().min(1).max(1024).optional() }),
  z.object({ type: z.literal('webdav'), remote_path: z.string().min(1).max(1024).optional() }),
]);
export type BackupTargetInput = z.infer<typeof backupTargetSchema>;

export const backupModuleSummarySchema = z.object({
  module_id: backupModuleIdSchema,
  label: z.string().min(1).max(100),
  selected: z.boolean(),
  default_selected: z.boolean(),
  sensitive: z.boolean(),
  risky: z.boolean(),
  count: z.number().int().min(0),
  size_bytes: z.number().int().min(0),
  warnings: z.array(z.string()).default([]),
});
export type BackupModuleSummary = z.infer<typeof backupModuleSummarySchema>;

export const backupPreviewRequestSchema = z.object({
  preset: backupPresetSchema.optional(),
  modules: z.array(backupModuleIdSchema).optional(),
  target: backupTargetSchema.optional(),
});
export type BackupPreviewRequestInput = z.infer<typeof backupPreviewRequestSchema>;

export const backupCreateRequestSchema = z.object({
  preset: backupPresetSchema.optional(),
  modules: z.array(backupModuleIdSchema).min(1),
  target: backupTargetSchema.default({ type: 'download' }),
});
export type BackupCreateRequestInput = z.infer<typeof backupCreateRequestSchema>;

export const backupPreviewResponseSchema = z.object({
  preset: backupPresetSchema.optional().nullable(),
  modules: z.array(backupModuleSummarySchema),
  selected_modules: z.array(backupModuleIdSchema),
  book_count: z.number().int().min(0),
  note_count: z.number().int().min(0),
  highlight_count: z.number().int().min(0),
  topic_count: z.number().int().min(0),
  estimated_size_bytes: z.number().int().min(0),
  warnings: z.array(z.string()).default([]),
});
export type BackupPreviewResponse = z.infer<typeof backupPreviewResponseSchema>;

export const backupManifestModuleSchema = z.object({
  module_id: backupModuleIdSchema,
  path: z.string().min(1).max(1024).optional(),
  included: z.boolean(),
  sensitive: z.boolean(),
  count: z.number().int().min(0),
  size_bytes: z.number().int().min(0),
  checksum: z.string().max(255).optional().nullable(),
});
export type BackupManifestModule = z.infer<typeof backupManifestModuleSchema>;

export const backupManifestFileSchema = z.object({
  path: z.string().min(1).max(1024),
  original_filename: z.string().max(1024).optional().nullable(),
  size_bytes: z.number().int().min(0),
  checksum: z.string().max(255).optional().nullable(),
  module_id: backupModuleIdSchema.optional(),
});
export type BackupManifestFile = z.infer<typeof backupManifestFileSchema>;

export const backupManifestSchema = z.object({
  format_version: z.number().int().positive(),
  backup_id: z.string().min(1).max(100),
  created_at: z.string().datetime(),
  app: z.object({
    name: z.literal('Redesk'),
    version: z.string().min(1).max(50),
  }),
  database: z.object({
    schema_version: z.string().max(100).optional().nullable(),
    snapshot_included: z.boolean(),
    snapshot_path: z.string().max(1024).optional().nullable(),
    size_bytes: z.number().int().min(0).optional(),
  }),
  preset: backupPresetSchema.optional().nullable(),
  target: backupTargetSchema.optional(),
  modules: z.array(backupManifestModuleSchema),
  files: z.array(backupManifestFileSchema).default([]),
  summary: z.object({
    book_count: z.number().int().min(0),
    note_count: z.number().int().min(0),
    highlight_count: z.number().int().min(0),
    topic_count: z.number().int().min(0),
    total_size_bytes: z.number().int().min(0),
  }),
  warnings: z.array(z.string()).default([]),
});
export type BackupManifest = z.infer<typeof backupManifestSchema>;

export const backupJobSchema = z.object({
  job_id: z.string().min(1).max(100),
  status: backupJobStatusSchema,
  target_type: backupTargetTypeSchema,
  bytes_total: z.number().int().min(0),
  bytes_uploaded: z.number().int().min(0),
  percent: z.number().min(0).max(100),
  remote_path: z.string().max(1024).optional().nullable(),
  speed_bytes_per_second: z.number().min(0).optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  error: z.string().max(2000).optional().nullable(),
  download_url: z.string().max(2000).optional().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type BackupJob = z.infer<typeof backupJobSchema>;

export const restorePreviewResponseSchema = z.object({
  manifest: backupManifestSchema,
  restorable_modules: z.array(backupModuleSummarySchema),
  missing_files: z.array(backupManifestFileSchema).default([]),
  warnings: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});
export type RestorePreviewResponse = z.infer<typeof restorePreviewResponseSchema>;

export const restoreExecuteRequestSchema = z.object({
  restore_id: z.string().min(1).max(100),
  modules: z.array(backupModuleIdSchema).min(1),
  conflict_strategy: restoreConflictStrategySchema.optional().default('skip'),
  confirm_risky_modules: z.boolean().optional().default(false),
});
export type RestoreExecuteRequestInput = z.infer<typeof restoreExecuteRequestSchema>;

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
  metadata_source: z.string().max(50).optional().nullable(),
  cover_url: z.string().max(2000).optional().nullable(),
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

export const metadataApplySchema = z.object({
  fields: z.record(z.unknown()).optional().default({}),
  fetch_cover: z.boolean().optional().default(false),
});
export type MetadataApplyInput = z.infer<typeof metadataApplySchema>;

export const batchBooksSchema = z.discriminatedUnion('action', [
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('set_status'),
    params: z.object({ status: z.enum(BOOK_STATUS_VALUES) }),
  }),
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('set_category'),
    params: z.object({ category_id: positiveInt.nullable() }),
  }),
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('set_genre_category'),
    params: z.object({ genre_category_id: positiveInt.nullable() }),
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
    action: z.literal('set_favorited'),
    params: z.object({ favorited: z.boolean() }),
  }),
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('delete'),
    params: z.object({}).optional(),
  }),
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('fetch_metadata'),
    params: z.object({}).optional(),
  }),
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('fetch_cover'),
    params: z.object({ force: z.boolean().optional() }).optional(),
  }),
]);
export type BatchBooksInput = z.infer<typeof batchBooksSchema>;

export const batchBookActionSchema = z.discriminatedUnion('action', [
  z.object({
    ids: z.array(positiveInt).min(1),
    action: z.literal('set_status'),
    params: z.object({ status: z.enum(BOOK_STATUS_VALUES) }),
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

export const categoryQuerySchema = z.object({
  type: z.enum(['PERSONAL', 'GENRE']).optional(),
});
export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;

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
  note: z.string().max(1000).optional().nullable(),
});
export type CreateRelationInput = z.infer<typeof createRelationSchema>;

export const createFileMetaSchema = z.object({
  original_filename: z.string().min(1).max(1024),
  is_primary: z.boolean().optional().default(false),
});
export type CreateFileMetaInput = z.infer<typeof createFileMetaSchema>;

export const updateFileSchema = z
  .object({
    is_primary: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' });
export type UpdateFileInput = z.infer<typeof updateFileSchema>;

export const matchFileToBookSchema = z.object({
  book_id: positiveInt,
  is_primary: z.boolean().optional(),
});
export type MatchFileToBookInput = z.infer<typeof matchFileToBookSchema>;

export const storageModeSchema = z.enum(STORAGE_MODE_VALUES);
export type StorageModeInput = z.infer<typeof storageModeSchema>;

export const fileMatchCandidatesSchema = z.object({
  file_ids: z.array(positiveInt).min(1).max(500),
  mode: z.enum(FILE_MATCH_MODE_VALUES).optional().default('balanced'),
});
export type FileMatchCandidatesInput = z.infer<typeof fileMatchCandidatesSchema>;

export const applyFileMatchesSchema = z.object({
  items: z.array(z.object({ file_id: positiveInt, book_id: positiveInt })).min(1).max(500),
});
export type ApplyFileMatchesInput = z.infer<typeof applyFileMatchesSchema>;

export const batchSendFilesToCloudSchema = z.object({
  ids: z.array(positiveInt).min(1).max(500),
});
export type BatchSendFilesToCloudInput = z.infer<typeof batchSendFilesToCloudSchema>;

export const fetchBookCoverSchema = z.object({
  force: z.boolean().optional().default(false),
});
export type FetchBookCoverInput = z.infer<typeof fetchBookCoverSchema>;

export const batchFetchBookCoversSchema = z.object({
  ids: z.array(positiveInt).min(1).max(500),
  force: z.boolean().optional().default(false),
});
export type BatchFetchBookCoversInput = z.infer<typeof batchFetchBookCoversSchema>;

export const activateBookCoverSchema = z.object({
  is_active: z.boolean(),
});
export type ActivateBookCoverInput = z.infer<typeof activateBookCoverSchema>;

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
  status: z.enum(BOOK_STATUS_VALUES).optional().default('COLLECTED'),
  visibility: z.enum(VISIBILITY_VALUES).optional().default('PRIVATE'),
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
  storage_driver: z.enum(STORAGE_DRIVER_VALUES).optional(),
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

export const updateSettingsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const storageSettingsSchema = z.object({
  default_storage_mode: z.enum(STORAGE_MODE_VALUES),
  driver: z.enum(STORAGE_DRIVER_VALUES).optional().nullable(),
  provider: z.string().max(100).optional().nullable(),
  bucket: z.string().max(255).optional().nullable(),
  endpoint: z.string().max(500).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  access_key: z.string().max(500).optional().nullable(),
  secret_key: z.string().max(500).optional().nullable(),
  public_url: z.string().max(500).optional().nullable(),
  clear_access_key: z.boolean().optional(),
  clear_secret_key: z.boolean().optional(),
});
export type StorageSettingsInput = z.infer<typeof storageSettingsSchema>;

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

export const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(200).optional(),
  new_password: z.string().min(6).max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(6).max(200),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

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
  label: z.string().max(500).optional().nullable(),
  percentage: z.number().min(0).max(100).optional().nullable(),
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

export const createTopicSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
});
export type CreateTopicInput = z.infer<typeof createTopicSchema>;

export const updateTopicSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' });
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;

export const createTopicEntrySchema = z.object({
  entry_type: z.enum(Object.values(TOPIC_ENTRY_TYPE) as [string, ...string[]]),
  content: z.string().min(1).max(5000),
});
export type CreateTopicEntryInput = z.infer<typeof createTopicEntrySchema>;

export const updateTopicEntrySchema = z
  .object({
    content: z.string().min(1).max(5000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' });
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

export const heartbeatSchema = z.object({
  book_id: positiveInt,
});
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

export const closeSessionSchema = z.object({
  book_id: positiveInt,
});
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;

export const readerPreferencesSchema = z.object({
  color_scheme: z.enum(['default', 'sepia', 'green', 'dark']).default('default'),
  font_family: z.string().default('serif'),
  font_size: z.number().min(12).max(28).default(18),
  line_height: z.number().min(1.2).max(2.4).default(1.6),
  custom_fonts: z.array(z.string()).default([]),
});
export type ReaderPreferences = z.infer<typeof readerPreferencesSchema>;

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

export const batchPreviewSchema = z.object({
  ids: z.array(positiveInt).min(1).max(500),
});
export type BatchPreviewInput = z.infer<typeof batchPreviewSchema>;

export const batchApplySchema = z.object({
  ids: z.array(positiveInt).min(1).max(500),
  fields: z.array(z.string()).optional(),
});
export type BatchApplyInput = z.infer<typeof batchApplySchema>;
