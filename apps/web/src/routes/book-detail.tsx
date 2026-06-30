import { type ChangeEvent, useCallback, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Download,
  FileText,
  Heart,
  ImageDown,
  Loader2,
  MessageSquare,
  Star,
  Tags,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS } from '@redesk/shared';
import {
  useActivateBookCover,
  useApplyBookMetadata,
  useBook,
  useBookCovers,
  useDeleteBookCover,
  useFavoriteBook,
  useFetchBookCover,
  useFetchBookMetadata,
  useUploadBookCover,
  useUnfavoriteBook,
  useUpdateBook,
  type BookCoverItem,
  type LinkMetadata,
  type UpdateBookInput,
} from '@/hooks/use-books';
import { useBookFiles, useDeleteFile, useReplaceFile, useUpdateFile, useUploadFile } from '@/hooks/use-files';
import { useCategories } from '@/hooks/use-categories';
import { useCreateTag, useTags } from '@/hooks/use-tags';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { BookEditForm } from '@/components/book-edit-form';
import { cn } from '@/lib/utils';

const COVER_URL_BASE = '/api/v1';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

function statusClass(status: string) {
  if (status === BOOK_STATUS.READING) return 'text-success border-success/30';
  if (status === BOOK_STATUS.PLANNED) return 'text-primary border-primary/30';
  if (status === BOOK_STATUS.READ) return 'text-success border-success/30';
  return 'text-muted-foreground border-muted-foreground/30';
}

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const navigate = useNavigate();

  const book = useBook(bookId);
  const covers = useBookCovers(bookId);
  const files = useBookFiles(bookId);
  const updateBook = useUpdateBook();
  const favoriteBook = useFavoriteBook();
  const unfavoriteBook = useUnfavoriteBook();
  const fetchCover = useFetchBookCover();
  const activateCover = useActivateBookCover();
  const deleteCover = useDeleteBookCover();
  const uploadCover = useUploadBookCover();
  const fetchMetadata = useFetchBookMetadata();
  const applyMetadata = useApplyBookMetadata();
  const uploadFile = useUploadFile();
  const replaceFile = useReplaceFile();
  const updateFile = useUpdateFile();
  const deleteFile = useDeleteFile();
  const personalCategories = useCategories('PERSONAL');
  const genreCategories = useCategories('GENRE');
  const tagsQuery = useTags();
  const createTag = useCreateTag();

  const [message, setMessage] = useState<StatusMessage>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [metadataResult, setMetadataResult] = useState<LinkMetadata | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  const [fetchCoverChecked, setFetchCoverChecked] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState<{ fileId: number; file: File } | null>(null);
  const [coverMenuOpen, setCoverMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        await uploadFile.mutateAsync({ bookId, file, isPrimary: (files.data?.length ?? 0) === 0 });
        setMessage({ type: 'success', text: '文件已上传' });
      } catch (err) {
        if (err instanceof Error && err.message.includes('existing_file_id')) {
          const match = err.message.match(/existing_file_id.*?(\d+)/);
          const existingId = match ? Number(match[1]) : null;
          if (existingId) {
            setConfirmOverwrite({ fileId: existingId, file });
          } else {
            setMessage({ type: 'error', text: err.message });
          }
        } else {
          setMessage({ type: 'error', text: err instanceof Error ? err.message : '上传失败' });
        }
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [bookId, files.data, uploadFile],
  );

  const handleOverwrite = useCallback(async () => {
    if (!confirmOverwrite) return;
    try {
      await replaceFile.mutateAsync({
        bookId,
        fileId: confirmOverwrite.fileId,
        file: confirmOverwrite.file,
      });
      setMessage({ type: 'success', text: '文件已替换' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '替换失败' });
    }
    setConfirmOverwrite(null);
  }, [bookId, confirmOverwrite, replaceFile]);

  const handleDeleteFile = useCallback(
    async (fileId: number) => {
      try {
        await deleteFile.mutateAsync({ bookId, fileId });
        setMessage({ type: 'success', text: '文件已删除' });
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : '删除失败' });
      }
    },
    [bookId, deleteFile],
  );

  const handleSetPrimary = useCallback(
    async (fileId: number) => {
      try {
        await updateFile.mutateAsync({ bookId, fileId, is_primary: true });
        setMessage({ type: 'success', text: '已设为主阅读文件' });
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : '操作失败' });
      }
    },
    [bookId, updateFile],
  );

  const handleFavorite = useCallback(async () => {
    if (!book.data) return;
    try {
      if (book.data.favorited_at) {
        await unfavoriteBook.mutateAsync(bookId);
        setMessage({ type: 'success', text: '已取消收藏' });
      } else {
        await favoriteBook.mutateAsync(bookId);
        setMessage({ type: 'success', text: '已加入收藏' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '操作失败' });
    }
  }, [book.data, bookId, favoriteBook, unfavoriteBook]);

  const handleSaveEdit = useCallback(
    async (data: UpdateBookInput) => {
      try {
        await updateBook.mutateAsync({ id: bookId, ...data });
        setMessage({ type: 'success', text: '书籍信息已更新' });
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '更新失败' });
      }
    },
    [bookId, updateBook],
  );

  const handleCreateTag = useCallback(async (name: string) => createTag.mutateAsync({ name }), [createTag]);

  const handleFetchCover = useCallback(async () => {
    try {
      await fetchCover.mutateAsync({ bookId });
      setMessage({ type: 'success', text: '封面已下载' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '封面下载失败' });
    }
  }, [bookId, fetchCover]);

  const handleActivateCover = useCallback(
    async (coverId: number) => {
      try {
        await activateCover.mutateAsync({ bookId, coverId });
        setMessage({ type: 'success', text: '已切换当前封面' });
        setCoverMenuOpen(false);
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '切换封面失败' });
      }
    },
    [activateCover, bookId],
  );

  const handleDeleteCover = useCallback(
    async (coverId: number) => {
      try {
        await deleteCover.mutateAsync({ bookId, coverId });
        setMessage({ type: 'success', text: '封面已删除' });
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '删除封面失败' });
      }
    },
    [bookId, deleteCover],
  );

  const handleCoverUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await uploadCover.mutateAsync({ bookId, file });
        setMessage({ type: 'success', text: '封面已上传' });
        setCoverMenuOpen(false);
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
    if (!metadataResult) return;
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
      setShowMetadataDialog(false);
      setMetadataResult(null);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '更新元数据失败' });
    }
  }, [bookId, metadataResult, selectedFields, fetchCoverChecked, applyMetadata]);

  const primaryEpub = files.data?.find((file) => file.is_primary === 1 && file.file_format === 'EPUB');

  // 分组封面
  const coverGroups = covers.data
    ? (() => {
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
        return groups;
      })()
    : null;

  if (book.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (book.isError || !book.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">书籍不存在或加载失败</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回书架
        </Button>
      </div>
    );
  }

  const b = book.data;
  const hasCover = Boolean(b.cover_path);

  return (
    <>
      {/* 主内容区 - 重定向到书架页并打开侧滑面板 */}
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">正在加载...</p>
        </div>
      </div>

      {/* 侧滑详情面板 */}
      <Sheet open={true} onOpenChange={(open) => !open && navigate('/')}>
        <SheetContent side="right" className="flex w-full flex-col overflow-hidden sm:max-w-md">
          {/* 头部 */}
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{b.title}</h1>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant={b.favorited_at ? 'default' : 'ghost'}
                size="icon"
                onClick={handleFavorite}
                title={b.favorited_at ? '取消收藏' : '加入收藏'}
              >
                <Heart className={cn('h-4 w-4', b.favorited_at ? 'fill-current' : '')} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="h-8 text-xs">
                编辑信息
              </Button>
            </div>
          </div>

          {/* 消息提示 */}
          {message && (
            <div
              className={cn(
                'mx-4 mt-3 rounded-md px-3 py-2 text-xs',
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
              )}
            >
              {message.text}
            </div>
          )}

          {/* 覆盖确认 */}
          {confirmOverwrite && (
            <div className="mx-4 mt-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
              <p className="text-destructive">已存在相同文件，是否覆盖？</p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleOverwrite} className="h-7 text-xs">
                  覆盖
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmOverwrite(null)} className="h-7 text-xs">
                  取消
                </Button>
              </div>
            </div>
          )}

          {/* 可滚动内容区 */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* 封面与基本信息 */}
            <div className="mb-5 flex gap-4">
              {/* 封面 */}
              <div className="shrink-0">
                {hasCover ? (
                  <img
                    src={`${COVER_URL_BASE}/books/${bookId}/cover`}
                    alt={b.title}
                    className="h-[140px] w-[96px] rounded-lg object-cover shadow-md"
                  />
                ) : (
                  <div
                    className={cn(
                      'flex h-[140px] w-[96px] flex-col items-center justify-center rounded-lg font-display shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]',
                      COVER_TONES[bookId % COVER_TONES.length],
                    )}
                  >
                    <span className="text-3xl">{b.title.slice(0, 1)}</span>
                    <span className="mt-1 text-xs opacity-70">{b.publish_year ?? 'Redesk'}</span>
                  </div>
                )}
              </div>

              {/* 基本信息 */}
              <div className="min-w-0 flex-1 space-y-2">
                {/* 作者/译者/出版社 */}
                <p className="text-sm text-muted-foreground">
                  {[b.author || '未知作者', b.translator ? `译 ${b.translator}` : null, b.publisher, b.publish_year]
                    .filter(Boolean)
                    .join(' / ')}
                </p>

                {/* 状态/分类/评分 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', statusClass(b.status))}>
                    {BOOK_STATUS_LABELS[b.status as keyof typeof BOOK_STATUS_LABELS] ?? b.status}
                  </span>
                  {b.category_name && (
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                      {b.category_name}
                    </span>
                  )}
                  {b.rating && (
                    <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                      {Array.from({ length: b.rating }, (_, index) => (
                        <Star key={index} className="h-3 w-3 fill-current" />
                      ))}
                    </span>
                  )}
                </div>

                {/* 阅读目的 */}
                {b.reading_purpose && (
                  <p className="text-xs text-muted-foreground">阅读目的：{b.reading_purpose}</p>
                )}

                {/* 阅读进度 */}
                {(b.started_at || b.finished_at) && (
                  <p className="text-xs text-muted-foreground">
                    {b.started_at ? `开始：${b.started_at.slice(0, 10)}` : ''}
                    {b.started_at && b.finished_at ? ' — ' : ''}
                    {b.finished_at ? `读完：${b.finished_at.slice(0, 10)}` : ''}
                  </p>
                )}

                {/* 标签 */}
                {b.tag_names.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {b.tag_names.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 封面管理（二次菜单） */}
            <div className="mb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">封面管理</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCoverMenuOpen(!coverMenuOpen)}
                    className="h-7 text-xs"
                  >
                    选择封面
                    <ChevronDown className={cn('ml-1 h-3 w-3 transition-transform', coverMenuOpen && 'rotate-180')} />
                  </Button>
                  {b.source_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleFetchCover}
                      disabled={!b.source_url || fetchCover.isPending}
                      className="h-7 text-xs"
                      title={b.source_url ? '从介绍页下载封面' : '请先填写介绍页链接'}
                    >
                      {fetchCover.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageDown className="h-3 w-3" />}
                      <span className="ml-1">下载</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* 封面选择菜单 */}
              {coverMenuOpen && coverGroups && (
                <div className="mt-2 rounded-lg border border-border bg-card p-3">
                  {covers.data && covers.data.length > 0 ? (
                    <>
                      {Object.entries(coverGroups)
                        .filter(([, { items }]) => items.length > 0)
                        .map(([type, { label, items }]) => (
                          <div key={type} className="mb-3 last:mb-0">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
                            <div className="space-y-2">
                              {items.map((cover) => (
                                <div
                                  key={cover.id}
                                  className="flex items-center gap-2 rounded-md border p-2 transition-colors hover:bg-muted/50"
                                >
                                  <img
                                    src={`${COVER_URL_BASE}/books/${bookId}/covers/${cover.id}/file?ts=${encodeURIComponent(cover.updated_at)}`}
                                    alt={b.title}
                                    className="h-12 w-9 rounded object-cover"
                                  />
                                  <div className="min-w-0 flex-1">
                                    {cover.is_active === 1 && (
                                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                                        当前
                                      </span>
                                    )}
                                    {cover.source_label && (
                                      <p className="text-xs text-muted-foreground">{cover.source_label}</p>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    {cover.is_active !== 1 && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleActivateCover(cover.id)}
                                        className="h-6 px-2 text-xs"
                                      >
                                        设为当前
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteCover(cover.id)}
                                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                    >
                                      删除
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      {/* 上传新封面 */}
                      <div className="mt-2 border-t pt-2">
                        <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                          <Upload className="h-3.5 w-3.5" />
                          上传新封面
                          <input
                            ref={coverInputRef}
                            type="file"
                            className="hidden"
                            accept=".jpg,.jpeg,.png,.webp,.gif,.bmp"
                            onChange={handleCoverUpload}
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-xs text-muted-foreground">暂无封面资源</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        先填写介绍页链接再下载，或上传封面
                      </p>
                      <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                        <Upload className="h-3 w-3" />
                        上传封面
                        <input
                          ref={coverInputRef}
                          type="file"
                          className="hidden"
                          accept=".jpg,.jpeg,.png,.webp,.gif,.bmp"
                          onChange={handleCoverUpload}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 补充信息 */}
            {(b.original_title || b.page_count || b.source_url || b.description) && (
              <div className="mb-5 space-y-1.5 rounded-lg border border-border p-3">
                {b.original_title && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">原作名</span>
                    <span className="text-foreground">{b.original_title}</span>
                  </div>
                )}
                {b.page_count && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">页数</span>
                    <span className="text-foreground">{b.page_count}</span>
                  </div>
                )}
                {b.source_url && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">链接</span>
                    <a
                      href={b.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-w-[200px] truncate text-primary hover:underline"
                      title={b.source_url}
                    >
                      {b.source_url.replace(/^https?:\/\//, '').slice(0, 30)}...
                    </a>
                  </div>
                )}
                {b.description && (
                  <div className="pt-1">
                    <p className="mb-1 text-xs text-muted-foreground">简介</p>
                    <p className="line-clamp-3 text-xs text-foreground">{b.description}</p>
                  </div>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="mb-5 flex flex-wrap gap-2">
              {b.source_url && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenMetadataDialog}
                  disabled={fetchMetadata.isPending || applyMetadata.isPending}
                  className="h-8 text-xs"
                >
                  {fetchMetadata.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  更新抓取信息
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!primaryEpub}
                onClick={() => primaryEpub && navigate(`/books/${bookId}/read`)}
                className="h-8 text-xs"
                title={primaryEpub ? '开始阅读' : '请先上传 EPUB 主阅读文件'}
              >
                <BookOpen className="mr-1 h-3 w-3" />
                阅读
              </Button>
            </div>

            {/* 阅读笔记入口 */}
            <div className="mb-4 flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">阅读笔记</span>
              </div>
              <span className="text-xs text-muted-foreground/50">阅读器上线后可用</span>
            </div>

            {/* 主题关联入口 */}
            <div className="mb-4 flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-3">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">主题关联</span>
              </div>
              <span className="text-xs text-muted-foreground/50">功能规划中</span>
            </div>

            {/* 文件管理 */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">文件管理</span>
                <label className="flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  <Upload className="h-3 w-3" />
                  上传文件
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".epub,.pdf,.mobi,.txt,.azw3,.azw,.djvu,.docx,.fb2"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>

              {files.isLoading && (
                <div className="py-4 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!files.isLoading && files.data?.length === 0 && (
                <div className="rounded-lg border border-dashed border-border py-6 text-center">
                  <FileText className="mx-auto h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-2 text-xs text-muted-foreground">暂无文件</p>
                </div>
              )}

              {files.data?.map((file) => (
                <div key={file.id} className="mb-2 flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{file.original_filename ?? '未知文件'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {file.file_format}
                      {file.file_size != null ? ` · ${formatBytes(file.file_size)}` : ''}
                    </p>
                  </div>
                  {file.is_primary === 1 && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      主阅读
                    </span>
                  )}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <a
                      href={`${COVER_URL_BASE}/books/${bookId}/files/${file.id}/download`}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="下载"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                    {file.is_primary !== 1 && (
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="设为主阅读文件"
                        onClick={() => handleSetPrimary(file.id)}
                      >
                        <BookOpen className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="删除"
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 元数据更新弹窗 */}
          {showMetadataDialog && metadataResult && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-10">
              <div className="w-full max-w-md rounded-lg border border-border bg-popover shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="text-base font-semibold">抓取元数据更新</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowMetadataDialog(false)} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
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
                      <label
                        key={key}
                        className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFields[key] ?? false}
                          onChange={(e) => setSelectedFields((prev) => ({ ...prev, [key]: e.target.checked }))}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground">{label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            抓取值：{String(metadataResult[key as keyof LinkMetadata] ?? '').slice(0, 80)}
                            {String(metadataResult[key as keyof LinkMetadata] ?? '').length > 80 ? '...' : ''}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            当前值：{String(b[key as keyof typeof b] ?? '').slice(0, 40) || '空'}
                          </p>
                        </div>
                      </label>
                    ))}
                  {metadataResult.cover_url && (
                    <label className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50">
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
                <div className="flex justify-end gap-2 border-t px-4 py-3">
                  <Button variant="outline" onClick={() => setShowMetadataDialog(false)} size="sm">
                    取消
                  </Button>
                  <Button
                    onClick={handleApplyMetadata}
                    disabled={
                      applyMetadata.isPending ||
                      (Object.values(selectedFields).every((v) => !v) && !fetchCoverChecked)
                    }
                    size="sm"
                  >
                    {applyMetadata.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    确认应用
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 编辑信息弹窗 */}
          {showEditDialog && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-10"
              onClick={() => setShowEditDialog(false)}
            >
              <div className="w-full max-w-lg rounded-lg border border-border bg-popover shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <BookEditForm
                  book={b}
                  onSave={handleSaveEdit}
                  onCancel={() => setShowEditDialog(false)}
                  isPending={updateBook.isPending}
                  statusMessage={message}
                  personalCategories={personalCategories.data ?? []}
                  genreCategories={genreCategories.data ?? []}
                  allTags={tagsQuery.data ?? []}
                  onCreateTag={handleCreateTag}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
