export interface Pagination {
  page: number;
  page_size: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface SingleResponse<T> {
  data: T;
}

export interface SortParam {
  field: string;
  descending: boolean;
}

export interface PaginationQuery {
  page: number;
  page_size: number;
  sort?: string;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 500;

export const SETTINGS_KEY = {
  AUTH_MODE: 'auth_mode',
  ADMIN_PASSWORD_CHANGED_AT: 'admin_password_changed_at',
  BRUTE_FORCE_WINDOW_MINUTES: 'brute_force_window_minutes',
  BRUTE_FORCE_MAX_ATTEMPTS: 'brute_force_max_attempts',
  BRUTE_FORCE_LOCK_MINUTES: 'brute_force_lock_minutes',
} as const;

export const BRUTE_FORCE_DEFAULTS = {
  WINDOW_MINUTES: 10,
  MAX_ATTEMPTS: 5,
  LOCK_MINUTES: 60,
} as const;

export interface QuickTemplate {
  key: string;
  icon: string;
  label: string;
  mark_type: string;
  note_prefix: string;
}

export const defaultQuickTemplates: QuickTemplate[] = [
  { key: 'inspiration', icon: '💡', label: '启发', mark_type: 'INSIGHT', note_prefix: '启发' },
  { key: 'question', icon: '❓', label: '疑问', mark_type: 'QUESTION', note_prefix: '疑问' },
  { key: 'important', icon: '⭐', label: '重要', mark_type: 'IMPORTANT', note_prefix: '重要' },
  { key: 'todo', icon: '📌', label: '待查', mark_type: 'NONE', note_prefix: '待查' },
];
