import { BookPlus, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BOOK_STATUS, BOOK_STATUS_LABELS, type BookStatus } from '@redesk/shared';
import { API_BASE } from '@/lib/api';
import type { ApiError } from '@/lib/api';
import type { BookSummary } from '@/hooks/use-books';
import { cn } from '@/lib/utils';

const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

const MOBILE_STATUS_OPTIONS = [
  { value: 'ALL', label: '\u5168\u90e8' },
  { value: BOOK_STATUS.READING, label: BOOK_STATUS_LABELS[BOOK_STATUS.READING] },
  { value: BOOK_STATUS.PLANNED, label: BOOK_STATUS_LABELS[BOOK_STATUS.PLANNED] },
  { value: BOOK_STATUS.STORED, label: BOOK_STATUS_LABELS[BOOK_STATUS.STORED] },
] as const;

export function MobileBookshelf({
  pageView,
  books,
  isLoading,
  isError,
  error,
  hasFilter,
  search,
  onSearchChange,
  status,
  onStatusChange,
  onOpenCreate,
  onOpenDetail,
}: {
  pageView: 'bookshelf' | 'trash';
  books: BookSummary[];
  isLoading: boolean;
  isError: boolean;
  error: Error | ApiError | null;
  hasFilter: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onOpenCreate: () => void;
  onOpenDetail: (id: number) => void;
}) {
  const navigate = useNavigate();

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-foreground font-display text-lg font-semibold text-background">
            R
          </div>
          <div>
            <div className="text-lg font-bold tracking-[-0.04em] text-foreground">
              {pageView === 'trash' ? '\u56de\u6536\u7ad9' : '\u4e66\u67b6'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {pageView === 'trash' ? '\u627e\u56de\u6700\u8fd1\u5220\u9664\u7684\u4e66\u7c4d' : `\u8f7b\u6d4f\u89c8 \u00b7 ${books.length} \u672c\u4e66`}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-border bg-card text-foreground shadow-sm"
          onClick={() => navigate('/settings')}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      <label className="flex h-11 items-center gap-3 rounded-full border border-border bg-[rgba(255,250,241,0.92)] px-4 text-sm text-muted-foreground shadow-[0_8px_22px_rgba(64,47,31,0.05)]">
        <Search className="h-4 w-4" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="\u641c\u7d22\u4e66\u540d\u3001\u4f5c\u8005\u3001\u6807\u7b7e"
          className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>

      {pageView === 'bookshelf' ? (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {MOBILE_STATUS_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  status === item.value ? 'border-primary/35 bg-primary/12 text-primary' : 'border-border bg-card text-muted-foreground',
                )}
                onClick={() => onStatusChange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <MobileQuickCard title="\u6dfb\u52a0\u4e66\u7c4d" subtitle="\u624b\u52a8\u5f55\u5165\u6216\u94fe\u63a5\u6293\u53d6" onClick={onOpenCreate} />
            <MobileQuickCard title="\u8f7b\u7ba1\u7406" subtitle="\u4e0a\u4f20\u3001\u5907\u4efd\u3001\u5bfc\u51fa\u5165\u53e3" onClick={() => navigate('/overview')} />
            <MobileQuickCard title="\u5907\u4efd\u5bfc\u51fa" subtitle="\u8fdb\u5165\u79fb\u52a8\u7aef\u5907\u4efd\u9875" onClick={() => navigate('/settings?mobile=backup')} />
            <MobileQuickCard title="\u5b8c\u6574\u8bbe\u7f6e" subtitle="\u7ee7\u7eed\u7ba1\u7406\u8d26\u6237\u4e0e\u7cfb\u7edf" onClick={() => navigate('/settings')} />
          </div>
        </>
      ) : null}

      <div className="mt-3 space-y-2.5">
        {isLoading ? (
          <MobilePlaceholder title="\u6b63\u5728\u6574\u7406\u4e66\u67b6..." />
        ) : isError ? (
          <MobilePlaceholder title="\u4e66\u67b6\u52a0\u8f7d\u5931\u8d25" description={error?.message ?? '\u8bf7\u7a0d\u540e\u91cd\u8bd5'} />
        ) : books.length === 0 ? (
          <MobilePlaceholder
            title={pageView === 'trash' ? '\u56de\u6536\u7ad9\u4e3a\u7a7a' : hasFilter ? '\u6ca1\u6709\u5339\u914d\u7684\u4e66\u7c4d' : '\u4e66\u67b6\u8fd8\u662f\u7a7a\u7684'}
            description={pageView === 'trash' ? '\u5220\u9664\u540e\u7684\u4e66\u7c4d\u4f1a\u6682\u65f6\u505c\u7559\u5728\u8fd9\u91cc\u3002' : '\u5148\u6dfb\u52a0\u4e00\u672c\u4e66\uff0c\u8fd9\u91cc\u5c31\u4f1a\u51fa\u73b0\u4f60\u7684\u4e66\u5e93\u3002'}
          />
        ) : (
          books.map((book, index) => (
            <button
              key={book.id}
              type="button"
              className="grid w-full grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border border-border bg-[rgba(255,253,248,0.9)] px-3 py-3 text-left shadow-[0_10px_24px_rgba(64,47,31,0.06)]"
              onClick={() => onOpenDetail(book.id)}
            >
              {book.cover_path ? (
                <img
                  src={`${API_BASE}/books/${book.id}/cover`}
                  alt={book.title}
                  className="h-[74px] w-[54px] rounded-[10px] object-cover"
                />
              ) : (
                <div className={cn('flex h-[74px] w-[54px] items-end rounded-[10px] px-2 py-2 font-display text-[11px] font-semibold leading-tight', COVER_TONES[index % COVER_TONES.length])}>
                  {book.title}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{book.title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {[book.author, book.category_name].filter(Boolean).join(' \u00b7 ') || '\u672a\u586b\u5199\u4f5c\u8005'}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {BOOK_STATUS_LABELS[book.status as BookStatus]}
                  </span>
                  {book.has_files ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">\u6709\u6587\u4ef6</span>
                  ) : null}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))
        )}
      </div>
    </>
  );
}

function MobileQuickCard({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-[22px] border border-border bg-card px-3 py-3 text-left shadow-[0_10px_24px_rgba(64,47,31,0.06)]"
      onClick={onClick}
    >
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] bg-primary/12 text-primary">
        <BookPlus className="h-4 w-4" />
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{subtitle}</div>
    </button>
  );
}

function MobilePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border bg-card px-4 py-10 text-center">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {description ? <div className="mt-2 text-xs leading-6 text-muted-foreground">{description}</div> : null}
    </div>
  );
}
