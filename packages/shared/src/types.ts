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
  BRUTE_FORCE_WINDOW_MINUTES: 'brute_force_window_minutes',
  BRUTE_FORCE_MAX_ATTEMPTS: 'brute_force_max_attempts',
  BRUTE_FORCE_LOCK_MINUTES: 'brute_force_lock_minutes',
} as const;

export const BRUTE_FORCE_DEFAULTS = {
  WINDOW_MINUTES: 10,
  MAX_ATTEMPTS: 5,
  LOCK_MINUTES: 60,
} as const;
