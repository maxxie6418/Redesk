import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, Search, Link, FileText } from 'lucide-react';
import { useFileLibrary, useUploadUnassociatedFile, useMatchFileToBook, useDeleteUnassociatedFile } from '@/hooks/use-files';
import { useBooks } from '@/hooks/use-books';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const FORMAT_OPTIONS = ['ALL', 'EPUB', 'PDF', 'MOBI', 'TXT', 'AZW3', 'DJVU', 'DOCX', 'FB2'];

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileLibraryPage() {
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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">书库文件</h1>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" />
          上传未关联文件
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
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-wrap gap-2 mb-4">
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
          <div className="flex gap-1 ml-2">
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
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-3 text-left font-medium">文件名</th>
              <th className="py-2 pr-3 text-left font-medium">格式</th>
              <th className="py-2 pr-3 text-left font-medium">大小</th>
              <th className="py-2 pr-3 text-left font-medium">关联书籍</th>
              <th className="py-2 pr-3 text-left font-medium">上传时间</th>
              <th className="py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {allFiles.map((f) => (
              <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{f.original_filename ?? '未知'}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">{f.file_format}</span>
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">{formatSize(f.file_size)}</td>
                <td className="py-2.5 pr-3">
                  {f.book_id && f.book_title ? (
                    <button
                      type="button"
                      className="text-primary hover:underline text-xs"
                      onClick={() => navigate(`/books/${f.book_id}`)}
                    >
                      {f.book_title}
                    </button>
                  ) : (
                    <span className="text-muted-foreground text-xs">未关联</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground text-xs">{f.created_at.slice(0, 10)}</td>
                <td className="py-2.5 text-right">
                  {f.book_id == null && (
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
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pagination.total > pagination.page_size && (
          <div className="flex items-center justify-between mt-4">
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
      </div>
    </div>
  );
}
