import { useMemo, useState, useCallback, useRef, type ChangeEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Heart,
  ImageDown,
  Lightbulb,
  Loader2,
  NotebookPen,
  RefreshCcw,
  Star,
  Tags as TagsIcon,
  Upload,
  X,
  FolderOpen,
  Pencil,
  ArrowUpFromLine,
  Archive,
  Highlighter,
  Sparkles,
  Check,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { BOOK_STATUS_LABELS, VISIBILITY } from '@redesk/shared';
import { ApiError, API_BASE } from '@/lib/api';
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
  type BookCoverItem,
  type LinkMetadata,
} from '@/hooks/use-books';
import { useBookFiles, type BookFileItem } from '@/hooks/use-files';
import { useCategories, type CategoryItem } from '@/hooks/use-categories';
import { useTags, type TagItem } from '@/hooks/use-tags';
import {
  ATTR_LABELS,
  COVER_TONES,
  bookProgress,
  extractDomain,
  formatFileSize,
  formatShortDate,
  formatTimelineDate,
  type DetailTab,
  type EditableField,
  type StatusMessage,
} from './types';
import { InlineEditText, InlineEditSelect, InlineRating, TagAtom } from './inline-edit';
import { StorageStatusBadge } from './storage-status-badge';
import { MetadataDialog } from './metadata-dialog';

const COVER_URL_BASE = API_BASE;

