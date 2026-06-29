import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileUp,
  FileText,
  Download,
  Trash2,
  Loader2,
  Star,
  Upload,
  X,
  Check,
  BookOpen,
  MessageSquare,
  Heart,
} from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS, VISIBILITY } from '@redesk/shared';
import { useBook, useUpdateBook, useFavoriteBook, useUnfavoriteBook } from '@/hooks/use-books';
import { useBookFiles, useUploadFile, useDeleteFile, useUpdateFile, useReplaceFile } from '@/hooks/use-files';
import { useCategories } from '@/hooks/use-categories';
import { useTags } from '@/hooks/use-tags';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppSidebar } from '@/components/app-sidebar';
import { useShellUser } from '@/components/shell-user-context';
import { cn } from '@/lib/utils';

const COVER_URL_BASE = '/api/v1';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
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
  if (status === BOOK_STATUS.STORED) return 'text-muted-foreground';
  if (status === BOOK_STATUS.READ) return 'text-success';
  return 'text-muted-foreground';
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

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const navigate = useNavigate();
  const user = useShellUser();

  const book = useBook(bookId);
  const updateBook = useUpdateBook();
  const favoriteBook = useFavoriteBook();
  const unfavoriteBook = useUnfavoriteBook();
  const files = useBookFiles(bookId);
  const uploadFile = useUploadFile();
  const deleteFile = useDeleteFile();
  const updateFile = useUpdateFile();
  const replaceFile = useReplaceFile();
  const personalCategories = useCategories('PERSONAL');
  const genreCategories = useCategories('GENRE');
  const tags = useTags();

  const [message, setMessage] = useState<StatusMessage>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editVisibility, setEditVisibility] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editRating, setEditRating] = useState<number | null>(null);
  const [editReadingPurpose, setEditReadingPurpose] = useState('');
  const [editTagIds, setEditTagIds] = useState<number[]>([]);
  const [editCustomAttributes, setEditCustomAttributes] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [editTranslator, setEditTranslator] = useState('');
  const [editOriginalTitle, setEditOriginalTitle] = useState('');
  const [editPageCount, setEditPageCount] = useState('');
  const [editGenreCategoryId, setEditGenreCategoryId] = useState<number | null>(null);
  const [editStartedAt, setEditStartedAt] = useState('');
  const [editFinishedAt, setEditFinishedAt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setEditSubtitle(book.data.subtitle ?? '');
    setEditSourceUrl(book.data.source_url ?? '');
    setEditTranslator(book.data.translator ?? '');
    setEditOriginalTitle(book.data.original_title ?? '');
    setEditPageCount(book.data.page_count != null ? String(book.data.page_count) : '');
    setEditGenreCategoryId(book.data.genre_category_id);
    setEditStartedAt(book.data.started_at ? book.data.started_at.slice(0, 10) : '');
    setEditFinishedAt(book.data.finished_at ? book.data.finished_at.slice(0, 10) : '');
    setEditingMeta(true);
  }, [book.data]);

  const saveMeta = useCallback(async () => {
    try {
      await updateBook.mutateAsync({
        id: bookId,
        title: editTitle,
        author: editAuthor || null,
        subtitle: editSubtitle || null,
        status: editStatus,
        visibility: editVisibility,
        category_id: editCategoryId,
        genre_category_id: editGenreCategoryId,
        rating: editRating,
        reading_purpose: editReadingPurpose || null,
        tag_ids: editTagIds,
        custom_attributes: editCustomAttributes || null,
        source_url: editSourceUrl || null,
        translator: editTranslator || null,
        original_title: editOriginalTitle || null,
        page_count: editPageCount ? Number(editPageCount) : null,
        started_at: editStartedAt ? new Date(editStartedAt).toISOString() : null,
        finished_at: editFinishedAt ? new Date(editFinishedAt).toISOString() : null,
      });
      setMessage({ type: 'success', text: '已更新' });
      setEditingMeta(false);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : '更新失败' });
    }
  }, [bookId, editTitle, editAuthor, editSubtitle, editStatus, editVisibility, editCategoryId, editGenreCategoryId, editRating, editReadingPurpose, editTagIds, editCustomAttributes, editSourceUrl, editTranslator, editOriginalTitle, editPageCount, editStartedAt, editFinishedAt, updateBook]);

  const [confirmOverwrite, setConfirmOverwrite] = useState<{ fileId: number; file: File } | null>(null);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await uploadFile.mutateAsync({ bookId, file, isPrimary: (files.data?.length ?? 0) === 0 });
        setMessage({ type: 'success', text: '文件已上传' });
      } catch (err) {
        if (err instanceof Error && err.message.includes('已存在相同文件')) {
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
      await replaceFile.mutateAsync({ bookId, fileId: confirmOverwrite.fileId, file: confirmOverwrite.file });
      setMessage({ type: 'success', text: '文件已替换' });
    } catch {
      setMessage({ type: 'error', text: '替换失败' });
    }
    setConfirmOverwrite(null);
  }, [confirmOverwrite, bookId, replaceFile]);

  const handleDeleteFile = useCallback(
    async (fileId: number) => {
      try {
        await deleteFile.mutateAsync({ bookId, fileId });
        setMessage({ type: 'success', text: '文件已删除' });
      } catch {
        setMessage({ type: 'error', text: '删除失败' });
      }
    },
    [bookId, deleteFile],
  );

  const handleSetPrimary = useCallback(
    async (fileId: number) => {
      try {
        await updateFile.mutateAsync({ bookId, fileId, is_primary: true });
        setMessage({ type: 'success', text: '已设为主阅读文件' });
      } catch {
        setMessage({ type: 'error', text: '操作失败' });
      }
    },
    [bookId, updateFile],
  );

  const toggleTag = useCallback((tagId: number) => {
    setEditTagIds((prev) => (prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]));
  }, []);

  const handleFavorite = useCallback(async () => {
    if (!book.data) return;
    try {
      if (book.data.favorited_at) {
        await unfavoriteBook.mutateAsync(bookId);
        setMessage({ type: 'success', text: '已取消收藏' });
      } else {
        await favoriteBook.mutateAsync(bookId);
        setMessage({ type: 'success', text: '已添加收藏' });
      }
    } catch {
      setMessage({ type: 'error', text: '操作失败' });
    }
  }, [book.data, bookId, favoriteBook, unfavoriteBook]);

  const primaryEpub = files.data?.find((f) => f.is_primary === 1 && f.file_format === 'EPUB');

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
          title={b.favorited_at ? '取消收藏' : '添加收藏'}
        >
          <Heart className={cn('h-4 w-4', b.favorited_at ? 'fill-current' : '')} />
        </Button>
        <Button variant="outline" size="sm" onClick={openEdit}>
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

      <div className="mx-auto max-w-3xl px-6 py-6">
        <StatusBanner message={message} />

        {confirmOverwrite && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-destructive">已存在相同文件，是否覆盖？</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleOverwrite}>覆盖</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmOverwrite(null)}>取消</Button>
            </div>
          </div>
        )}

        <div className="mb-6 flex gap-6">
          <div className="shrink-0">
            {hasCover ? (
              <img
                src={`${COVER_URL_BASE}/books/${bookId}/cover`}
                alt={b.title}
                className="h-[160px] w-[110px] rounded-lg object-cover shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div
              className={cn(
                'flex h-[160px] w-[110px] shrink-0 flex-col items-center justify-center rounded-lg font-display shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]',
                hasCover ? 'hidden' : '',
                COVER_TONES[bookId % COVER_TONES.length],
              )}
            >
              <span className="text-3xl">{b.title.slice(0, 1)}</span>
              <span className="mt-1 text-xs opacity-70">{b.publish_year ?? 'Redesk'}</span>
            </div>
          </div>

          <div className="min-w-0 space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">{b.title}</h2>
            {b.subtitle && <p className="text-sm text-muted-foreground">{b.subtitle}</p>}
            <p className="text-muted-foreground">
              {[b.author || '未知作者', b.translator ? `译 ${b.translator}` : null, b.publisher, b.publish_year].filter(Boolean).join(' / ')}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
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
                <span key={tag} className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>
            {b.rating && (
              <div className="flex items-center gap-1 text-sm text-yellow-500">
                {Array.from({ length: b.rating }, (_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
            )}
            {b.reading_purpose && (
              <p className="text-sm text-muted-foreground">阅读目的：{b.reading_purpose}</p>
            )}
            {(b.started_at || b.finished_at) && (
              <p className="text-xs text-muted-foreground">
                {b.started_at ? `开始：${b.started_at.slice(0, 10)}` : ''}
                {b.started_at && b.finished_at ? ' · ' : ''}
                {b.finished_at ? `读完：${b.finished_at.slice(0, 10)}` : ''}
              </p>
            )}
          </div>
        </div>

        {b.description && (
          <Card className="mb-6">
            <CardContent className="px-4 py-4">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{b.description}</p>
            </CardContent>
          </Card>
        )}

        {(b.original_title || b.page_count || b.source_url) && (
          <Card className="mb-6">
            <CardContent className="px-4 py-4 space-y-1.5">
              {b.original_title && (
                <p className="text-xs text-muted-foreground">原作名：<span className="text-foreground">{b.original_title}</span></p>
              )}
              {b.page_count && (
                <p className="text-xs text-muted-foreground">页数：<span className="text-foreground">{b.page_count}</span></p>
              )}
              {b.source_url && (
                <p className="text-xs text-muted-foreground truncate">
                  链接：<a href={b.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{b.source_url}</a>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 border-dashed">
          <CardContent className="py-6 text-center">
            <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">阅读痕迹</p>
            <p className="text-xs text-muted-foreground/70">笔记、高亮、标注 — 阅读器上线后（M2）自动记录</p>
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
                <FileUp className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">暂无文件</p>
                <p className="text-xs text-muted-foreground/70">上传 EPUB/PDF/MOBI/TXT 等格式</p>
              </div>
            )}

            {files.data?.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 mb-2 last:mb-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {f.original_filename ?? '未知文件'}
                    </p>
                    {f.is_primary === 1 && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        主阅读
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {f.file_format} {f.file_size != null ? `· ${formatBytes(f.file_size)}` : ''} · {formatDate(f.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`${COVER_URL_BASE}/books/${bookId}/files/${f.id}/download`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="下载"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  {f.is_primary !== 1 && (
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="设为主阅读文件"
                      onClick={() => handleSetPrimary(f.id)}
                    >
                      <BookOpen className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="删除"
                    onClick={() => handleDeleteFile(f.id)}
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-10" onClick={() => setEditingMeta(false)}>
          <Card className="w-full max-w-lg border-border bg-popover shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">编辑信息</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setEditingMeta(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>书名</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>副标题</Label>
                <Input value={editSubtitle} onChange={(e) => setEditSubtitle(e.target.value)} placeholder="可选" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>作者</Label>
                  <Input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} placeholder="可选" />
                </div>
                <div className="space-y-2">
                  <Label>译者</Label>
                  <Input value={editTranslator} onChange={(e) => setEditTranslator(e.target.value)} placeholder="可选" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>原作名</Label>
                <Input value={editOriginalTitle} onChange={(e) => setEditOriginalTitle(e.target.value)} placeholder="可选" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>状态</Label>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    {Object.entries(BOOK_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>页数</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editPageCount}
                    onChange={(e) => setEditPageCount(e.target.value)}
                    placeholder="可选"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>个人分类</Label>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={editCategoryId ?? ''}
                    onChange={(e) => setEditCategoryId(e.target.value ? Number(e.target.value) : null)}
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
                    value={editGenreCategoryId ?? ''}
                    onChange={(e) => setEditGenreCategoryId(e.target.value ? Number(e.target.value) : null)}
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
                  <Label>可见性</Label>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value)}
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
                        onClick={() => setEditRating(editRating === r ? null : r)}
                        className={cn(r <= (editRating ?? 0) ? 'text-yellow-500' : 'text-muted-foreground/30')}
                      >
                        <Star className="h-5 w-5 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>书籍介绍链接</Label>
                <Input
                  type="url"
                  value={editSourceUrl}
                  onChange={(e) => setEditSourceUrl(e.target.value)}
                  placeholder="https://douban.com/..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>开始阅读时间</Label>
                  <Input
                    type="date"
                    value={editStartedAt}
                    onChange={(e) => setEditStartedAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>读完时间</Label>
                  <Input
                    type="date"
                    value={editFinishedAt}
                    onChange={(e) => setEditFinishedAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>阅读目的</Label>
                <Input
                  placeholder="泛读/精读/参考…"
                  value={editReadingPurpose}
                  onChange={(e) => setEditReadingPurpose(e.target.value)}
                />
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
                      {editTagIds.includes(t.id) ? <Check className="mr-1 inline h-3 w-3" /> : null}
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
                <Button variant="outline" onClick={() => setEditingMeta(false)}>
                  取消
                </Button>
                <Button onClick={saveMeta} disabled={updateBook.isPending}>
                  {updateBook.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </main>
    </div>
  );
}
