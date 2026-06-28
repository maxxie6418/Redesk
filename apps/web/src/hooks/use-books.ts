import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BookSummary {
  id: number;
  owner_id: number;
  title: string;
  author: string;
  cover_path: string | null;
  status: string;
  visibility: string;
  rating: number | null;
  category_id: number | null;
  category_name: string | null;
  tag_ids: number[];
  tag_names: string[];
  description: string | null;
  publish_year: number | null;
  publisher: string | null;
  language: string | null;
  reading_purpose: string | null;
  custom_attributes: Record<string, unknown> | null;
  metadata_source: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookDetail extends BookSummary {
  isbn: string | null;
}

export interface PaginatedBooks {
  data: BookSummary[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface BookQueryParams {
  page?: number;
  page_size?: number;
  sort?: string;
  q?: string;
  status?: string;
  category_id?: number;
  tag_id?: string;
  visibility?: string;
  in_trash?: boolean;
}

export interface CreateBookInput {
  title: string;
  author: string;
  isbn?: string | null;
  publisher?: string | null;
  publish_year?: number | null;
  description?: string | null;
  language?: string | null;
  category_id?: number | null;
  status?: string;
  visibility?: string;
  reading_purpose?: string | null;
  rating?: number | null;
  tag_ids?: number[];
  custom_attributes?: Record<string, unknown> | null;
}

export interface UpdateBookInput {
  title?: string;
  author?: string;
  isbn?: string | null;
  publisher?: string | null;
  publish_year?: number | null;
  description?: string | null;
  language?: string | null;
  category_id?: number | null;
  status?: string;
  visibility?: string;
  reading_purpose?: string | null;
  rating?: number | null;
  tag_ids?: number[];
  custom_attributes?: Record<string, unknown> | null;
}

function buildQuery(params?: BookQueryParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.page_size) sp.set('page_size', String(params.page_size));
  if (params.sort) sp.set('sort', params.sort);
  if (params.q) sp.set('q', params.q);
  if (params.status) sp.set('status', params.status);
  if (params.category_id != null) sp.set('category_id', String(params.category_id));
  if (params.tag_id) sp.set('tag_id', params.tag_id);
  if (params.visibility) sp.set('visibility', params.visibility);
  if (params.in_trash) sp.set('in_trash', 'true');
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export function useBooks(params?: BookQueryParams) {
  return useQuery({
    queryKey: ['books', params],
    queryFn: () => api.getBody<PaginatedBooks>(`/books${buildQuery(params)}`),
  });
}

export function useBook(id: number) {
  return useQuery({
    queryKey: ['books', id],
    queryFn: () => api.get<BookDetail>(`/books/${id}`),
    enabled: id > 0,
  });
}

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookInput) => api.post<BookDetail>('/books', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & UpdateBookInput) =>
      api.patch<BookDetail>(`/books/${id}`, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['books', vars.id] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ id: number; deleted: boolean }>(`/books/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export interface BatchBooksInput {
  ids: number[];
  action: 'set_status' | 'set_category' | 'set_tags' | 'set_visibility' | 'delete';
  params?: Record<string, unknown>;
}

export function useBatchBooks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BatchBooksInput) =>
      api.post<{ affected: number }>('/books/batch', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export interface StatusHistoryEntry {
  id: number;
  from_status: string | null;
  to_status: string;
  changed_at: string;
}

export function useStatusHistory(bookId: number) {
  return useQuery({
    queryKey: ['books', bookId, 'status-history'],
    queryFn: () => api.get<StatusHistoryEntry[]>(`/books/${bookId}/status-history`),
    enabled: bookId > 0,
  });
}

export interface TrashQueryParams {
  page?: number;
  page_size?: number;
  sort?: string;
  q?: string;
}

export function useTrash(params?: TrashQueryParams) {
  return useQuery({
    queryKey: ['trash', params],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.page) sp.set('page', String(params.page));
      if (params?.page_size) sp.set('page_size', String(params.page_size));
      if (params?.sort) sp.set('sort', params.sort);
      if (params?.q) sp.set('q', params.q);
      const qs = sp.toString();
      return api.getBody<PaginatedBooks>(`/trash${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useRestoreBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookId: number) =>
      api.post<{ id: number; restored: boolean }>(`/trash/${bookId}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function usePermanentDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookId: number) =>
      api.delete<{ id: number; deleted: boolean }>(`/trash/${bookId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useEmptyTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ affected: number }>('/trash'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}
