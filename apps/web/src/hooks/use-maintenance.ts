import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MaintenanceStats {
  total: number;
  complete: number;
  missing_any: number;
  missing_fields: Record<string, number>;
  no_source_url: number;
  has_source_url_not_fetched: number;
  no_cover: number;
}

export interface MaintenanceBookRow {
  id: number;
  owner_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  publish_year: number | null;
  description: string | null;
  cover_path: string | null;
  file_size: number | null;
  status: string;
  visibility: string;
  reading_purpose: string | null;
  entry_reason: string | null;
  rating: number | null;
  is_favorite: boolean;
  favorite_at: string | null;
  source_url: string | null;
  metadata_source: string | null;
  created_at: string;
  updated_at: string;
  subtitle: string | null;
  translator: string | null;
  original_title: string | null;
  page_count: number | null;
  language: string | null;
  import_order: number | null;
  genre_category_id: number | null;
  category_id: number | null;
  tags: string[];
  category_name?: string | null;
  genre_category_name?: string | null;
  has_cover?: boolean;
}

export interface MaintenanceListResponse {
  data: MaintenanceBookRow[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface MaintenanceListParams {
  page?: number;
  page_size?: number;
  sort?: string;
  q?: string;
  missing?: string;
  no_source_url?: boolean;
  has_source_url_not_fetched?: boolean;
  no_cover?: boolean;
  category_id?: number;
  genre_category_id?: number;
  status?: string;
  tag_ids?: string;
  book_ids?: string;
}

export function useMaintenanceStats() {
  return useQuery<MaintenanceStats>({
    queryKey: ['maintenance', 'stats'],
    queryFn: () => api.get<MaintenanceStats>('/books/maintenance/stats'),
  });
}

export function useMaintenanceList(params: MaintenanceListParams) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  if (params.sort) query.set('sort', params.sort);
  if (params.q) query.set('q', params.q);
  if (params.missing) query.set('missing', params.missing);
  if (params.no_source_url) query.set('no_source_url', 'true');
  if (params.has_source_url_not_fetched) query.set('has_source_url_not_fetched', 'true');
  if (params.no_cover) query.set('no_cover', 'true');
  if (params.category_id) query.set('category_id', String(params.category_id));
  if (params.genre_category_id) query.set('genre_category_id', String(params.genre_category_id));
  if (params.status) query.set('status', params.status);
  if (params.tag_ids) query.set('tag_ids', params.tag_ids);
  if (params.book_ids) query.set('book_ids', params.book_ids);
  const qs = query.toString();

  return useQuery<MaintenanceListResponse>({
    queryKey: ['maintenance', 'list', qs],
    queryFn: () => api.getBody<MaintenanceListResponse>(`/books/maintenance/list${qs ? `?${qs}` : ''}`),
  });
}

export function useUpdateBookField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, field, value }: { bookId: number; field: string; value: unknown }) =>
      api.patch(`/books/${bookId}`, { [field]: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });
}

export function useBatchPreviewMetadata() {
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<unknown[]>('/books/metadata/batch-preview', { ids }),
  });
}

export function useBatchApplyMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { ids: number[]; fields?: string[] }) =>
      api.post<unknown[]>('/books/metadata/batch-apply', params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });
}

export interface BatchFetchCoversResult {
  total: number;
  success: number;
  failed: number;
  rows: Array<{ book_id: number; success: boolean; error: string | null }>;
}

export function useBatchFetchCovers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<BatchFetchCoversResult>('/books/covers/batch-fetch', { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });
}
