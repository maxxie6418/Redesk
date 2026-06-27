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
export const MAX_PAGE_SIZE = 100;
