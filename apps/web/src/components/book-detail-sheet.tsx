import { useMemo, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileUp,
  Heart,
  ImageDown,
  Lightbulb,
  Loader2,
  NotebookPen,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS, VISIBILITY } from '@redesk/shared';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  useBook,
  useUpdateBook,
  useBookCovers,
  useFetchBookCover,
  useActivateBookCover,
  useDeleteBookCover,
  useUploadBookCover,
  useFetchBookMetadata,
  useApplyBookMetadata,
  useFavoriteBook,
  useUnfavoriteBook,
  type BookSummary,
  type BookCoverItem,
  type LinkMetadata,
} from '@/hooks/use-books';
import { useBookFiles } from '@/hooks/use-files';
import { useCategories } from '@/hooks/use-categories';
import { useTags } from '@/hooks/use-tags';
import { Button } from '@/components/ui/button';


const COVER_URL_BASE = '/api/v1';

const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

function statusLabel(status: string) {
  if (status === BOOK_STATUS.COLLECTED) return '已收录';
  return BOOK_STATUS_LABELS[status as keyof typeof BOOK_STATUS_LABELS] ?? status;
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

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value));
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

function ReadModeBadge({ mode }: { mode: string }) {
  if (mode === '精读') {
    return (
      <span className="inline-flex items-center gap-1 rounded-2xl bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        🔍 精读
      </span>
    );
  }
  if (mode === '泛读') {
    return (
      <span className="inline-flex items-center gap-1 rounded-2xl bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
        📖 泛读
      </span>
    );
  }
  if (mode === '收录') {
    return (
      <span className="inline-flex items-center gap-1 rounded-2xl bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
        📚 收录
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-2xl bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      {mode}
    </span>
  );
}

type EditableField = 'title' | 'author' | 'status' | 'category' | 'rating' | 'readingPurpose' | 'visibility' | 'sourceUrl' | 'customAttributes' | null;

export function BookDetailSheet({ bookId, open, onClose }: { bookId: number | null; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const book = useBook(bookId ?? 0);
  const updateBook = useUpdateBook();
  const files = useBookFiles(bookId ?? 0);
  const covers = useBookCovers(bookId ?? 0);
  const personalCategories = useCategories('PERSONAL');
  const tagsQuery = useTags();
  const fetchCover = useFetchBookCover();
  const activateCover = useActivateBookCover();
  const deleteCover = useDeleteBookCover();
  const uploadCover = useUploadBookCover();
  const fetchMetadata = useFetchBookMetadata();
  const applyMetadata = useApplyBookMetadata();
  const favoriteBook = useFavoriteBook();
  const unfavoriteBook = useUnfavoriteBook();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState<StatusMessage>(null);
  const [editingField, setEditingField] = useState<EditableField>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editTagIds, setEditTagIds] = useState<number[]>([]);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [metadataResult, setMetadataResult] = useState<LinkMetadata | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  const [fetchCoverChecked, setFetchCoverChecked] = useState(false);
  const categories = personalCategories;
  const tags = tagsQuery;

  const startEdit = useCallback((field: EditableField, value: string) => {
    setEditingField(field);
    setEditValue(value);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  const saveField = useCallback(async (field: EditableField, value: string) => {
    if (!bookId || !book.data) return;
    try {
      const payload: Record<string, unknown> = {};
      switch (field) {
        case 'title':
          payload.title = value;
          break;
        case 'author':
          payload.author = value || null;
          break;
        case 'status':
          payload.status = value;
          break;
        case 'category':
          payload.category_id = value ? Number(value) : null;
          break;
        case 'rating':
          payload.rating = value ? Number(value) : null;
          break;
        case 'readingPurpose':
          payload.reading_purpose = value || null;
          break;
        case 'visibility':
          payload.visibility = value;
          break;
        case 'sourceUrl':
          payload.source_url = value || null;
          break;
        case 'customAttributes':
          payload.custom_attributes = value || null;
          break;
        default:
          return;
      }
      await updateBook.mutateAsync({ id: bookId, ...payload });
      setMessage({ type: 'success', text: '已更新' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '更新失败' });
    } finally {
      setEditingField(null);
      setEditValue('');
    }
  }, [bookId, book.data, updateBook]);

  const saveTags = useCallback(async () => {
    if (!bookId) return;
    try {
      await updateBook.mutateAsync({ id: bookId, tag_ids: editTagIds });
      setMessage({ type: 'success', text: '标签已更新' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '更新失败' });
    }
    setEditingField(null);
  }, [bookId, editTagIds, updateBook]);

  const toggleTag = useCallback((tagId: number) => {
    setEditTagIds((prev) => (prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]));
  }, []);

  const startEditTags = useCallback(() => {
    if (!book.data) return;
    setEditTagIds(book.data.tag_ids);
    setEditingField('tags' as unknown as EditableField);
  }, [book.data]);

  const handleFavorite = useCallback(async () => {
    if (!book.data || !bookId) return;
    try {
      if (book.data.favorited_at) {
        await unfavoriteBook.mutateAsync(bookId);
      } else {
        await favoriteBook.mutateAsync(bookId);
      }
    } catch {
      // ignore
    }
  }, [book.data, bookId, favoriteBook, unfavoriteBook]);

  const handleFetchCover = useCallback(async () => {
    if (!bookId) return;
    try {
      await fetchCover.mutateAsync({ bookId });
      setMessage({ type: 'success', text: '封面已下载' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '封面下载失败' });
    }
  }, [bookId, fetchCover]);

  const handleActivateCover = useCallback(async (coverId: number) => {
    if (!bookId) return;
    try {
      await activateCover.mutateAsync({ bookId, coverId });
      setMessage({ type: 'success', text: '已切换当前封面' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '切换封面失败' });
    }
  }, [activateCover, bookId]);

  const handleDeleteCover = useCallback(async (coverId: number) => {
    if (!bookId) return;
    try {
      await deleteCover.mutateAsync({ bookId, coverId });
      setMessage({ type: 'success', text: '封面已删除' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '删除封面失败' });
    }
  }, [bookId, deleteCover]);

  const handleCoverUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !bookId) return;
      try {
        await uploadCover.mutateAsync({ bookId, file });
        setMessage({ type: 'success', text: '封面已上传' });
        setTimeout(() => setMessage(null), 2000);
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '上传封面失败' });
      }
      if (coverInputRef.current) coverInputRef.current.value = '';
    },
    [bookId, uploadCover],
  );

  const handleOpenMetadataDialog = useCallback(async () => {
    const current = book.data;
    if (!current?.source_url) {
      setMessage({ type: 'error', text: '请先填写介绍页链接' });
      return;
    }
    try {
      const result = await fetchMetadata.mutateAsync(current.source_url);
      setMetadataResult(result);
      const initialSelected: Record<string, boolean> = {};
      const fieldKeys = ['title', 'author', 'subtitle', 'isbn', 'publisher', 'publish_year', 'description', 'language', 'translator', 'original_title', 'page_count'] as const;
      for (const key of fieldKeys) {
        const value = result[key as keyof LinkMetadata];
        const currentValue = current[key as keyof typeof current];
        if (value != null && String(value).trim() !== '' && (currentValue == null || String(currentValue).trim() === '')) {
          initialSelected[key] = true;
        } else if (value != null && String(value).trim() !== '' && currentValue != null && String(currentValue).trim() !== '') {
          initialSelected[key] = false;
        }
      }
      setSelectedFields(initialSelected);
      setFetchCoverChecked(Boolean(result.cover_url) && !current.cover_path);
      setShowMetadataDialog(true);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '抓取元数据失败' });
    }
  }, [book.data, fetchMetadata]);

  const handleApplyMetadata = useCallback(async () => {
    if (!metadataResult || !bookId) return;
    const fields: Record<string, unknown> = {};
    for (const [key, checked] of Object.entries(selectedFields)) {
      if (checked) {
        const value = metadataResult[key as keyof LinkMetadata];
        if (value != null) fields[key] = value;
      }
    }
    try {
      await applyMetadata.mutateAsync({ bookId, fields, fetchCover: fetchCoverChecked });
      setMessage({ type: 'success', text: '元数据已更新' });
      setTimeout(() => setMessage(null), 2000);
      setShowMetadataDialog(false);
      setMetadataResult(null);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '更新元数据失败' });
    }
  }, [bookId, metadataResult, selectedFields, fetchCoverChecked, applyMetadata]);

  const b = book.data;
  const hasCover = Boolean(b?.cover_path);
  const progress = b ? bookProgress(b) : 0;
  const primaryEpub = files.data?.find((f) => f.is_primary === 1 && f.file_format === 'EPUB');

  const customAttrs = useMemo(() => {
    if (!b?.custom_attributes) return [];
    try {
      const parsed = JSON.parse(b.custom_attributes);
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed).map(([k, v]) => {
          const label = k === 'douban_rating' ? '豆瓣评分' : k === 'neodb_rating' ? 'NeoDB 评分' : k;
          return `${label}: ${String(v)}`;
        });
      }
    } catch {
      // ignore
    }
    return [];
  }, [b?.custom_attributes]);

  const coverGroups = useMemo(() => {
    if (!covers.data) return null;
    const groups: Record<string, { label: string; items: BookCoverItem[] }> = {
      EPUB_EXTRACTED: { label: 'EPUB 抽取', items: [] },
      REMOTE_FETCHED: { label: '介绍页抓取', items: [] },
      MANUAL_UPLOAD: { label: '用户上传', items: [] },
    };
    for (const cover of covers.data) {
      const g = groups[cover.source_type];
      if (g) g.items.push(cover);
      else groups[cover.source_type] = { label: cover.source_type, items: [cover] };
    }
    return Object.entries(groups).filter(([, { items }]) => items.length > 0);
  }, [covers.data]);

  if (!open) return null;

  const InlineEditText = ({ field, label, value, multiline = false }: { field: EditableField; label: string; value: string; multiline?: boolean }) => {
    const isEditing = editingField === field;
    if (isEditing) {
      return (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {multiline ? (
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveField(field, editValue)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelEdit();
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveField(field, editValue);
              }}
              className="w-full rounded-md border border-primary bg-muted px-2 py-1 text-[13px] outline-none"
              rows={3}
            />
          ) : (
            <input
              autoFocus
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveField(field, editValue)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelEdit();
                if (e.key === 'Enter') saveField(field, editValue);
              }}
              className="h-7 w-full rounded-md border border-primary bg-muted px-2 text-[13px] outline-none"
            />
          )}
        </div>
      );
    }
    return (
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => startEdit(field, value)}
          className="text-right font-medium text-foreground hover:text-primary transition-colors"
        >
          {value || '—'}
        </button>
      </div>
    );
  };

  const InlineEditSelect = ({ field, label, value, options }: { field: EditableField; label: string; value: string; options: { value: string; label: string }[] }) => {
    const isEditing = editingField === field;
    if (isEditing) {
      return (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <select
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveField(field, editValue)}
            className="h-7 w-full rounded-md border border-primary bg-muted px-2 text-[13px] outline-none"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }
    const displayLabel = options.find((o) => o.value === value)?.label ?? value;
    return (
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => startEdit(field, value)}
          className="text-right font-medium text-foreground hover:text-primary transition-colors"
        >
          {displayLabel || '—'}
        </button>
      </div>
    );
  };

  const InlineRating = () => {
    const isEditing = editingField === 'rating';
    const currentRating = b?.rating ?? null;
    const displayRating = isEditing ? (editValue ? Number(editValue) : null) : currentRating;
    if (isEditing) {
      return (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">评分</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  const newVal = displayRating === r ? '' : String(r);
                  setEditValue(newVal);
                  saveField('rating', newVal);
                }}
                className={cn(r <= (displayRating ?? 0) ? 'text-[#f5c842]' : 'text-muted-foreground/40')}
              >
                <Star className="h-4 w-4 fill-current" />
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">评分</span>
        <button
          type="button"
          onClick={() => startEdit('rating', currentRating ? String(currentRating) : '')}
          className="flex items-center gap-1 font-medium text-foreground hover:text-primary transition-colors"
        >
          {currentRating != null ? (
            <>
              <Star className="h-3.5 w-3.5 fill-[#f5c842] text-[#f5c842]" />
              {currentRating}
            </>
          ) : (
            '—'
          )}
        </button>
      </div>
    );
  };

  return (
    <>
    <button type="button" aria-label="关闭书籍详情" className="fixed inset-0 z-30 cursor-default bg-black/10" onClick={onClose} />
    <div className="fixed inset-y-0 right-0 z-40 flex w-[min(760px,calc(100vw-256px))] min-w-[560px] flex-col overflow-hidden border-l border-border bg-background shadow-2xl">
      {/* Topbar */}
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border px-5">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <span className="font-display text-[15px] font-medium text-foreground">书籍详情</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleFavorite}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-sm transition-all hover:-translate-y-px"
            title={b?.favorited_at ? '取消收藏' : '加入收藏'}
          >
            <Heart className={cn('h-3.5 w-3.5', b?.favorited_at ? 'fill-current' : '')} />
            收藏
          </button>
          <button
            type="button"
            disabled={!primaryEpub}
            title={primaryEpub ? '开始阅读' : '请先上传 EPUB 主阅读文件'}
            onClick={() => {
              if (!bookId || !primaryEpub) return;
              navigate(`/books/${bookId}/read`);
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-white shadow-[0_2px_8px_rgba(217,119,87,0.25)] transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <BookOpen className="h-3.5 w-3.5" />
            阅读
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {book.isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {book.isError && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载失败</div>
        )}

        {b && (
          <div className="mx-auto max-w-3xl px-8 py-8">
            {/* Toast */}
            {message && (
              <div
                className={cn(
                  'fixed top-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm shadow-lg transition-all duration-300',
                  message.type === 'success'
                    ? 'bg-emerald-500 text-white dark:bg-emerald-600'
                    : 'bg-red-500 text-white dark:bg-red-600'
                )}
              >
                {message.text}
              </div>
            )}

            {/* Hero */}
            <div className="mb-8 flex gap-8">
              {/* Cover */}
              <div className="shrink-0">
                {hasCover ? (
                  <img
                    src={`${COVER_URL_BASE}/books/${bookId}/cover`}
                    alt={b.title}
                    className="h-[180px] w-[128px] rounded-xl object-cover shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
                  />
                ) : (
                  <div
                    className={cn('flex h-[180px] w-[128px] items-center justify-center rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] font-display text-5xl font-bold', COVER_TONES[(bookId ?? 0) % COVER_TONES.length])}
                  >
                    {b.title.slice(0, 1)}
                  </div>
                )}
              </div>

              {/* Title + Meta */}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => startEdit('title', b.title)}
                  className="mb-1.5 block w-full text-left font-display text-[26px] font-semibold leading-tight text-foreground hover:text-primary transition-colors"
                >
                  {b.title}
                </button>
                {b.subtitle && <p className="mb-2 text-[14px] text-muted-foreground">{b.subtitle}</p>}
                <button
                  type="button"
                  onClick={() => startEdit('author', b.author ?? '')}
                  className="mb-4 block w-full text-left text-[13.5px] text-muted-foreground hover:text-primary transition-colors"
                >
                  {[b.author, b.publisher].filter(Boolean).join(' / ') || '作者未填写'}
                  {b.publish_year ? ` · ${b.publish_year}年` : ''}
                </button>

                {/* Status + Rating */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => startEdit('status', b.status)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f0ea] px-3 py-1 text-[12px] font-medium text-[#8a6a4a] hover:bg-[#efe6dc] transition-colors"
                  >
                    <span className={cn('h-[7px] w-[7px] rounded-full', statusDotClass(b.status))} />
                    {statusLabel(b.status)}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit('rating', b.rating != null ? String(b.rating) : '')}
                    className="inline-flex items-center gap-1 text-[15px] font-bold text-foreground hover:text-primary transition-colors"
                  >
                    {b.rating != null ? (
                      <>
                        <Star className="h-[14px] w-[14px] fill-[#f5c842] text-[#f5c842]" />
                        {b.rating}
                      </>
                    ) : null}
                  </button>
                  {b.reading_purpose && (
                    <button
                      type="button"
                      onClick={() => startEdit('readingPurpose', b.reading_purpose ?? '')}
                      className="hover:opacity-80 transition-opacity"
                    >
                      <ReadModeBadge mode={b.reading_purpose} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit('visibility', b.visibility)}
                    className="rounded-full bg-muted px-3 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted/70 transition-colors"
                  >
                    {b.visibility === 'public' ? '公开' : '私密'}
                  </button>
                </div>

                {/* Tags */}
                <button
                  type="button"
                  onClick={startEditTags}
                  className="w-full text-left"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {b.tag_names.length > 0 ? (
                      b.tag_names.map((tag) => (
                        <TagAtom key={tag} size="small">{tag}</TagAtom>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground/60">点击添加标签</span>
                    )}
                    {b.category_name && (
                      <TagAtom key="cat" size="small">{b.category_name}</TagAtom>
                    )}
                  </div>
                </button>
                {editingField === ('tags' as unknown as EditableField) && (
                  <div className="mt-2 rounded-lg border border-border bg-muted p-3">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {tags.data?.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTag(t.id)}
                          className={cn(
                            'flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] transition-all',
                            editTagIds.includes(t.id)
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                          )}
                        >
                          {editTagIds.includes(t.id) && (
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                          )}
                          {t.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="h-7 rounded-md border border-border px-3 text-[12px] text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={saveTags}
                        className="h-7 rounded-md bg-primary px-3 text-[12px] text-white hover:bg-primary/90"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-8 rounded-xl border border-border bg-muted p-4">
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="font-medium text-foreground">阅读进度</span>
                <span className="font-semibold text-foreground">{progress}%</span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-[3px] bg-muted">
                <div
                  className="h-full rounded-[3px] bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Cards Grid */}
            <div className="mb-8 grid grid-cols-2 gap-4">
              {/* 书籍档案 */}
              <div className="rounded-xl border border-border p-4">
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <span className="inline-block h-3.5 w-[3px] rounded-sm bg-primary" />
                  书籍档案
                </h3>
                <div className="space-y-2 text-[12.5px]">
                  <InlineEditText field="title" label="书名" value={b.title} />
                  <InlineEditText field="author" label="作者" value={b.author ?? ''} />
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">出版社</span>
                    <span className="font-medium text-foreground">{b.publisher ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">出版年</span>
                    <span className="font-medium text-foreground">{b.publish_year ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">ISBN</span>
                    <span className="font-medium text-foreground">{b.isbn ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">页数</span>
                    <span className="font-medium text-foreground">{b.page_count ?? '—'}</span>
                  </div>
                  <InlineEditSelect
                    field="category"
                    label="分类"
                    value={b.category_id ? String(b.category_id) : ''}
                    options={[
                      { value: '', label: '未分类' },
                      ...(categories.data?.map((c) => ({ value: String(c.id), label: c.name })) ?? []),
                    ]}
                  />
                  <InlineEditText field="sourceUrl" label="来源链接" value={b.source_url ?? ''} />
                  <InlineEditText field="readingPurpose" label="阅读目的" value={b.reading_purpose ?? ''} />
                  <InlineRating />
                  <InlineEditSelect
                    field="visibility"
                    label="可见性"
                    value={b.visibility}
                    options={[
                      { value: VISIBILITY.PRIVATE, label: '私密' },
                      { value: VISIBILITY.PUBLIC, label: '公开' },
                    ]}
                  />
                  <InlineEditSelect
                    field="status"
                    label="状态"
                    value={b.status}
                    options={Object.entries(BOOK_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  />
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">录入时间</span>
                    <span className="font-medium text-foreground">{formatShortDate(b.created_at)}</span>
                  </div>
                </div>
                {customAttrs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                    {customAttrs.map((attr) => (
                      <span key={attr} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">{attr}</span>
                    ))}
                  </div>
                )}
                {b.source_url && (
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={handleOpenMetadataDialog}
                      disabled={fetchMetadata.isPending}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {fetchMetadata.isPending ? '抓取中...' : '抓取更新信息'}
                    </button>
                    <button
                      type="button"
                      onClick={handleFetchCover}
                      disabled={fetchCover.isPending}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {fetchCover.isPending ? '下载中...' : '下载封面'}
                    </button>
                  </div>
                )}
              </div>

              {/* 封面管理 */}
              <div className="rounded-xl border border-border p-4">
                <h3 className="mb-3 flex items-center justify-between text-[13px] font-bold text-foreground">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3.5 w-[3px] rounded-sm bg-primary" />
                    封面管理
                  </span>
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted/70">
                    <Upload className="h-3 w-3" />
                    上传
                    <input
                      ref={coverInputRef}
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.webp,.gif,.bmp"
                      onChange={handleCoverUpload}
                    />
                  </label>
                </h3>
                {coverGroups && coverGroups.length > 0 ? (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {coverGroups.map(([type, { label, items }]) => (
                      <div key={type}>
                        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{label}</p>
                        <div className="space-y-2">
                          {items.map((cover) => (
                            <div key={cover.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2">
                              <img
                                src={`${COVER_URL_BASE}/books/${bookId}/covers/${cover.id}/file?ts=${encodeURIComponent(cover.updated_at)}`}
                                alt={b.title}
                                className="h-12 w-9 rounded object-cover shadow-sm"
                              />
                              <div className="min-w-0 flex-1">
                                {cover.is_active === 1 && (
                                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">当前</span>
                                )}
                                {cover.source_label && (
                                  <p className="truncate text-[10px] text-muted-foreground">{cover.source_label}</p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                {cover.is_active !== 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleActivateCover(cover.id)}
                                    className="text-[10px] text-primary hover:underline"
                                  >
                                    设为当前
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCover(cover.id)}
                                  className="text-[10px] text-muted-foreground hover:text-destructive"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <ImageDown className="h-5 w-5 text-muted-foreground/30" />
                    <p className="mt-2 text-[12px] text-muted-foreground">暂无封面</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/50">上传或从介绍页下载</p>
                  </div>
                )}
              </div>

              {/* 阅读留痕 */}
              <div className="rounded-xl border border-dashed border-border p-4">
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <span className="inline-block h-3.5 w-[3px] rounded-sm bg-primary" />
                  阅读留痕
                </h3>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <NotebookPen className="h-6 w-6 text-muted-foreground/30" />
                  <p className="mt-2 text-[13px] text-muted-foreground">笔记、高亮、标注</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/50">阅读器上线后（M2）自动记录</p>
                </div>
              </div>

              {/* 主题关联 */}
              <div className="rounded-xl border border-dashed border-border p-4">
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <span className="inline-block h-3.5 w-[3px] rounded-sm bg-primary" />
                  主题关联
                </h3>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Lightbulb className="h-6 w-6 text-muted-foreground/30" />
                  <p className="mt-2 text-[13px] text-muted-foreground">围绕一个主题组织多本书</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/50">主题阅读 — 即将上线（M4）</p>
                </div>
              </div>

              {/* 文件管理 */}
              <div className="rounded-xl border border-border p-4 col-span-2">
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <span className="inline-block h-3.5 w-[3px] rounded-sm bg-primary" />
                  文件管理
                </h3>
                {files.data && files.data.length > 0 ? (
                  <div className="space-y-2">
                    {files.data.map((f: { id: number; original_filename: string | null; file_format: string; file_size: number | null; is_primary: number; updated_at: string }) => (
                      <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">{f.original_filename ?? '未知文件'}</p>
                          <p className="text-[11px] text-muted-foreground">{f.file_format} · {formatFullDate(f.updated_at)}</p>
                        </div>
                        {f.is_primary === 1 && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">主阅读</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <FileUp className="h-6 w-6 text-muted-foreground/30" />
                    <p className="mt-2 text-[13px] text-muted-foreground">暂未上传文件</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/50">可上传 epub / pdf 等电子书</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-xs text-muted-foreground/50 text-center">
              创建于 {formatFullDate(b.created_at)} · 最后更新 {formatFullDate(b.updated_at)}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* 元数据抓取更新弹窗 */}
    {showMetadataDialog && metadataResult && b && (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-12"
        onClick={() => setShowMetadataDialog(false)}
      >
        <div
          className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="font-display text-[15px] font-medium text-foreground">抓取元数据更新</h3>
            <button
              type="button"
              onClick={() => setShowMetadataDialog(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {[
              { key: 'title', label: '书名' },
              { key: 'author', label: '作者' },
              { key: 'subtitle', label: '副标题' },
              { key: 'translator', label: '译者' },
              { key: 'original_title', label: '原作名' },
              { key: 'publisher', label: '出版社' },
              { key: 'publish_year', label: '出版年' },
              { key: 'isbn', label: 'ISBN' },
              { key: 'page_count', label: '页数' },
              { key: 'description', label: '简介' },
              { key: 'language', label: '语言' },
            ]
              .filter(({ key }) => metadataResult[key as keyof LinkMetadata] != null)
              .map(({ key, label }) => (
                <label key={key} className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFields[key] ?? false}
                    onChange={(e) => setSelectedFields((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      抓取值：{String(metadataResult[key as keyof LinkMetadata] ?? '').slice(0, 100)}
                      {String(metadataResult[key as keyof LinkMetadata] ?? '').length > 100 ? '...' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      当前值：{String(b[key as keyof typeof b] ?? '').slice(0, 50) || '空'}
                    </p>
                  </div>
                </label>
              ))}
            {metadataResult.cover_url && (
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fetchCoverChecked}
                  onChange={(e) => setFetchCoverChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">封面图</p>
                  <p className="text-xs text-muted-foreground/70">
                    当前值：{b.cover_path ? '已有封面' : '无封面'}
                  </p>
                </div>
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
            <Button variant="outline" onClick={() => setShowMetadataDialog(false)}>取消</Button>
            <Button onClick={handleApplyMetadata} disabled={applyMetadata.isPending || (Object.values(selectedFields).every((v) => !v) && !fetchCoverChecked)}>
              {applyMetadata.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              确认应用
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
