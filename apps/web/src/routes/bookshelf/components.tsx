import { type CSSProperties } from 'react';
import { Bookmark, Grid3X3, Heart, LayoutGrid, LayoutList, Star } from 'lucide-react';
import type { BookSummary } from '@/hooks/use-books';
import { Button } from '@/components/ui/button';
import { FilterSelect, type FilterSelectOption } from '@/components/page-ui/filter-select';
import { SegmentedToggle, SegmentedToggleItem } from '@/components/page-ui/segmented-toggle';
import { cn } from '@/lib/utils';
import { COVER_TONES, COVER_URL_BASE, STATUS_OPTIONS, type SortMode, type ViewMode } from './constants';
import { bookMeta, bookMetaLine, bookProgress, statusDotClass, statusLabel } from './utils';

interface BookCardProps {
  book: BookSummary;
  index: number;
  onOpenDetail: () => void;
  isTrash?: boolean;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
}

export function BookCoverImage({
  book,
  index,
  className,
  rounded = 'rounded-md',
}: {
  book: BookSummary;
  index: number;
  className: string;
  rounded?: string;
}) {
  const hasCover = Boolean(book.cover_path);

  if (hasCover) {
    return (
      <img
        src={`${COVER_URL_BASE}/books/${book.id}/cover`}
        alt={book.title}
        className={cn('object-cover', rounded, className)}
        onError={(event) => {
          (event.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col justify-between px-2 py-1.5 font-display shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]',
        rounded,
        className,
        COVER_TONES[index % COVER_TONES.length],
      )}
    >
      <span className="line-clamp-3 text-xs font-medium leading-tight">{book.title}</span>
      <span className="truncate text-[10px] opacity-70">{book.publish_year ?? 'Redesk'}</span>
    </div>
  );
}

function MenuMore({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'absolute z-10 flex items-center gap-[3px] rounded p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/60" />
      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/60" />
      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/60" />
    </button>
  );
}

function TagAtom({ children, size = 'default' }: { children: React.ReactNode; size?: 'default' | 'small' | 'tiny' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border border-border bg-muted text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground',
        size === 'default' && 'rounded-md px-2.5 py-[3px] text-xs leading-[1.4]',
        size === 'small' && 'rounded px-2 py-[2px] text-[11px] leading-[1.4]',
        size === 'tiny' && 'rounded px-2 py-[2px] text-[11px] leading-[1.4]',
      )}
    >
      {children}
    </span>
  );
}

function RatingDisplay({ rating, size = 'sm' }: { rating: number | null; size?: 'sm' | 'xs' }) {
  return (
    <div className={cn('inline-flex items-center gap-1 font-semibold text-foreground', size === 'xs' ? 'text-[13px]' : 'text-sm')}>
      <Star className={cn('fill-[#f5c842] text-[#f5c842]', size === 'xs' ? 'h-3 w-3' : 'h-[13px] w-[13px]')} />
      {rating ?? '—'}
    </div>
  );
}

function ProgressBar({ progress, trackWidth = 'w-[70px]', trackHeight = 'h-1' }: { progress: number; trackWidth?: string; trackHeight?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className={cn('overflow-hidden rounded-full bg-muted', trackWidth, trackHeight)}>
        <div
          className="h-full rounded-full bg-[#2f7af5] transition-[width] duration-500"
          style={{ width: `${progress}%` } as CSSProperties}
        />
      </div>
      <span className="min-w-[32px] text-right text-[13px] font-medium tabular-nums text-muted-foreground">{progress}%</span>
    </div>
  );
}

function TrashActions({ onRestore, onPermanentDelete }: { onRestore?: () => void; onPermanentDelete?: () => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRestore}>
        恢复
      </Button>
      <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onPermanentDelete}>
        删除
      </Button>
    </div>
  );
}

