/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Loader2, Menu, X, StickyNote, Plus, Trash2, Check, Pencil } from 'lucide-react';
import { BubbleToolbar, type MarkType } from '@/components/highlight-toolbar';
import { CommentInput } from '@/components/reader/comment-input';
import { toast } from 'sonner';
import type EpubFactory from 'epubjs';
import { useBookFiles, type BookFileItem } from '@/hooks/use-files';
import { useBook } from '@/hooks/use-books';
import { useHighlights, useCreateHighlight, useUpdateHighlight, useDeleteHighlight, useNotes, useCreateNote, useUpdateNote, useDeleteNote, useBookmarks, useCreateBookmark, useDeleteBookmark, type HighlightItem, type NoteItem } from '@/hooks/use-notes';
import { useAddTopicHighlight } from '@/hooks/use-topics';
import { Button } from '@/components/ui/button';
import { AddToTopicDialog } from '@/components/add-to-topic-dialog';
import { api, API_BASE } from '@/lib/api';

interface TocItem {
  id: string;
  label: string;
  href: string;
}

interface ReadingProgressData {
  id: number;
  book_id: number;
  owner_id: number;
  file_id: number;
  cfi: string;
  percentage: number;
  last_read_at: string;
  created_at: string;
  updated_at: string;
}

interface SelectionState {
  rect: DOMRect;
  cfi: string;
  text: string;
}

interface EditingHighlight {
  id: number;
  note: string | null;
  markType: string;
  position: { top: number; left: number };
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
  const lastSaveRef = useRef<string>('');
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


  const primaryEpub = files.data?.find((f: BookFileItem) => f.is_primary === 1 && f.file_format === 'EPUB');
  const primaryEpubId = primaryEpub?.id;
  const bookTitle = book.data?.title ?? '';

  const saveProgress = useCallback(
    (cfi: string, percentage: number) => {
      if (!primaryEpubId || !bookId) return;
      const key = `${cfi}:${percentage}`;
      if (key === lastSaveRef.current) return;
      lastSaveRef.current = key;
      api
        .put<ReadingProgressData>(`/books/${bookId}/reading-progress`, {
          file_id: primaryEpubId,
          cfi,
          percentage,
        })
        .catch(() => {});
    },
    [bookId, primaryEpubId],
  );

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
      lastSaveRef.current = '';

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

  if (!primaryEpub) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">没有可用的 EPUB 主阅读文件</p>
        <Button variant="outline" onClick={() => navigate(`/books/${bookId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回详情
        </Button>
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
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/books/${bookId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleToc}>
          <Menu className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleNotesPanel}>
          <StickyNote className="h-5 w-5" />
        </Button>
        <div className="flex-1 truncate text-sm font-medium text-foreground">
          {currentTitle || book.data?.title}
        </div>
        <Button variant="ghost" size="icon" onClick={goPrev}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={goNext}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {tocOpen && (
          <div className="absolute left-0 top-0 z-20 h-full w-64 border-r border-border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium">目录</span>
              <Button variant="ghost" size="icon" onClick={() => setTocOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100%-49px)] overflow-y-auto">
              {toc.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  暂无目录
                </div>
              ) : (
                <ul className="py-1">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => goToHref(item.href)}
                        className="w-full px-4 py-2 text-left text-sm text-foreground/80 hover:bg-muted"
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {notesPanelOpen && (
          <div className="absolute left-0 top-0 z-20 h-full w-72 border-r border-border bg-background shadow-lg flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium">笔记</span>
              <Button variant="ghost" size="icon" onClick={() => setNotesPanelOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {noteForm ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="笔记标题"
                    value={noteForm.title}
                    onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <textarea
                    placeholder="笔记内容（可选）"
                    value={noteForm.content}
                    onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                    className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={4}
                  />
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setNoteForm(null)}>
                      取消
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSubmitNote}>
                      <Check className="mr-1 h-3 w-3" />
                      保存
                    </Button>
                  </div>
                </div>
              ) : editingNote ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="笔记标题"
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <textarea
                    placeholder="笔记内容"
                    value={editingNote.content}
                    onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                    className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={4}
                  />
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setEditingNote(null)}>
                      取消
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSubmitEditNote}>
                      <Check className="mr-1 h-3 w-3" />
                      更新
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleOpenNoteForm}
                    className="flex w-full items-center gap-1.5 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    在当前页添加笔记
                  </button>
                  <div className="pt-1 space-y-1.5">
                    {bookNotes.isLoading ? (
                      <div className="px-1 py-4 text-center text-xs text-muted-foreground">加载中...</div>
                    ) : (bookNotes.data ?? []).length === 0 ? (
                      <div className="px-1 py-4 text-center text-xs text-muted-foreground">暂无笔记</div>
                    ) : (
                      (bookNotes.data ?? []).map((note: NoteItem) => (
                        <div
                          key={note.id}
                          className="group rounded border border-border/50 bg-muted/20 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-medium text-foreground">
                              {note.title || '无标题'}
                            </span>
                            <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleEditNote(note)}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note.id)}
                                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {note.content_markdown && (
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/70 line-clamp-3">
                              {note.content_markdown}
                            </p>
                          )}
                          {note.cfi && (
                            <p className="mt-1 text-[10px] text-muted-foreground/40 font-mono truncate">
                              {note.cfi.slice(0, 40)}...
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
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
        <div
          className="fixed z-50 anim-pop"
          style={{
            top: (editing.position?.top ?? 0) - 60,
            left: editing.position?.left ?? 0,
          }}
        >
          <div
            className="relative flex items-center gap-1 rounded-[14px] border bg-white px-2 py-1.5"
            style={{
              borderColor: '#e5e5e5',
              boxShadow: '0 10px 30px -8px rgba(0,0,0,0.08)',
            }}
          >
            <div
              className="absolute -bottom-[6px] left-4 w-3 h-3 bg-white"
              style={{
                borderRight: '1px solid #e5e5e5',
                borderBottom: '1px solid #e5e5e5',
                transform: 'rotate(45deg)',
              }}
            />
            <button
              type="button"
              onClick={() => {
                setCommentTargetHighlightId(editing.id);
                setCommentMode(true);
                setEditing(null);
              }}
              className="flex items-center gap-1 rounded-lg px-2.5 h-8 hover:bg-neutral-100 text-xs text-neutral-600"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {editing.note ? '编辑附注' : '添加附注'}
            </button>
            <div className="w-px h-5 bg-neutral-200" />
            <button
              type="button"
              onClick={() => {
                setTopicHighlightId(editing.id);
                setEditing(null);
              }}
              className="flex items-center gap-1 rounded-lg px-2.5 h-8 hover:bg-neutral-100 text-xs text-neutral-600"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 12V7a2 2 0 0 0-2-2h-5" />
                <path d="M14 17H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
                <path d="M8 12h8" /><path d="M12 8v8" />
              </svg>
              加入话题
            </button>
            <div className="w-px h-5 bg-neutral-200" />
            <button
              type="button"
              onClick={() => {
                deleteHighlight.mutate(editing.id);
                setEditing(null);
              }}
              className="flex items-center gap-1 rounded-lg px-2.5 h-8 hover:bg-red-50 text-xs text-red-500"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
