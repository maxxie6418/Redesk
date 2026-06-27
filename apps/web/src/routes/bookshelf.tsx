import { useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  BookPlus,
  Grid3X3,
  LayoutGrid,
  LayoutList,
  Search,
  Settings,
  User,
  X,
} from 'lucide-react';
import { BOOK_STATUS, VISIBILITY } from '@redesk/shared';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useBooks, useCreateBook, type BookSummary } from '@/hooks/use-books';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShellUser } from '@/components/shell-user-context';

type ViewMode = 'card' | 'grid' | 'list';
type SortMode = 'updated_desc' | 'title_asc' | 'rating_desc';

const BOOK_STATUS_LABELS: Record<string, string> = {
  [BOOK_STATUS.COLLECTED]: '收录',
  [BOOK_STATUS.PLANNED]: '计划读',
  [BOOK_STATUS.READING]: '在读',
  [BOOK_STATUS.READ]: '已读',
  [BOOK_STATUS.STORED]: '存',
};

const STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  { value: BOOK_STATUS.COLLECTED, label: BOOK_STATUS_LABELS[BOOK_STATUS.COLLECTED] },
  { value: BOOK_STATUS.PLANNED, label: BOOK_STATUS_LABELS[BOOK_STATUS.PLANNED] },
  { value: BOOK_STATUS.READING, label: BOOK_STATUS_LABELS[BOOK_STATUS.READING] },
  { value: BOOK_STATUS.READ, label: BOOK_STATUS_LABELS[BOOK_STATUS.READ] },
  { value: BOOK_STATUS.STORED, label: BOOK_STATUS_LABELS[BOOK_STATUS.STORED] },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'ALL', label: '全部权限' },
  { value: VISIBILITY.PRIVATE, label: '私密' },
  { value: VISIBILITY.PUBLIC, label: '公开' },
] as const;

const SORT_OPTIONS = [
  { value: 'updated_desc', label: '按最近更新排序' },
  { value: 'title_asc', label: '按书名排序' },
  { value: 'rating_desc', label: '按评分排序' },
] as const;

const COVER_TONES = [
  'bg-[#d8c6b7] text-[#3d2f28]',
  'bg-[#cfd8c8] text-[#26301f]',
  'bg-[#c7d4dc] text-[#22313a]',
  'bg-[#ded7c2] text-[#3c3422]',
  'bg-[#d7c8d5] text-[#342535]',
  'bg-[#d6d0c6] text-[#332f28]',
];

function statusLabel(status: string) {
  return BOOK_STATUS_LABELS[status] ?? status;
}

function statusClass(status: string) {
  if (status === BOOK_STATUS.READING) return 'border-transparent bg-success/12 text-success';
  if (status === BOOK_STATUS.PLANNED) return 'border-transparent bg-primary/10 text-primary';
  if (status === BOOK_STATUS.STORED) return 'border-border bg-muted text-muted-foreground';
  if (status === BOOK_STATUS.READ) return 'border-transparent bg-[#dfe7d7] text-[#536843]';
  return 'border-border bg-background text-muted-foreground';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function bookMeta(book: BookSummary) {
  return [book.author, book.publisher, book.publish_year].filter(Boolean).join(' / ');
}

function ratingText(rating: number | null) {
  return rating ? `${rating}.0` : '未评';
}

function BookCover({ book, index, compact = false }: { book: BookSummary; index: number; compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col justify-between rounded-md px-2.5 py-2 font-display shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]',
        compact ? 'h-14 w-10 text-base' : 'h-[86px] w-[58px] text-xl',
        COVER_TONES[index % COVER_TONES.length],
      )}
    >
      <span>{book.title.slice(0, 1)}</span>
      <span className="truncate text-[10px] opacity-70">{book.publish_year ?? 'Redesk'}</span>
    </div>
  );
}

