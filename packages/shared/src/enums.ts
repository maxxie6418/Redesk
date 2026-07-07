export const BOOK_STATUS = {
  COLLECTED: 'COLLECTED',
  PLANNED: 'PLANNED',
  READING: 'READING',
  READ: 'READ',
  STORED: 'STORED',
} as const;
export type BookStatus = (typeof BOOK_STATUS)[keyof typeof BOOK_STATUS];

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  COLLECTED: '收录',
  PLANNED: '计划读',
  READING: '在读',
  READ: '已读',
  STORED: '存档',
};

export const VISIBILITY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;
export type Visibility = (typeof VISIBILITY)[keyof typeof VISIBILITY];

export const FILE_FORMAT = {
  EPUB: 'EPUB',
  PDF: 'PDF',
  MOBI: 'MOBI',
  TXT: 'TXT',
  AZW3: 'AZW3',
} as const;
export type FileFormat = (typeof FILE_FORMAT)[keyof typeof FILE_FORMAT];

export const METADATA_SOURCE = {
  MANUAL: 'manual',
  NEODB: 'neodb',
  DOUBAN: 'douban',
} as const;
export type MetadataSource = (typeof METADATA_SOURCE)[keyof typeof METADATA_SOURCE];

export const BOOK_COVER_SOURCE_TYPE = {
  EPUB_EXTRACTED: 'EPUB_EXTRACTED',
  REMOTE_FETCHED: 'REMOTE_FETCHED',
  MANUAL_UPLOAD: 'MANUAL_UPLOAD',
} as const;
export type BookCoverSourceType = (typeof BOOK_COVER_SOURCE_TYPE)[keyof typeof BOOK_COVER_SOURCE_TYPE];

export const HIGHLIGHT_TYPE = {
  HIGHLIGHT: 'HIGHLIGHT',
  UNDERLINE: 'UNDERLINE',
  WAVY: 'WAVY',
} as const;
export type HighlightType = (typeof HIGHLIGHT_TYPE)[keyof typeof HIGHLIGHT_TYPE];

export const MARK_TYPE = {
  NONE: 'NONE',
  IMPORTANT: 'IMPORTANT',
  QUESTION: 'QUESTION',
  INSIGHT: 'INSIGHT',
} as const;
export type MarkType = (typeof MARK_TYPE)[keyof typeof MARK_TYPE];

export const AI_SCOPE_TYPE = {
  BOOK: 'BOOK',
  TOPIC: 'TOPIC',
  GLOBAL: 'GLOBAL',
} as const;
export type AiScopeType = (typeof AI_SCOPE_TYPE)[keyof typeof AI_SCOPE_TYPE];

export const AI_ASSET_KIND = {
  SUMMARY: 'SUMMARY',
  QUESTION_LIST: 'QUESTION_LIST',
  TAG_SUGGEST: 'TAG_SUGGEST',
  CATEGORY_SUGGEST: 'CATEGORY_SUGGEST',
  DUPLICATE_HINT: 'DUPLICATE_HINT',
  COMPARE: 'COMPARE',
  DIVERGENCE: 'DIVERGENCE',
  RELATE_SUGGEST: 'RELATE_SUGGEST',
  ANSWER: 'ANSWER',
} as const;
export type AiAssetKind = (typeof AI_ASSET_KIND)[keyof typeof AI_ASSET_KIND];

export const TOPIC_ENTRY_TYPE = {
  QUESTION: 'QUESTION',
  JUDGMENT: 'JUDGMENT',
  COMPARISON: 'COMPARISON',
} as const;
export type TopicEntryType = (typeof TOPIC_ENTRY_TYPE)[keyof typeof TOPIC_ENTRY_TYPE];

export const CATEGORY_TYPE = {
  GENRE: 'GENRE',
  PERSONAL: 'PERSONAL',
} as const;
export type CategoryType = (typeof CATEGORY_TYPE)[keyof typeof CATEGORY_TYPE];

export const AUTH_MODE = {
  SINGLE_TOKEN: 'single_token',
  MULTI_TOKEN: 'multi_token',
} as const;
export type AuthMode = (typeof AUTH_MODE)[keyof typeof AUTH_MODE];
