import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  BookOpen,
  BookPlus,
  Bookmark,
  Check,
  Grid3X3,
  LayoutGrid,
  LayoutList,
  Lightbulb,
  Loader2,
  Search,
  Settings,
  Star,
  Trash2,
  User,
  X,
  Sparkles,
  NotebookPen,
  Heart,
} from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS, VISIBILITY } from '@redesk/shared';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  useBooks,
  useTrash,
  useRestoreBook,
  usePermanentDeleteBook,
  useEmptyTrash,
  useBook,
  useUpdateBook,
  type BookSummary,
} from '@/hooks/use-books';
import { useBookFiles } from '@/hooks/use-files';
import { useCategories } from '@/hooks/use-categories';
import { useTags } from '@/hooks/use-tags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShellUser } from '@/components/shell-user-context';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';

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

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
      className="absolute right-5 top-5 z-10 flex items-center gap-[3px] rounded p-1 transition-colors hover:bg-[rgba(0,0,0,0.03)]"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <span className="block h-1 w-1 rounded-full bg-[#d0d0d0] transition-colors hover:bg-[#999]" />
      <span className="block h-1 w-1 rounded-full bg-[#d0d0d0] transition-colors hover:bg-[#999]" />
      <span className="block h-1 w-1 rounded-full bg-[#d0d0d0] transition-colors hover:bg-[#999]" />
    </button>
  );
}

function MenuMoreSmall({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="absolute right-4 top-4 z-10 flex items-center gap-[3px] rounded p-1 transition-colors hover:bg-[rgba(0,0,0,0.03)]"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <span className="block h-1 w-1 rounded-full bg-[#d0d0d0] transition-colors hover:bg-[#999]" />
      <span className="block h-1 w-1 rounded-full bg-[#d0d0d0] transition-colors hover:bg-[#999]" />
      <span className="block h-1 w-1 rounded-full bg-[#d0d0d0] transition-colors hover:bg-[#999]" />
    </button>
  );
}

function MenuMoreTiny({ onClick, className }: { onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={cn("absolute right-4 top-3.5 z-10 flex items-center gap-[3px] rounded p-1 transition-colors hover:bg-[rgba(0,0,0,0.03)]", className)}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <span className="block h-1 w-1 rounded-full bg-[#d0d0d0] transition-colors hover:bg-[#999]" />
      <span className="block h-1 w-1 rounded-full bg-[#d0d0d0] transition-colors hover:bg-[#999]" />
      <span className="block h-1 w-1 rounded-full bg-[#d0d0d0] transition-colors hover:bg-[#999]" />
    </button>
  );
}

