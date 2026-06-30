import { type ChangeEvent, useCallback, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Download,
  FileText,
  Heart,
  Loader2,
  MessageSquare,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS } from '@redesk/shared';
import {
  useActivateBookCover,
  useBook,
  useBookCovers,
  useDeleteBookCover,
  useFavoriteBook,
  useFetchBookCover,
  useUnfavoriteBook,
  useUpdateBook,
  type UpdateBookInput,
} from '@/hooks/use-books';
import { useBookFiles, useDeleteFile, useReplaceFile, useUpdateFile, useUploadFile } from '@/hooks/use-files';
import { useCategories } from '@/hooks/use-categories';
import { useCreateTag, useTags } from '@/hooks/use-tags';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppSidebar } from '@/components/app-sidebar';
import { BookEditForm } from '@/components/book-edit-form';
import { useShellUser } from '@/components/shell-user-context';
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
  if (status === BOOK_STATUS.READING) return 'text-success';
  if (status === BOOK_STATUS.PLANNED) return 'text-primary';
  if (status === BOOK_STATUS.READ) return 'text-success';
  return 'text-muted-foreground';
}

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const navigate = useNavigate();
  const user = useShellUser();

  const book = useBook(bookId);
  const covers = useBookCovers(bookId);
  const files = useBookFiles(bookId);
  const updateBook = useUpdateBook();
  const favoriteBook = useFavoriteBook();
  const unfavoriteBook = useUnfavoriteBook();
  const fetchCover = useFetchBookCover();
  const activateCover = useActivateBookCover();
  const deleteCover = useDeleteBookCover();
  const uploadFile = useUploadFile();
  const replaceFile = useReplaceFile();
  const updateFile = useUpdateFile();
  const deleteFile = useDeleteFile();
  const personalCategories = useCategories('PERSONAL');
  const genreCategories = useCategories('GENRE');
  const tagsQuery = useTags();
  const createTag = useCreateTag();

  const [message, setMessage] = useState<StatusMessage>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState<{ fileId: number; file: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setEditingMeta(false);
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
      setMessage({ type: 'success', text: '封面已下载并设为当前封面' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '封面下载失败' });
    }
  }, [bookId, fetchCover]);

  const handleActivateCover = useCallback(
    async (coverId: number) => {
      try {
        await activateCover.mutateAsync({ bookId, coverId });
        setMessage({ type: 'success', text: '已切换当前封面' });
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

  const primaryEpub = files.data?.find((file) => file.is_primary === 1 && file.file_format === 'EPUB');

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
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeKey="bookshelf" user={user} />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex items-center gap-4 border-b border-border px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{b.title}</h1>
          <div className="flex-1" />
          <Button
            variant={b.favorited_at ? 'default' : 'outline'}
            size="icon"
            onClick={handleFavorite}
            title={b.favorited_at ? '取消收藏' : '加入收藏'}
          >
            <Heart className={cn('h-4 w-4', b.favorited_at ? 'fill-current' : '')} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditingMeta(true)}>
            编辑信息
          </Button>
          <Button
            size="sm"
            disabled={!primaryEpub}
            onClick={() => primaryEpub && navigate(`/books/${bookId}/read`)}
            title={primaryEpub ? '开始阅读' : '请先上传 EPUB 主阅读文件'}
          >
            <BookOpen className="mr-1.5 h-4 w-4" />
            阅读
          </Button>
        </header>

        <div className="mx-auto max-w-4xl px-6 py-6">
          {message && (
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
          )}

          {confirmOverwrite && (
            <div className="mb-4 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">已存在相同文件，是否覆盖？</p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleOverwrite}>
                  覆盖
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmOverwrite(null)}>
                  取消
                </Button>
              </div>
            </div>
          )}

          <div className="mb-6 flex gap-6">
            <div className="shrink-0">
              {hasCover ? (
                <img
                  src={`${COVER_URL_BASE}/books/${bookId}/cover`}
                  alt={b.title}
                  className="h-[180px] w-[124px] rounded-lg object-cover shadow-md"
                />
              ) : (
                <div
                  className={cn(
                    'flex h-[180px] w-[124px] flex-col items-center justify-center rounded-lg font-display shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]',
                    COVER_TONES[bookId % COVER_TONES.length],
                  )}
                >
                  <span className="text-3xl">{b.title.slice(0, 1)}</span>
                  <span className="mt-1 text-xs opacity-70">{b.publish_year ?? 'Redesk'}</span>
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">{b.title}</h2>
              {b.subtitle && <p className="text-sm text-muted-foreground">{b.subtitle}</p>}
              <p className="text-sm text-muted-foreground">
                {[b.author || '未知作者', b.translator ? `译 ${b.translator}` : null, b.publisher, b.publish_year]
                  .filter(Boolean)
                  .join(' / ')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', statusClass(b.status))}>
                  {BOOK_STATUS_LABELS[b.status as keyof typeof BOOK_STATUS_LABELS] ?? b.status}
                </span>
                {b.category_name && (
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    {b.category_name}
                  </span>
                )}
                {b.genre_category_name && (
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    [类型] {b.genre_category_name}
                  </span>
                )}
                {b.tag_names.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              {b.rating && (
                <div className="flex items-center gap-1 text-sm text-yellow-500">
                  {Array.from({ length: b.rating }, (_, index) => (
                    <Star key={index} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
              )}
              {b.reading_purpose && <p className="text-sm text-muted-foreground">阅读目的：{b.reading_purpose}</p>}
              {(b.started_at || b.finished_at) && (
                <p className="text-xs text-muted-foreground">
                  {b.started_at ? `开始：${b.started_at.slice(0, 10)}` : ''}
                  {b.started_at && b.finished_at ? ' 路 ' : ''}
                  {b.finished_at ? `读完：${b.finished_at.slice(0, 10)}` : ''}
                </p>
              )}
            </div>
          </div>

          {b.description && (
            <Card className="mb-6">
              <CardContent className="px-4 py-4">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{b.description}</p>
              </CardContent>
            </Card>
          )}

          {(b.original_title || b.page_count || b.source_url) && (
            <Card className="mb-6">
              <CardContent className="space-y-1.5 px-4 py-4">
                {b.original_title && (
                  <p className="text-xs text-muted-foreground">
                    原作名：<span className="text-foreground">{b.original_title}</span>
                  </p>
                )}
                {b.page_count && (
                  <p className="text-xs text-muted-foreground">
                    页数：<span className="text-foreground">{b.page_count}</span>
                  </p>
                )}
                {b.source_url && (
                  <p className="truncate text-xs text-muted-foreground">
                    链接：
                    <a
                      href={b.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-primary hover:underline"
                    >
                      {b.source_url}
                    </a>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">封面管理</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFetchCover}
                disabled={!b.source_url || fetchCover.isPending}
                title={b.source_url ? '从来源链接手动下载封面' : '请先保存 source_url'}
              >
                {fetchCover.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                手动下载封面
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {!b.source_url && (
                <p className="text-xs text-muted-foreground">
                  先在书籍信息里填写来源链接，再手动下载封面。系统不会因为链接存在而自动抓取。
                </p>
              )}
              {covers.data && covers.data.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {covers.data.map((cover) => (
                    <div key={cover.id} className="rounded-lg border border-border p-3">
                      <div className="flex gap-3">
                        <img
                          src={`${COVER_URL_BASE}/books/${bookId}/covers/${cover.id}/file?ts=${encodeURIComponent(cover.updated_at)}`}
                          alt={b.title}
                          className="h-[96px] w-[68px] rounded object-cover shadow-sm"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {cover.source_type}
                            </span>
                            {cover.is_active === 1 && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                                当前
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{cover.source_label ?? '未标注'}</p>
                          {cover.original_url && (
                            <a
                              href={cover.original_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-xs text-primary hover:underline"
                            >
                              {cover.original_url}
                            </a>
                          )}
                          <div className="flex gap-2 pt-2">
                            {cover.is_active !== 1 && (
                              <Button size="sm" variant="outline" onClick={() => handleActivateCover(cover.id)}>
                                设为当前
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteCover(cover.id)}>
                              删除
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  暂无封面资源。EPUB 提取封面和手动下载的远程封面都会出现在这里。
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6 border-dashed">
            <CardContent className="py-6 text-center">
              <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">阅读痕迹</p>
              <p className="text-xs text-muted-foreground/70">笔记、高亮、标注会在阅读器上线后自动记录。</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">文件管理</CardTitle>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                <Upload className="h-3.5 w-3.5" />
                上传文件
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".epub,.pdf,.mobi,.txt,.azw3,.azw,.djvu,.docx,.fb2"
                  onChange={handleFileSelect}
                />
              </label>
            </CardHeader>
            <CardContent>
              {files.isLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </div>
              )}

              {!files.isLoading && files.data?.length === 0 && (
                <div className="rounded-lg border border-dashed border-border py-10 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">暂无文件</p>
                </div>
              )}

              {files.data?.map((file) => (
                <div key={file.id} className="mb-2 flex items-center gap-3 rounded-lg border border-border px-4 py-3 last:mb-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {file.original_filename ?? '未知文件'}
                      </p>
                      {file.is_primary === 1 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          主阅读
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {file.file_format}
                      {file.file_size != null ? ` 路 ${formatBytes(file.file_size)}` : ''}
                      {` 路 ${formatDate(file.updated_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`${COVER_URL_BASE}/books/${bookId}/files/${file.id}/download`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="下载"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    {file.is_primary !== 1 && (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="设为主阅读文件"
                        onClick={() => handleSetPrimary(file.id)}
                      >
                        <BookOpen className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="删除"
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {editingMeta && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-10"
            onClick={() => setEditingMeta(false)}
          >
            <Card className="w-full max-w-lg border-border bg-popover shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg">编辑信息</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setEditingMeta(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <BookEditForm
                  book={b}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditingMeta(false)}
                  isPending={updateBook.isPending}
                  statusMessage={null}
                  personalCategories={personalCategories.data ?? []}
                  genreCategories={genreCategories.data ?? []}
                  allTags={tagsQuery.data ?? []}
                  onCreateTag={handleCreateTag}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
