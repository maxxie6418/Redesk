import { useCallback, useEffect, useRef } from 'react';
import type { HighlightItem } from '@/hooks/use-notes';
import type { EditingHighlight } from './components';

interface AnnotationEvent {
  stopPropagation: () => void;
  target: EventTarget | null;
}

interface ReaderAnnotations {
  clear: () => void;
  underline: (cfi: string, data: object, callback: (event: AnnotationEvent) => void, className: string, styles: Record<string, string>) => void;
  highlight: (cfi: string, data: object, callback: (event: AnnotationEvent) => void, className: string, styles: Record<string, string>) => void;
}

interface HighlightRendition {
  annotations: ReaderAnnotations;
}

interface HighlightsQuery {
  data?: HighlightItem[];
  refetch: () => Promise<unknown>;
}

interface MutationStatus {
  isSuccess: boolean;
}

interface UseReaderHighlightRendererOptions {
  loading: boolean;
  highlights: HighlightsQuery;
  createHighlight: MutationStatus;
  updateHighlight: MutationStatus;
  deleteHighlight: MutationStatus;
  getRendition: () => HighlightRendition | null;
  setEditing: (value: EditingHighlight) => void;
}

function ignoreError(error: unknown) {
  void error;
}

function buildAnnotationClickHandler(item: HighlightItem, setEditing: (value: EditingHighlight) => void) {
  return (event: AnnotationEvent) => {
    event.stopPropagation();
    const rect = event.target instanceof HTMLElement ? event.target.getBoundingClientRect() : null;
    if (rect) {
      setEditing({
        id: item.id,
        note: item.note,
        markType: item.mark_type,
        position: { top: rect.bottom + 4, left: rect.left },
      });
    }
  };
}

export function useReaderHighlightRenderer({ loading, highlights, createHighlight, updateHighlight, deleteHighlight, getRendition, setEditing }: UseReaderHighlightRendererOptions) {
  const highlightsMapRef = useRef<Map<string, HighlightItem>>(new Map());
  const { data: highlightItems, refetch } = highlights;

  const renderHighlights = useCallback(() => {
    const rendition = getRendition();
    if (!rendition) return;
    const items = highlightItems ?? [];
    const map = new Map<string, HighlightItem>();

    try {
      rendition.annotations.clear();
    } catch (error) {
      ignoreError(error);
    }

    for (const item of items) {
      const key = `${item.cfi_start}:${item.cfi_end}`;
      map.set(key, item);

      const onClick = buildAnnotationClickHandler(item, setEditing);

      try {
        if (item.type === 'UNDERLINE') {
          rendition.annotations.underline(item.cfi_start, {}, onClick, '', { 'border-bottom': '2.2px solid rgba(59,130,246,0.75)' });
        } else if (item.type === 'WAVY') {
          rendition.annotations.highlight(item.cfi_start, {}, onClick, 'rd-wavy', {
            background: 'transparent',
            'text-decoration': 'underline wavy rgba(220,38,38,0.7)',
            'text-underline-offset': '3px',
          });
        } else {
          rendition.annotations.highlight(item.cfi_start, {}, onClick, '', { 'background-color': 'rgba(250,204,21,0.35)' });
        }
      } catch (error) {
        ignoreError(error);
      }
    }

    highlightsMapRef.current = map;
  }, [getRendition, highlightItems, setEditing]);

  useEffect(() => {
    if (!loading && highlightItems) {
      renderHighlights();
    }
  }, [loading, highlightItems, renderHighlights]);

  useEffect(() => {
    if (createHighlight.isSuccess) {
      refetch().then(() => {
        renderHighlights();
      });
    }
  }, [createHighlight.isSuccess, refetch, renderHighlights]);

  useEffect(() => {
    if (updateHighlight.isSuccess || deleteHighlight.isSuccess) {
      refetch().then(() => {
        renderHighlights();
      });
    }
  }, [deleteHighlight.isSuccess, refetch, renderHighlights, updateHighlight.isSuccess]);

  return { highlightsMapRef };
}
