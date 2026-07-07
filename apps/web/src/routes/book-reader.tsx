/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { BubbleToolbar, type MarkType } from '@/components/highlight-toolbar';
import { CommentInput } from '@/components/reader/comment-input';
import { ImagePreviewViewer, PdfPreviewViewer, TextPreviewViewer, UnsupportedPreviewViewer } from '@/components/reader/preview-viewers';
import { toast } from 'sonner';
import type EpubFactory from 'epubjs';
import { useBookFiles, type BookFileItem } from '@/hooks/use-files';
import { useBook } from '@/hooks/use-books';
import { useHighlights, useCreateHighlight, useUpdateHighlight, useDeleteHighlight, useNotes, useCreateNote, useUpdateNote, useDeleteNote, useBookmarks, useCreateBookmark, useDeleteBookmark } from '@/hooks/use-notes';
import { useAddTopicHighlight } from '@/hooks/use-topics';
import { Button } from '@/components/ui/button';
import { AddToTopicDialog } from '@/components/add-to-topic-dialog';
import { api, API_BASE } from '@/lib/api';
import { normalizeFileFormat, selectReadableFile } from '@redesk/shared';
import { HighlightEditPopover, ReaderNotesPanel, ReaderTopBar, TocPanel, type EditingHighlight, type TocItem } from './book-reader/components';
import { useReadingProgressSync, type ReadingProgressData } from './book-reader/reading-progress-sync';
import { useReaderHighlightActions, type ReaderSelectionState } from './book-reader/use-reader-highlight-actions';
import { useReaderHighlightRenderer } from './book-reader/use-reader-highlight-renderer';
import { useReaderKeyboardNavigation } from './book-reader/use-reader-keyboard-navigation';
import { useReaderNotes } from './book-reader/use-reader-notes';

