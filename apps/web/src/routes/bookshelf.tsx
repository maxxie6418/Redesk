import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BookPlus,
  Bookmark,
  FileUp,
  Grid3X3,
  LayoutGrid,
  LayoutList,
  Star,
  X,
  Heart,
} from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS, VISIBILITY, type ImportBooksResult } from '@redesk/shared';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  useBooks,
  useTrash,
  useRestoreBook,
  usePermanentDeleteBook,
  useEmptyTrash,
  type BookSummary,
} from '@/hooks/use-books';
import { useCategories } from '@/hooks/use-categories';
import { useTags } from '@/hooks/use-tags';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { Button } from '@/components/ui/button';
import { BookDetailSheet } from '@/components/book-detail-sheet';
import { useShellUser } from '@/components/shell-user-context';
import { AppShell } from '@/components/app-shell';

type ViewMode = 'A' | 'B' | 'C' | 'D';
type SortMode = 'updated_desc' | 'title_asc' | 'rating_desc';
type PageView = 'bookshelf' | 'trash';

const SORT_API_MAP: Record<SortMode, string> = {
  updated_desc: '-updated_at',
  title_asc: 'title',
  rating_desc: '-rating',
};

const BOOK_STATUS_LABELS_LOCAL: Record<string, string> = {
  [BOOK_STATUS.COLLECTED]: '收录',
  [BOOK_STATUS.PLANNED]: '计划读',
  [BOOK_STATUS.READING]: '在读',
  [BOOK_STATUS.READ]: '已读',
  [BOOK_STATUS.STORED]: '存',
};

const STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  { value: BOOK_STATUS.COLLECTED, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.COLLECTED] },
  { value: BOOK_STATUS.PLANNED, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.PLANNED] },
  { value: BOOK_STATUS.READING, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.READING] },
  { value: BOOK_STATUS.READ, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.READ] },
  { value: BOOK_STATUS.STORED, label: BOOK_STATUS_LABELS_LOCAL[BOOK_STATUS.STORED] },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'ALL', label: '全部权限' },
  { value: VISIBILITY.PRIVATE, label: '私密' },
  { value: VISIBILITY.PUBLIC, label: '公开' },
] as const;

const SORT_OPTIONS = [
  { value: 'updated_desc', label: '按最近更新排序' },
  { value: 'title_asc', label: '按书名排序' },
  { value: 'rating_desc', label: '按评分排序' },
] as const;

const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

const COVER_URL_BASE = '/api/v1';

interface ParsedBookMetadata {
  title?: string;
  author?: string;
  translator?: string;
  publisher?: string;
  publishYear?: string;
  isbn?: string;
  pageCount?: string;
  originalTitle?: string;
  description?: string;
  coverUrl?: string;
  doubanRating?: string;
}

interface LinkBookMetadata {
  title?: string;
  author?: string;
  translator?: string;
  publisher?: string;
  publish_year?: number;
  isbn?: string;
  page_count?: number;
  original_title?: string;
  description?: string;
  cover_url?: string;
  douban_rating?: number;
  source_url: string;
  metadata_source: 'douban' | 'neodb' | 'manual';
}