function TagAtom({ children, size = 'default' }: { children: React.ReactNode; size?: 'default' | 'small' | 'tiny' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border border-[#ebebeb] bg-[#fafafa] text-[#666] transition-colors hover:border-[#ddd] hover:bg-[#f5f5f5] hover:text-[#444]',
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
    <div className={cn('inline-flex items-center gap-1 font-semibold text-[#262626]', size === 'xs' ? 'text-[13px]' : 'text-sm')}>
      <Star className={cn('fill-[#f5c842] text-[#f5c842]', size === 'xs' ? 'h-3 w-3' : 'h-[13px] w-[13px]')} />
      {rating ?? '—'}
    </div>
  );
}

function ProgressBar({ progress, trackWidth = 'w-[70px]', trackHeight = 'h-1' }: { progress: number; trackWidth?: string; trackHeight?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className={cn('overflow-hidden rounded-full bg-[#f0f0f0]', trackWidth, trackHeight)}>
        <div
          className="h-full rounded-full bg-[#2f7af5] transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="min-w-[32px] text-right text-[13px] font-medium tabular-nums text-[#666]">{progress}%</span>
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
      className="group relative flex gap-[18px] rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.06)] transition-[transform,box-shadow] duration-[0.25s] hover:-translate-y-[3px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)]"
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
        <div className="mb-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#262626]">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass(book.status))} />
          {statusLabel(book.status)}
        </div>
        <h2 className="mb-1.5 line-clamp-2 text-base font-bold leading-[1.4] tracking-[-0.2px] text-[#1a1a1a]">{book.title}</h2>
        <p className="mb-2.5 truncate text-[13px] leading-[1.5] text-[#999]">{bookMeta(book) || '未填写作者'}</p>
        <div className="mb-2.5 flex flex-wrap gap-2">
          {book.tag_names.slice(0, 3).map((tag) => (
            <TagAtom key={tag}>{tag}</TagAtom>
          ))}
        </div>
        <p className="mb-3.5 text-[13px] leading-[1.5] tabular-nums text-[#999]">{bookMetaLine(book)}</p>
        <div className="mt-auto flex items-center gap-3.5 border-t border-[#f5f5f5] pt-3">
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
    <article className="group flex w-[200px] flex-col rounded-lg bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        className="relative mx-auto mb-2.5 block h-[190px] w-[130px] cursor-not-allowed overflow-hidden rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
        disabled
        title="阅读器将在 M2 上线"
      >
        <BookCoverImage book={book} index={index} className="h-full w-full" rounded="rounded-md" />
        <div className="pointer-events-none absolute inset-0 rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]" />
        <div className="absolute left-2 top-2 z-10 inline-flex items-center gap-[5px] rounded-xl bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-md">
          <span className={cn('h-1.5 w-1.5 rounded-full shadow-[0_0_4px_rgba(77,171,247,0.6)]', statusDotClass(book.status))} />
          {statusLabel(book.status)}
        </div>
        <div
          className="absolute bottom-2 right-2 z-10 flex items-center gap-[3px] rounded-[10px] bg-black/45 px-[7px] py-[5px] backdrop-blur-md transition-colors hover:bg-black/65"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block h-[3px] w-[3px] rounded-full bg-white/85" />
          <span className="block h-[3px] w-[3px] rounded-full bg-white/85" />
          <span className="block h-[3px] w-[3px] rounded-full bg-white/85" />
        </div>
      </button>
      <div className="flex flex-col" onClick={onOpenDetail}>
        <h2 className="mb-1 line-clamp-2 text-[15px] font-bold leading-[1.4] tracking-[-0.2px] text-[#1a1a1a]">{book.title}</h2>
        <p className="mb-1.5 truncate text-xs leading-[1.5] text-[#999]">{book.author || '未填写作者'}</p>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {book.tag_names.slice(0, 3).map((tag) => (
            <TagAtom key={tag} size="small">{tag}</TagAtom>
          ))}
        </div>
        <p className="mb-1.5 text-xs leading-[1.5] tabular-nums text-[#999]">{bookMetaLine(book)}</p>
        <div className="mt-auto flex items-center justify-between border-t border-[#f5f5f5] pt-2">
          <RatingDisplay rating={book.rating} size="xs" />
          <ProgressBar progress={progress} trackWidth="w-[56px]" trackHeight="h-[3px]" />
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
    <article className="group relative flex items-start gap-4 rounded-lg bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
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
          <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#262626]">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass(book.status))} />
            {statusLabel(book.status)}
          </div>
          <RatingDisplay rating={book.rating} />
        </div>
        <h2 className="mb-1.5 line-clamp-2 text-[15px] font-bold leading-[1.4] tracking-[-0.2px] text-[#1a1a1a]">{book.title}</h2>
        <p className="mb-2.5 truncate text-[13px] leading-[1.5] text-[#999]">{bookMeta(book) || '未填写作者'}</p>
        <div className="mb-2.5 flex flex-wrap gap-2">
          {book.tag_names.slice(0, 3).map((tag) => (
            <TagAtom key={tag}>{tag}</TagAtom>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <p className="text-[13px] leading-[1.5] tabular-nums text-[#999]">{bookMetaLine(book)}</p>
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
    <article className="group relative flex items-center gap-4 rounded-lg bg-white px-5 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      {!isTrash && <MenuMoreTiny onClick={onOpenDetail} />}
      <button
        type="button"
        className="relative shrink-0 cursor-not-allowed overflow-hidden rounded shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
        disabled
        title="阅读器将在 M2 上线"
      >
        <BookCoverImage book={book} index={index} className="h-[76px] w-[56px]" rounded="rounded" />
        <div className="pointer-events-none absolute inset-0 rounded shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]" />
      </button>
      <div
        className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center border-r border-[#f0f0f0] pr-5"
        onClick={onOpenDetail}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full', statusDotClass(book.status))} />
          <span className="text-xs font-medium text-[#999]">{statusLabel(book.status)}</span>
          <h2 className="truncate text-sm font-bold leading-[1.4] tracking-[-0.2px] text-[#1a1a1a]">{book.title}</h2>
        </div>
        <p className="mb-0.5 truncate text-xs leading-[1.5] text-[#999]">{book.author || '未填写作者'}</p>
        <p className="text-xs leading-[1.5] tabular-nums text-[#999]">{bookMetaLine(book)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 pr-6">
        <RatingDisplay rating={book.rating} size="xs" />
        <ProgressBar progress={progress} trackWidth="w-[64px]" trackHeight="h-[3px]" />
      </div>
      {isTrash && (
        <div className="absolute right-5 top-3.5">
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
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [genreCategoryId, setGenreCategoryId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>(BOOK_STATUS.COLLECTED);
  const [visibility, setVisibility] = useState<string>(VISIBILITY.PRIVATE);
  const [rating, setRating] = useState<number | null>(null);
  const [readingPurpose, setReadingPurpose] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = useCallback((tagId: number) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        title,
        subtitle: subtitle || null,
        author: author || null,
        isbn: isbn || null,
        publisher: publisher || null,
        publish_year: publishYear ? Number(publishYear) : null,
        description: description || null,
        category_id: categoryId,
        genre_category_id: genreCategoryId,
        status,
        visibility,
        reading_purpose: readingPurpose || null,
        rating,
        source_url: sourceUrl || null,
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-8" onClick={onClose}>
      <Card className="w-full max-w-lg border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="font-serif text-xl">添加书籍</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">书名</Label>
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="必填" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">副标题</Label>
              <Input id="subtitle" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="可选" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="author">作者</Label>
                <Input id="author" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="可选" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isbn">ISBN</Label>
                <Input id="isbn" value={isbn} onChange={(event) => setIsbn(event.target.value)} placeholder="可选" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="publisher">出版社</Label>
                <Input id="publisher" value={publisher} onChange={(event) => setPublisher(event.target.value)} placeholder="可选" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publishYear">出版年</Label>
                <Input id="publishYear" type="number" min="0" max="2100" value={publishYear} onChange={(event) => setPublishYear(event.target.value)} placeholder="可选" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>个人分类</Label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={categoryId ?? ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">未分类</option>
                  {personalCategories.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>常规分类</Label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={genreCategoryId ?? ''}
                  onChange={(e) => setGenreCategoryId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">未分类</option>
                  {genreCategories.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>状态</Label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {Object.entries(BOOK_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pageCount">页数</Label>
                <Input id="pageCount" type="number" min="0" value={pageCount} onChange={(event) => setPageCount(event.target.value)} placeholder="可选" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>可见性</Label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value={VISIBILITY.PRIVATE}>私密</option>
                  <option value={VISIBILITY.PUBLIC}>公开</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>评分</Label>
                <div className="flex items-center gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRating(rating === r ? null : r)}
                      className={cn(r <= (rating ?? 0) ? 'text-yellow-500' : 'text-muted-foreground/30')}
                    >
                      <Star className="h-5 w-5 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourceUrl">书籍介绍链接</Label>
              <Input id="sourceUrl" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://douban.com/...（可选）" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="readingPurpose">阅读目的</Label>
              <Input id="readingPurpose" value={readingPurpose} onChange={(event) => setReadingPurpose(event.target.value)} placeholder="泛读/精读/参考…（可选）" />
            </div>
            <div className="space-y-2">
              <Label>标签</Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.data?.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      tagIds.includes(t.id)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/20',
                    )}
                    onClick={() => toggleTag(t.id)}
                  >
                    {tagIds.includes(t.id) ? <Check className="mr-1 inline h-3 w-3" /> : null}
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>书籍简介</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选"
              />
            </div>
            <div className="space-y-2">
              <Label>上传文件（可选）</Label>
              <input
                type="file"
                accept=".epub,.pdf,.mobi,.txt,.azw3,.azw,.djvu,.docx,.fb2"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">已选择: {selectedFile.name}</p>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '创建中...' : '创建'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

function StatusBanner({ message }: { message: StatusMessage }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'mb-4 rounded-md px-4 py-2.5 text-sm',
        message.type === 'success'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
      )}
    >
      {message.text}
    </div>
  );
}

function ReadModeBadge({ mode }: { mode: string }) {
  if (mode === '精读') {
    return (
      <span className="inline-flex items-center gap-1 rounded-2xl bg-[#fff3e0] px-2.5 py-1 text-xs font-semibold text-[#e65100]">
        🔍 精读
      </span>
    );
  }
  if (mode === '泛读') {
    return (
      <span className="inline-flex items-center gap-1 rounded-2xl bg-[#e3f2fd] px-2.5 py-1 text-xs font-semibold text-[#1565c0]">
        📖 泛读
      </span>
    );
  }
  if (mode === '收录') {
    return (
      <span className="inline-flex items-center gap-1 rounded-2xl bg-[#f3e5f5] px-2.5 py-1 text-xs font-semibold text-[#7b1fa2]">
        📚 收录
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-2xl bg-[#f5f5f5] px-2.5 py-1 text-xs font-semibold text-[#555]">
      {mode}
    </span>
  );
}

function BookDetailSheet({ bookId, open, onClose }: { bookId: number | null; open: boolean; onClose: () => void }) {
  const book = useBook(bookId ?? 0);
  const updateBook = useUpdateBook();
  const files = useBookFiles(bookId ?? 0);
  const categories = useCategories();
  const tags = useTags();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<StatusMessage>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editVisibility, setEditVisibility] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editRating, setEditRating] = useState<number | null>(null);
  const [editReadingPurpose, setEditReadingPurpose] = useState('');
  const [editTagIds, setEditTagIds] = useState<number[]>([]);
  const [editCustomAttributes, setEditCustomAttributes] = useState('');

  const openEdit = useCallback(() => {
    if (!book.data) return;
    setEditTitle(book.data.title);
    setEditAuthor(book.data.author ?? '');
    setEditStatus(book.data.status);
    setEditVisibility(book.data.visibility);
    setEditCategoryId(book.data.category_id);
    setEditRating(book.data.rating);
    setEditReadingPurpose(book.data.reading_purpose ?? '');
    setEditTagIds(book.data.tag_ids);
    setEditCustomAttributes(book.data.custom_attributes ?? '');
    setEditing(true);
  }, [book.data]);

  const saveMeta = useCallback(async () => {
    if (!bookId) return;
    try {
      await updateBook.mutateAsync({
        id: bookId,
        title: editTitle,
        author: editAuthor,
        status: editStatus,
        visibility: editVisibility,
        category_id: editCategoryId,
        rating: editRating,
        reading_purpose: editReadingPurpose || null,
        tag_ids: editTagIds,
        custom_attributes: editCustomAttributes || null,
      });
      setMessage({ type: 'success', text: '已更新' });
      setEditing(false);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '更新失败' });
    }
  }, [bookId, editTitle, editAuthor, editStatus, editVisibility, editCategoryId, editRating, editReadingPurpose, editTagIds, editCustomAttributes, updateBook]);

  const toggleTag = useCallback((tagId: number) => {
    setEditTagIds((prev) => (prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]));
  }, []);

  const b = book.data;
  const hasCover = Boolean(b?.cover_path);
  const progress = b ? bookProgress(b) : 0;

  const customAttrs = useMemo(() => {
    if (!b?.custom_attributes) return [];
    try {
      const parsed = JSON.parse(b.custom_attributes);
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed).map(([k, v]) => `${k}: ${String(v)}`);
      }
    } catch {
      // ignore
    }
    return [];
  }, [b?.custom_attributes]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[480px] overflow-hidden border-0 p-0 shadow-[-8px_0_32px_rgba(0,0,0,0.1)] sm:max-w-[480px]"
        style={{ borderRadius: '12px 0 0 12px' }}
      >
        {book.isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {book.isError && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载失败</div>
        )}

        {b && !editing && (
          <div className="flex h-full flex-col">
            {/* 顶部封面区 */}
            <div className="relative h-[200px] shrink-0 overflow-hidden">
              {hasCover ? (
                <img
                  src={`${COVER_URL_BASE}/books/${bookId}/cover`}
                  alt={b.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className={cn('flex h-full w-full items-center justify-center', COVER_TONES[(bookId ?? 0) % COVER_TONES.length])}>
                  <span className="text-4xl font-bold">{b.title.slice(0, 1)}</span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 to-black/50" />
              <button
                type="button"
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.1)] backdrop-blur transition-all duration-200 hover:scale-105 hover:bg-white"
                onClick={onClose}
              >
                <X className="h-4 w-4 text-[#333]" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 z-[1] px-6 py-5 text-white">
                <h2 className="mb-1.5 text-[22px] font-bold leading-[1.3] tracking-[-0.3px]" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  {b.title}
                </h2>
                <p className="text-sm opacity-90" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {[b.author, b.publisher].filter(Boolean).join(' / ') || '未填写作者'}
                </p>
              </div>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'thin' }}>
              <StatusBanner message={message} />

              {/* 书籍本体区 */}
              <div className="mb-6 rounded-xl bg-[#fafafa] p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-2xl bg-[rgba(47,122,245,0.08)] px-2.5 py-1 text-xs font-semibold text-[#2f7af5]">
                    <span className={cn('h-[7px] w-[7px] rounded-full', statusDotClass(b.status))} />
                    {statusLabel(b.status)}
                  </span>
                  {b.rating != null && (
                    <span className="inline-flex items-center gap-1 text-[15px] font-bold text-[#1a1a1a]">
                      <Star className="h-[14px] w-[14px] fill-[#f5c842] text-[#f5c842]" />
                      {b.rating}
                    </span>
                  )}
                  {b.reading_purpose && <ReadModeBadge mode={b.reading_purpose} />}
                </div>

                <div className="mb-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-[#888]">
                    <span>阅读进度</span>
                    <span className="font-semibold text-[#333]">{progress}%</span>
                  </div>
                  <div className="h-[5px] overflow-hidden rounded-[3px] bg-[#e0e0e0]">
                    <div
                      className="h-full rounded-[3px] bg-[#2f7af5] transition-[width] duration-500"
                      style={{ width: `${progress}%`, transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
                    />
                  </div>
                </div>

                <div className="mb-3.5 flex flex-wrap gap-1.5">
                  {b.tag_names.map((tag) => (
                    <TagAtom key={tag} size="small">{tag}</TagAtom>
                  ))}
                  {b.category_name && (
                    <TagAtom key="cat" size="small">{b.category_name}</TagAtom>
                  )}
                </div>

                {customAttrs.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-[#e8e8e8] pt-3">
                    {customAttrs.map((attr) => (
                      <span key={attr} className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2.5 py-1 text-xs text-[#555]">
                        {attr}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 阅读沉淀区 */}
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.2px] text-[#1a1a1a]">
                  <span className="inline-block h-3.5 w-[3px] rounded-sm bg-[#2f7af5]" />
                  阅读沉淀
                </h3>
                <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] py-6 text-center">
                  <NotebookPen className="mx-auto h-5 w-5 text-muted-foreground/40" />
                  <p className="mt-2 text-[13px] text-muted-foreground">笔记、高亮、标注</p>
                  <p className="text-xs text-muted-foreground/60">阅读器上线后（M2）自动记录</p>
                </div>
              </div>

              {/* 主题阅读区 */}
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.2px] text-[#1a1a1a]">
                  <span className="inline-block h-3.5 w-[3px] rounded-sm bg-[#2f7af5]" />
                  主题阅读
                </h3>
                <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] py-6 text-center">
                  <Lightbulb className="mx-auto h-5 w-5 text-muted-foreground/40" />
                  <p className="mt-2 text-[13px] text-muted-foreground">围绕一个主题组织多本书</p>
                  <p className="text-xs text-muted-foreground/60">主题阅读 — 即将上线（M4）</p>
                </div>
              </div>

              {/* 文件列表 */}
              {files.data && files.data.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.2px] text-[#1a1a1a]">
                    <span className="inline-block h-3.5 w-[3px] rounded-sm bg-[#2f7af5]" />
                    文件 ({files.data.length})
                  </h3>
                  <div className="space-y-2">
                    {files.data.map((f: { id: number; original_filename: string | null; file_format: string; file_size: number | null; is_primary: number; updated_at: string }) => (
                      <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{f.original_filename ?? '未知文件'}</p>
                          <p className="text-xs text-muted-foreground">{f.file_format} · {formatFullDate(f.updated_at)}</p>
                        </div>
                        {f.is_primary === 1 && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">主阅读</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground/60 pt-2">
                创建 {formatFullDate(b.created_at)} · 更新 {formatFullDate(b.updated_at)}
              </div>
            </div>

            {/* 底部操作栏 */}
            <div className="flex shrink-0 gap-3 border-t border-[#f0f0f0] px-6 py-4">
              <button
                type="button"
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-[#e8e8e8] bg-[#f5f5f5] text-sm font-semibold text-[#333] transition-colors hover:bg-[#eee]"
                onClick={openEdit}
              >
                编辑属性
              </button>
              <button
                type="button"
                className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#2f7af5] text-sm font-semibold text-white shadow-[0_2px_8px_rgba(47,122,245,0.25)] transition-all hover:-translate-y-px hover:bg-[#1a68e5]"
                disabled
                title="阅读器将在 M2 上线"
              >
                继续阅读
              </button>
            </div>
          </div>
        )}

        {b && editing && (
          <div className="h-full overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">编辑信息</h2>
              <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <StatusBanner message={message} />
            <div className="space-y-2">
              <Label>书名</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>作者</Label>
              <Input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>状态</Label>
                <select className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  {Object.entries(BOOK_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>可见性</Label>
                <select className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)}>
                  <option value={VISIBILITY.PRIVATE}>私密</option>
                  <option value={VISIBILITY.PUBLIC}>公开</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类</Label>
                <select className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" value={editCategoryId ?? ''} onChange={(e) => setEditCategoryId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">未分类</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>评分</Label>
                <div className="flex items-center gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setEditRating(editRating === r ? null : r)}
                      className={cn(r <= (editRating ?? 0) ? 'text-primary' : 'text-muted-foreground/30')}
                    >
                      <Star className="h-5 w-5 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>阅读目的</Label>
              <Input placeholder="泛读/精读/参考…" value={editReadingPurpose} onChange={(e) => setEditReadingPurpose(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>标签</Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.data?.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      editTagIds.includes(t.id)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/20',
                    )}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>自定义属性</Label>
              <Input
                placeholder={'JSON 格式，如 {"来源":"朋友推荐"}'}
                value={editCustomAttributes}
                onChange={(e) => setEditCustomAttributes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">存储自定义收藏信息，需为合法 JSON</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
              <Button onClick={saveMeta} disabled={updateBook.isPending}>
                {updateBook.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                保存
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function Bookshelf() {
  const user = useShellUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [visibility, setVisibility] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [tag, setTag] = useState('ALL');
  const [favorited, setFavorited] = useState(false);
  const [sort, setSort] = useState<SortMode>('updated_desc');
  const [viewMode, setViewMode] = useState<ViewMode>('A');
  const [showCreate, setShowCreate] = useState(false);
  const [pageView, setPageView] = useState<PageView>('bookshelf');
  const [detailBookId, setDetailBookId] = useState<number | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [debouncedSearch, setDebouncedSearch] = useState('');

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

  const stats = useMemo(() => {
    const allBooks = booksQuery.data?.data ?? [];
    return {
      total: booksQuery.data?.pagination.total ?? 0,
      reading: allBooks.filter((book) => book.status === BOOK_STATUS.READING).length,
      read: allBooks.filter((book) => book.status === BOOK_STATUS.READ).length,
      topics: new Set(allBooks.flatMap((book) => book.tag_names)).size,
    };
  }, [booksQuery.data]);

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

  const handleSwitchView = useCallback((view: PageView) => {
    setPageView(view);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-[256px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-5 py-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-lg font-medium text-primary-foreground">
              R
            </div>
            <div className="font-display text-xl text-sidebar-foreground">Redesk</div>
            <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground/50">v{__APP_VERSION__}</span>
          </div>

          <div className="relative mt-5">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-full border-sidebar-border bg-background pl-9 text-sm"
              placeholder="搜索书名、作者、标签"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <nav className="mt-5 space-y-0.5">
            <SidebarItem
              icon={<Archive className="h-4 w-4" />}
              label="档案"
              onClick={() => navigate('/overview')}
            />
            <SidebarItem
              active={pageView === 'bookshelf'}
              icon={<BookOpen className="h-4 w-4" />}
              label="书架"
              onClick={() => handleSwitchView('bookshelf')}
            />
            <SidebarItem icon={<NotebookPen className="h-4 w-4" />} label="读书笔记" disabled hint="M2" />
            <SidebarItem icon={<Grid3X3 className="h-4 w-4" />} label="阅读话题" disabled hint="M4" />
            <SidebarItem
              active={pageView === 'trash'}
              icon={<Trash2 className="h-4 w-4" />}
              label="回收站"
              onClick={() => handleSwitchView('trash')}
            />
          </nav>
        </div>

        <div className="mt-10 w-full">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <StatCell label="总数" value={stats.total} />
            <StatCell label="在读" value={stats.reading} />
            <StatCell label="已读" value={stats.read} />
            <StatCell label="话题数" value={stats.topics} />
          </div>
        </div>

        <div className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/50 cursor-not-allowed"
            disabled
          >
            <Sparkles className="h-4 w-4" />
            AI 助手
            <span className="ml-auto text-[10px] text-muted-foreground/30">M3</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-4 w-4" />
            设置
          </button>
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 mt-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {user?.display_name ?? user?.username ?? 'Maxxie'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
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
              <Button className="rounded-full" onClick={() => setShowCreate(true)}>
                <BookPlus className="h-4 w-4" />
                添加书籍
              </Button>
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
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
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
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
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
          <section className="flex flex-col gap-3">
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
      </main>

      {showCreate && <CreateBookForm onClose={() => setShowCreate(false)} />}
      <BookDetailSheet bookId={detailBookId} open={detailBookId !== null} onClose={() => setDetailBookId(null)} />
    </div>
  );
}

function SidebarItem({ active, icon, label, onClick, disabled, hint }: { active?: boolean; icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; hint?: string }) {
  if (disabled) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground/50 cursor-not-allowed"
        disabled
      >
        {icon}
        {label}
        {hint && <span className="ml-auto text-[10px] text-muted-foreground/30">{hint}</span>}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
        active && 'bg-sidebar-primary text-sidebar-primary-foreground font-medium hover:bg-sidebar-primary',
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-foreground">{value}</div>
    </div>
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
