import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { toast } from 'sonner';
import { api, API_BASE } from '@/lib/api';
import type { MarkType } from '@/components/highlight-toolbar';
import type { HighlightItem } from '@/hooks/use-notes';
import type { ReadingProgressData } from './reading-progress-sync';
import type { ReaderSelectionState } from './use-reader-highlight-actions';
import type { TocItem } from './components';

interface EpubContents {
  document: Document;
  cfiFromRange: (range: Range) => string;
}

interface EpubRendition {
  location?: { start?: { cfi?: string } };
  annotations: {
    clear: () => void;
    underline: (cfi: string, data: object, callback: (event: { stopPropagation: () => void; target: EventTarget | null }) => void, className: string, styles: Record<string, string>) => void;
    highlight: (cfi: string, data: object, callback: (event: { stopPropagation: () => void; target: EventTarget | null }) => void, className: string, styles: Record<string, string>) => void;
  };
  hooks: {
    content: {
      register: (callback: (contents: EpubContents) => void) => void;
    };
  };
  themes: {
    override: (prop: string, value: string) => void;
    font: (family: string) => void;
    register: (name: string, styles: object) => void;
    select: (name: string) => void;
  };
  currentLocation: () => EpubLocation | null;
  display: (target?: string) => Promise<unknown>;
  prev: () => void;
  next: () => void;
  on: (event: 'relocated', callback: (location: EpubLocation) => void) => void;
  destroy: () => void;
}

interface EpubBook {
  renderTo: (element: HTMLElement, options: { width: string; height: string; flow: string; spread: string }) => EpubRendition;
  ready: Promise<unknown>;
  navigation: { toc: { label: string; href: string }[] };
  loaded: { metadata: Promise<{ title?: string; language?: string }> };
  search: (query: string) => Promise<{ cfi: string; excerpt: string }[]>;
  destroy: () => void;
}

interface EpubLocation {
  start?: {
    cfi?: string;
    href?: string;
    displayed?: {
      page?: number;
      total?: number;
    };
  };
}

interface UseEpubReaderOptions {
  bookId: number;
  bookTitle: string;
  primaryEpubId: number | undefined;
  initialCfi: string | null;
  highlightsMapRef: MutableRefObject<Map<string, HighlightItem>>;
  saveProgress: (cfi: string, percentage: number) => void;
  setSelection: (value: ReaderSelectionState | null) => void;
  setActiveMarkType: (value: MarkType) => void;
  setSelectionHighlightId: (value: number | null) => void;
  setCommentMode: (value: boolean) => void;
  setCommentTargetHighlightId: (value: number | null) => void;
}

function ignoreError(error: unknown) {
  void error;
}

