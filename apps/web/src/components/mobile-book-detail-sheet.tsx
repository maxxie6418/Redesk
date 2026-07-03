import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Loader2, X } from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS } from '@redesk/shared';
import { API_BASE } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useBook, useFavoriteBook, useStatusHistory, useUnfavoriteBook, useUpdateBook } from '@/hooks/use-books';
import { useBookFiles } from '@/hooks/use-files';
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
    () => files.data?.find((item) => item.is_primary === 1 && item.file_format === 'EPUB'),
    [files.data],
  );

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
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="mx-auto min-h-screen w-full max-w-md px-4 py-4">
          <div className="rounded-[32px] border border-white/70 bg-[rgba(255,253,248,0.98)] shadow-[0_20px_60px_rgba(64,47,31,0.22)] backdrop-blur">
            <div className="flex items-center justify-between px-4 py-4">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background/70 text-foreground"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="text-sm font-semibold text-foreground">\u4e66\u7c4d\u8be6\u60c5</div>
              <div className="w-9" />
            </div>

            {book.isLoading ? (
              <div className="flex items-center justify-center px-6 py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : null}

            {book.isError ? (
              <div className="px-6 pb-8 text-center text-sm text-muted-foreground">\u4e66\u7c4d\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25</div>
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
                      <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.04em]">{data.title}</h2>
                      <p className="mt-2 text-xs text-[#fff8ec]/76">
                        {[data.author, data.publisher, data.publish_year].filter(Boolean).join(' \u00b7 ') || '\u672a\u586b\u5199\u4f5c\u8005'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/14 px-2.5 py-1 text-[11px] font-semibold">{BOOK_STATUS_LABELS[data.status]}</span>
                        {data.category_name ? <span className="rounded-full bg-white/14 px-2.5 py-1 text-[11px] font-semibold">{data.category_name}</span> : null}
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
                      \u9605\u8bfb
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
                      {data.favorited_at ? '\u53d6\u6d88\u6536\u85cf' : '\u6536\u85cf'}
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-2xl bg-white/14 text-sm font-semibold text-[#fff8ec]"
                      onClick={() => window.open(`${API_BASE}/export/books?ids=${data.id}&format=json`, '_blank', 'noopener')}
                    >
                      \u5bfc\u51fa
                    </button>
                  </div>
                </section>

                <section className="rounded-[24px] border border-border bg-card px-4 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <strong className="text-sm text-foreground">\u5173\u952e\u4fe1\u606f</strong>
                    <span className="text-[11px] text-muted-foreground">\u79fb\u52a8\u7aef\u4fdd\u7559\u5fc5\u8981\u5b57\u6bb5</span>
                  </div>
                  <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                    <span className="text-muted-foreground">\u4f5c\u8005</span>
                    <span className="font-medium text-foreground">{data.author || '\u672a\u586b\u5199'}</span>
                    <span className="text-muted-foreground">\u5206\u7c7b</span>
                    <span className="font-medium text-foreground">{data.category_name || '\u672a\u5206\u7c7b'}</span>
                    <span className="text-muted-foreground">\u72b6\u6001</span>
                    <span className="font-medium text-foreground">{BOOK_STATUS_LABELS[data.status]}</span>
                    <span className="text-muted-foreground">\u6587\u4ef6</span>
                    <span className="font-medium text-foreground">{files.data && files.data.length > 0 ? `${files.data.length} \u4e2a\u5df2\u5173\u8054` : '\u6682\u65e0\u5173\u8054\u6587\u4ef6'}</span>
                    <span className="text-muted-foreground">\u6807\u7b7e</span>
                    <span className="font-medium text-foreground">{data.tag_names.length > 0 ? data.tag_names.join('\u3001') : '\u6682\u65e0\u6807\u7b7e'}</span>
                  </div>
                  {data.description ? <div className="mt-4 rounded-[18px] bg-muted px-3 py-3 text-xs leading-6 text-muted-foreground">{data.description}</div> : null}
                </section>

                <section className="rounded-[24px] border border-border bg-card px-4 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <strong className="text-sm text-foreground">\u8f7b\u91cf\u64cd\u4f5c</strong>
                    <span className="text-[11px] text-muted-foreground">\u907f\u514d\u8be6\u60c5\u9875\u8fc7\u8f7d</span>
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
                    <div>
                      <div className="text-sm font-semibold text-foreground">\u8fdb\u5165\u5b8c\u6574\u8be6\u60c5</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">\u7ee7\u7eed\u7f16\u8f91\u5143\u6570\u636e\u3001\u5c01\u9762\u548c\u6587\u4ef6</div>
                    </div>
                    <Heart className={cn('h-4 w-4', data.favorited_at ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                  </button>
                </section>

                {history.data && history.data.length > 0 ? (
                  <section className="rounded-[24px] border border-border bg-card px-4 py-4">
                    <div className="mb-3 text-center text-sm font-semibold text-foreground">\u6700\u8fd1\u72b6\u6001\u53d8\u5316</div>
                    <div className="space-y-3">
                      {history.data.slice(0, 4).map((item, index) => (
                        <div key={item.id} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3 text-xs leading-5 text-muted-foreground">
                          <span className={cn('mt-1 h-2.5 w-2.5 rounded-full', index === 0 ? 'bg-success' : index === 1 ? 'bg-primary' : 'bg-amber-500')} />
                          <div>
                            <div className="font-medium text-foreground">{BOOK_STATUS_LABELS[item.to_status]}</div>
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