function BookCard({ book, index }: { book: BookSummary; index: number }) {
  return (
    <article className="group flex min-h-[142px] gap-3 rounded-xl border border-border bg-popover p-3 transition-colors hover:border-foreground/20 hover:bg-card">
      <BookCover book={book} index={index} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-5 text-foreground">{book.title}</h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">{bookMeta(book) || '未填写作者'}</p>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', statusClass(book.status))}>
            {statusLabel(book.status)}
          </span>
          {book.category_name && (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              {book.category_name}
            </span>
          )}
        </div>

        {book.tag_names.length > 0 && (
          <div className="mt-2 flex gap-1 overflow-hidden text-[11px] text-muted-foreground">
            {book.tag_names.slice(0, 2).map((tag) => (
              <span key={`${book.id}-${tag}`} className="truncate">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
          <span>{ratingText(book.rating)}</span>
          <span>更新 {formatDate(book.updated_at)}</span>
        </div>
      </div>
    </article>
  );
}

function BookGridTile({ book, index }: { book: BookSummary; index: number }) {
  return (
    <article className="rounded-xl border border-border bg-popover p-3 transition-colors hover:border-foreground/20 hover:bg-card">
      <BookCover book={book} index={index} />
      <h2 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-foreground">{book.title}</h2>
      <p className="mt-1 truncate text-xs text-muted-foreground">{book.author || '未填写作者'}</p>
      <span className={cn('mt-3 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', statusClass(book.status))}>
        {statusLabel(book.status)}
      </span>
    </article>
  );
}

function BookListRow({ book, index }: { book: BookSummary; index: number }) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_120px_90px_76px] items-center gap-4 border-t border-border px-4 py-3 text-sm first:border-t-0 hover:bg-card max-lg:grid-cols-[minmax(0,1fr)_72px]">
      <div className="flex min-w-0 items-center gap-3">
        <BookCover book={book} index={index} compact />
        <div className="min-w-0">
          <h2 className="truncate font-medium text-foreground">{book.title}</h2>
          <p className="truncate text-xs text-muted-foreground">{bookMeta(book) || '未填写作者'}</p>
        </div>
      </div>
      <div className="truncate text-xs text-muted-foreground max-lg:hidden">{book.category_name ?? '未分类'}</div>
      <div className="max-lg:hidden">
        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', statusClass(book.status))}>
          {statusLabel(book.status)}
        </span>
      </div>
      <div className="text-right text-xs text-muted-foreground">{formatDate(book.updated_at)}</div>
    </article>
  );
}

interface CreateBookFormProps {
  onClose: () => void;
}

function CreateBookForm({ onClose }: CreateBookFormProps) {
  const createBook = useCreateBook();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      await createBook.mutateAsync({ title, author });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建失败，请稍后重试。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4" onClick={onClose}>
      <Card className="w-full max-w-md border-border bg-popover shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl">添加书籍</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">书名</Label>
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">作者</Label>
              <Input id="author" value={author} onChange={(event) => setAuthor(event.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={createBook.isPending}>
                {createBook.isPending ? '创建中...' : '创建'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function Bookshelf() {
  const user = useShellUser();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [visibility, setVisibility] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [tag, setTag] = useState('ALL');
  const [sort, setSort] = useState<SortMode>('updated_desc');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [showCreate, setShowCreate] = useState(false);

  const booksQuery = useBooks({
    page_size: 100,
    sort: '-updated_at',
  });

  const rawBooks = useMemo(() => booksQuery.data?.data ?? [], [booksQuery.data?.data]);

  const categoryOptions = useMemo(
    () => ['ALL', ...new Set(rawBooks.map((book) => book.category_name).filter((value): value is string => Boolean(value)))],
    [rawBooks],
  );

  const tagOptions = useMemo(() => ['ALL', ...new Set(rawBooks.flatMap((book) => book.tag_names))], [rawBooks]);

  const stats = useMemo(() => {
    return {
      total: rawBooks.length,
      reading: rawBooks.filter((book) => book.status === BOOK_STATUS.READING).length,
      read: rawBooks.filter((book) => book.status === BOOK_STATUS.READ).length,
      topics: new Set(rawBooks.flatMap((book) => book.tag_names)).size,
    };
  }, [rawBooks]);

  const books = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = rawBooks.filter((book) => {
      if (status !== 'ALL' && book.status !== status) return false;
      if (visibility !== 'ALL' && book.visibility !== visibility) return false;
      if (category !== 'ALL' && book.category_name !== category) return false;
      if (tag !== 'ALL' && !book.tag_names.includes(tag)) return false;
      if (!keyword) return true;

      const haystack = [
        book.title,
        book.author,
        book.description ?? '',
        book.publisher ?? '',
        book.category_name ?? '',
        ...book.tag_names,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'title_asc') return a.title.localeCompare(b.title, 'zh-CN');
      if (sort === 'rating_desc') return (b.rating ?? 0) - (a.rating ?? 0);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [rawBooks, search, status, visibility, category, tag, sort]);

  const hasFilter = search || status !== 'ALL' || visibility !== 'ALL' || category !== 'ALL' || tag !== 'ALL';

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-5 py-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-lg font-medium text-primary-foreground">
              R
            </div>
            <div className="font-display text-xl text-sidebar-foreground">Redesk</div>
          </div>

          <div className="relative mt-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-lg border-border bg-background pl-9 text-sm"
              placeholder="搜索书名、作者、标签"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <nav className="mt-6 space-y-1">
            <SidebarItem active icon={<BookOpen className="h-4 w-4" />} label="书架" />
            <SidebarItem icon={<Archive className="h-4 w-4" />} label="档案" />
            <SidebarItem icon={<LayoutList className="h-4 w-4" />} label="记录" />
            <SidebarItem icon={<Grid3X3 className="h-4 w-4" />} label="阅读话题" />
          </nav>
        </div>

        <div className="mt-14 w-full rounded-xl border border-border bg-popover p-3">
          <div className="grid grid-cols-2 gap-2">
            <StatCell label="总数" value={stats.total} />
            <StatCell label="在读" value={stats.reading} />
            <StatCell label="已读" value={stats.read} />
            <StatCell label="话题数" value={stats.topics} />
          </div>
        </div>

        <div className="mt-auto space-y-3 border-t border-sidebar-border pt-4">
          <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent">
            <Settings className="h-4 w-4" />
            设置
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {user?.display_name ?? user?.username ?? 'Maxxie'}
              </div>
              <div className="text-xs text-muted-foreground">个人空间</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">书架</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {booksQuery.isLoading ? '正在加载' : `显示 ${books.length} 本书`}
            </p>
          </div>
          <Button className="rounded-lg" onClick={() => setShowCreate(true)}>
            <BookPlus className="h-4 w-4" />
            添加书籍
          </Button>
        </header>

        <section className="mb-5 flex items-center gap-2 rounded-xl border border-border bg-popover p-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS.map((item) => [item.value, item.label])} />
            <FilterSelect
              value={category}
              onChange={setCategory}
              options={categoryOptions.map((item) => [item, item === 'ALL' ? '全部分类' : item])}
            />
            <FilterSelect value={tag} onChange={setTag} options={tagOptions.map((item) => [item, item === 'ALL' ? '全部标签' : item])} />
            <FilterSelect
              value={visibility}
              onChange={setVisibility}
              options={VISIBILITY_OPTIONS.map((item) => [item.value, item.label])}
            />
            <FilterSelect value={sort} onChange={(value) => setSort(value as SortMode)} options={SORT_OPTIONS.map((item) => [item.value, item.label])} />
          </div>

          <div className="flex-1" />

          <div className="flex shrink-0 items-center rounded-lg border border-border bg-background p-0.5">
            <ViewButton active={viewMode === 'card'} label="卡片显示" onClick={() => setViewMode('card')}>
              <LayoutGrid className="h-4 w-4" />
              卡片
            </ViewButton>
            <ViewButton active={viewMode === 'grid'} label="网格显示" onClick={() => setViewMode('grid')}>
              <Grid3X3 className="h-4 w-4" />
              网格
            </ViewButton>
            <ViewButton active={viewMode === 'list'} label="列表显示" onClick={() => setViewMode('list')}>
              <LayoutList className="h-4 w-4" />
              列表
            </ViewButton>
          </div>
        </section>

        {booksQuery.isLoading && (
          <div className="rounded-xl border border-dashed border-border bg-popover px-6 py-16 text-center text-sm text-muted-foreground">
            正在整理书架...
          </div>
        )}

        {booksQuery.isError && (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center">
            <p className="font-medium text-foreground">书架加载失败</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {booksQuery.error instanceof ApiError ? booksQuery.error.message : '请检查本地 API 是否正常启动。'}
            </p>
          </div>
        )}

        {!booksQuery.isLoading && !booksQuery.isError && books.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-popover px-6 py-16 text-center">
            <p className="font-medium text-foreground">{hasFilter ? '没有匹配的书籍' : '书架为空'}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasFilter ? '可以放宽筛选条件，或清空搜索关键词。' : '添加一本书后，这里会显示书籍列表。'}
            </p>
          </div>
        )}

        {!booksQuery.isLoading && !booksQuery.isError && books.length > 0 && viewMode === 'card' && (
          <section className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {books.map((book, index) => (
              <BookCard key={book.id} book={book} index={index} />
            ))}
          </section>
        )}

        {!booksQuery.isLoading && !booksQuery.isError && books.length > 0 && viewMode === 'grid' && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {books.map((book, index) => (
              <BookGridTile key={book.id} book={book} index={index} />
            ))}
          </section>
        )}

        {!booksQuery.isLoading && !booksQuery.isError && books.length > 0 && viewMode === 'list' && (
          <section className="overflow-hidden rounded-xl border border-border bg-popover">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_90px_76px] gap-4 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground max-lg:hidden">
              <span>书籍</span>
              <span>分类</span>
              <span>状态</span>
              <span className="text-right">更新</span>
            </div>
            {books.map((book, index) => (
              <BookListRow key={book.id} book={book} index={index} />
            ))}
          </section>
        )}
      </main>

      {showCreate && <CreateBookForm onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function SidebarItem({ active, icon, label }: { active?: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent font-medium text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold leading-none text-foreground">{value}</div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <select
      className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none transition-colors hover:border-foreground/20 focus:border-primary"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground',
        active && 'bg-popover text-foreground shadow-sm',
      )}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  );
}
