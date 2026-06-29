import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  FolderOpen,
  Grid3X3,
  NotebookPen,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Link,
  FileText,
  AlertTriangle,
  HardDrive,
  CheckCircle2,
  Files,
  FileWarning,
} from 'lucide-react';
import { useFileLibrary, useUploadUnassociatedFile, useMatchFileToBook, useDeleteUnassociatedFile } from '@/hooks/use-files';
import { useBooks } from '@/hooks/use-books';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useShellUser } from '@/components/shell-user-context';
import { cn } from '@/lib/utils';

const FORMAT_OPTIONS = ['ALL', 'EPUB', 'PDF', 'MOBI', 'TXT', 'AZW3', 'DJVU', 'DOCX', 'FB2'];

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTotalSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileLibraryPage() {
  const user = useShellUser();
  const navigate = useNavigate();
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [associatedFilter, setAssociatedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [matchDialog, setMatchDialog] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fileParams = {
    page,
    page_size: 50,
    format: formatFilter !== 'ALL' ? formatFilter : undefined,
    associated: associatedFilter !== 'all' ? associatedFilter : undefined,
  };

  const files = useFileLibrary(fileParams);
  const uploadUnassociated = useUploadUnassociatedFile();
  const matchFile = useMatchFileToBook();
  const deleteUnassociated = useDeleteUnassociatedFile();
  const [searchResults, setSearchResults] = useState<Array<{ id: number; title: string; author: string | null }>>([]);
  const bookSearch = useBooks({ q: searchQuery, page_size: 20 });

  const handleMatch = useCallback(async (fileId: number, bookId: number) => {
    try {
      await matchFile.mutateAsync({ fileId, bookId });
      setMatchDialog(null);
    } catch { /* ignore */ }
  }, [matchFile]);

  const handleDeleteUnassociated = useCallback(async (fileId: number) => {
    try {
      await deleteUnassociated.mutateAsync(fileId);
    } catch { /* ignore */ }
  }, [deleteUnassociated]);

  const handleUploadUnassociated = useCallback(async (file: File) => {
    try {
      await uploadUnassociated.mutateAsync(file);
    } catch { /* ignore */ }
  }, [uploadUnassociated]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allFiles = files.data?.data ?? [];
  const pagination = files.data?.pagination ?? { page: 1, page_size: 50, total: 0 };
  const totalCount = pagination.total;
  const linkedCount = allFiles.filter((f) => f.book_id != null).length;
  const unlinkedCount = allFiles.filter((f) => f.book_id == null).length;
  const totalSize = allFiles.reduce((sum, f) => sum + (f.file_size ?? 0), 0);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-[256px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-5 py-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-lg font-medium text-primary-foreground">
              R
            </div>
            <div className="font-display text-xl text-sidebar-foreground">Redesk</div>
            <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground/50">
              v{__APP_VERSION__}
            </span>
          </div>

          <div className="relative mt-5">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-full border-sidebar-border bg-background pl-9 text-sm"
              placeholder="搜索书名、作者、标签"
              value=""
              readOnly
            />
          </div>

          <nav className="mt-5 space-y-0.5">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/overview')}
            >
              <Archive className="h-4 w-4" />
              档案
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/')}
            >
              <BookOpen className="h-4 w-4" />
              书架
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium bg-sidebar-primary text-sidebar-primary-foreground"
            >
              <FolderOpen className="h-4 w-4" />
              书库文件
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/reading-notes')}
            >
              <NotebookPen className="h-4 w-4" />
              读书笔记
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/reading-topics')}
            >
              <Grid3X3 className="h-4 w-4" />
              阅读话题
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              onClick={() => navigate('/?trash=1')}
            >
              <Trash2 className="h-4 w-4" />
              回收站
            </button>
          </nav>
        </div>

        <div className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/50 cursor-not-allowed"
            disabled
          >
            <Sparkles className="h-4 w-4" />
            AI 助手
            <span className="ml-auto text-[10px] text-muted-foreground/30">M3</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-4 w-4" />
            设置
          </button>
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 mt-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              {(user?.display_name ?? user?.username ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {user?.display_name ?? user?.username ?? 'Maxxie'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        <div className="mb-6">
          <h1 className="font-display text-[26px] font-semibold text-foreground">书库文件</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            管理所有导入的电子书文件 · {totalCount} 个文件
          </p>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Files className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">文件总数</span>
            </div>
            <div className="text-[28px] font-bold tabular-nums text-foreground">{totalCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">已关联</span>
            </div>
            <div className="text-[28px] font-bold tabular-nums text-success">{linkedCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                <FileWarning className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">未关联</span>
            </div>
            <div className="text-[28px] font-bold tabular-nums text-amber-600 dark:text-amber-400">{unlinkedCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">占用空间</span>
            </div>
            <div className="text-[28px] font-bold tabular-nums text-foreground">{formatTotalSize(totalSize)}</div>
          </div>
        </div>

        {unlinkedCount > 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-medium text-amber-700 dark:text-amber-300">
                有 {unlinkedCount} 个文件未关联书籍
              </span>
              <span className="ml-2 text-[12px] text-amber-600/70 dark:text-amber-400/70">
                未关联的文件不会出现在书架中，建议尽快匹配
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400"
              onClick={() => setAssociatedFilter('false')}
            >
              查看未关联
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => { setFormatFilter(fmt); setPage(1); }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  formatFilter === fmt ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {fmt === 'ALL' ? '全部格式' : fmt}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={() => { setAssociatedFilter('all'); setPage(1); }}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', associatedFilter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground')}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => { setAssociatedFilter('true'); setPage(1); }}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', associatedFilter === 'true' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground')}
            >
              已关联
            </button>
            <button
              type="button"
              onClick={() => { setAssociatedFilter('false'); setPage(1); }}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', associatedFilter === 'false' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground')}
            >
              未关联
            </button>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" />
                上传文件
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".epub,.pdf,.mobi,.txt,.azw3,.azw,.djvu,.docx,.fb2"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadUnassociated(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-muted-foreground">
                <th className="py-2.5 pl-5 pr-3 text-left font-medium">文件名</th>
                <th className="py-2.5 pr-3 text-left font-medium">格式</th>
                <th className="py-2.5 pr-3 text-left font-medium">大小</th>
                <th className="py-2.5 pr-3 text-left font-medium">关联书籍</th>
                <th className="py-2.5 pr-3 text-left font-medium">上传时间</th>
                <th className="py-2.5 pr-5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {allFiles.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 pl-5 pr-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[220px]">{f.original_filename ?? '未知'}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">{f.file_format}</span>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">{formatSize(f.file_size)}</td>
                  <td className="py-3 pr-3">
                    {f.book_id && f.book_title ? (
                      <button
                        type="button"
                        className="text-primary hover:underline text-xs"
                        onClick={() => navigate(`/books/${f.book_id}`)}
                      >
                        {f.book_title}
                      </button>
                    ) : (
                      <span className="rounded bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">未关联</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground text-xs">{f.created_at.slice(0, 10)}</td>
                  <td className="py-3 pr-5 text-right">
                    {f.book_id == null ? (
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMatchDialog(f.id)}
                        >
                          <Link className="mr-1 h-3.5 w-3.5" />
                          匹配书籍
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteUnassociated(f.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {allFiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    暂无文件
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {pagination.total > pagination.page_size && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                共 {pagination.total} 个文件
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pagination.page_size >= pagination.total}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>

        {matchDialog != null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <Card className="w-[500px] max-h-[80vh] overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">匹配书籍</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="搜索书籍…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Button size="sm" onClick={() => setSearchResults(bookSearch.data?.data ?? [])}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {searchResults.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="w-full text-left rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => handleMatch(matchDialog, b.id)}
                        disabled={matchFile.isPending}
                      >
                        <span className="font-medium">{b.title}</span>
                        {b.author && <span className="text-muted-foreground ml-2">{b.author}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setMatchDialog(null)}>
                    取消
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
