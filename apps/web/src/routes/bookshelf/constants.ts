import { BOOK_STATUS, VISIBILITY } from '@redesk/shared';
import { API_BASE } from '@/lib/api';

export type ViewMode = 'A' | 'B' | 'C' | 'D';
export type SortMode = 'import_order_asc' | 'updated_desc' | 'title_asc' | 'rating_desc';
export type PageView = 'bookshelf' | 'trash';

export const VIEW_PAGE_SIZE_MULTIPLIERS = [1.5, 2, 4] as const;

export const SORT_API_MAP: Record<SortMode, string> = {
  import_order_asc: 'import_order',
  updated_desc: '-updated_at',
  title_asc: 'title',
  rating_desc: '-rating',
};

export const BOOK_STATUS_LABELS_LOCAL: Record<string, string> = {
  [BOOK_STATUS.COLLECTED]: '收录',
  [BOOK_STATUS.PLANNED]: '计划读',
  [BOOK_STATUS.READING]: '在读',
  [BOOK_STATUS.READ]: '已读',
  [BOOK_STATUS.STORED]: '存档',
};

export const STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  { value: BOOK_STATUS.COLLECTED, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.COLLECTED] },
  { value: BOOK_STATUS.PLANNED, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.PLANNED] },
  { value: BOOK_STATUS.READING, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.READING] },
  { value: BOOK_STATUS.READ, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.READ] },
  { value: BOOK_STATUS.STORED, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.STORED] },
] as const;

export const VISIBILITY_OPTIONS = [
  { value: 'ALL', label: '全部权限' },
  { value: VISIBILITY.PRIVATE, label: '私密' },
  { value: VISIBILITY.PUBLIC, label: '公开' },
] as const;

export const SORT_OPTIONS = [
  { value: 'import_order_asc', label: '按导入序号排序' },
  { value: 'updated_desc', label: '按最近更新排序' },
  { value: 'title_asc', label: '按书名排序' },
  { value: 'rating_desc', label: '按评分排序' },
] as const;

export const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

export const COVER_URL_BASE = API_BASE;