export function useEpubReader({
  bookId,
  bookTitle,
  primaryEpubId,
  initialCfi,
  highlightsMapRef,
  saveProgress,
  setSelection,
  setActiveMarkType,
  setSelectionHighlightId,
  setCommentMode,
  setCommentTargetHighlightId,
}: UseEpubReaderOptions) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const currentCfiRef = useRef<string>('');
  const initialCfiRef = useRef<string | null>(initialCfi);

  const [toc, setToc] = useState<TocItem[]>([]);
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [epubLang, setEpubLang] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCurrentCfi = useCallback(() => renditionRef.current?.location?.start?.cfi ?? currentCfiRef.current, []);
  const getRendition = useCallback(() => renditionRef.current, []);
  const getBookRef = useCallback(() => bookRef.current, []);
  const goPrev = useCallback(() => renditionRef.current?.prev(), []);
  const goNext = useCallback(() => renditionRef.current?.next(), []);
  const goToHref = useCallback((href: string) => {
    renditionRef.current?.display(href);
  }, []);

  useEffect(() => {
    if (!primaryEpubId || !viewerRef.current) return;

    const url = `${API_BASE}/books/${bookId}/files/${primaryEpubId}/download`;
    let cancelled = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    const loadBook = async () => {
      try {
        setLoading(true);
        setError(null);
        setToc([]);
        setCurrentTitle(bookTitle);

        const epubModule = await import('epubjs');
        if (cancelled || !viewerRef.current) return;
        const epubBook = epubModule.default(url, { openAs: 'epub' }) as unknown as EpubBook;
        bookRef.current = epubBook;

        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'auto',
        });
        renditionRef.current = rendition;

        rendition.hooks.content.register((contents: EpubContents) => {
          contents.document.addEventListener('mouseup', () => {
            if (cancelled) return;
            setTimeout(() => {
              if (cancelled) return;
              const sel = contents.document.getSelection();
              if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) {
                setSelection(null);
                setSelectionHighlightId(null);
                return;
              }
              const range = sel.getRangeAt(0);
              const rawRect = range.getBoundingClientRect();
              if (rawRect.width === 0 && rawRect.height === 0) {
                setSelection(null);
                setSelectionHighlightId(null);
                return;
              }

              let iframeEl: HTMLIFrameElement | null = null;
              try {
                iframeEl = (contents.document.defaultView?.frameElement as HTMLIFrameElement) ?? null;
              } catch (selectionError) {
                ignoreError(selectionError);
              }
              if (!iframeEl && viewerRef.current) {
                iframeEl = viewerRef.current.querySelector('iframe');
              }
              const iframeRect = iframeEl?.getBoundingClientRect();
              const offsetX = iframeRect?.left ?? 0;
              const offsetY = iframeRect?.top ?? 0;

              const rect = {
                left: rawRect.left + offsetX,
                top: rawRect.top + offsetY,
                right: rawRect.right + offsetX,
                bottom: rawRect.bottom + offsetY,
                width: rawRect.width,
                height: rawRect.height,
                x: rawRect.x + offsetX,
                y: rawRect.y + offsetY,
              } as DOMRect;

              let cfiStr = '';
              try {
                cfiStr = contents.cfiFromRange(range);
              } catch {
                setSelection(null);
                setSelectionHighlightId(null);
                return;
              }

              if (cfiStr) {
                let foundType: MarkType = null;
                let foundHighlightId: number | null = null;
                for (const [, item] of highlightsMapRef.current) {
                  if (cfiStr.includes(item.cfi_start) || item.cfi_start.includes(cfiStr)) {
                    foundType = item.type as MarkType;
                    foundHighlightId = item.id;
                    break;
                  }
                }
                setActiveMarkType(foundType);
                setSelectionHighlightId(foundHighlightId);
                setCommentMode(false);
                setCommentTargetHighlightId(null);
                setSelection({
                  rect,
                  cfi: cfiStr,
                  text: sel.toString().trim(),
                });
              }
            }, 10);
          });
        });

        epubBook.ready
          .then(() => {
            if (cancelled) return;
            const tocData = epubBook.navigation.toc.map((item: { label: string; href: string }, index: number) => ({
              id: String(index),
              label: item.label,
              href: item.href,
            }));
            setToc(tocData);

            api
              .get<ReadingProgressData | null>(`/books/${bookId}/reading-progress`)
              .then((saved) => {
                if (cancelled) return;
                const targetCfi = initialCfiRef.current;
                if (targetCfi) {
                  rendition.display(targetCfi).catch(() => {
                    toast('未能定位到原文位置，已跳转至最近阅读位置');
                    if (saved && saved.file_id === primaryEpubId && saved.cfi) {
                      rendition.display(saved.cfi).catch((displayError: unknown) => ignoreError(displayError));
                    }
                  });
                } else if (saved && saved.file_id === primaryEpubId && saved.cfi) {
                  rendition.display(saved.cfi).catch((displayError: unknown) => ignoreError(displayError));
                }
              })
              .catch((progressError) => ignoreError(progressError))
              .finally(() => {
                if (!cancelled) setLoading(false);
              });
          })
          .catch((readyError: unknown) => {
            if (cancelled) return;
            setError(readyError instanceof Error ? readyError.message : '加载失败');
            setLoading(false);
          });

        epubBook.loaded.metadata
          .then((meta: { title?: string; language?: string }) => {
            if (cancelled) return;
            if (meta?.title) setCurrentTitle(meta.title);
            if (meta?.language) setEpubLang(meta.language);
          })
          .catch((metadataError: unknown) => ignoreError(metadataError));

        rendition.on('relocated', (location: EpubLocation) => {
          if (cancelled) return;
          if (location?.start?.cfi) {
            currentCfiRef.current = location.start.cfi;
          }
          if (location?.start?.displayed?.page) {
            setCurrentPage(location.start.displayed.page);
          }
          if (location?.start?.displayed?.total) {
            setTotalPages(location.start.displayed.total);
          }

          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            if (cancelled) return;
            const cfi = location?.start?.cfi;
            const total = location?.start?.displayed?.total ?? 1;
            const page = location?.start?.displayed?.page ?? 0;
            const percentage = total > 0 ? Math.round((page / total) * 100) : 0;
            if (cfi) saveProgress(cfi, percentage);
          }, 2000);
        });

        Promise.resolve(rendition.display()).catch((displayError: unknown) => {
          if (cancelled) return;
          setError(displayError instanceof Error ? displayError.message : '加载失败');
          setLoading(false);
        });
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '加载失败');
        setLoading(false);
      }
    };

    void loadBook();

    return () => {
      cancelled = true;
      if (saveTimer) clearTimeout(saveTimer);
      if (renditionRef.current) {
        try {
          renditionRef.current.destroy();
        } catch (renditionError) {
          ignoreError(renditionError);
        }
        renditionRef.current = null;
      }
      if (bookRef.current) {
        try {
          bookRef.current.destroy();
        } catch (bookError) {
          ignoreError(bookError);
        }
        bookRef.current = null;
      }
    };
  }, [bookId, bookTitle, highlightsMapRef, primaryEpubId, saveProgress, setActiveMarkType, setCommentMode, setCommentTargetHighlightId, setSelection, setSelectionHighlightId]);

  return {
    viewerRef,
    toc,
    currentTitle,
    currentPage,
    totalPages,
    epubLang,
    loading,
    error,
    getCurrentCfi,
    getRendition,
    getBookRef,
    goPrev,
    goNext,
    goToHref,
  };
}
