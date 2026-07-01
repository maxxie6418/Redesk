/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Loader2, Menu, X } from 'lucide-react';
import ePub from 'epubjs';
import { useBookFiles, type BookFileItem } from '@/hooks/use-files';
import { useBook } from '@/hooks/use-books';
import { Button } from '@/components/ui/button';
import { API_BASE } from '@/lib/api';

interface TocItem {
  id: string;
  label: string;
  href: string;
}

export function BookReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const navigate = useNavigate();

  const book = useBook(bookId);
  const files = useBookFiles(bookId);

  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<ReturnType<typeof ePub> | null>(null);
  const renditionRef = useRef<any>(null);

  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const primaryEpub = files.data?.find((f: BookFileItem) => f.is_primary === 1 && f.file_format === 'EPUB');
  const primaryEpubId = primaryEpub?.id;
  const bookTitle = book.data?.title ?? '';

  useEffect(() => {
    if (!primaryEpubId || !viewerRef.current) return;

    const url = `${API_BASE}/books/${bookId}/files/${primaryEpubId}/download`;
    let cancelled = false;

    try {
      setLoading(true);
      setError(null);
      setToc([]);
      setCurrentTitle(bookTitle);

      const epubBook = ePub(url, { openAs: 'epub' });
      bookRef.current = epubBook;

      const rendition = epubBook.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'auto',
      });
      renditionRef.current = rendition;

      epubBook.ready
        .then(() => {
          if (cancelled) return;
          const tocData = epubBook.navigation.toc.map((item: any, index: number) => ({
            id: String(index),
            label: item.label,
            href: item.href,
          }));
          setToc(tocData);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : '加载失败');
          setLoading(false);
        });

      epubBook.loaded.metadata
        .then((meta: any) => {
          if (cancelled) return;
          if (meta?.title) {
            setCurrentTitle(meta.title);
          }
        })
        .catch(() => undefined);

      rendition.on('relocated', (location: any) => {
        if (cancelled) return;
        if (location?.start?.displayed?.page) {
          const page = location.start.displayed.page;
          const total = location.start.displayed.total;
          setCurrentTitle(`${bookTitle} · ${page} / ${total}`);
        }
      });

      Promise.resolve(rendition.display()).catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载失败');
        setLoading(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      setLoading(false);
    }

    return () => {
      cancelled = true;
      if (renditionRef.current) {
        try {
          renditionRef.current.destroy();
        } catch {
          /* ignore */
        }
        renditionRef.current = null;
      }
      if (bookRef.current) {
        try {
          bookRef.current.destroy();
        } catch {
          /* ignore */
        }
        bookRef.current = null;
      }
    };
  }, [bookId, bookTitle, primaryEpubId]);

  const goPrev = () => {
    renditionRef.current?.prev();
  };

  const goNext = () => {
    renditionRef.current?.next();
  };

  const goToHref = (href: string) => {
    renditionRef.current?.display(href);
    setTocOpen(false);
  };

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
        <Button variant="ghost" size="icon" onClick={() => setTocOpen(!tocOpen)}>
          <Menu className="h-5 w-5" />
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

        <div ref={viewerRef} className="h-full w-full" />

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
