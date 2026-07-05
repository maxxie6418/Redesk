import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface HighlightItem {
  id: number;
  book_id: number;
  owner_id: number;
  cfi_start: string;
  cfi_end: string;
  text: string;
  type: string;
  color: string | null;
  note: string | null;
  mark_type: string;
  created_at: string;
  updated_at: string;
  book_title: string | null;
  book_author: string | null;
  book_cover_path: string | null;
}

export interface NoteItem {
  id: number;
  book_id: number;
  owner_id: number;
  cfi: string | null;
  title: string | null;
  content_html: string | null;
  content_markdown: string | null;
  mark_type: string;
  created_at: string;
  updated_at: string;
  book_title: string | null;
  book_author: string | null;
  book_cover_path: string | null;
}

export interface ReadingMarkStats {
  total_highlights: number;
  total_notes: number;
  notes_this_month: number;
  annotated: number;
}

export function useHighlights(bookId?: number) {
  return useQuery({
    queryKey: ['highlights', { bookId }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (bookId) params.set('book_id', String(bookId));
      return api.get<HighlightItem[]>(`/highlights?${params.toString()}`);
    },
  });
}

export function useCreateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      book_id: number;
      cfi_start: string;
      cfi_end: string;
      text: string;
      type?: string;
      color?: string;
      note?: string;
      mark_type?: string;
    }) => api.post<HighlightItem>('/highlights', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['highlights'] });
      qc.invalidateQueries({ queryKey: ['reading-marks-stats'] });
    },
  });
}

export function useUpdateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; cfi_start?: string; cfi_end?: string; text?: string; type?: string; color?: string; note?: string; mark_type?: string }) =>
      api.patch<HighlightItem>(`/highlights/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['highlights'] });
    },
  });
}

export function useDeleteHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ id: number; deleted: boolean }>(`/highlights/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['highlights'] });
      qc.invalidateQueries({ queryKey: ['reading-marks-stats'] });
    },
  });
}

export function useNotes(bookId?: number) {
  return useQuery({
    queryKey: ['notes', { bookId }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (bookId) params.set('book_id', String(bookId));
      return api.get<NoteItem[]>(`/notes?${params.toString()}`);
    },
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      book_id: number;
      cfi?: string;
      title?: string;
      content_html?: string;
      content_markdown?: string;
      mark_type?: string;
    }) => api.post<NoteItem>('/notes', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['reading-marks-stats'] });
    },
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; cfi?: string; title?: string; content_html?: string; content_markdown?: string; mark_type?: string }) =>
      api.patch<NoteItem>(`/notes/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ id: number; deleted: boolean }>(`/notes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['reading-marks-stats'] });
    },
  });
}

export function useReadingMarkStats() {
  return useQuery({
    queryKey: ['reading-marks-stats'],
    queryFn: () => api.get<ReadingMarkStats>('/reading-marks/stats'),
  });
}

export function useNotesSearch(q: string, bookId?: number) {
  return useQuery({
    queryKey: ['notes-search', { q, bookId }],
    queryFn: () => {
      const params = new URLSearchParams({ q });
      if (bookId) params.set('book_id', String(bookId));
      return api.get<NoteItem[]>(`/notes/search?${params.toString()}`);
    },
    enabled: q.trim().length > 0,
  });
}

export function useHighlightsSearch(q: string, bookId?: number) {
  return useQuery({
    queryKey: ['highlights-search', { q, bookId }],
    queryFn: () => {
      const params = new URLSearchParams({ q });
      if (bookId) params.set('book_id', String(bookId));
      return api.get<HighlightItem[]>(`/highlights/search?${params.toString()}`);
    },
    enabled: q.trim().length > 0,
  });
}
