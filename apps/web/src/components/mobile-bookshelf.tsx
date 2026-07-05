import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChevronRight, Heart, Search, SlidersHorizontal } from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS, type BookStatus } from '@redesk/shared';
import { API_BASE } from '@/lib/api';
import type { ApiError } from '@/lib/api';
import type { BookSummary } from '@/hooks/use-books';
import { cn } from '@/lib/utils';
import { FilterSelect, type FilterSelectOption } from '@/components/page-ui/filter-select';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

const MOBILE_STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  { value: BOOK_STATUS.COLLECTED, label: BOOK_STATUS_LABELS[BOOK_STATUS.COLLECTED] },
  { value: BOOK_STATUS.READING, label: BOOK_STATUS_LABELS[BOOK_STATUS.READING] },
  { value: BOOK_STATUS.PLANNED, label: BOOK_STATUS_LABELS[BOOK_STATUS.PLANNED] },
  { value: BOOK_STATUS.READ, label: BOOK_STATUS_LABELS[BOOK_STATUS.READ] },
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
  category,
  onCategoryChange,
  categoryOptions,
  tag,
  onTagChange,
  tagOptions,
  visibility,
  onVisibilityChange,
  visibilityOptions,
  favorited,
  onFavoritedChange,
  onResetFilters,
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
  category: string;
  onCategoryChange: (value: string) => void;
  categoryOptions: readonly FilterSelectOption[];
  tag: string;
  onTagChange: (value: string) => void;
  tagOptions: readonly FilterSelectOption[];
  visibility: string;
  onVisibilityChange: (value: string) => void;
  visibilityOptions: readonly FilterSelectOption[];
  favorited: boolean;
  onFavoritedChange: () => void;
  onResetFilters: () => void;
  onOpenDetail: (id: number) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterCount = getActiveFilterCount({ status, category, tag, visibility, favorited });

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

        {pageView === 'bookshelf' ? (
          <button
            type="button"
            aria-label="打开筛选"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-border bg-card text-foreground shadow-sm"
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filterCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {filterCount}
              </span>
            ) : null}
          </button>
        ) : null}
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

      <div className="mt-3 space-y-2.5">
        {isLoading ? (
          <MobilePlaceholder title="正在整理书架..." />
        ) : isError ? (
          <MobilePlaceholder title="书架加载失败" description={error?.message ?? '请稍后重试'} />
        ) : books.length === 0 ? (
          <MobilePlaceholder
            title={pageView === 'trash' ? '回收站为空' : hasFilter ? '没有匹配的书籍' : '书架还是空的'}
            description={pageView === 'trash' ? '删除后的书籍会暂时停留在这里。' : '先添加一本到书架，这里就会出现你的藏书。'}
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

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] border-x-0 border-b-0 px-4 pb-6 pt-5 sm:max-w-md">
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle>筛选书架</SheetTitle>
            <SheetDescription>保留移动端最常用的筛选项，其他深度管理继续放在桌面端。</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <MobileFilterField label="阅读状态">
              <FilterSelect value={status} onChange={onStatusChange} options={MOBILE_STATUS_OPTIONS} size="md" className="w-full min-w-0" />
            </MobileFilterField>

            <MobileFilterField label="分类">
              <FilterSelect value={category} onChange={onCategoryChange} options={categoryOptions} size="md" className="w-full min-w-0" />
            </MobileFilterField>

            <MobileFilterField label="标签">
              <FilterSelect value={tag} onChange={onTagChange} options={tagOptions} size="md" className="w-full min-w-0" />
            </MobileFilterField>

            <MobileFilterField label="可见性">
              <FilterSelect value={visibility} onChange={onVisibilityChange} options={visibilityOptions} size="md" className="w-full min-w-0" />
            </MobileFilterField>

            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left text-sm font-medium transition-colors',
                favorited ? 'border-primary/35 bg-primary/10 text-primary' : 'border-border bg-card text-foreground',
              )}
              onClick={onFavoritedChange}
            >
              <span className="flex items-center gap-2">
                <Heart className={cn('h-4 w-4', favorited ? 'fill-current' : '')} />
                仅看收藏
              </span>
              <span className="text-xs text-muted-foreground">{favorited ? '已开启' : '未开启'}</span>
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                onResetFilters();
              }}
            >
              清空筛选
            </Button>
            <Button type="button" className="rounded-full" onClick={() => setFilterOpen(false)}>
              查看结果
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MobileFilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">{label}</div>
      {children}
    </div>
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

function getActiveFilterCount({
  status,
  category,
  tag,
  visibility,
  favorited,
}: {
  status: string;
  category: string;
  tag: string;
  visibility: string;
  favorited: boolean;
}) {
  return [status !== 'ALL', category !== 'ALL', tag !== 'ALL', visibility !== 'ALL', favorited].filter(Boolean).length;
}