export function BookReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCfiRef = useRef<string | null>(searchParams.get('cfi'));

  const book = useBook(bookId);
  const files = useBookFiles(bookId);
  const highlights = useHighlights(bookId);
  const createHighlight = useCreateHighlight();
  const updateHighlight = useUpdateHighlight();
  const deleteHighlight = useDeleteHighlight();
  const bookNotes = useNotes(bookId);
  const addTopicHighlight = useAddTopicHighlight();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const bookmarks = useBookmarks(bookId);
  const createBookmark = useCreateBookmark();
  const deleteBookmark = useDeleteBookmark();

  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<ReturnType<typeof EpubFactory> | null>(null);
  const renditionRef = useRef<any>(null);
  const currentCfiRef = useRef<string>('');

  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<ReaderSelectionState | null>(null);
  const [activeMarkType, setActiveMarkType] = useState<MarkType>(null);
  const [selectionHighlightId, setSelectionHighlightId] = useState<number | null>(null);
  const [commentMode, setCommentMode] = useState(false);
  const [commentTargetHighlightId, setCommentTargetHighlightId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditingHighlight | null>(null);
  const [topicHighlightId, setTopicHighlightId] = useState<number | null>(null);


  const readableFile = selectReadableFile<BookFileItem>(files.data);
  const readableFileId = readableFile?.id;
  const readableFormat = normalizeFileFormat(readableFile?.file_format);
  const isEpub = readableFormat === 'EPUB';
  const primaryEpubId = isEpub ? readableFileId : undefined;
  const bookTitle = book.data?.title ?? '';
  const { saveProgress, syncMessage } = useReadingProgressSync({
    bookId,
    fileId: primaryEpubId,
  });
  const getCurrentCfi = useCallback(() => renditionRef.current?.location?.start?.cfi ?? currentCfiRef.current, []);
  const getHighlightRendition = useCallback(() => renditionRef.current, []);
  const { highlightsMapRef } = useReaderHighlightRenderer({
    loading,
    highlights,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    getRendition: getHighlightRendition,
    setEditing,
  });
  const {
    noteForm,
    editingNote,
    setNoteForm,
    setEditingNote,
    handleOpenNoteForm,
    handleSubmitNote,
    handleEditNote,
    handleSubmitEditNote,
    handleDeleteNote,
  } = useReaderNotes({
    bookId,
    getCurrentCfi,
    notesQuery: bookNotes,
    createNote,
    updateNote,
    deleteNote,
  });
  const {
    handleCreateHighlight,
    handleCreateUnderline,
    handleCreateWavy,
    handleClearMark,
    handleBookmark,
    handleOpenComment,
    handleCommentSave,
    handleCommentCancel,
    handleDismissSelection,
  } = useReaderHighlightActions({
    bookId,
    primaryEpubId,
    selection,
    selectionHighlightId,
    commentTargetHighlightId,
    bookmarks: bookmarks.data,
    highlightsMap: highlightsMapRef.current,
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
  });

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
      const epubBook = epubModule.default(url, { openAs: 'epub' });
      bookRef.current = epubBook;

      const rendition = epubBook.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'auto',
      });
      renditionRef.current = rendition;

      // 选区检测
      rendition.hooks.content.register((contents: any) => {
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

            // 获取 iframe 在主窗口中的偏移量
            // 优先用 frameElement，失败时从 viewerRef 中查询 iframe
            let iframeEl: HTMLIFrameElement | null = null;
            try {
              iframeEl = (contents.document.defaultView?.frameElement as HTMLIFrameElement) ?? null;
            } catch {
              // 跨域或 sandbox 限制时 frameElement 会抛异常
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
              // 检查选区是否覆盖已有痕迹
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
          const tocData = epubBook.navigation.toc.map((item: any, index: number) => ({
            id: String(index),
            label: item.label,
            href: item.href,
          }));
          setToc(tocData);

          api
            .get<ReadingProgressData | null>(`/books/${bookId}/reading-progress`)
            .then((saved) => {
              if (cancelled) return;
              // 优先使用 ?cfi= 查询参数定位（从笔记/高亮跳回）
              const targetCfi = initialCfiRef.current;
              if (targetCfi) {
                rendition.display(targetCfi).catch(() => {
                  toast('未能定位到原文位置，已跳转至最近阅读位置');
                  // CFI 失效，降级到已保存进度或首页
                  if (saved && saved.file_id === primaryEpubId && saved.cfi) {
                    rendition.display(saved.cfi).catch(() => {});
                  }
                });
              } else if (saved && saved.file_id === primaryEpubId && saved.cfi) {
                rendition.display(saved.cfi).catch(() => {});
              }
            })
            .catch(() => {})
            .finally(() => {
              if (!cancelled) setLoading(false);
            });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : '加载失败');
          setLoading(false);
        });

      epubBook.loaded.metadata
        .then((meta: any) => {
          if (cancelled) return;
          if (meta?.title) setCurrentTitle(meta.title);
        })
        .catch(() => undefined);

      rendition.on('relocated', (location: any) => {
        if (cancelled) return;
        // 记录当前 CFI 用于笔记创建
        if (location?.start?.cfi) {
          currentCfiRef.current = location.start.cfi;
        }
        if (location?.start?.displayed?.page) {
          const page = location.start.displayed.page;
          const total = location.start.displayed.total;
          setCurrentTitle(`${bookTitle} · ${page} / ${total}`);
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

      Promise.resolve(rendition.display()).catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载失败');
        setLoading(false);
      });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载失败');
        setLoading(false);
      }
    };

    void loadBook();

    return () => {
      cancelled = true;
      if (saveTimer) clearTimeout(saveTimer);
      if (renditionRef.current) {
        try { renditionRef.current.destroy(); } catch { /* ignore */ }
        renditionRef.current = null;
      }
      if (bookRef.current) {
        try { bookRef.current.destroy(); } catch { /* ignore */ }
        bookRef.current = null;
      }
    };
  }, [bookId, bookTitle, highlightsMapRef, primaryEpubId, saveProgress]);

  const toggleToc = () => {
    setTocOpen(!tocOpen);
    setNotesPanelOpen(false);
  };

  const toggleNotesPanel = () => {
    setNotesPanelOpen(!notesPanelOpen);
    setTocOpen(false);
  };

  const goPrev = () => renditionRef.current?.prev();
  const goNext = () => renditionRef.current?.next();
  const goToHref = (href: string) => {
    renditionRef.current?.display(href);
    setTocOpen(false);
  };

  const getKeyboardRendition = useCallback(() => renditionRef.current, []);
  useReaderKeyboardNavigation({ activeKey: primaryEpubId, getRendition: getKeyboardRendition });

  if (book.isLoading || files.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!readableFile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">没有可在线预览的主阅读文件</p>
        <Button variant="outline" onClick={() => navigate(`/books/${bookId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回详情
        </Button>
      </div>
    );
  }

  if (!isEpub) {
    const previewUrl = `${API_BASE}/books/${bookId}/files/${readableFile.id}/download`;
    const title = book.data?.title ?? readableFile.original_filename ?? '文件预览';
    let viewer = <UnsupportedPreviewViewer url={previewUrl} format={readableFormat} />;

    if (readableFormat === 'PDF') {
      viewer = <PdfPreviewViewer url={previewUrl} title={title} format={readableFormat} filename={readableFile.original_filename} />;
    } else if (readableFormat === 'TXT' || readableFormat === 'MD' || readableFormat === 'MARKDOWN') {
      viewer = <TextPreviewViewer url={previewUrl} title={title} format={readableFormat} filename={readableFile.original_filename} />;
    } else if (readableFormat === 'JPG' || readableFormat === 'JPEG' || readableFormat === 'PNG') {
      viewer = <ImagePreviewViewer url={previewUrl} title={title} format={readableFormat} filename={readableFile.original_filename} />;
    }

    return (
      <div className="flex h-screen flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/books/${bookId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{title}</div>
            <div className="truncate text-xs text-muted-foreground">{readableFile.original_filename ?? readableFormat}</div>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{viewer}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => navigate(`/books/${bookId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回详情
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <ReaderTopBar
        title={currentTitle || book.data?.title}
        syncMessage={syncMessage}
        onBack={() => navigate(`/books/${bookId}`)}
        onToggleToc={toggleToc}
        onToggleNotes={toggleNotesPanel}
        onPrev={goPrev}
        onNext={goNext}
      />

      <div className="relative flex-1 overflow-hidden">
        {tocOpen && <TocPanel toc={toc} onClose={() => setTocOpen(false)} onOpenItem={goToHref} />}

        {notesPanelOpen && (
          <ReaderNotesPanel
            notes={bookNotes.data ?? []}
            isLoading={bookNotes.isLoading}
            noteForm={noteForm}
            editingNote={editingNote}
            onClose={() => setNotesPanelOpen(false)}
            onOpenNoteForm={handleOpenNoteForm}
            onChangeNoteForm={setNoteForm}
            onSubmitNote={handleSubmitNote}
            onEditNote={handleEditNote}
            onChangeEditingNote={setEditingNote}
            onSubmitEditNote={handleSubmitEditNote}
            onDeleteNote={handleDeleteNote}
          />
        )}

        <div ref={viewerRef} className="h-full w-full" />

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* 新选区气泡工具条 */}
      <BubbleToolbar
        rect={selection?.rect ?? null}
        visible={selection !== null && !commentMode}
        activeType={activeMarkType}
        hasBookmark={bookmarks.data?.some((b) => b.cfi === selection?.cfi)}
        showClear={selectionHighlightId != null}
        onHighlight={handleCreateHighlight}
        onUnderline={handleCreateUnderline}
        onWavy={handleCreateWavy}
        onBookmark={handleBookmark}
        onComment={handleOpenComment}
        onClear={handleClearMark}
        onDismiss={handleDismissSelection}
      />

      {/* 评论迷你输入 */}
      <CommentInput
        rect={selection?.rect ?? null}
        visible={commentMode}
        onSave={handleCommentSave}
        onCancel={handleCommentCancel}
      />

      {/* 已有高亮编辑态气泡 */}
      <AddToTopicDialog
        open={topicHighlightId !== null}
        title="将高亮加入话题"
        description="选择一个主题阅读话题，或新建话题后自动关联当前高亮。"
        loading={addTopicHighlight.isPending}
        onCancel={() => setTopicHighlightId(null)}
        onConfirm={async (topicId) => {
          if (!topicHighlightId) return;
          await addTopicHighlight.mutateAsync({ topicId, highlightId: topicHighlightId });
          toast.success('高亮已加入话题');
          setTopicHighlightId(null);
        }}
      />

      {editing && (
        <HighlightEditPopover
          editing={editing}
          onComment={(id) => {
            setCommentTargetHighlightId(id);
            setCommentMode(true);
            setEditing(null);
          }}
          onAddToTopic={(id) => {
            setTopicHighlightId(id);
            setEditing(null);
          }}
          onDelete={(id) => {
            deleteHighlight.mutate(id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
