import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookPlus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { useBooks, useEmptyTrash, usePermanentDeleteBook, useRestoreBook, useTrash, type BookSummary } from '@/hooks/use-books';
import { useCategories, type CategoryItem } from '@/hooks/use-categories';
import { useTags, type TagItem } from '@/hooks/use-tags';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { useMobileLayout } from '@/hooks/use-mobile-layout';
import { Button } from '@/components/ui/button';
import { MobileBookshelf } from '@/components/mobile-bookshelf';
import { MobileBookDetailSheet } from '@/components/mobile-book-detail-sheet';
import { BookDetailSheet } from '@/components/book-detail-sheet';
import { ProtectedShell } from '@/components/protected-shell';
import { type FilterSelectOption } from '@/components/page-ui/filter-select';
import { BookshelfContent, BookshelfFilterBar, StatusPills } from './components';
import { CreateBookForm } from './create-book-form';
import { SORT_API_MAP, SORT_OPTIONS, type PageView, type SortMode, type ViewMode, VISIBILITY_OPTIONS } from './constants';

export function Bookshelf({ initialPageView = 'bookshelf' }: { initialPageView?: PageView }) {
  const isMobileLayout = useMobileLayout();
  const sidebarStats = useSidebarStats();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [visibility, setVisibility] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [tag, setTag] = useState('ALL');
  const [favorited, setFavorited] = useState(false);
  const [sort, setSort] = useState<SortMode>('import_order_asc');
  const [viewMode, setViewMode] = useState<ViewMode>('A');
  const [showCreate, setShowCreate] = useState(false);
  const [pageView, setPageView] = useState<PageView>(initialPageView);
  const [detailBookId, setDetailBookId] = useState<number | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const personalCategories = useCategories('PERSONAL');
  const tags = useTags();

  useEffect(() => {
    setPageView(initialPageView);
  }, [initialPageView]);

  useEffect(() => {
    const shouldOpenCreate = searchParams.get('create') === '1';
    if (!shouldOpenCreate) return;

    setShowCreate(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  const booksQueryParams = useMemo(
    () => ({
      page_size: 200,
      sort: SORT_API_MAP[sort],
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(status !== 'ALL' ? { status } : {}),
      ...(visibility !== 'ALL' ? { visibility } : {}),
      ...(category !== 'ALL' ? { category_id: Number(category) } : {}),
      ...(tag !== 'ALL' ? { tag_id: tag } : {}),
      ...(favorited ? { favorited: true } : {}),
    }),
    [category, debouncedSearch, favorited, sort, status, tag, visibility],
  );

  const trashQueryParams = useMemo(
    () => ({
      page_size: 200,
      sort: '-deleted_at',
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
    }),
    [debouncedSearch],
  );

  const booksQuery = useBooks(booksQueryParams);
  const trashQuery = useTrash(trashQueryParams);
  const restoreBook = useRestoreBook();
  const permanentDeleteBook = usePermanentDeleteBook();
  const emptyTrash = useEmptyTrash();

  const books = useMemo<BookSummary[]>(() => {
    if (pageView === 'trash') {
      return trashQuery.data?.data ?? [];
    }
    return booksQuery.data?.data ?? [];
  }, [booksQuery.data?.data, pageView, trashQuery.data?.data]);

  const isLoading = pageView === 'trash' ? trashQuery.isLoading : booksQuery.isLoading;
  const isError = pageView === 'trash' ? trashQuery.isError : booksQuery.isError;
  const error = pageView === 'trash' ? trashQuery.error : booksQuery.error;
  const total = pageView === 'trash' ? trashQuery.data?.pagination.total : booksQuery.data?.pagination.total;
  const retryRefetch = pageView === 'trash' ? () => trashQuery.refetch() : () => booksQuery.refetch();

  const categoryOptions = useMemo<FilterSelectOption[]>(
    () => [
      { value: 'ALL', label: '全部分类' },
      ...((personalCategories.data ?? []).map((item: CategoryItem) => ({ value: String(item.id), label: item.name })) as FilterSelectOption[]),
    ],
    [personalCategories.data],
  );

  const tagOptions = useMemo<FilterSelectOption[]>(
    () => [{ value: 'ALL', label: '全部标签' }, ...((tags.data ?? []).map((item: TagItem) => ({ value: String(item.id), label: item.name })) as FilterSelectOption[])],
    [tags.data],
  );

  const visibilityOptions = useMemo<FilterSelectOption[]>(
    () => VISIBILITY_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
    [],
  );

  const sortOptions = useMemo<FilterSelectOption[]>(
    () => SORT_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
    [],
  );

  const hasFilter = debouncedSearch || status !== 'ALL' || visibility !== 'ALL' || category !== 'ALL' || tag !== 'ALL' || favorited;

  const handleRestore = useCallback(async (id: number) => {
    try {
      await restoreBook.mutateAsync(id);
    } catch {
      // mutation handles error
    }
  }, [restoreBook]);

  const handlePermanentDelete = useCallback(async (id: number) => {
    try {
      await permanentDeleteBook.mutateAsync(id);
    } catch {
      // mutation handles error
    }
  }, [permanentDeleteBook]);

  const handleEmptyTrash = useCallback(async () => {
    try {
      await emptyTrash.mutateAsync();
    } catch {
      // mutation handles error
    }
  }, [emptyTrash]);

  return (
    <>
      <ProtectedShell
        activeKey={pageView === 'trash' ? 'trash' : 'bookshelf'}
        searchValue={search}
        onSearchChange={setSearch}
        stats={sidebarStats}
        mobileNavKey="bookshelf"
        mainClassName={isMobileLayout ? 'px-0 py-0' : 'px-6 py-6 lg:px-8'}
      >
        {isMobileLayout ? (
          <MobileBookshelf
            pageView={pageView}
            books={books}
            isLoading={isLoading}
            isError={isError}
            error={error instanceof Error ? error : null}
            hasFilter={Boolean(hasFilter)}
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            onOpenCreate={() => setShowCreate(true)}
            onOpenDetail={(id) => setDetailBookId(id)}
          />
        ) : (
          <>
            <header className="mb-5 flex items-center justify-between">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{pageView === 'trash' ? '回收站' : '书架'}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isLoading ? '正在加载' : `显示 ${books.length} 本书`}
                  {total != null && total > books.length ? `（共 ${total} 本）` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {pageView === 'trash' && books.length > 0 ? (
                  <Button variant="destructive" size="sm" onClick={() => void handleEmptyTrash()}>
                    清空回收站
                  </Button>
                ) : null}
                {pageView === 'bookshelf' ? (
                  <Button className="rounded-full" onClick={() => setShowCreate(true)}>
                    <BookPlus className="h-4 w-4" />
                    添加书籍
                  </Button>
                ) : null}
              </div>
            </header>

            {pageView === 'bookshelf' ? (
              <BookshelfFilterBar
                status={status}
                onStatusChange={setStatus}
                category={category}
                onCategoryChange={setCategory}
                categoryOptions={categoryOptions}
                tag={tag}
                onTagChange={setTag}
                tagOptions={tagOptions}
                visibility={visibility}
                onVisibilityChange={setVisibility}
                visibilityOptions={visibilityOptions}
                favorited={favorited}
                onFavoritedChange={() => setFavorited((value) => !value)}
                sort={sort}
                onSortChange={setSort}
                sortOptions={sortOptions}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            ) : (
              <section className="mb-5">
                <StatusPills value={status} onChange={setStatus} />
              </section>
            )}

            {isLoading ? (
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">正在整理书架...</div>
            ) : null}

            {isError ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-6 py-12 text-center">
                <p className="font-medium text-foreground">书架加载失败</p>
                <p className="mt-2 text-sm text-muted-foreground">{error instanceof ApiError ? error.message : '请检查本地 API 是否正常启动。'}</p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  onClick={() => retryRefetch()}
                >
                  重新加载
                </button>
              </div>
            ) : null}

            {!isLoading && !isError && books.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
                <p className="font-medium text-foreground">{pageView === 'trash' ? '回收站为空' : hasFilter ? '没有匹配的书籍' : '书架为空'}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {pageView === 'trash'
                    ? '删除的书籍会出现在这里。'
                    : hasFilter
                      ? '可以放宽筛选条件，或清空搜索关键词。'
                      : '添加一本书后，这里会显示书籍列表。'}
                </p>
              </div>
            ) : null}

            {!isLoading && !isError && books.length > 0 ? (
              <BookshelfContent
                books={books}
                viewMode={viewMode}
                isTrash={pageView === 'trash'}
                onOpenDetail={setDetailBookId}
                onRestore={handleRestore}
                onPermanentDelete={handlePermanentDelete}
              />
            ) : null}
          </>
        )}
      </ProtectedShell>

      {showCreate ? <CreateBookForm onClose={() => setShowCreate(false)} /> : null}
      {isMobileLayout ? (
        <MobileBookDetailSheet bookId={detailBookId} open={detailBookId !== null} onClose={() => setDetailBookId(null)} />
      ) : (
        <BookDetailSheet bookId={detailBookId} open={detailBookId !== null} onClose={() => setDetailBookId(null)} />
      )}
    </>
  );
}