export function BookCardA({ book, index, onOpenDetail, isTrash, onRestore, onPermanentDelete }: BookCardProps) {
  const progress = bookProgress(book);

  return (
    <article
      className="group relative flex gap-[18px] rounded-xl bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.06)] transition-[transform,box-shadow] duration-[0.25s] hover:-translate-y-[3px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)]"
      style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' } as CSSProperties}
    >
      {!isTrash ? <MenuMore onClick={onOpenDetail} className="right-5 top-5" /> : null}
      <button type="button" className="relative mt-0.5 shrink-0 cursor-not-allowed overflow-hidden rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.1)]" disabled title="阅读器将在 M2 上线">
        <BookCoverImage book={book} index={index} className="h-[182px] w-[130px]" rounded="rounded-md" />
        <div className="pointer-events-none absolute inset-0 rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col" onClick={onOpenDetail}>
        <div className="mb-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass(book.status))} />
          {statusLabel(book.status)}
        </div>
        <h2 className="mb-1.5 line-clamp-2 text-base font-bold leading-[1.4] tracking-[-0.2px] text-foreground">{book.title}</h2>
        <p className="mb-2.5 truncate text-[13px] leading-[1.5] text-muted-foreground">{bookMeta(book) || '未填写作者'}</p>
        <div className="mb-2.5 flex flex-wrap gap-2">
          {book.tag_names.slice(0, 3).map((tag) => (
            <TagAtom key={tag}>{tag}</TagAtom>
          ))}
        </div>
        <p className="mb-3.5 text-[13px] leading-[1.5] tabular-nums text-muted-foreground">{bookMetaLine(book)}</p>
        <div className="mt-auto flex items-center gap-3.5 border-t border-border pt-3">
          <RatingDisplay rating={book.rating} />
          <ProgressBar progress={progress} />
        </div>
      </div>
      {isTrash ? (
        <div className="absolute bottom-5 right-5">
          <TrashActions onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
        </div>
      ) : null}
    </article>
  );
}

