import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookPlus } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { useCurrentUser } from '@/hooks/use-auth';
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
import { BookshelfContent, BookshelfFilterBar, BookshelfPagination, StatusPills } from './components';
import { CreateBookForm } from './create-book-form';
import { SORT_API_MAP, SORT_OPTIONS, VIEW_PAGE_SIZE_MULTIPLIERS, type PageView, type SortMode, type ViewMode, VISIBILITY_OPTIONS } from './constants';



export function Bookshelf({ initialPageView = 'bookshelf' }: { initialPageView?: PageView }) {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isLoggedIn = Boolean(currentUser.data);
  const isMobileLayout = useMobileLayout();
  const sidebarStats = useSidebarStats();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [visibility, setVisibility] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [tag, setTag] = useState('ALL');
  const [favorited, setFavorited] = useState(false);
  const [readableFilter, setReadableFilter] = useState<'all' | 'readable' | 'unreadable'>('all');
  const [sort, setSort] = useState<SortMode>('import_order_asc');
  const [viewMode, setViewMode] = useState<ViewMode>('A');
  const [showCreate, setShowCreate] = useState(false);
  const [pageView, setPageView] = useState<PageView>(initialPageView);
  const [detailBookId, setDetailBookId] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(12);
  const [booksPage, setBooksPage] = useState(1);
  const [trashPage, setTrashPage] = useState(1);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const contentViewportRef = useRef<HTMLDivElement | null>(null);
  const contentMeasureRef = useRef<HTMLDivElement | null>(null);
  const [dynamicPageSizes, setDynamicPageSizes] = useState<readonly number[]>([8, 12, 18]);
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
      page: booksPage,
      page_size: pageSize,
      sort: SORT_API_MAP[sort],
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(status !== 'ALL' ? { status } : {}),
      ...(visibility !== 'ALL' ? { visibility } : {}),
      ...(category !== 'ALL' ? { category_id: Number(category) } : {}),
      ...(tag !== 'ALL' ? { tag_id: tag } : {}),
      ...(favorited ? { favorited: true } : {}),
      ...(readableFilter === 'readable' ? { has_readable_file: true } : {}),
      ...(readableFilter === 'unreadable' ? { has_readable_file: false } : {}),
    }),
    [booksPage, category, debouncedSearch, favorited, pageSize, readableFilter, sort, status, tag, visibility],
  );

  const trashQueryParams = useMemo(
    () => ({
      page: trashPage,
      page_size: pageSize,
      sort: '-deleted_at',
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
    }),
    [debouncedSearch, pageSize, trashPage],
  );

  const booksQuery = useBooks(booksQueryParams);
  const trashQuery = useTrash(trashQueryParams);

  useEffect(() => {
    setBooksPage(1);
  }, [category, debouncedSearch, favorited, pageSize, readableFilter, sort, status, tag, visibility]);

  useEffect(() => {
    setTrashPage(1);
  }, [debouncedSearch]);

  const restoreBook = useRestoreBook();
  const permanentDeleteBook = usePermanentDeleteBook();
  const emptyTrash = useEmptyTrash();

  const books = useMemo<BookSummary[]>(() => {
    if (pageView === 'trash') {
      return trashQuery.data?.data ?? [];
    }
    return booksQuery.data?.data ?? [];
  }, [booksQuery.data?.data, trashQuery.data?.data, pageView]);

  const isLoading = pageView === 'trash' ? trashQuery.isLoading && trashPage === 1 : booksQuery.isLoading && booksPage === 1;
  const isFetchingMore = pageView === 'trash' ? trashQuery.isFetching && trashPage > 1 : booksQuery.isFetching && booksPage > 1;
  const isError = pageView === 'trash' ? trashQuery.isError : booksQuery.isError;
  const error = pageView === 'trash' ? trashQuery.error : booksQuery.error;
  const total = pageView === 'trash' ? trashQuery.data?.pagination.total : booksQuery.data?.pagination.total;
  const currentPage = pageView === 'trash' ? trashPage : booksPage;
  const totalPages = total != null ? Math.ceil(total / pageSize) : 1;
  const hasMore = total != null && books.length < total;
  const retryRefetch = pageView === 'trash' ? () => trashQuery.refetch() : () => booksQuery.refetch();

  const handlePrevPage = useCallback(() => {
    if (pageView === 'trash') {
      setTrashPage((p) => Math.max(1, p - 1));
    } else {
      setBooksPage((p) => Math.max(1, p - 1));
    }
  }, [pageView]);

  const handleNextPage = useCallback(() => {
    if (!hasMore) return;
    if (pageView === 'trash') {
      setTrashPage((p) => p + 1);
    } else {
      setBooksPage((p) => p + 1);
    }
  }, [hasMore, pageView]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    if (pageView === 'trash') setTrashPage(1);
    else setBooksPage(1);
  }, [pageView]);

  const handleGotoPage = useCallback((p: number) => {
    if (pageView === 'trash') setTrashPage(p);
    else setBooksPage(p);
    contentViewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageView]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  useEffect(() => {
    if (isMobileLayout || pageView === 'trash') return;

    const recalculate = () => {
      const viewport = contentViewportRef.current;
      const measureRoot = contentMeasureRef.current;
      if (!viewport || !measureRoot) return;

      const sampleCard = measureRoot.querySelector('[data-book-card]') as HTMLElement | null;
      if (!sampleCard) return;

      const availableHeight = viewport.clientHeight;
      if (availableHeight <= 0) return;

      const verticalGap = viewMode === 'D' ? 4 : 12;
      const cardHeight = Math.ceil(sampleCard.getBoundingClientRect().height);
      if (cardHeight <= 0) return;
      const rowHeight = cardHeight + verticalGap;

      let columns = 1;
      if (viewMode === 'A') {
        columns = window.innerWidth >= 1536 ? 3 : window.innerWidth >= 1280 ? 2 : 1;
      } else if (viewMode === 'B') {
        columns = window.innerWidth >= 1536 ? 7 : window.innerWidth >= 1280 ? 6 : window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 4 : window.innerWidth >= 640 ? 3 : 2;
      } else if (viewMode === 'C') {
        columns = window.innerWidth >= 1536 ? 5 : window.innerWidth >= 640 ? 4 : 3;
      }

      const sizes = VIEW_PAGE_SIZE_MULTIPLIERS.map((ratio) => {
         const totalRows = Math.max(1, Math.ceil(ratio * availableHeight / rowHeight));
         return Math.max(1, totalRows * columns);
       });
      const uniqueSizes = Array.from(new Set<number>(sizes)).sort((a: number, b: number) => a - b);
      const resolvedSizes: readonly number[] = uniqueSizes.length > 0 ? uniqueSizes : [columns];

      setDynamicPageSizes(resolvedSizes);
      setPageSize((current) => {
        if (resolvedSizes.includes(current)) return current;
        let closest = resolvedSizes[0];
        let minDiff = Math.abs(current - closest);
        for (let i = 1; i < resolvedSizes.length; i++) {
          const diff = Math.abs(current - resolvedSizes[i]);
          if (diff < minDiff) { minDiff = diff; closest = resolvedSizes[i]; }
        }
        return closest;
      });
    };

    let frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(recalculate);
    });
    const resizeTimer = { current: 0 };
    const debouncedRecalculate = () => {
      cancelAnimationFrame(resizeTimer.current);
      resizeTimer.current = requestAnimationFrame(recalculate);
    };
    const resizeObserver = new ResizeObserver(debouncedRecalculate);
    if (contentViewportRef.current) resizeObserver.observe(contentViewportRef.current);
    if (contentMeasureRef.current) resizeObserver.observe(contentMeasureRef.current);
    window.addEventListener('resize', debouncedRecalculate);
    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', debouncedRecalculate);
      cancelAnimationFrame(resizeTimer.current);
    };
  }, [isMobileLayout, pageView, viewMode]);

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

  const hasFilter = debouncedSearch || status !== 'ALL' || visibility !== 'ALL' || category !== 'ALL' || tag !== 'ALL' || favorited || readableFilter !== 'all';
  const resetFilters = useCallback(() => {
    setStatus('ALL');
    setVisibility('ALL');
    setCategory('ALL');
    setTag('ALL');
    setFavorited(false);
    setReadableFilter('all');
  }, []);

  const handleOpenDetail = useCallback((bookId: number) => {
    if (!isLoggedIn) {
      navigate(`/login?redirect=/books/${bookId}`);
      return;
    }
    setDetailBookId(bookId);
  }, [isLoggedIn, navigate]);

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
        mainClassName={isMobileLayout ? 'px-0 py-0' : 'overflow-hidden pt-6 pb-0'}
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
            category={category}
            onCategoryChange={setCategory}
            categoryOptions={isLoggedIn ? categoryOptions : [{ value: 'ALL', label: '全部分类' }]}
            tag={tag}
            onTagChange={setTag}
            tagOptions={isLoggedIn ? tagOptions : [{ value: 'ALL', label: '全部标签' }]}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            visibilityOptions={isLoggedIn ? visibilityOptions : [{ value: 'ALL', label: '全部可见性' }]}
            favorited={favorited}
            onFavoritedChange={() => setFavorited((value) => !value)}
            onResetFilters={resetFilters}
            onOpenDetail={handleOpenDetail}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="mb-5 flex items-center justify-between px-6 lg:px-8">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{pageView === 'trash' ? '回收站' : '书架'}</h1>
              </div>
              <div className="flex items-center gap-2">
                {isLoggedIn && pageView === 'trash' && books.length > 0 ? (
                  <Button variant="destructive" size="sm" onClick={() => void handleEmptyTrash()}>
                    清空回收站
                  </Button>
                ) : null}
                {isLoggedIn && pageView === 'bookshelf' ? (
                  <Button className="rounded-full" onClick={() => setShowCreate(true)}>
                    <BookPlus className="h-4 w-4" />
                    添加书籍
                  </Button>
                ) : null}
              </div>
            </header>

            {isLoggedIn && pageView === 'bookshelf' ? (
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
                readableFilter={readableFilter}
                onReadableFilterChange={setReadableFilter}
                sort={sort}
                onSortChange={setSort}
                sortOptions={sortOptions}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
              />
            ) : null}
            {!isLoggedIn && pageView === 'bookshelf' ? (
              <section className="mb-5 px-6 lg:px-8">
                <p className="text-sm text-muted-foreground">登录后可查看更多书籍和功能</p>
              </section>
            ) : null}
            {isLoggedIn && pageView === 'trash' ? (
              <section className="mb-5 px-6 lg:px-8">
                <StatusPills value={status} onChange={setStatus} />
              </section>
            ) : null}

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
              <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div ref={contentViewportRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
                  <div ref={contentMeasureRef} className="px-4 pb-2 pt-1">
                    <BookshelfContent
                      books={books}
                      viewMode={viewMode}
                      isTrash={pageView === 'trash'}
                      onRestore={handleRestore}
                      onPermanentDelete={handlePermanentDelete}
                      onOpenDetail={handleOpenDetail}
                    />
                  </div>
                </div>
                <BookshelfPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  pageSizes={dynamicPageSizes}
                  displayedCount={books.length}
                  totalCount={total ?? null}
                  isFetching={isFetchingMore}
                  onPrev={handlePrevPage}
                  onNext={handleNextPage}
                  onGoto={handleGotoPage}
                  onPageSizeChange={handlePageSizeChange}
                />
              </section>
            ) : null}
          </div>
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
