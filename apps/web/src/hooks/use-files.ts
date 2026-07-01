import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BookFileItem {
  id: number;
  owner_id: number;
  book_id: number | null;
  file_path: string;
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
    mutationFn: async ({ bookId, file, isPrimary }: { bookId: number; file: File; isPrimary?: boolean }) => {
      const form = new FormData();
      form.append('file', file);
      if (isPrimary) form.append('is_primary', 'true');

      const res = await fetch(`/api/v1/books/${bookId}/files`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = (body as { error?: { message?: string } } | null)?.error;
        throw new Error(err?.message ?? '上传失败');
      }

      return (await res.json()) as { data: { id: number; file_format: string } };
    },
    onSuccess: (_data: { data: { id: number; file_format: string } }, vars: { bookId: number; file: File; isPrimary?: boolean }) => {
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

      const res = await fetch(`/api/v1/books/${bookId}/files/${fileId}/replace`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = (body as { error?: { message?: string } } | null)?.error;
        throw new Error(err?.message ?? '替换失败');
      }

      return (await res.json()) as { data: { id: number; file_format: string } };
    },
    onSuccess: (_data: { data: { id: number; file_format: string } }, vars: { bookId: number; fileId: number; file: File }) => {
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
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/v1/files/unassociated', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = (body as { error?: { message?: string } } | null)?.error;
        throw new Error(err?.message ?? '上传失败');
      }

      return (await res.json()) as { data: { id: number; file_format: string } };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unassociated-files'] });
      qc.invalidateQueries({ queryKey: ['file-library'] });
    },
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