export function BookCardB({ book, index, onOpenDetail, isTrash, onRestore, onPermanentDelete }: BookCardProps) {
  const progress = bookProgress(book);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-card p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
      <div className="relative mb-3 overflow-hidden rounded-xl">
        <button type="button" className="block w-full cursor-not-allowed" disabled title="阅读器将在 M2 上线">
          <BookCoverImage book={book} index={index} className="aspect-[6/7] w-full" rounded="rounded-xl" />
        </button>
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm">
          <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(book.status))} />
          {statusLabel(book.status)}
        </div>
        {!isTrash ? (
          <div
            className="absolute right-2.5 top-2.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-foreground"
            onClick={onOpenDetail}
          >
            <div className="flex flex-col gap-[3px]">
              <span className="block h-[3px] w-[3px] rounded-full bg-current" />
              <span className="block h-[3px] w-[3px] rounded-full bg-current" />
              <span className="block h-[3px] w-[3px] rounded-full bg-current" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col" onClick={onOpenDetail}>
        <h3 className="mb-1.5 line-clamp-1 text-base font-semibold leading-tight text-foreground">{book.title}</h3>
        <p className="mb-2 line-clamp-1 text-sm text-muted-foreground">{book.author || '未知作者'}</p>
        {book.tag_names.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {book.tag_names.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mb-3 text-xs text-muted-foreground">
          {[book.publish_year, book.page_count ? `${book.page_count}页` : null].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-auto flex items-center gap-2">
          {book.rating != null ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-yellow-500">
              <Star className="h-4 w-4 fill-current" />
              {book.rating.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          <div className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` } as CSSProperties} />
            </div>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
        </div>
      </div>
      {isTrash ? (
        <div className="mt-2">
          <TrashActions onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
        </div>
      ) : null}
    </article>
  );
}

export function BookCardC({ book, index, onOpenDetail, isTrash, onRestore, onPermanentDelete }: BookCardProps) {
  const progress = bookProgress(book);

  return (
    <article className="group relative flex items-start gap-4 rounded-lg bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      {!isTrash ? <MenuMore onClick={onOpenDetail} className="right-4 top-4" /> : null}
      <button type="button" className="relative shrink-0 cursor-not-allowed overflow-hidden rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.1)]" disabled title="阅读器将在 M2 上线">
        <BookCoverImage book={book} index={index} className="h-[130px] w-[100px]" rounded="rounded-md" />
        <div className="pointer-events-none absolute inset-0 rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col pr-7">
        <div className="mb-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass(book.status))} />
            {statusLabel(book.status)}
          </div>
          <RatingDisplay rating={book.rating} />
        </div>
        <h2 className="mb-1.5 line-clamp-2 text-[15px] font-bold leading-[1.4] tracking-[-0.2px] text-foreground">{book.title}</h2>
        <p className="mb-2.5 truncate text-[13px] leading-[1.5] text-muted-foreground">{bookMeta(book) || '未填写作者'}</p>
        <div className="mb-2.5 flex flex-wrap gap-2">
          {book.tag_names.slice(0, 3).map((tag) => (
            <TagAtom key={tag}>{tag}</TagAtom>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[13px] leading-[1.5] tabular-nums text-muted-foreground">{bookMetaLine(book)}</p>
          <div className="shrink-0">
            <ProgressBar progress={progress} trackWidth="w-[80px]" />
          </div>
        </div>
      </div>
      {isTrash ? (
        <div className="absolute bottom-4 right-4">
          <TrashActions onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
        </div>
      ) : null}
    </article>
  );
}

export function BookCardD({ book, index, onOpenDetail, isTrash, onRestore, onPermanentDelete }: BookCardProps) {
  const progress = bookProgress(book);

  return (
    <article className="group relative flex items-center gap-4 rounded border border-border bg-card px-3 py-2 hover:border-primary/30 hover:bg-muted/30">
      {!isTrash ? <MenuMore onClick={onOpenDetail} className="right-4 top-3.5" /> : null}
      <button type="button" className="relative shrink-0 cursor-not-allowed overflow-hidden rounded shadow-[0_2px_6px_rgba(0,0,0,0.08)]" disabled title="阅读器将在 M2 上线">
        <BookCoverImage book={book} index={index} className="h-[50px] w-[36px]" rounded="rounded-sm" />
        <div className="pointer-events-none absolute inset-0 rounded-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]" />
      </button>
      <div className="min-w-0 flex-1 cursor-pointer pr-16" onClick={onOpenDetail}>
        <div className="flex items-center gap-2">
          <span className={cn('h-[6px] w-[6px] shrink-0 rounded-full', statusDotClass(book.status))} />
          <span className="truncate text-sm font-medium text-foreground">{book.title}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author || '—'}</p>
      </div>
      <div className="w-[60px] shrink-0 text-xs text-muted-foreground">{statusLabel(book.status)}</div>
      <div className="w-[80px] shrink-0 truncate text-xs text-muted-foreground">{book.category_name || '—'}</div>
      <div className="w-[50px] shrink-0">
        {book.rating != null ? (
          <span className="flex items-center gap-0.5 text-xs text-yellow-500">
            <Star className="h-3 w-3 fill-current" />
            {book.rating}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <div className="flex w-[80px] shrink-0 items-center gap-2">
        <div className="h-1.5 w-[50px] overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` } as CSSProperties} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
      </div>
      <div className="flex w-[100px] shrink-0 flex-wrap gap-1">
        {book.tag_names.slice(0, 2).map((tag) => (
          <span key={tag} className="max-w-[60px] truncate rounded border border-border bg-muted/50 px-1 py-0.5 text-[10px] text-muted-foreground">
            #{tag}
          </span>
        ))}
        {book.tag_names.length > 2 ? <span className="text-[10px] text-muted-foreground">+{book.tag_names.length - 2}</span> : null}
      </div>
      <div className="w-[70px] shrink-0 text-right text-xs tabular-nums text-muted-foreground">{book.updated_at.slice(0, 10)}</div>
      {isTrash ? (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <TrashActions onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
        </div>
      ) : null}
    </article>
  );
}

export function StatusPills({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const items = [{ value: 'ALL', label: '全部' }, ...STATUS_OPTIONS.slice(1)];

  return (
    <div className="flex items-center gap-1.5">
      {items.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
            value === option.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function BookshelfFilterBar({
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
  sort,
  onSortChange,
  sortOptions,
  viewMode,
  onViewModeChange,
}: {
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
  sort: SortMode;
  onSortChange: (value: SortMode) => void;
  sortOptions: readonly FilterSelectOption[];
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
}) {
  return (
    <section className="mb-5 flex flex-wrap items-center gap-3">
      <StatusPills value={status} onChange={onStatusChange} />
      <div className="hidden h-5 w-px bg-border sm:block" />

      <div className="flex items-center gap-2">
        <FilterSelect value={category} onChange={onCategoryChange} options={categoryOptions} shape="pill" tone="muted" className="border-border bg-muted" />
        <FilterSelect value={tag} onChange={onTagChange} options={tagOptions} shape="pill" tone="muted" className="border-border bg-muted" />
        <FilterSelect value={visibility} onChange={onVisibilityChange} options={visibilityOptions} shape="pill" tone="muted" className="border-border bg-muted" />
        <button
          type="button"
          title="收藏"
          onClick={onFavoritedChange}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
            favorited ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground hover:border-primary/30 hover:text-foreground',
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', favorited ? 'fill-current' : '')} />
          收藏
        </button>
        <FilterSelect
          value={sort}
          onChange={(value) => onSortChange(value as SortMode)}
          options={sortOptions}
          shape="pill"
          tone="muted"
          className="border-border bg-muted"
        />
      </div>

      <div className="flex-1" />

      <SegmentedToggle className="rounded-full border-border bg-muted">
        <SegmentedToggleItem active={viewMode === 'A'} onClick={() => onViewModeChange('A')} className="rounded-full">
          <Grid3X3 className="h-3.5 w-3.5" />
          网格
        </SegmentedToggleItem>
        <SegmentedToggleItem active={viewMode === 'B'} onClick={() => onViewModeChange('B')} className="rounded-full">
          <Bookmark className="h-3.5 w-3.5" />
          书签
        </SegmentedToggleItem>
        <SegmentedToggleItem active={viewMode === 'C'} onClick={() => onViewModeChange('C')} className="rounded-full">
          <LayoutGrid className="h-3.5 w-3.5" />
          卡片
        </SegmentedToggleItem>
        <SegmentedToggleItem active={viewMode === 'D'} onClick={() => onViewModeChange('D')} className="rounded-full">
          <LayoutList className="h-3.5 w-3.5" />
          表格
        </SegmentedToggleItem>
      </SegmentedToggle>
    </section>
  );
}

export function BookshelfContent({
  books,
  viewMode,
  isTrash,
  onOpenDetail,
  onRestore,
  onPermanentDelete,
}: {
  books: BookSummary[];
  viewMode: ViewMode;
  isTrash: boolean;
  onOpenDetail: (bookId: number) => void;
  onRestore: (bookId: number) => void;
  onPermanentDelete: (bookId: number) => void;
}) {
  if (viewMode === 'A') {
    return (
      <section className="grid grid-cols-1 gap-x-2 gap-y-3 xl:grid-cols-2 2xl:grid-cols-3">
        {books.map((book, index) => (
          <BookCardA
            key={book.id}
            book={book}
            index={index}
            onOpenDetail={() => onOpenDetail(book.id)}
            isTrash={isTrash}
            onRestore={() => onRestore(book.id)}
            onPermanentDelete={() => onPermanentDelete(book.id)}
          />
        ))}
      </section>
    );
  }

  if (viewMode === 'B') {
    return (
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {books.map((book, index) => (
          <BookCardB
            key={book.id}
            book={book}
            index={index}
            onOpenDetail={() => onOpenDetail(book.id)}
            isTrash={isTrash}
            onRestore={() => onRestore(book.id)}
            onPermanentDelete={() => onPermanentDelete(book.id)}
          />
        ))}
      </section>
    );
  }

  if (viewMode === 'C') {
    return (
      <section className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
        {books.map((book, index) => (
          <BookCardC
            key={book.id}
            book={book}
            index={index}
            onOpenDetail={() => onOpenDetail(book.id)}
            isTrash={isTrash}
            onRestore={() => onRestore(book.id)}
            onPermanentDelete={() => onPermanentDelete(book.id)}
          />
        ))}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-1">
      <div className="mb-1 flex items-center gap-4 rounded bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <div className="w-[36px] shrink-0" />
        <div className="min-w-0 flex-1">书名</div>
        <div className="w-[60px] shrink-0">状态</div>
        <div className="w-[80px] shrink-0">分类</div>
        <div className="w-[50px] shrink-0">评分</div>
        <div className="w-[80px] shrink-0">进度</div>
        <div className="w-[100px] shrink-0">标签</div>
        <div className="w-[70px] shrink-0 text-right">更新</div>
      </div>
      {books.map((book, index) => (
        <BookCardD
          key={book.id}
          book={book}
          index={index}
          onOpenDetail={() => onOpenDetail(book.id)}
          isTrash={isTrash}
          onRestore={() => onRestore(book.id)}
          onPermanentDelete={() => onPermanentDelete(book.id)}
        />
      ))}
    </section>
  );
}
