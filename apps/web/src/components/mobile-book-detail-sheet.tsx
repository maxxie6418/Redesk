import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Loader2, X } from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS, selectReadableFile, type BookStatus } from '@redesk/shared';
import { API_BASE } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useBook, useFavoriteBook, useStatusHistory, useUnfavoriteBook, useUpdateBook } from '@/hooks/use-books';
import { useBookFiles, type BookFileItem } from '@/hooks/use-files';
import { useMobileLayout } from '@/hooks/use-mobile-layout';

const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

const MOBILE_STATUS_OPTIONS = [
  BOOK_STATUS.COLLECTED,
  BOOK_STATUS.READING,
  BOOK_STATUS.READ,
  BOOK_STATUS.STORED,
] as const;

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function MobileBookDetailSheet({
  bookId,
  open,
  onClose,
}: {
  bookId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const isMobileLayout = useMobileLayout();
  const book = useBook(bookId ?? 0);
  const files = useBookFiles(bookId ?? 0);
  const history = useStatusHistory(bookId ?? 0);
  const updateBook = useUpdateBook();
  const favoriteBook = useFavoriteBook();
  const unfavoriteBook = useUnfavoriteBook();

  const primaryReaderFile = useMemo(
    () => selectReadableFile<BookFileItem>(files.data),
    [files.data],
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open || !isMobileLayout) {
    return null;
  }

  const data = book.data;

  return (
    <>
      <button
        type="button"
        aria-label="close-book-detail"
        className="fixed inset-0 z-40 bg-black/25"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="w-full max-w-md px-2 pb-2 pt-12">
          <div className="max-h-[calc(100vh-1rem)] overflow-y-auto rounded-[28px] border border-white/70 bg-card/98 shadow-[0_-8px_40px_rgba(64,47,31,0.22)] backdrop-blur">
            <div className="sticky top-0 z-10 rounded-t-[28px] bg-card/94 px-4 pb-4 pt-3 backdrop-blur">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background/70 text-foreground"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="text-sm font-semibold text-foreground">书籍详情</div>
                <div className="w-9" />
              </div>
            </div>

            {book.isLoading ? (
              <div className="flex items-center justify-center px-6 py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : null}

            {book.isError ? (
              <div className="px-6 pb-8 text-center text-sm text-muted-foreground">书籍详情加载失败</div>
            ) : null}

            {data ? (
              <div className="space-y-3 px-4 pb-6">
                <section className="rounded-[28px] bg-[linear-gradient(145deg,#3b3228,#81604c)] p-4 text-[#fff8ec] shadow-[0_16px_36px_rgba(64,47,31,0.18)]">
                  <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4">
                    {data.cover_path ? (
                      <img
                        src={`${API_BASE}/books/${data.id}/cover`}
                        alt={data.title}
                        className="h-[124px] w-[88px] rounded-[14px] object-cover"
                      />
                    ) : (
                      <div
                        className={cn(
                          'flex h-[124px] w-[88px] items-end rounded-[14px] px-3 py-3 font-display text-sm font-semibold leading-tight',
                          COVER_TONES[data.id % COVER_TONES.length],
                        )}
                      >
                        {data.title}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h2 className="break-words font-display text-2xl font-semibold leading-tight tracking-[-0.04em]">{data.title}</h2>
                      <p className="mt-2 break-words text-xs leading-5 text-[#fff8ec]/76">
                        {[data.author, data.publisher, data.publish_year].filter(Boolean).join(' · ') || '未填写作者'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/14 px-2.5 py-1 text-xs font-semibold">{BOOK_STATUS_LABELS[data.status as BookStatus]}</span>
                        {data.category_name ? <span className="rounded-full bg-white/14 px-2.5 py-1 text-xs font-semibold">{data.category_name}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={!primaryReaderFile}
                      className="h-10 rounded-2xl bg-white/14 text-sm font-semibold text-[#fff8ec] disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => navigate(`/books/${data.id}/read`)}
                    >
                      阅读
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-2xl bg-white/14 text-sm font-semibold text-[#fff8ec]"
                      onClick={async () => {
                        if (data.favorited_at) {
                          await unfavoriteBook.mutateAsync(data.id);
                          return;
                        }
                        await favoriteBook.mutateAsync(data.id);
                      }}
                    >
                      {data.favorited_at ? '取消收藏' : '收藏'}
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-2xl bg-white/14 text-sm font-semibold text-[#fff8ec]"
                      onClick={() => window.open(`${API_BASE}/export/books?ids=${data.id}&format=json`, '_blank', 'noopener')}
                    >
                      导出
                    </button>
                  </div>
                </section>

                <section className="rounded-[24px] border border-border bg-card px-4 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <strong className="text-sm text-foreground">关键信息</strong>
                    <span className="text-xs text-muted-foreground">移动端保留必要字段</span>
                  </div>
                  <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                    <span className="text-muted-foreground">作者</span>
                    <span className="break-words font-medium text-foreground">{data.author || '未填写'}</span>
                    <span className="text-muted-foreground">分类</span>
                    <span className="break-words font-medium text-foreground">{data.category_name || '未分类'}</span>
                    <span className="text-muted-foreground">状态</span>
                    <span className="font-medium text-foreground">{BOOK_STATUS_LABELS[data.status as BookStatus]}</span>
                    <span className="text-muted-foreground">文件</span>
                    <span className="break-words font-medium text-foreground">{files.data && files.data.length > 0 ? `${files.data.length} 个已关联` : '暂无关联文件'}</span>
                    <span className="text-muted-foreground">标签</span>
                    <span className="break-words font-medium text-foreground">{data.tag_names.length > 0 ? data.tag_names.join('、') : '暂无标签'}</span>
                  </div>
                  {data.description ? <div className="mt-4 rounded-[18px] bg-muted px-3 py-3 text-xs leading-6 break-words text-muted-foreground">{data.description}</div> : null}
                </section>

                <section className="rounded-[24px] border border-border bg-card px-4 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <strong className="text-sm text-foreground">轻量操作</strong>
                    <span className="text-xs text-muted-foreground">避免详情页过载</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {MOBILE_STATUS_OPTIONS.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                          data.status === status ? 'border-primary/30 bg-primary/12 text-primary' : 'border-border bg-muted text-muted-foreground',
                        )}
                        onClick={() => updateBook.mutateAsync({ id: data.id, status })}
                      >
                        {BOOK_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="mt-4 flex w-full items-center justify-between rounded-[18px] bg-muted px-3 py-3 text-left"
                    onClick={() => navigate(`/books/${data.id}`)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">进入完整详情</div>
                      <div className="mt-1 break-words text-xs leading-5 text-muted-foreground">继续编辑元数据、封面和文件</div>
                    </div>
                    <Heart className={cn('h-4 w-4', data.favorited_at ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                  </button>
                </section>

                {history.data && history.data.length > 0 ? (
                  <section className="rounded-[24px] border border-border bg-card px-4 py-4">
                    <div className="mb-3 text-center text-sm font-semibold text-foreground">最近状态变化</div>
                    <div className="space-y-3">
                      {history.data.slice(0, 4).map((item, index) => (
                        <div key={item.id} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3 text-xs leading-5 text-muted-foreground">
                          <span className={cn('mt-1 h-2.5 w-2.5 rounded-full', index === 0 ? 'bg-success' : index === 1 ? 'bg-primary' : 'bg-amber-500')} />
                          <div>
                            <div className="font-medium text-foreground">{BOOK_STATUS_LABELS[item.to_status as BookStatus]}</div>
                            <div>{formatHistoryTime(item.changed_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
