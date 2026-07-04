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
  { value: 'ALL', label: '全部' },
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
              {pageView === 'trash' ? '回收站' : '书架'}
            </div>
            <div className="text-xs text-muted-foreground">
              {pageView === 'trash' ? '找回最近删除的书籍' : `轻浏览 · ${books.length} 本书`}
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

      <label className="flex h-11 items-center gap-3 rounded-full border border-border bg-card/92 px-4 text-sm text-muted-foreground shadow-[0_8px_22px_rgba(64,47,31,0.05)]">
        <Search className="h-4 w-4" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索书名、作者、标签"
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
            <MobileQuickCard title="添加书籍" subtitle="手动录入或链接抓取" onClick={onOpenCreate} />
            <MobileQuickCard title="轻管理" subtitle="上传、备份、导出入口" onClick={() => navigate('/overview')} />
            <MobileQuickCard title="备份导出" subtitle="进入移动端备份页" onClick={() => navigate('/settings?mobile=backup')} />
            <MobileQuickCard title="完整设置" subtitle="继续管理账户与系统" onClick={() => navigate('/settings')} />
          </div>
        </>
      ) : null}

      <div className="mt-3 space-y-2.5">
        {isLoading ? (
          <MobilePlaceholder title="正在整理书架..." />
        ) : isError ? (
          <MobilePlaceholder title="书架加载失败" description={error?.message ?? '请稍后重试'} />
        ) : books.length === 0 ? (
          <MobilePlaceholder
            title={pageView === 'trash' ? '回收站为空' : hasFilter ? '没有匹配的书籍' : '书架还是空的'}
            description={pageView === 'trash' ? '删除后的书籍会暂时停留在这里。' : '先添加一本书，这里就会出现你的书库。'}
          />
        ) : (
          books.map((book, index) => (
            <button
              key={book.id}
              type="button"
              className="grid w-full grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border border-border bg-card/90 px-3 py-3 text-left shadow-[0_10px_24px_rgba(64,47,31,0.06)]"
              onClick={() => onOpenDetail(book.id)}
            >
              {book.cover_path ? (
                <img
                  src={`${API_BASE}/books/${book.id}/cover`}
                  alt={book.title}
                  className="h-[74px] w-[54px] rounded-[10px] object-cover"
                />
              ) : (
                <div className={cn('flex h-[74px] w-[54px] items-end rounded-[10px] px-2 py-2 font-display text-xs font-semibold leading-tight', COVER_TONES[index % COVER_TONES.length])}>
                  {book.title}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{book.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {[book.author, book.category_name].filter(Boolean).join(' · ') || '未填写作者'}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {BOOK_STATUS_LABELS[book.status as BookStatus]}
                  </span>
                  {book.has_files ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">有文件</span>
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
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</div>
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