function cleanDoubanValue(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\u3010([^\u3011]+)\u3011/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDoubanMetadata(raw: string): ParsedBookMetadata {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const data: ParsedBookMetadata = {};

  const firstTitle = lines.find((line) => !line.includes(':') && !line.includes('\uff1a'));
  if (firstTitle) data.title = cleanDoubanValue(firstTitle);

  for (const line of lines) {
    const match = line.match(/^([^:\uff1a]+)[:\uff1a]\s*(.+)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = cleanDoubanValue(match[2]);

    if (key.includes('\u4f5c\u8005')) data.author = value;
    if (key.includes('\u8bd1\u8005')) data.translator = value;
    if (key.includes('\u51fa\u7248\u793e')) data.publisher = value;
    if (key.includes('\u51fa\u7248\u5e74')) data.publishYear = value.match(/\d{4}/)?.[0] ?? value;
    if (key.toUpperCase().includes('ISBN')) data.isbn = value.replace(/[^\dXx]/g, '');
    if (key.includes('\u9875\u6570')) data.pageCount = value.match(/\d+/)?.[0] ?? value;
    if (key.includes('\u539f\u4f5c\u540d')) data.originalTitle = value;
    if (key.includes('\u8c46\u74e3\u8bc4\u5206') || key.includes('\u8bc4\u5206')) data.doubanRating = value.match(/\d+(?:\.\d+)?/)?.[0];
  }

  return data;
}

function statusLabel(status: string) {
  return BOOK_STATUS_LABELS_LOCAL[status] ?? status;
}

function statusDotClass(status: string) {
  if (status === BOOK_STATUS.READING) return 'bg-[#2f7af5]';
  if (status === BOOK_STATUS.PLANNED) return 'bg-[#4dabf7]';
  if (status === BOOK_STATUS.READ) return 'bg-[#788c5d]';
  if (status === BOOK_STATUS.STORED) return 'bg-[#bbb]';
  return 'bg-[#bbb]';
}

function bookProgress(book: BookSummary) {
  if (book.status === BOOK_STATUS.READ) return 100;
  return 0;
}

function bookMetaLine(book: BookSummary) {
  const parts = [book.publish_year?.toString(), book.category_name].filter(Boolean);
  return parts.join(' · ') || '—';
}

function bookMeta(book: BookSummary) {
  return [book.author, book.publisher, book.publish_year].filter(Boolean).join(' / ');
}

function BookCoverImage({ book, index, className, rounded = 'rounded-md' }: { book: BookSummary; index: number; className: string; rounded?: string }) {
  const hasCover = Boolean(book.cover_path);
  if (hasCover) {
    return (
      <img
        src={`${COVER_URL_BASE}/books/${book.id}/cover`}
        alt={book.title}
        className={cn('object-cover', rounded, className)}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={cn('flex flex-col justify-between px-2 py-1.5 font-display shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]', rounded, className, COVER_TONES[index % COVER_TONES.length])}>
      <span className="line-clamp-3 text-xs font-medium leading-tight">{book.title}</span>
      <span className="truncate text-[10px] opacity-70">{book.publish_year ?? 'Redesk'}</span>
    </div>
  );
}

function MenuMore({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="absolute right-5 top-5 z-10 flex items-center gap-[3px] rounded p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/60" />
      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/60" />
      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/60" />
    </button>
  );
}

function MenuMoreSmall({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="absolute right-4 top-4 z-10 flex items-center gap-[3px] rounded p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/60" />
      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/60" />
      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/60" />
    </button>
  );
}

function MenuMoreTiny({ onClick, className }: { onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={cn("absolute right-4 top-3.5 z-10 flex items-center gap-[3px] rounded p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5", className)}
      onClick={(e) => {
        e.stopPropagation();
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
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="min-w-[32px] text-right text-[13px] font-medium tabular-nums text-muted-foreground">{progress}%</span>
    </div>
  );
}

function TrashActions({ onRestore, onPermanentDelete }: { onRestore?: () => void; onPermanentDelete?: () => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRestore}>恢复</Button>
      <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onPermanentDelete}>删除</Button>
    </div>
  );
}

interface BookCardProps {
  book: BookSummary;
  index: number;
  onOpenDetail: () => void;
  isTrash?: boolean;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
}

function BookCardA({ book, index, onOpenDetail, isTrash, onRestore, onPermanentDelete }: BookCardProps) {
  const progress = bookProgress(book);
  return (
    <article
      className="group relative flex gap-[18px] rounded-xl bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.06)] transition-[transform,box-shadow] duration-[0.25s] hover:-translate-y-[3px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)]"
      style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      {!isTrash && <MenuMore onClick={onOpenDetail} />}
      <button
        type="button"
        className="relative mt-0.5 shrink-0 cursor-not-allowed overflow-hidden rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
        disabled
        title="阅读器将在 M2 上线"
      >
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
      {isTrash && (
        <div className="absolute bottom-5 right-5">
          <TrashActions onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
        </div>
      )}
    </article>
  );
}

function BookCardB({ book, index, onOpenDetail, isTrash, onRestore, onPermanentDelete }: BookCardProps) {
  const progress = bookProgress(book);
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-card p-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
      {/* 封面区 */}
      <div className="relative mb-2 overflow-hidden rounded-lg">
        <button
          type="button"
          className="block w-full cursor-not-allowed"
          disabled
          title="阅读器将在 M2 上线"
        >
          <BookCoverImage book={book} index={index} className="aspect-[2/3] w-full" rounded="rounded-lg" />
        </button>
        {/* 状态标签 */}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm">
          <span className={cn('h-1 w-1 rounded-full', statusDotClass(book.status))} />
          {statusLabel(book.status)}
        </div>
        {/* 更多按钮 */}
        <div
          className="absolute right-2 top-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-foreground"
          onClick={onOpenDetail}
        >
          <div className="flex flex-col gap-[2px]">
            <span className="block h-[2px] w-[2px] rounded-full bg-current" />
            <span className="block h-[2px] w-[2px] rounded-full bg-current" />
            <span className="block h-[2px] w-[2px] rounded-full bg-current" />
          </div>
        </div>
      </div>

      {/* 信息区 */}
      <div className="flex flex-1 flex-col" onClick={onOpenDetail}>
        <h3 className="mb-0.5 line-clamp-1 text-[13px] font-semibold leading-tight text-foreground">{book.title}</h3>
        <p className="mb-1.5 line-clamp-1 text-[11px] text-muted-foreground">{book.author || '未知作者'}</p>

        {/* 标签 */}
        {book.tag_names.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-0.5">
            {book.tag_names.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="mb-2 text-[10px] text-muted-foreground">
          {[book.publish_year, book.page_count ? `${book.page_count}页` : null].filter(Boolean).join(' · ')}
        </p>

        {/* 评分 + 进度 */}
        <div className="mt-auto flex items-center gap-1.5">
          {book.rating != null ? (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-yellow-500">
              <Star className="h-3 w-3 fill-current" />
              {book.rating.toFixed(1)}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
          <div className="flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-[9px] tabular-nums text-muted-foreground">{progress}%</span>
        </div>
      </div>

      {isTrash && (
        <div className="mt-2">
          <TrashActions onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
        </div>
      )}
    </article>
  );
}

function BookCardC({ book, index, onOpenDetail, isTrash, onRestore, onPermanentDelete }: BookCardProps) {
  const progress = bookProgress(book);
  return (
    <article className="group relative flex items-start gap-4 rounded-lg bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      {!isTrash && <MenuMoreSmall onClick={onOpenDetail} />}
      <button
        type="button"
        className="relative shrink-0 cursor-not-allowed overflow-hidden rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
        disabled
        title="阅读器将在 M2 上线"
      >
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
        <div className="mt-auto flex items-center justify-between">
          <p className="text-[13px] leading-[1.5] tabular-nums text-muted-foreground">{bookMetaLine(book)}</p>
          <ProgressBar progress={progress} trackWidth="w-[80px]" />
        </div>
      </div>
      {isTrash && (
        <div className="absolute bottom-4 right-4">
          <TrashActions onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
        </div>
      )}
    </article>
  );
}

function BookCardD({ book, index, onOpenDetail, isTrash, onRestore, onPermanentDelete }: BookCardProps) {
  const progress = bookProgress(book);
  return (
    <article className="group relative flex items-center gap-4 rounded border border-border bg-card px-3 py-2 hover:border-primary/30 hover:bg-muted/30">
      {!isTrash && <MenuMoreTiny onClick={onOpenDetail} />}
      {/* 封面 */}
      <button
        type="button"
        className="relative shrink-0 cursor-not-allowed overflow-hidden rounded shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
        disabled
        title="阅读器将在 M2 上线"
      >
        <BookCoverImage book={book} index={index} className="h-[50px] w-[36px]" rounded="rounded-sm" />
        <div className="pointer-events-none absolute inset-0 rounded-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]" />
      </button>
      {/* 书名 */}
      <div
        className="min-w-0 flex-1 cursor-pointer pr-16"
        onClick={onOpenDetail}
      >
        <div className="flex items-center gap-2">
          <span className={cn('h-[6px] w-[6px] shrink-0 rounded-full', statusDotClass(book.status))} />
          <span className="truncate text-sm font-medium text-foreground">{book.title}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author || '—'}</p>
      </div>
      {/* 状态 */}
      <div className="w-[60px] shrink-0 text-xs text-muted-foreground">
        {statusLabel(book.status)}
      </div>
      {/* 分类 */}
      <div className="w-[80px] shrink-0 truncate text-xs text-muted-foreground">
        {book.category_name || '—'}
      </div>
      {/* 评分 */}
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
      {/* 进度 */}
      <div className="flex w-[80px] shrink-0 items-center gap-2">
        <div className="h-1.5 w-[50px] overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
      </div>
      {/* 标签 */}
      <div className="flex w-[100px] shrink-0 flex-wrap gap-1">
        {book.tag_names.slice(0, 2).map((tag) => (
          <span key={tag} className="max-w-[60px] truncate rounded border border-border bg-muted/50 px-1 py-0.5 text-[10px] text-muted-foreground">
            #{tag}
          </span>
        ))}
        {book.tag_names.length > 2 && (
          <span className="text-[10px] text-muted-foreground">+{book.tag_names.length - 2}</span>
        )}
      </div>
      {/* 更新日期 */}
      <div className="w-[70px] shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {book.updated_at.slice(0, 10)}
      </div>
      {isTrash && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <TrashActions onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
        </div>
      )}
    </article>
  );
}

interface CreateBookFormProps {
  onClose: () => void;
}

function CreateBookForm({ onClose }: CreateBookFormProps) {
  const qc = useQueryClient();
  const personalCategories = useCategories('PERSONAL');
  const genreCategories = useCategories('GENRE');
  const tags = useTags();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [publisher, setPublisher] = useState('');
  const [publishYear, setPublishYear] = useState('');
  const [translator, setTranslator] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [doubanRating, setDoubanRating] = useState('');
  const [metadataSource, setMetadataSource] = useState<'douban' | 'neodb' | 'manual'>('manual');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [genreCategoryId, setGenreCategoryId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>(BOOK_STATUS.COLLECTED);
  const [visibility, setVisibility] = useState<string>(VISIBILITY.PRIVATE);
  const [rating] = useState<number | null>(null);
  const [readingPurpose, setReadingPurpose] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [metadataPasteOpen, setMetadataPasteOpen] = useState(false);
  const [metadataPasteText, setMetadataPasteText] = useState('');

  const toggleTag = useCallback((tagId: number) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);

  const applyPastedMetadata = useCallback(() => {
    const parsed = parseDoubanMetadata(metadataPasteText);
    if (parsed.title) setTitle(parsed.title);
    if (parsed.author) setAuthor(parsed.author);
    if (parsed.translator) setTranslator(parsed.translator);
    if (parsed.publisher) setPublisher(parsed.publisher);
    if (parsed.publishYear) setPublishYear(parsed.publishYear);
    if (parsed.isbn) setIsbn(parsed.isbn);
    if (parsed.pageCount) setPageCount(parsed.pageCount);
    if (parsed.originalTitle) setOriginalTitle(parsed.originalTitle);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.coverUrl) setCoverUrl(parsed.coverUrl);
    if (parsed.doubanRating) setDoubanRating(parsed.doubanRating);
    setMetadataSource('douban');
    setMetadataPasteOpen(false);
  }, [metadataPasteText]);

  const applyLinkMetadata = useCallback((metadata: LinkBookMetadata) => {
    if (metadata.title) setTitle(metadata.title);
    if (metadata.author) setAuthor(metadata.author);
    if (metadata.translator) setTranslator(metadata.translator);
    if (metadata.publisher) setPublisher(metadata.publisher);
    if (metadata.publish_year != null) setPublishYear(String(metadata.publish_year));
    if (metadata.isbn) setIsbn(metadata.isbn);
    if (metadata.page_count != null) setPageCount(String(metadata.page_count));
    if (metadata.original_title) setOriginalTitle(metadata.original_title);
    if (metadata.description) setDescription(metadata.description);
    if (metadata.cover_url) setCoverUrl(metadata.cover_url);
    if (metadata.douban_rating != null) setDoubanRating(String(metadata.douban_rating));
    setMetadataSource(metadata.metadata_source);
    setSourceUrl(metadata.source_url);
  }, []);

  const fetchMetadataFromLink = useCallback(async () => {
    if (!sourceUrl.trim()) {
      setMetadataPasteOpen(true);
      return;
    }
    setError('');
    setFetchingMetadata(true);
    try {
      const metadata = await api.post<LinkBookMetadata>('/books/metadata/fetch', { source_url: sourceUrl.trim() });
      applyLinkMetadata(metadata);
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message}。也可以粘贴豆瓣文本导入。` : '获取失败，也可以粘贴豆瓣文本导入。');
      setMetadataPasteOpen(true);
    } finally {
      setFetchingMetadata(false);
    }
  }, [applyLinkMetadata, sourceUrl]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const parsedDoubanRating = doubanRating ? Number(doubanRating) : null;
      const externalRatingKey = metadataSource === 'neodb' ? 'neodb_rating' : 'douban_rating';
      const payload: Record<string, unknown> = {
        title,
        subtitle: subtitle || null,
        author: author || null,
        isbn: isbn || null,
        publisher: publisher || null,
        publish_year: publishYear ? Number(publishYear) : null,
        translator: translator || null,
        original_title: originalTitle || null,
        description: description || null,
        category_id: categoryId,
        genre_category_id: genreCategoryId,
        status,
        visibility,
        reading_purpose: readingPurpose || null,
        rating,
        metadata_source: metadataSource,
        source_url: sourceUrl || null,
        cover_url: coverUrl || null,
        custom_attributes: parsedDoubanRating != null && Number.isFinite(parsedDoubanRating) ? { [externalRatingKey]: parsedDoubanRating } : null,
        page_count: pageCount ? Number(pageCount) : null,
        tag_ids: tagIds.length > 0 ? tagIds : null,
      };

      if (selectedFile) {
        const form = new FormData();
        form.append('title', title);
        Object.entries(payload).forEach(([key, value]) => {
          if (value != null) {
            form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
          }
        });
        form.append('file', selectedFile);

        const res = await fetch('/api/v1/books', {
          method: 'POST',
          credentials: 'include',
          body: form,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const err = (body as { error?: { message?: string } } | null)?.error;
          throw new Error(err?.message ?? '创建失败');
        }
      } else {
        await api.post('/books', payload);
      }

      qc.invalidateQueries({ queryKey: ['books'] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-xl font-medium text-foreground">添加书籍</h2>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* 快速录入 */}
            <div className="col-span-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              快速录入
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-foreground">
                书名 <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="输入书名"
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">个人分类</label>
              <select
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="h-9 w-full appearance-none rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              >
                <option value="">未分类</option>
                {personalCategories.data?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                页数 <span className="font-normal text-muted-foreground/60">可选</span>
              </label>
              <input
                type="number"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                placeholder="0"
                min="0"
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-foreground">
                书籍介绍链接 <span className="font-normal text-muted-foreground/60">可选</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://douban.com/..."
                  className="flex-1 h-9 rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
                />
                <button type="button" onClick={fetchMetadataFromLink} disabled={fetchingMetadata} className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-muted text-[12px] font-medium text-muted-foreground transition-all hover:border-primary hover:text-primary hover:bg-primary/10 disabled:opacity-50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                  {fetchingMetadata ? '获取中' : '一键获取'}
                </button>
              </div>
              {(coverUrl || doubanRating) && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-2 py-2">
                  {coverUrl ? (
                    <img src={coverUrl} alt="封面预览" className="h-14 w-10 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-10 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">封面</div>
                  )}
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">已获取元数据</div>
                    {doubanRating && <div>{metadataSource === 'neodb' ? 'NeoDB 评分' : '豆瓣评分'}：{doubanRating}</div>}
                    {coverUrl && <div className="truncate">{coverUrl}</div>}
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-foreground">
                书籍简介 <span className="font-normal text-muted-foreground/60">可选</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入书籍简介..."
                rows={3}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)] resize-vertical"
              />
            </div>

            {/* 文件上传 */}
            <div className="col-span-2">
              <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-6 cursor-pointer transition hover:border-primary hover:bg-primary/10">
                <svg className="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                <div className="text-[13px] text-muted-foreground">点击或拖拽上传书籍文件</div>
                <div className="text-[11px] text-muted-foreground">支持 epub, pdf, mobi, txt, azw3, docx 等格式</div>
                <input
                  type="file"
                  accept=".epub,.pdf,.mobi,.txt,.azw3,.azw,.djvu,.docx,.fb2"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
              {selectedFile && (
                <p className="mt-2 text-xs text-muted-foreground">已选择: {selectedFile.name}</p>
              )}
            </div>

            {/* 详细信息 */}
            <div className="col-span-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              详细信息（收录后可补充）
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-foreground">
                副标题 <span className="font-normal text-muted-foreground/60">可选</span>
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="输入副标题"
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                作者 <span className="font-normal text-muted-foreground/60">可选</span>
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="作者姓名"
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                ISBN <span className="font-normal text-muted-foreground/60">可选</span>
              </label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978-..."
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                出版社 <span className="font-normal text-muted-foreground/60">可选</span>
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="出版社名称"
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                出版年 <span className="font-normal text-muted-foreground/60">可选</span>
              </label>
              <input
                type="number"
                value={publishYear}
                onChange={(e) => setPublishYear(e.target.value)}
                placeholder="2024"
                min="0"
                max="2100"
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">常规分类</label>
              <select
                value={genreCategoryId ?? ''}
                onChange={(e) => setGenreCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="h-9 w-full appearance-none rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              >
                <option value="">未分类</option>
                {genreCategories.data?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">阅读状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 w-full appearance-none rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              >
                {Object.entries(BOOK_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">可见性</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="h-9 w-full appearance-none rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              >
                <option value={VISIBILITY.PRIVATE}>私密</option>
                <option value={VISIBILITY.PUBLIC}>公开</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                阅读目的 <span className="font-normal text-muted-foreground/60">可选</span>
              </label>
              <input
                type="text"
                value={readingPurpose}
                onChange={(e) => setReadingPurpose(e.target.value)}
                placeholder="泛读 / 精读 / 参考 ..."
                className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-foreground">标签</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.data?.map((t) => {
                  const on = tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] transition-all',
                        on
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                      )}
                    >
                      {on && (
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                      )}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="col-span-2 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-border bg-transparent px-5 text-[13.5px] font-medium text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={submitting}
            className="h-9 rounded-lg bg-primary px-5 text-[13.5px] font-medium text-white shadow-[0_2px_8px_rgba(217,119,87,0.25)] transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
      {metadataPasteOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          onClick={(event) => {
            event.stopPropagation();
            setMetadataPasteOpen(false);
          }}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-medium text-foreground">粘贴豆瓣书籍信息</h3>
                <p className="mt-1 text-xs text-muted-foreground">会自动识别书名、作者、出版社、出版年、ISBN、页数等字段。</p>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => setMetadataPasteOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <textarea
                value={metadataPasteText}
                onChange={(event) => setMetadataPasteText(event.target.value)}
                rows={12}
                placeholder="粘贴豆瓣条目信息，例如：&#10;邓小平时代&#10;作者: [【美】傅高义](...)&#10;出版社: 生活·读书·新知三联书店&#10;出版年: 2013-1-18&#10;ISBN: 9787108041531&#10;页数: 754"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
              />
            </div>
            <div className="flex justify-end gap-2.5 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setMetadataPasteOpen(false)}
                className="h-9 rounded-lg border border-border bg-transparent px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                取消
              </button>
              <button
                type="button"
                onClick={applyPastedMetadata}
                disabled={!metadataPasteText.trim()}
                className="h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-white shadow-[0_2px_8px_rgba(217,119,87,0.25)] transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                填入表单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportBooksDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportBooksResult | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dryRun, setDryRun] = useState(false);

  const importCsv = async () => {
    if (!file) {
      setError('请先选择 CSV 文件');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await api.postForm<ImportBooksResult>(`/books/import${dryRun ? '?dry_run=true' : ''}`, form);
      setResult(data);
      if (!dryRun) {
        qc.invalidateQueries({ queryKey: ['books'] });
        qc.invalidateQueries({ queryKey: ['categories'] });
        qc.invalidateQueries({ queryKey: ['tags'] });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const problemRows = result?.rows.filter((row) => !row.success) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-xl font-medium text-foreground">批量导入书籍</h2>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-lg border border-border bg-muted p-4">
            <div className="text-sm font-medium text-foreground">CSV 模板</div>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              模板包含书名、作者、ISBN、分类、标签、状态、评分等字段。导入只创建书籍元数据，不包含文件。
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => { window.location.href = '/api/v1/books/import/template'; }}
            >
              下载参考 CSV
            </Button>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-medium text-foreground">选择已填写的 CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>仅校验不导入（预览模式）</span>
          </label>

          {error && (
            <div className="rounded-md bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm font-medium text-foreground">
                {result.dry_run
                  ? `预览通过 ${result.valid} 行，跳过 ${result.skipped} 行，失败 ${result.failed} 行`
                  : `已创建 ${result.created} 本，跳过 ${result.skipped} 行，失败 ${result.failed} 行`}
              </div>
              {problemRows.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-border">
                  {problemRows.slice(0, 20).map((row) => (
                    <div key={row.row} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                      <span className="font-medium text-foreground">第 {row.row} 行</span>
                      <span className="ml-2 text-muted-foreground">{row.title ?? '未命名'}</span>
                      <div className="mt-1 text-red-700">{row.error}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={onClose}>关闭</Button>
            <Button type="button" onClick={importCsv} disabled={submitting}>
              {submitting ? (dryRun ? '校验中...' : '导入中...') : (dryRun ? '开始校验' : '开始导入')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}



export function Bookshelf({ initialPageView = 'bookshelf' }: { initialPageView?: PageView }) {
  const user = useShellUser();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [visibility, setVisibility] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [tag, setTag] = useState('ALL');
  const [favorited, setFavorited] = useState(false);
  const [sort, setSort] = useState<SortMode>('updated_desc');
  const [viewMode, setViewMode] = useState<ViewMode>('A');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pageView, setPageView] = useState<PageView>(initialPageView);
  const [detailBookId, setDetailBookId] = useState<number | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    setPageView(initialPageView);
  }, [initialPageView]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  const booksQueryParams = useMemo(() => ({
    page_size: 200,
    sort: SORT_API_MAP[sort],
    ...(debouncedSearch ? { q: debouncedSearch } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(visibility !== 'ALL' ? { visibility } : {}),
    ...(category !== 'ALL' ? { category_id: Number(category) } : {}),
    ...(tag !== 'ALL' ? { tag_id: tag } : {}),
    ...(favorited ? { favorited: true } : {}),
  }), [debouncedSearch, status, visibility, category, tag, favorited, sort]);

  const trashQueryParams = useMemo(() => ({
    page_size: 200,
    sort: '-deleted_at',
    ...(debouncedSearch ? { q: debouncedSearch } : {}),
  }), [debouncedSearch]);

  const booksQuery = useBooks(booksQueryParams);
  const trashQuery = useTrash(trashQueryParams);
  const restoreBook = useRestoreBook();
  const permanentDeleteBook = usePermanentDeleteBook();
  const emptyTrash = useEmptyTrash();

  const rawBooks = useMemo(() => {
    if (pageView === 'trash') {
      return trashQuery.data?.data ?? [];
    }
    return booksQuery.data?.data ?? [];
  }, [pageView, booksQuery.data?.data, trashQuery.data?.data]);

  const isLoading = pageView === 'trash' ? trashQuery.isLoading : booksQuery.isLoading;
  const isError = pageView === 'trash' ? trashQuery.isError : booksQuery.isError;
  const error = pageView === 'trash' ? trashQuery.error : booksQuery.error;
  const retryRefetch = pageView === 'trash' ? () => trashQuery.refetch() : () => booksQuery.refetch();
  const total = pageView === 'trash' ? trashQuery.data?.pagination.total : booksQuery.data?.pagination.total;

  const categoryOptions = useMemo(
    () => ['ALL', ...new Set(rawBooks.map((book) => book.category_name).filter((value): value is string => Boolean(value)))],
    [rawBooks],
  );

  const tagOptions = useMemo(() => ['ALL', ...new Set(rawBooks.flatMap((book) => book.tag_names))], [rawBooks]);

  const sidebarStats = useSidebarStats();

  const books = rawBooks;

  const hasFilter = debouncedSearch || status !== 'ALL' || visibility !== 'ALL' || category !== 'ALL' || tag !== 'ALL' || favorited;

  const handleRestore = useCallback(async (id: number) => {
    try {
      await restoreBook.mutateAsync(id);
    } catch {
      // handled by mutation
    }
  }, [restoreBook]);

  const handlePermanentDelete = useCallback(async (id: number) => {
    try {
      await permanentDeleteBook.mutateAsync(id);
    } catch {
      // handled by mutation
    }
  }, [permanentDeleteBook]);

  const handleEmptyTrash = useCallback(async () => {
    try {
      await emptyTrash.mutateAsync();
    } catch {
      // handled by mutation
    }
  }, [emptyTrash]);

  return (
    <>
      <AppShell
        activeKey={pageView === 'trash' ? 'trash' : 'bookshelf'}
        user={user}
        searchValue={search}
        onSearchChange={setSearch}
      stats={sidebarStats}
        mainClassName="px-6 py-6 lg:px-8"
      >
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground font-display">
              {pageView === 'trash' ? '回收站' : '书架'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading ? '正在加载' : `显示 ${books.length} 本书`}
              {total != null && total > books.length && `（共 ${total} 本）`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pageView === 'trash' && books.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleEmptyTrash}>
                清空回收站
              </Button>
            )}
            {pageView === 'bookshelf' && (
              <>
                <Button variant="outline" className="rounded-full" onClick={() => setShowImport(true)}>
                  <FileUp className="h-4 w-4" />
                  批量导入
                </Button>
                <Button className="rounded-full" onClick={() => setShowCreate(true)}>
                  <BookPlus className="h-4 w-4" />
                  添加书籍
                </Button>
              </>
            )}
          </div>
        </header>

        {pageView === 'bookshelf' && (
          <section className="mb-5 flex flex-wrap items-center gap-3">
            <StatusPills value={status} onChange={setStatus} />

            <div className="h-5 w-px bg-border hidden sm:block" />

            <div className="flex items-center gap-2">
              <FilterSelect
                value={category}
                onChange={setCategory}
                options={categoryOptions.map((item) => [item, item === 'ALL' ? '全部分类' : item])}
              />
              <FilterSelect value={tag} onChange={setTag} options={tagOptions.map((item) => [item, item === 'ALL' ? '全部标签' : item])} />
              <FilterSelect value={visibility} onChange={setVisibility} options={VISIBILITY_OPTIONS.map((item) => [item.value, item.label])} />
              <button
                type="button"
                title="收藏"
                onClick={() => setFavorited((v) => !v)}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                  favorited
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted text-muted-foreground hover:border-primary/30 hover:text-foreground',
                )}
              >
                <Heart className={cn('h-3.5 w-3.5', favorited ? 'fill-current' : '')} />
                收藏
              </button>
              <FilterSelect value={sort} onChange={(value) => setSort(value as SortMode)} options={SORT_OPTIONS.map((item) => [item.value, item.label])} />
            </div>

            <div className="flex-1" />

            <div className="flex shrink-0 items-center rounded-full border border-border bg-muted p-0.5">
              <ViewButton active={viewMode === 'A'} label="网格视图" onClick={() => setViewMode('A')}>
                <Grid3X3 className="h-3.5 w-3.5" />
                网格
              </ViewButton>
              <ViewButton active={viewMode === 'B'} label="书签视图" onClick={() => setViewMode('B')}>
                <Bookmark className="h-3.5 w-3.5" />
                书签
              </ViewButton>
              <ViewButton active={viewMode === 'C'} label="卡片视图" onClick={() => setViewMode('C')}>
                <LayoutGrid className="h-3.5 w-3.5" />
                卡片
              </ViewButton>
              <ViewButton active={viewMode === 'D'} label="表格视图" onClick={() => setViewMode('D')}>
                <LayoutList className="h-3.5 w-3.5" />
                表格
              </ViewButton>
            </div>
          </section>
        )}

        {isLoading && (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
            正在整理书架...
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-6 py-12 text-center">
            <p className="font-medium text-foreground">书架加载失败</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {error instanceof ApiError ? error.message : '请检查本地 API 是否正常启动。'}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={() => retryRefetch()}
            >
              重新加载
            </button>
          </div>
        )}

        {!isLoading && !isError && books.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <p className="font-medium text-foreground">
              {pageView === 'trash' ? '回收站为空' : hasFilter ? '没有匹配的书籍' : '书架为空'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {pageView === 'trash'
                ? '删除的书籍会出现在这里。'
                : hasFilter
                  ? '可以放宽筛选条件，或清空搜索关键词。'
                  : '添加一本书后，这里会显示书籍列表。'}
            </p>
          </div>
        )}

        {!isLoading && !isError && books.length > 0 && viewMode === 'A' && (
          <section className="grid grid-cols-1 gap-y-3 gap-x-2 xl:grid-cols-2 2xl:grid-cols-3">
            {books.map((book, index) => (
              <BookCardA
                key={book.id}
                book={book}
                index={index}
                onOpenDetail={() => setDetailBookId(book.id)}
                isTrash={pageView === 'trash'}
                onRestore={() => handleRestore(book.id)}
                onPermanentDelete={() => handlePermanentDelete(book.id)}
              />
            ))}
          </section>
        )}

        {!isLoading && !isError && books.length > 0 && viewMode === 'B' && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {books.map((book, index) => (
              <BookCardB
                key={book.id}
                book={book}
                index={index}
                onOpenDetail={() => setDetailBookId(book.id)}
                isTrash={pageView === 'trash'}
                onRestore={() => handleRestore(book.id)}
                onPermanentDelete={() => handlePermanentDelete(book.id)}
              />
            ))}
          </section>
        )}

        {!isLoading && !isError && books.length > 0 && viewMode === 'C' && (
          <section className="grid grid-cols-3 gap-y-3 gap-x-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
            {books.map((book, index) => (
              <BookCardC
                key={book.id}
                book={book}
                index={index}
                onOpenDetail={() => setDetailBookId(book.id)}
                isTrash={pageView === 'trash'}
                onRestore={() => handleRestore(book.id)}
                onPermanentDelete={() => handlePermanentDelete(book.id)}
              />
            ))}
          </section>
        )}

        {!isLoading && !isError && books.length > 0 && viewMode === 'D' && (
          <section className="flex flex-col gap-1">
            {/* 表头 */}
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
                onOpenDetail={() => setDetailBookId(book.id)}
                isTrash={pageView === 'trash'}
                onRestore={() => handleRestore(book.id)}
                onPermanentDelete={() => handlePermanentDelete(book.id)}
              />
            ))}
          </section>
        )}
      </AppShell>

      {showCreate && <CreateBookForm onClose={() => setShowCreate(false)} />}
      {showImport && <ImportBooksDialog onClose={() => setShowImport(false)} />}
      <BookDetailSheet bookId={detailBookId} open={detailBookId !== null} onClose={() => setDetailBookId(null)} />
    </>
  );
}

function StatusPills({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const items = [
    { value: 'ALL', label: '全部' },
    ...STATUS_OPTIONS.slice(1),
  ];
  return (
    <div className="flex items-center gap-1.5">
      {items.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <select
      className="h-8 rounded-full border border-border bg-muted px-3 text-xs text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground',
        active && 'bg-card text-foreground shadow-sm',
      )}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  );
}
