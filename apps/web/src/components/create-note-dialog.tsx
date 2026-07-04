import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useBooks } from '@/hooks/use-books';

export interface CreateNoteDialogProps {
  open: boolean;
  onConfirm: (data: { book_id: number; title: string; content_markdown: string }) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function CreateNoteDialog({ open, onConfirm, onCancel, loading }: CreateNoteDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [bookId, setBookId] = useState<number>(0);

  const { data } = useBooks();
  const books = data?.data ?? [];

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
      setBookId(0);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!content.trim()) return;
    onConfirm({
      book_id: bookId,
      title: title.trim() || undefined as unknown as string,
      content_markdown: content.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-note-title"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 id="create-note-title" className="font-display text-base font-semibold text-foreground">
            添加笔记
          </h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">标题（可选）</Label>
            <input
              id="note-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="为笔记起个标题..."
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-content">笔记内容 *</Label>
            <textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下你的想法..."
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-book">关联书籍</Label>
            <Select
              id="note-book"
              value={bookId}
              onChange={(e) => setBookId(Number(e.target.value))}
            >
              <option value={0}>无书籍笔记</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  《{book.title}》{book.author ? ` · ${book.author}` : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
          >
            {loading ? '创建中...' : '确认添加'}
          </Button>
        </div>
      </div>
    </div>
  );
}
