import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE } from '@/lib/api';

export type StorageMode = 'local_only' | 'cloud_only' | 'dual';
export type SyncStatus = 'synced' | 'pending' | 'partial_failed' | 'failed';
export type MatchMode = 'conservative' | 'balanced' | 'loose';
export type MatchConfidence = 'high' | 'medium' | 'low';

export interface BookFileItem {
  id: number;
  owner_id: number;
  book_id: number | null;
  storage_mode: StorageMode;
  local_path: string | null;
  remote_key: string | null;
  primary_location: 'local' | 'cloud';
  sync_status: SyncStatus;
  original_filename: string | null;
  file_format: string;
  mime_type: string | null;
  file_size: number | null;
  checksum: string | null;
  is_primary: number;
  created_at: string;
  updated_at: string;
  book_title?: string | null;
}

export interface FileMatchDerived {
  filename_title: string | null;
  filename_author: string | null;
  normalized_filename: string;
  epub_title: string | null;
  epub_author: string | null;
  epub_publisher: string | null;
  epub_identifier: string | null;
}

export interface FileMatchCandidate {
  book_id: number;
  title: string;
  author: string | null;
  score: number;
  confidence: MatchConfidence;
  ambiguous: boolean;
  reason: string;
}

export interface FileMatchItem {
  file_id: number;
  original_filename: string | null;
  file_format: string;
  derived: FileMatchDerived;
  recommended_book_id: number | null;
  confidence: MatchConfidence;
  reason: string | null;
  candidates: FileMatchCandidate[];
}

export interface ApplyFileMatchesResult {
  applied: BookFileItem[];
  failed: Array<{ file_id: number; book_id: number; message: string }>;
  total: number;
  success_count: number;
  failed_count: number;
}

export interface BatchSendFilesToCloudResult {
  total: number;
  success_count: number;
  failed_count: number;
  synced: BookFileItem[];
  failed: Array<{ file_id: number; message: string }>;
}

export function useBookFiles(bookId: number) {
  return useQuery({
    queryKey: ['books', bookId, 'files'],
    queryFn: () => api.get<BookFileItem[]>(`/books/${bookId}/files`),
    enabled: bookId > 0,
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookId, file, isPrimary, storageMode }: { bookId: number; file: File; isPrimary?: boolean; storageMode?: StorageMode }) => {
      const form = new FormData();
      form.append('file', file);
      if (isPrimary) form.append('is_primary', 'true');
      if (storageMode) form.append('storage_mode', storageMode);

      const res = await fetch(`${API_BASE}/books/${bookId}/files`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = (body as { error?: { message?: string } } | null)?.error;
        throw new Error(err?.message ?? '上传失败');
      }

      return ((await res.json()) as { data: { id: number; file_format: string } }).data;
    },
    onSuccess: (_data: { id: number; file_format: string }, vars: { bookId: number; file: File; isPrimary?: boolean }) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'files'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useReplaceFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookId, fileId, file }: { bookId: number; fileId: number; file: File }) => {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(`${API_BASE}/books/${bookId}/files/${fileId}/replace`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = (body as { error?: { message?: string } } | null)?.error;
        throw new Error(err?.message ?? '替换失败');
      }

      return ((await res.json()) as { data: { id: number; file_format: string } }).data;
    },
    onSuccess: (_data: { id: number; file_format: string }, vars: { bookId: number; fileId: number; file: File }) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'files'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useUpdateFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, fileId, ...input }: { bookId: number; fileId: number; is_primary?: boolean; original_filename?: string }) =>
      api.patch<BookFileItem>(`/books/${bookId}/files/${fileId}`, input),
    onSuccess: (_data: BookFileItem, vars: { bookId: number; fileId: number; is_primary?: boolean; original_filename?: string }) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'files'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, fileId }: { bookId: number; fileId: number }) =>
      api.delete<{ id: number; deleted: boolean }>(`/books/${bookId}/files/${fileId}`),
    onSuccess: (_data: { id: number; deleted: boolean }, vars: { bookId: number; fileId: number }) => {
      qc.invalidateQueries({ queryKey: ['books', vars.bookId, 'files'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export interface FileLibraryParams {
  page?: number;
  page_size?: number;
  format?: string;
  associated?: 'true' | 'false';
}

export interface PaginatedFiles {
  data: BookFileItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
  };
  summary?: {
    linked: number;
    unlinked: number;
    total_size: number;
  };
}

export function useFileLibrary(params?: FileLibraryParams) {
  return useQuery({
    queryKey: ['file-library', params],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.page) sp.set('page', String(params.page));
      if (params?.page_size) sp.set('page_size', String(params.page_size));
      if (params?.format) sp.set('format', params.format);
      if (params?.associated) sp.set('associated', params.associated);
      const qs = sp.toString();
      return api.getBody<PaginatedFiles>(`/files${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useUnassociatedFiles() {
  return useQuery({
    queryKey: ['unassociated-files'],
    queryFn: () => api.get<BookFileItem[]>('/files/unassociated'),
  });
}

export function useUploadUnassociatedFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, storageMode }: { file: File; storageMode?: StorageMode }) => {
      const form = new FormData();
      form.append('file', file);
      if (storageMode) form.append('storage_mode', storageMode);

      const res = await fetch(`${API_BASE}/files/unassociated`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = (body as { error?: { message?: string } } | null)?.error;
        throw new Error(err?.message ?? '上传失败');
      }

      return ((await res.json()) as { data: BookFileItem }).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unassociated-files'] });
      qc.invalidateQueries({ queryKey: ['file-library'] });
    },
  });
}

export function useFileMatchCandidates(fileIds: number[], mode: MatchMode, enabled: boolean) {
  return useQuery({
    queryKey: ['file-match-candidates', fileIds, mode],
    queryFn: () => api.post<FileMatchItem[]>('/files/match/candidates', { file_ids: fileIds, mode }),
    enabled: enabled && fileIds.length > 0,
  });
}

export function useMatchFileToBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, bookId }: { fileId: number; bookId: number }) =>
      api.post<BookFileItem>(`/files/${fileId}/match`, { book_id: bookId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unassociated-files'] });
      qc.invalidateQueries({ queryKey: ['file-library'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useApplyFileMatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ fileId: number; bookId: number }>) =>
      api.post<ApplyFileMatchesResult>('/files/match/apply-batch', {
        items: items.map((item) => ({ file_id: item.fileId, book_id: item.bookId })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unassociated-files'] });
      qc.invalidateQueries({ queryKey: ['file-library'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}

export function useDeleteUnassociatedFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: number) =>
      api.delete<{ id: number; deleted: boolean }>(`/files/unassociated/${fileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unassociated-files'] });
      qc.invalidateQueries({ queryKey: ['file-library'] });
    },
  });
}

export function useBatchSendFilesToCloud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileIds: number[]) =>
      api.post<BatchSendFilesToCloudResult>('/files/batch/send-to-cloud', { ids: fileIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-library'] });
      qc.invalidateQueries({ queryKey: ['unassociated-files'] });
      qc.invalidateQueries({ queryKey: ['books'] });
    },
  });
}