const TAB_LABELS: { id: DetailTab; label: string; icon: LucideIcon; tint: string }[] = [
  { id: 'archive', label: '档案', icon: Archive, tint: 'bg-[hsl(15,28%,91%)] text-[hsl(15,24%,38%)]' },
  { id: 'traces', label: '笔记', icon: Highlighter, tint: 'bg-[hsl(22,28%,91%)] text-[hsl(22,24%,38%)]' },
  { id: 'topics', label: '主题', icon: TagsIcon, tint: 'bg-[hsl(8,28%,91%)] text-[hsl(8,24%,38%)]' },
  { id: 'ai', label: 'AI', icon: Sparkles, tint: 'bg-[hsl(28,28%,91%)] text-[hsl(28,24%,38%)]' },
];

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
  const [showCoverPanel, setShowCoverPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('archive');
  const [editMode, setEditMode] = useState(false);
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
        case 'description':
          payload.description = value || null;
          break;
        case 'customAttributes':
          payload.custom_attributes = value ? JSON.parse(value) as Record<string, unknown> : null;
          break;
        default:
          return;
      }
      await updateBook.mutateAsync({ id: bookId, ...payload });
      setMessage({ type: 'info', text: '已更新' });
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
      setMessage({ type: 'info', text: '标签已更新' });
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
      setMessage({ type: 'info', text: '封面已下载' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '封面下载失败' });
    }
  }, [bookId, fetchCover]);

  const handleActivateCover = useCallback(async (coverId: number) => {
    if (!bookId) return;
    try {
      await activateCover.mutateAsync({ bookId, coverId });
      setMessage({ type: 'info', text: '已切换当前封面' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '切换封面失败' });
    }
  }, [activateCover, bookId]);

  const handleDeleteCover = useCallback(async (coverId: number) => {
    if (!bookId) return;
    try {
      await deleteCover.mutateAsync({ bookId, coverId });
      setMessage({ type: 'info', text: '封面已删除' });
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
        setMessage({ type: 'info', text: '封面已上传' });
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
      setMessage({ type: 'info', text: '元数据已更新' });
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
  const primaryEpub = files.data?.find((f: BookFileItem) => f.is_primary === 1 && f.file_format === 'EPUB');

  const customAttrs = useMemo(() => {
    if (!b?.custom_attributes) return [];
    if (typeof b.custom_attributes === 'object' && b.custom_attributes !== null) {
      return Object.entries(b.custom_attributes).map(([k, v]: [string, unknown]) => {
          const label = ATTR_LABELS[k] ?? k;
          return { label, value: String(v) };
      });
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
    return Object.entries(groups).filter(([, { items }]: [string, { label: string; items: BookCoverItem[] }]) => items.length > 0);
  }, [covers.data]);

  if (!open) return null;

  const inlineEditProps = { editMode, editingField, editValue, setEditValue, saveField, cancelEdit, startEdit };

  return (
    <>
    <button type="button" aria-label="关闭书籍详情" className="fixed inset-0 z-30 cursor-default bg-black/10" onClick={onClose} />
    <div className="fixed inset-y-0 right-0 z-40 flex w-[min(1000px,calc(100vw-160px))] min-w-[720px] flex-col overflow-hidden border-l border-border bg-background shadow-2xl">
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border px-5">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <span className="font-display text-[15px] font-medium text-foreground">书籍详情</span>
        <button
          type="button"
          onClick={handleFavorite}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium shadow-sm transition-all hover:-translate-y-px',
            b?.favorited_at
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-foreground'
          )}
          title={b?.favorited_at ? '取消收藏' : '加入收藏'}
        >
          <Heart className={cn('h-3.5 w-3.5', b?.favorited_at ? 'fill-current' : '')} />
          {b?.favorited_at ? '已收藏' : '收藏'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {book.isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {book.isError && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载失败</div>
        )}

        {b && (
          <div className="flex h-full">
            <div className="relative w-[300px] shrink-0 border-r border-border bg-muted/30">
              <div className="h-full overflow-y-auto px-6 py-6 pr-9">
              {message && (
                <div
                  className={cn(
                    'fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm transition-all duration-300',
                    message.type === 'info'
                      ? 'border-primary/15 bg-primary/5 text-foreground dark:border-primary/30 dark:bg-primary/10'
                      : message.type === 'warning'
                        ? 'border-amber-200/60 bg-amber-50/95 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
                        : 'border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {message.type === 'info' ? <Check className="h-4 w-4 text-primary" /> : message.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : <X className="h-4 w-4 text-destructive" />}
                    <span className="font-medium">{message.text}</span>
                  </span>
                </div>
              )}

              <div className="mb-6">
                {hasCover ? (
                  <img
                    src={`${COVER_URL_BASE}/books/${bookId}/cover?v=${encodeURIComponent(b.cover_path ?? b.updated_at)}`}
                    alt={b.title}
                    className="w-full rounded-xl object-cover shadow-lg aspect-[2/3]"
                  />
                ) : (
                  <div
                    className={cn('flex w-full aspect-[2/3] items-center justify-center rounded-xl shadow-lg font-display text-5xl font-bold', COVER_TONES[(bookId ?? 0) % COVER_TONES.length])}
                  >
                    {b.title.slice(0, 1)}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">阅读进度</span>
                  <span className="font-semibold text-foreground">{progress}%</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` } as CSSProperties}
                  />
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">时间</div>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      录入
                    </span>
                    <span className="font-medium text-foreground">{formatTimelineDate(b.created_at)}</span>
                  </div>
                  {b.started_at && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                        开始阅读
                      </span>
                      <span className="font-medium text-foreground">{formatTimelineDate(b.started_at)}</span>
                    </div>
                  )}
                  {b.finished_at && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        阅读完成
                      </span>
                      <span className="font-medium text-foreground">{formatTimelineDate(b.finished_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6 space-y-2.5">
                <button
                  type="button"
                  disabled={!primaryEpub}
                  title={primaryEpub ? '开始阅读' : '请先上传 EPUB 主阅读文件'}
                  onClick={() => {
                    if (!bookId || !primaryEpub) return;
                    navigate(`/books/${bookId}/read`);
                  }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,119,87,0.25)] transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BookOpen className="h-4 w-4" />
                  开始阅读
                </button>
                <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/70">
                  已支持基础 EPUB 阅读，进度/高亮/笔记链路待 M2 闭环
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCoverPanel(!showCoverPanel)}
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground shadow-sm transition-all hover:-translate-y-px"
                  >
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                    选择封面
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (editMode) cancelEdit();
                      setEditMode(!editMode);
                    }}
                    className={cn(
                      'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card text-xs font-medium text-foreground shadow-sm transition-all hover:-translate-y-px',
                      editMode ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                    )}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {editMode ? '完成编辑' : '编辑信息'}
                  </button>
                </div>
                {b.source_url && (
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleOpenMetadataDialog}
                      disabled={fetchMetadata.isPending}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary disabled:opacity-50"
                      title="从源页面抓取最新元数据，可勾选要更新的字段"
                    >
                      <RefreshCcw className={cn('h-3 w-3', fetchMetadata.isPending && 'animate-spin')} />
                      {fetchMetadata.isPending ? '抓取中…' : '抓取更新信息'}
                    </button>
                  </div>
                )}
              </div>

              {showCoverPanel && (
                <div className="mb-6 rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">封面管理</span>
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
                  </div>
                  {coverGroups && coverGroups.length > 0 ? (
                    <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
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
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <ImageDown className="h-5 w-5 text-muted-foreground/30" />
                      <p className="mt-2 text-[12px] text-muted-foreground">暂无封面</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/50">上传或从介绍页下载</p>
                    </div>
                  )}
                  {b.source_url && (
                    <div className="mt-3 flex items-center justify-end border-t border-border pt-3">
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
              )}

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">文件</div>
                {files.data && files.data.length > 0 ? (
                  <div className="space-y-1">
                    {files.data.map((f: BookFileItem) => (
                      <div key={f.id} className="flex items-center gap-2 py-1.5">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', f.is_primary === 1 ? 'bg-primary' : 'bg-muted-foreground/40')} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{f.original_filename ?? '未知文件'}</span>
                        <StorageStatusBadge file={f} />
                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatFileSize(f.file_size)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2 text-[12px] text-muted-foreground/60">暂无文件</div>
                )}
              </div>
              </div>

              <div className="absolute right-0 bottom-4 flex flex-col gap-2">
                {TAB_LABELS.map((tab) => {
                  const active = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        if (editMode) {
                          cancelEdit();
                          setEditMode(false);
                        }
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1.5 rounded-l-lg py-2.5 transition-colors duration-150',
                        'w-9',
                        active
                          ? 'mr-2 bg-primary text-primary-foreground shadow-md'
                          : cn('hover:brightness-[0.97]', tab.tint),
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="[writing-mode:vertical-rl] text-[11px] font-semibold leading-none">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-8">
              {activeTab === 'archive' && (
              <>
              <div className="mb-6">
                {editMode ? (
                  <button
                    type="button"
                    onClick={() => startEdit('title', b.title)}
                    className="mb-1 block w-full text-left font-display text-[28px] font-semibold leading-tight text-foreground hover:text-primary transition-colors"
                  >
                    {b.title}
                  </button>
                ) : (
                  <h1 className="mb-1 block w-full font-display text-[28px] font-semibold leading-tight text-foreground">
                    {b.title}
                  </h1>
                )}
                {b.subtitle && <p className="mb-3 text-[15px] text-muted-foreground italic">{b.subtitle}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted-foreground">
                  {b.author && <span className="font-medium text-foreground">{b.author}</span>}
                  {b.translator && <span>·</span>}
                  {b.translator && <span>{b.translator} 译</span>}
                  {b.publisher && <span>·</span>}
                  {b.publisher && <span>{b.publisher}</span>}
                  {b.publish_year && <span>·</span>}
                  {b.publish_year && <span>{b.publish_year}年</span>}
                </div>

                {b.category_name && (
                  <div className="mt-3">
                    {editMode ? (
                      <button
                        type="button"
                        onClick={() => startEdit('category', b.category_id ? String(b.category_id) : '')}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-1.5 text-[13px] font-semibold text-foreground shadow-sm transition-all hover:-translate-y-px border-l-[3px] border-l-primary"
                      >
                        <FolderOpen className="h-4 w-4 text-primary" />
                        {b.category_name}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-1.5 text-[13px] font-semibold text-foreground shadow-sm border-l-[3px] border-l-primary">
                        <FolderOpen className="h-4 w-4 text-primary" />
                        {b.category_name}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-0 border-t border-border pt-4">
                  {editMode ? (
                    <button
                      type="button"
                      onClick={() => startEdit('rating', b.rating != null ? String(b.rating) : '')}
                      className="flex shrink-0 items-center gap-1 text-[15px] font-bold text-foreground hover:text-primary transition-colors"
                    >
                      {b.rating != null ? (
                        <>
                          {[1, 2, 3, 4, 5].map((r) => (
                            <Star
                              key={r}
                              className={cn(
                                'h-4 w-4',
                                r <= b.rating! ? 'fill-[#f5c842] text-[#f5c842]' : 'text-muted-foreground/30'
                              )}
                            />
                          ))}
                          <span className="ml-1">{b.rating}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">未评分</span>
                      )}
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1 text-[15px] font-bold text-foreground">
                      {b.rating != null ? (
                        <>
                          {[1, 2, 3, 4, 5].map((r) => (
                            <Star
                              key={r}
                              className={cn(
                                'h-4 w-4',
                                r <= b.rating! ? 'fill-[#f5c842] text-[#f5c842]' : 'text-muted-foreground/30'
                              )}
                            />
                          ))}
                          <span className="ml-1">{b.rating}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">未评分</span>
                      )}
                    </div>
                  )}
                  <div className="mx-4 h-6 w-px bg-border" />
                  {editMode ? (
                    <button
                      type="button"
                      onClick={startEditTags}
                      className="flex min-w-0 flex-1 flex-wrap gap-1.5 text-left"
                    >
                      {b.tag_names.length > 0 ? (
                        b.tag_names.map((tag: string) => (
                          <TagAtom key={tag} size="small">{tag}</TagAtom>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground/60">点击添加标签</span>
                      )}
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {b.tag_names.length > 0 ? (
                        b.tag_names.map((tag: string) => (
                          <TagAtom key={tag} size="small">{tag}</TagAtom>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground/40">无标签</span>
                      )}
                    </div>
                  )}
                </div>
                {editingField === ('tags' as unknown as EditableField) && (
                  <div className="mt-2 rounded-lg border border-border bg-muted p-3">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {tags.data?.map((t: TagItem) => (
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

              <div className="mb-5 rounded-xl border border-border bg-muted/30 p-5">
                <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <span className="inline-block h-3.5 w-[3px] rounded-sm bg-primary" />
                  书籍档案
                </h3>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-6 gap-y-2 text-[13px]">
                  <InlineEditText {...inlineEditProps} field="title" label="书名" value={b.title} />
                  <InlineEditText {...inlineEditProps} field="author" label="作者" value={b.author ?? ''} />
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
                    {...inlineEditProps}
                    field="category"
                    label="分类"
                    value={b.category_id ? String(b.category_id) : ''}
                    options={[
                      { value: '', label: '未分类' },
                      ...(categories.data?.map((c: CategoryItem) => ({ value: String(c.id), label: c.name })) ?? []),
                    ]}
                  />
                  <InlineEditText {...inlineEditProps} field="readingPurpose" label="阅读目的" value={b.reading_purpose ?? ''} />
                  <InlineEditSelect
                    {...inlineEditProps}
                    field="visibility"
                    label="可见性"
                    value={b.visibility}
                    options={[
                      { value: VISIBILITY.PRIVATE, label: '私密' },
                      { value: VISIBILITY.PUBLIC, label: '公开' },
                    ]}
                  />
                  <InlineEditSelect
                    {...inlineEditProps}
                    field="status"
                    label="状态"
                    value={b.status}
                    options={Object.entries(BOOK_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  />
                  <InlineRating {...inlineEditProps} currentRating={b.rating ?? null} />
                  <div className="flex min-w-0 justify-between gap-2">
                    <span className="shrink-0 text-muted-foreground">书籍链接</span>
                    {editMode ? (
                      <button
                        type="button"
                        onClick={() => startEdit('sourceUrl', b.source_url ?? '')}
                        className="min-w-0 flex-1 truncate text-right font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {b.source_url || '—'}
                      </button>
                    ) : b.source_url ? (
                      <a
                        href={b.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate text-right font-medium text-primary hover:underline"
                      >
                        {extractDomain(b.source_url)}
                      </a>
                    ) : (
                      <span className="min-w-0 flex-1 text-right font-medium text-foreground">—</span>
                    )}
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">元数据来源</span>
                    <span className="font-medium text-foreground">{b.metadata_source ?? '—'}</span>
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">简介</span>
                  {editMode ? (
                    <button
                      type="button"
                      onClick={() => startEdit('description', b.description ?? '')}
                      className="mt-2 block w-full text-left"
                    >
                      <p className="text-[14px] leading-relaxed text-muted-foreground hover:text-foreground transition-colors">
                        {b.description || '暂无简介'}
                      </p>
                    </button>
                  ) : (
                    <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                      {b.description || '暂无简介'}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 text-[12px] text-muted-foreground/60">
                  <span>收录于 {formatShortDate(b.created_at)}</span>
                  <span>·</span>
                  <span>最后更新 {formatShortDate(b.updated_at)}</span>
                </div>

                {customAttrs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                    {customAttrs.map((attr) => (
                      <span key={attr.label} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">{attr.label}: {attr.value}</span>
                    ))}
                  </div>
                )}
              </div>
              </>
              )}

              {activeTab === 'traces' && (
              <div className="rounded-xl border-l-[3px] border-l-emerald-500 border-y border-r border-border bg-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <NotebookPen className="h-4 w-4 text-emerald-500" />
                  阅读留痕
                </h3>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <NotebookPen className="h-8 w-8 text-muted-foreground/20" />
                  <p className="mt-3 text-[14px] text-muted-foreground">笔记、高亮、标注</p>
                  <p className="mt-1 text-[12px] text-muted-foreground/50">留痕链路待 M2 闭环；当前可正常阅读</p>
                </div>
              </div>
              )}

              {activeTab === 'topics' && (
              <div className="rounded-xl border-l-[3px] border-l-primary/60 border-y border-r border-border bg-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <Lightbulb className="h-4 w-4 text-primary/60" />
                  主题关联
                </h3>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Lightbulb className="h-8 w-8 text-muted-foreground/20" />
                  <p className="mt-3 text-[14px] text-muted-foreground">围绕一个主题组织多本书</p>
                  <p className="mt-1 text-[12px] text-muted-foreground/50">主题阅读 — 即将上线（M4）</p>
                </div>
              </div>
              )}

              {activeTab === 'ai' && (
              <div className="rounded-xl border-l-[3px] border-l-[#9c87f5] border-y border-r border-border bg-[#f8f7fd] p-5">
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c6bc4" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  AI 衍生内容
                </h3>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/20"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  <p className="mt-3 text-[14px] text-muted-foreground">AI 摘要、问答、标签建议</p>
                  <p className="mt-1 text-[12px] text-muted-foreground/50">接入 LLM 后（S3）自动生成</p>
                </div>
              </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {showMetadataDialog && metadataResult && b && (
      <MetadataDialog
        book={b}
        metadataResult={metadataResult}
        selectedFields={selectedFields}
        setSelectedFields={setSelectedFields}
        fetchCoverChecked={fetchCoverChecked}
        setFetchCoverChecked={setFetchCoverChecked}
        onClose={() => setShowMetadataDialog(false)}
        onApply={handleApplyMetadata}
        isPending={applyMetadata.isPending}
      />
    )}
    </>
  );
}
