import { Loader2, X } from 'lucide-react';
import type { BookSummary, LinkMetadata } from '@/hooks/use-books';
import { Button } from '@/components/ui/button';

interface MetadataDialogProps {
  book: BookSummary;
  metadataResult: LinkMetadata;
  selectedFields: Record<string, boolean>;
  setSelectedFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  fetchCoverChecked: boolean;
  setFetchCoverChecked: (v: boolean) => void;
  onClose: () => void;
  onApply: () => void;
  isPending: boolean;
}

const FIELDS: { key: string; label: string }[] = [
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
];

export function MetadataDialog({
  book, metadataResult, selectedFields, setSelectedFields,
  fetchCoverChecked, setFetchCoverChecked,
  onClose, onApply, isPending,
}: MetadataDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-display text-[15px] font-medium text-foreground">抓取元数据更新</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {FIELDS
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
                    当前值：{String(book[key as keyof typeof book] ?? '').slice(0, 50) || '空'}
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
                  当前值：{book.cover_path ? '已有封面' : '无封面'}
                </p>
              </div>
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={onApply} disabled={isPending || (Object.values(selectedFields).every((v) => !v) && !fetchCoverChecked)}>
            {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            确认应用
          </Button>
        </div>
      </div>
    </div>
  );
}
