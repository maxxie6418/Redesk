import { useCallback } from 'react';
import type { BookmarkItem, HighlightItem } from '@/hooks/use-notes';
import type { MarkType } from '@/components/highlight-toolbar';

export interface ReaderSelectionState {
  rect: DOMRect;
  cfi: string;
  text: string;
}

interface MutationOptions<TData, TInput> {
  onSuccess?: (data: TData, variables: TInput) => void;
}

interface Mutation<TInput, TData = unknown> {
  mutate: (input: TInput, options?: MutationOptions<TData, TInput>) => void;
}

interface UseReaderHighlightActionsOptions {
  bookId: number;
  primaryEpubId: number | undefined;
  selection: ReaderSelectionState | null;
  selectionHighlightId: number | null;
  commentTargetHighlightId: number | null;
  bookmarks: BookmarkItem[] | undefined;
  highlightsMap: Map<string, HighlightItem>;
  createHighlight: Mutation<{
    book_id: number;
    cfi_start: string;
    cfi_end: string;
    text: string;
    type?: string;
    color?: string;
    note?: string;
    mark_type?: string;
  }, HighlightItem>;
  updateHighlight: Mutation<{
    id: number;
    cfi_start?: string;
    cfi_end?: string;
    text?: string;
    type?: string;
    color?: string;
    note?: string;
    mark_type?: string;
  }, HighlightItem>;
  deleteHighlight: Mutation<number, { id: number; deleted: boolean }>;
  createBookmark: Mutation<{
    book_id: number;
    cfi: string;
    label?: string | null;
    percentage?: number | null;
  }, BookmarkItem>;
  deleteBookmark: Mutation<number, { id: number; deleted: boolean }>;
  setSelection: (value: ReaderSelectionState | null) => void;
  setCommentMode: (value: boolean) => void;
  setCommentTargetHighlightId: (value: number | null) => void;
  setActiveMarkType: (value: MarkType) => void;
  setSelectionHighlightId: (value: number | null) => void;
  setEditing: (value: null) => void;
}

export function useReaderHighlightActions({
  bookId,
  primaryEpubId,
  selection,
  selectionHighlightId,
  commentTargetHighlightId,
  bookmarks,
  highlightsMap,
  createHighlight,
  updateHighlight,
  deleteHighlight,
  createBookmark,
  deleteBookmark,
  setSelection,
  setCommentMode,
  setCommentTargetHighlightId,
  setActiveMarkType,
  setSelectionHighlightId,
  setEditing,
}: UseReaderHighlightActionsOptions) {
  const handleDismissSelection = useCallback(() => {
    setSelection(null);
    setCommentMode(false);
    setCommentTargetHighlightId(null);
    setActiveMarkType(null);
    setSelectionHighlightId(null);
  }, [setActiveMarkType, setCommentMode, setCommentTargetHighlightId, setSelection, setSelectionHighlightId]);

  const createMark = (type: 'HIGHLIGHT' | 'UNDERLINE' | 'WAVY', color: string) => {
    if (!selection || !primaryEpubId) return;
    createHighlight.mutate({
      book_id: bookId,
      cfi_start: selection.cfi,
      cfi_end: selection.cfi,
      text: selection.text,
      type,
      color,
    });
    setSelection(null);
    setSelectionHighlightId(null);
  };

  const handleCreateHighlight = () => createMark('HIGHLIGHT', '#fde047');
  const handleCreateUnderline = () => createMark('UNDERLINE', '#3b82f6');
  const handleCreateWavy = () => createMark('WAVY', '#dc2626');

  const handleClearMark = () => {
    if (selectionHighlightId == null) return;
    deleteHighlight.mutate(selectionHighlightId);
    handleDismissSelection();
  };

  const handleBookmark = () => {
    if (!selection || !primaryEpubId) return;
    const cfi = selection.cfi;
    const existing = bookmarks?.find((bookmark) => bookmark.cfi === cfi);
    if (existing) {
      deleteBookmark.mutate(existing.id);
    } else {
      createBookmark.mutate({
        book_id: bookId,
        cfi,
        label: selection.text.slice(0, 50) || null,
        percentage: null,
      });
    }
    setSelection(null);
    setSelectionHighlightId(null);
  };

  const handleOpenComment = () => {
    if (!selection || !primaryEpubId) return;
    let targetId: number | null = null;
    for (const [, item] of highlightsMap) {
      if (selection.cfi.includes(item.cfi_start) || item.cfi_start.includes(selection.cfi)) {
        targetId = item.id;
        break;
      }
    }
    setCommentTargetHighlightId(targetId);
    setCommentMode(true);
  };

  const handleCommentSave = (content: string) => {
    if (commentTargetHighlightId) {
      updateHighlight.mutate({
        id: commentTargetHighlightId,
        note: content,
      });
      setCommentMode(false);
      setCommentTargetHighlightId(null);
      setEditing(null);
      return;
    }

    if (!selection || !primaryEpubId) return;
    const cfi = selection.cfi;
    const text = selection.text;

    createHighlight.mutate(
      {
        book_id: bookId,
        cfi_start: cfi,
        cfi_end: cfi,
        text,
        type: 'HIGHLIGHT',
        color: '#fde047',
      },
      {
        onSuccess: (created) => {
          if (created.id) {
            updateHighlight.mutate({
              id: created.id,
              note: content,
            });
          }
        },
      },
    );
    setCommentMode(false);
    setCommentTargetHighlightId(null);
    setSelection(null);
  };

  const handleCommentCancel = () => {
    setCommentMode(false);
    setCommentTargetHighlightId(null);
  };

  return {
    handleCreateHighlight,
    handleCreateUnderline,
    handleCreateWavy,
    handleClearMark,
    handleBookmark,
    handleOpenComment,
    handleCommentSave,
    handleCommentCancel,
    handleDismissSelection,
  };
}
