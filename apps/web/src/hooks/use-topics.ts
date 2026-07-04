import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TopicBook {
  topic_id: number;
  book_id: number;
  added_at: string;
  title: string;
  author: string | null;
  cover_path: string | null;
}

export interface TopicHighlight {
  topic_id: number;
  highlight_id: number;
  added_at: string;
  text: string;
  cfi_start: string;
  cfi_end: string;
  color: string | null;
  note: string | null;
  book_id: number;
  book_title: string | null;
}

export interface TopicNote {
  topic_id: number;
  note_id: number;
  added_at: string;
  title: string | null;
  content_markdown: string | null;
  book_id: number;
  book_title: string | null;
}

export interface TopicEntry {
  id: number;
  topic_id: number;
  entry_type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TopicItem {
  id: number;
  owner_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  book_count: number;
  entry_count: number;
}

export interface TopicDetail extends TopicItem {
  books: TopicBook[];
  highlights: TopicHighlight[];
  notes: TopicNote[];
  entries: TopicEntry[];
}

export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: () => api.get<TopicItem[]>('/topics'),
  });
}

export function useTopic(id: number) {
  return useQuery({
    queryKey: ['topics', id],
    queryFn: () => api.get<TopicDetail>(`/topics/${id}`),
    enabled: id > 0,
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      api.post<TopicItem>('/topics', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; description?: string }) =>
      api.patch<TopicItem>(`/topics/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ id: number; deleted: boolean }>(`/topics/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

export function useAddTopicBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, bookId }: { topicId: number; bookId: number }) =>
      api.post<{ added: boolean }>(`/topics/${topicId}/books`, { book_id: bookId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

export function useRemoveTopicBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, bookId }: { topicId: number; bookId: number }) =>
      api.delete<{ removed: boolean }>(`/topics/${topicId}/books/${bookId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

export function useCreateTopicEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, ...input }: { topicId: number; entry_type: string; content: string }) =>
      api.post<TopicEntry>(`/topics/${topicId}/entries`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

export function useUpdateTopicEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, entryId, ...input }: { topicId: number; entryId: number; content?: string }) =>
      api.patch<TopicEntry>(`/topics/${topicId}/entries/${entryId}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

export function useDeleteTopicEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, entryId }: { topicId: number; entryId: number }) =>
      api.delete<{ id: number; deleted: boolean }>(`/topics/${topicId}/entries/${entryId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}
