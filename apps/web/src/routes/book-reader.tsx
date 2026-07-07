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
import { useHighlights, useCreateHighlight, useUpdateHighlight, useDeleteHighlight, useNotes, useCreateNote, useUpdateNote, useDeleteNote, useBookmarks, useCreateBookmark, useDeleteBookmark, type HighlightItem, type NoteItem } from '@/hooks/use-notes';
import { useAddTopicHighlight } from '@/hooks/use-topics';
import { Button } from '@/components/ui/button';
import { AddToTopicDialog } from '@/components/add-to-topic-dialog';
import { api, API_BASE } from '@/lib/api';
import { normalizeFileFormat, selectReadableFile } from '@redesk/shared';
import { HighlightEditPopover, ReaderNotesPanel, ReaderTopBar, TocPanel, type EditingHighlight, type TocItem } from './book-reader/components';
import { useReadingProgressSync, type ReadingProgressData } from './book-reader/reading-progress-sync';

interface SelectionState {
  rect: DOMRect;
  cfi: string;
  text: string;
}

function shouldIgnoreKeydown(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.closest('[contenteditable="true"]') !== null
  );
}

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
  const highlightsMapRef = useRef<Map<string, HighlightItem>>(new Map());
  const currentCfiRef = useRef<string>('');

  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [activeMarkType, setActiveMarkType] = useState<MarkType>(null);
  const [selectionHighlightId, setSelectionHighlightId] = useState<number | null>(null);
  const [commentMode, setCommentMode] = useState(false);
  const [commentTargetHighlightId, setCommentTargetHighlightId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditingHighlight | null>(null);
  const [topicHighlightId, setTopicHighlightId] = useState<number | null>(null);
  const [noteForm, setNoteForm] = useState<{ title: string; content: string } | null>(null);
  const [editingNote, setEditingNote] = useState<{ id: number; title: string; content: string } | null>(null);


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

  const renderHighlights = useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    const items = highlights.data ?? [];
    const map = new Map<string, HighlightItem>();

    try {
      rendition.annotations.clear();
    } catch { /* ignore */ }

    for (const item of items) {
      const key = `${item.cfi_start}:${item.cfi_end}`;
      map.set(key, item);

      const type = item.type;

      try {
        if (type === 'UNDERLINE') {
          rendition.annotations.underline(
            item.cfi_start,
            {},
            (e: any) => {
              e.stopPropagation();
              const rect = (e.target as HTMLElement)?.getBoundingClientRect();
              if (rect) {
                setEditing({
                  id: item.id,
                  note: item.note,
                  markType: item.mark_type,
                  position: { top: rect.bottom + 4, left: rect.left },
                });
              }
            },
            '',
            { 'border-bottom': '2.2px solid rgba(59,130,246,0.75)' },
          );
        } else if (type === 'WAVY') {
          // 波浪线使用 highlight 机制但覆盖样式为波浪下划线
          rendition.annotations.highlight(
            item.cfi_start,
            {},
            (e: any) => {
              e.stopPropagation();
              const rect = (e.target as HTMLElement)?.getBoundingClientRect();
              if (rect) {
                setEditing({
                  id: item.id,
                  note: item.note,
                  markType: item.mark_type,
                  position: { top: rect.bottom + 4, left: rect.left },
                });
              }
            },
            'rd-wavy',
            {
              background: 'transparent',
              'text-decoration': 'underline wavy rgba(220,38,38,0.7)',
              'text-underline-offset': '3px',
            },
          );
        } else {
          // HIGHLIGHT 默认黄色半透明
          rendition.annotations.highlight(
            item.cfi_start,
            {},
            (e: any) => {
              e.stopPropagation();
              const rect = (e.target as HTMLElement)?.getBoundingClientRect();
              if (rect) {
                setEditing({
                  id: item.id,
                  note: item.note,
                  markType: item.mark_type,
                  position: { top: rect.bottom + 4, left: rect.left },
                });
              }
            },
            '',
            { 'background-color': 'rgba(250,204,21,0.35)' },
          );
        }
      } catch { /* CFI 失效的高亮跳过 */ }
    }

    highlightsMapRef.current = map;
  }, [highlights.data]);

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
  }, [bookId, bookTitle, primaryEpubId, saveProgress]);

  // 高亮数据加载完成后渲染
  useEffect(() => {
    if (!loading && highlights.data) {
      renderHighlights();
    }
  }, [loading, highlights.data, renderHighlights]);

  // 创建高亮后重新渲染
  useEffect(() => {
    if (createHighlight.isSuccess) {
      highlights.refetch().then(() => {
        renderHighlights();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createHighlight.isSuccess]);

  // 更新/删除高亮后重新渲染
  useEffect(() => {
    if (updateHighlight.isSuccess || deleteHighlight.isSuccess) {
      highlights.refetch().then(() => {
        renderHighlights();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateHighlight.isSuccess, deleteHighlight.isSuccess]);

  const handleDismissSelection = useCallback(() => {
    setSelection(null);
    setCommentMode(false);
    setCommentTargetHighlightId(null);
    setActiveMarkType(null);
    setSelectionHighlightId(null);
  }, []);

  const handleCreateHighlight = () => {
    if (!selection || !primaryEpubId) return;
    createHighlight.mutate({
      book_id: bookId,
      cfi_start: selection.cfi,
      cfi_end: selection.cfi,
      text: selection.text,
      type: 'HIGHLIGHT',
      color: '#fde047',
    });
    setSelection(null);
    setSelectionHighlightId(null);
  };

  const handleCreateUnderline = () => {
    if (!selection || !primaryEpubId) return;
    createHighlight.mutate({
      book_id: bookId,
      cfi_start: selection.cfi,
      cfi_end: selection.cfi,
      text: selection.text,
      type: 'UNDERLINE',
      color: '#3b82f6',
    });
    setSelection(null);
    setSelectionHighlightId(null);
  };

  const handleCreateWavy = () => {
    if (!selection || !primaryEpubId) return;
    createHighlight.mutate({
      book_id: bookId,
      cfi_start: selection.cfi,
      cfi_end: selection.cfi,
      text: selection.text,
      type: 'WAVY',
      color: '#dc2626',
    });
    setSelection(null);
    setSelectionHighlightId(null);
  };

  const handleClearMark = () => {
    if (selectionHighlightId == null) return;
    deleteHighlight.mutate(selectionHighlightId);
    handleDismissSelection();
  };

  const handleBookmark = () => {
    if (!selection || !primaryEpubId) return;
    const cfi = selection.cfi;
    // 检查是否已有锚点
    const existing = bookmarks.data?.find((b) => b.cfi === cfi);
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
    // 检查选区是否已有高亮，若有则绑定到该高亮
    let targetId: number | null = null;
    for (const [, item] of highlightsMapRef.current) {
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
      // 绑定到已有高亮的评论：更新高亮附注
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

    // 独立评论：创建高亮 + 附注
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
        onSuccess: (res: any) => {
          if (res?.data?.id) {
            updateHighlight.mutate({
              id: res.data.id,
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

  const handleOpenNoteForm = () => {
    const cfi = renditionRef.current?.location?.start?.cfi ?? currentCfiRef.current;
    if (!cfi) return;
    setNoteForm({ title: '', content: '' });
  };

  const handleSubmitNote = () => {
    if (!noteForm || !noteForm.title.trim()) return;
    const cfi = renditionRef.current?.location?.start?.cfi ?? currentCfiRef.current;
    createNote.mutate(
      {
        book_id: bookId,
        cfi: cfi || null,
        title: noteForm.title.trim(),
        content_markdown: noteForm.content.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNoteForm(null);
          bookNotes.refetch();
        },
      },
    );
  };

  const handleEditNote = (note: NoteItem) => {
    setEditingNote({
      id: note.id,
      title: note.title ?? '',
      content: note.content_markdown ?? '',
    });
  };

  const handleSubmitEditNote = () => {
    if (!editingNote) return;
    updateNote.mutate(
      {
        id: editingNote.id,
        title: editingNote.title.trim() || undefined,
        content_markdown: editingNote.content.trim() || undefined,
      },
      {
        onSuccess: () => {
          setEditingNote(null);
          bookNotes.refetch();
        },
      },
    );
  };

  const handleDeleteNote = (id: number) => {
    deleteNote.mutate(id, {
      onSuccess: () => bookNotes.refetch(),
    });
  };

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

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeydown(event.target)) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        renditionRef.current?.prev();
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        renditionRef.current?.next();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    const rendition = renditionRef.current;
    if (rendition?.hooks?.content) {
      rendition.hooks.content.register((contents: any) => {
        contents.document.addEventListener('keydown', handleKeydown);
      });
    }
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [primaryEpubId]);

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
