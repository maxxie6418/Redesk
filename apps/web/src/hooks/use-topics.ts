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
  cfi: string | null;
  book_id: number;
  book_title: string | null;
}

export interface TopicSegment {
  id: number;
  topic_id: number;
  book_id: number;
  cfi_start: string;
  cfi_end: string;
  label: string | null;
  added_at: string;
  book_title?: string | null;
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
  segments: TopicSegment[];
  entries: TopicEntry[];
}

function invalidateTopicQueries(qc: ReturnType<typeof useQueryClient>, topicId?: number) {
  qc.invalidateQueries({ queryKey: ['topics'] });
  if (topicId) {
    qc.invalidateQueries({ queryKey: ['topics', topicId] });
  }
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
    onSuccess: (data) => {
      invalidateTopicQueries(qc, data.id);
    },
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; description?: string }) =>
      api.patch<TopicItem>(`/topics/${id}`, input),
    onSuccess: (data) => {
      invalidateTopicQueries(qc, data.id);
    },
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ id: number; deleted: boolean }>(`/topics/${id}`),
    onSuccess: () => {
      invalidateTopicQueries(qc);
    },
  });
}

export function useAddTopicBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, bookId }: { topicId: number; bookId: number }) =>
      api.post<{ added: boolean }>(`/topics/${topicId}/books`, { book_id: bookId }),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useRemoveTopicBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, bookId }: { topicId: number; bookId: number }) =>
      api.delete<{ removed: boolean }>(`/topics/${topicId}/books/${bookId}`),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useAddTopicHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, highlightId }: { topicId: number; highlightId: number }) =>
      api.post<{ added: boolean }>(`/topics/${topicId}/highlights`, { highlight_id: highlightId }),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useRemoveTopicHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, highlightId }: { topicId: number; highlightId: number }) =>
      api.delete<{ removed: boolean }>(`/topics/${topicId}/highlights/${highlightId}`),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useAddTopicNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, noteId }: { topicId: number; noteId: number }) =>
      api.post<{ added: boolean }>(`/topics/${topicId}/notes`, { note_id: noteId }),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useRemoveTopicNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, noteId }: { topicId: number; noteId: number }) =>
      api.delete<{ removed: boolean }>(`/topics/${topicId}/notes/${noteId}`),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useCreateTopicSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      topicId,
      ...input
    }: {
      topicId: number;
      book_id: number;
      cfi_start: string;
      cfi_end: string;
      label?: string | null;
    }) => api.post<TopicSegment>(`/topics/${topicId}/segments`, input),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useUpdateTopicSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      topicId,
      segmentId,
      ...input
    }: {
      topicId: number;
      segmentId: number;
      cfi_start?: string;
      cfi_end?: string;
      label?: string | null;
    }) => api.patch<TopicSegment>(`/topics/${topicId}/segments/${segmentId}`, input),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useDeleteTopicSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, segmentId }: { topicId: number; segmentId: number }) =>
      api.delete<{ removed: boolean }>(`/topics/${topicId}/segments/${segmentId}`),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useCreateTopicEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, ...input }: { topicId: number; entry_type: string; content: string }) =>
      api.post<TopicEntry>(`/topics/${topicId}/entries`, input),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useUpdateTopicEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, entryId, ...input }: { topicId: number; entryId: number; content?: string }) =>
      api.patch<TopicEntry>(`/topics/${topicId}/entries/${entryId}`, input),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}

export function useDeleteTopicEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, entryId }: { topicId: number; entryId: number }) =>
      api.delete<{ id: number; deleted: boolean }>(`/topics/${topicId}/entries/${entryId}`),
    onSuccess: (_data, vars) => {
      invalidateTopicQueries(qc, vars.topicId);
    },
  });
}
