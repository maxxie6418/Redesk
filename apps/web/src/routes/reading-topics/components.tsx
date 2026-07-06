import { useEffect, useMemo, useState } from 'react';
import { BookOpen, BrainCircuit, CirclePlus, LayoutGrid, List, MessageSquareText, Network, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FilterSelect } from '@/components/page-ui/filter-select';
import { SectionPanel } from '@/components/page-ui/section-panel';
import { SegmentedToggle, SegmentedToggleItem } from '@/components/page-ui/segmented-toggle';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useBooks } from '@/hooks/use-books';
import type { TopicBook, TopicDetail } from '@/hooks/use-topics';
import { cn } from '@/lib/utils';
import type { Topic, TopicInsight, TopicTrace, TopicWorkspaceBlock } from './data';
import { topicStats } from './data';

export function CompactSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  const currentValue = value ?? options[0] ?? '';
  return (
    <FilterSelect
      value={currentValue}
      onChange={(next) => onChange?.(next)}
      options={options.map((option) => ({ value: option, label: option }))}
    />
  );
}

export function TopicCard({ topic, onOpen }: { topic: Topic; onOpen: () => void }) {
  const stats = topicStats(topic);

  return (
    <button type="button" onClick={onOpen} className="group rounded-xl border border-border bg-card p-6 text-left transition-shadow hover:shadow-md">
      <div className="flex gap-5">
        <div className="flex shrink-0 -space-x-3">
          {topic.books.slice(0, 3).map((book) => (
            <div key={book.id} className={cn('h-24 w-16 rounded-md border-2 border-background shadow-sm', book.tone)} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">{topic.title}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">{topic.updatedAt}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{topic.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {stats.books} 本书
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Network className="h-4 w-4" />
              {stats.traces} 条痕迹
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquareText className="h-4 w-4" />
              {stats.insights} 条沉淀
            </span>
          </div>

          <div className="mt-4 rounded-lg bg-secondary/50 p-3">
            <div className="mb-1 text-xs text-muted-foreground">最近更新</div>
            <div className="text-sm text-foreground">{topic.latestUpdate}</div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {topic.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-[3px] text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

function InsightBlockIcon({ block }: { block: TopicWorkspaceBlock }) {
  if (block === '问题') return <MessageSquareText className="h-3.5 w-3.5" />;
  if (block === '判断') return <BrainCircuit className="h-3.5 w-3.5" />;
  return <Network className="h-3.5 w-3.5" />;
}

function AddBookDialog({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (bookId: number) => Promise<void> | void;
}) {
  const [query, setQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<number>(0);
  const booksQuery = useBooks({ q: query.trim() || undefined, page_size: 20, sort: '-updated_at' });
  const books = booksQuery.data?.data ?? [];

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedBookId(0);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!selectedBookId) return;
    await onConfirm(selectedBookId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="topic-add-book-title">
        <div className="border-b border-border px-5 py-4">
          <h2 id="topic-add-book-title" className="text-base font-semibold text-foreground">添加书籍</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="topic-book-query">搜索书名</Label>
            <input
              id="topic-book-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入书名或作者..."
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-border p-2">
            {books.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {booksQuery.isFetching ? '正在搜索书籍...' : '没有找到可添加的书籍'}
              </div>
            ) : (
              books.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBookId(book.id)}
                  className={cn(
                    'flex w-full items-start justify-between rounded-md border px-3 py-2 text-left transition-colors',
                    selectedBookId === book.id ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border hover:bg-accent',
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">《{book.title}》</div>
                    <div className="truncate text-xs text-muted-foreground">{book.author || '未知作者'}</div>
                  </div>
                  <div className="ml-3 shrink-0 text-xs text-muted-foreground">{book.status}</div>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>取消</Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={!selectedBookId || loading}>
            {loading ? '添加中...' : '确认添加'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TopicEditDialog({
  open,
  loading,
  initialName,
  initialDescription,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading?: boolean;
  initialName: string;
  initialDescription: string;
  onCancel: () => void;
  onConfirm: (input: { name: string; description: string }) => Promise<void> | void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [open, initialName, initialDescription]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onConfirm({ name: name.trim(), description: description.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="topic-edit-title">
        <div className="border-b border-border px-5 py-4">
          <h2 id="topic-edit-title" className="text-base font-semibold text-foreground">编辑话题</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="topic-edit-name">话题名称</Label>
            <input
              id="topic-edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-edit-description">话题描述</Label>
            <textarea
              id="topic-edit-description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充这个话题的研究问题、比较维度或整理目标..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>取消</Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={!name.trim() || loading}>
            {loading ? '保存中...' : '保存修改'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TopicEntryDialog({
  open,
  loading,
  initialType,
  initialContent,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading?: boolean;
  initialType: 'QUESTION' | 'JUDGMENT' | 'COMPARISON';
  initialContent: string;
  onCancel: () => void;
  onConfirm: (input: { entry_type: 'QUESTION' | 'JUDGMENT' | 'COMPARISON'; content: string }) => Promise<void> | void;
}) {
  const [entryType, setEntryType] = useState<'QUESTION' | 'JUDGMENT' | 'COMPARISON'>(initialType);
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (open) {
      setEntryType(initialType);
      setContent(initialContent);
    }
  }, [open, initialType, initialContent]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await onConfirm({ entry_type: entryType, content: content.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="topic-entry-title">
        <div className="border-b border-border px-5 py-4">
          <h2 id="topic-entry-title" className="text-base font-semibold text-foreground">沉淀内容</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label>沉淀类型</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '问题', value: 'QUESTION' },
                { label: '判断', value: 'JUDGMENT' },
                { label: '比较', value: 'COMPARISON' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setEntryType(item.value as 'QUESTION' | 'JUDGMENT' | 'COMPARISON')}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm transition-colors',
                    entryType === item.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-entry-content">内容</Label>
            <textarea
              id="topic-entry-content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下这个话题下的关键问题、判断或比较结论..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>取消</Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={!content.trim() || loading}>
            {loading ? '保存中...' : '确认保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TraceCard({
  trace,
  onJump,
}: {
  trace: TopicTrace;
  onJump?: (trace: TopicTrace) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">《{trace.bookTitle}》</span>
        <span>·</span>
        <span>{trace.chapter}</span>
        <span className="ml-auto">{trace.createdAt}</span>
      </div>
      <blockquote
        className={cn(
          'mb-2 border-l-2 pl-3 text-sm leading-relaxed text-foreground',
          trace.tone === 'success' ? 'border-success' : trace.tone === 'info' ? 'border-sky-700' : 'border-primary',
        )}
      >
        {trace.quote}
      </blockquote>
      {trace.note ? <div className="mb-3 text-xs text-muted-foreground">{trace.note}</div> : null}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => toast('话题内引用沉淀将在后续入口联动中补充')}>
          引用到沉淀
        </Button>
        <Button variant="outline" size="sm" onClick={() => onJump?.(trace)}>
          回到书中
        </Button>
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  onEdit,
  onDelete,
}: {
  insight: TopicInsight;
  onEdit?: (insight: TopicInsight) => void;
  onDelete?: (insight: TopicInsight) => void;
}) {
  return (
    <div className="rounded-md border border-border p-2 transition-colors hover:bg-accent">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-foreground">{insight.title}</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit?.(insight)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete?.(insight)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{insight.citations} 条引用</div>
    </div>
  );
}

function mapEntryTypeToBlock(type: string): TopicWorkspaceBlock {
  if (type === 'QUESTION') return '问题';
  if (type === 'JUDGMENT') return '判断';
  return '比较';
}

function findBookById(books: TopicBook[], bookId: number) {
  return books.find((book) => book.book_id === bookId);
}

export function mapTopicDetailToViewModel(topic: TopicDetail): Topic {
  const bookTraceCounts = new Map<number, number>();
  for (const highlight of topic.highlights) {
    bookTraceCounts.set(highlight.book_id, (bookTraceCounts.get(highlight.book_id) ?? 0) + 1);
  }
  for (const note of topic.notes) {
    bookTraceCounts.set(note.book_id, (bookTraceCounts.get(note.book_id) ?? 0) + 1);
  }
  for (const segment of topic.segments) {
    bookTraceCounts.set(segment.book_id, (bookTraceCounts.get(segment.book_id) ?? 0) + 1);
  }

  return {
    id: String(topic.id),
    title: topic.name,
    updatedAt: topic.updated_at,
    description: topic.description ?? '',
    tags: [],
    books: topic.books.map((book, index) => ({
      id: String(book.book_id),
      title: book.title,
      traceCount: bookTraceCounts.get(book.book_id) ?? 0,
      citationCount: topic.entries.length,
      tone: ['bg-[#d8c6b7]', 'bg-[#c7d4dc]', 'bg-[#ded7c2]', 'bg-[#cfd8c8]', 'bg-[#d7c8d5]'][index % 5] ?? 'bg-muted',
    })),
    traces: [
      ...topic.highlights.map((highlight) => ({
        id: `highlight-${highlight.highlight_id}`,
        bookTitle: highlight.book_title ?? '未知书籍',
        chapter: highlight.cfi_start,
        createdAt: highlight.added_at,
        quote: highlight.text,
        note: highlight.note ?? undefined,
        tone: 'primary' as const,
      })),
      ...topic.notes.map((note) => ({
        id: `note-${note.note_id}`,
        bookTitle: note.book_title ?? '未知书籍',
        chapter: note.cfi ?? '独立笔记',
        createdAt: note.added_at,
        quote: note.content_markdown ?? note.title ?? '未命名笔记',
        tone: 'success' as const,
      })),
      ...topic.segments.map((segment) => ({
        id: `segment-${segment.id}`,
        bookTitle: segment.book_title ?? findBookById(topic.books, segment.book_id)?.title ?? '未知书籍',
        chapter: segment.label ?? segment.cfi_start,
        createdAt: segment.added_at,
        quote: `${segment.cfi_start} → ${segment.cfi_end}`,
        tone: 'info' as const,
      })),
    ],
    latestUpdate: topic.description?.trim() || `最近更新于 ${topic.updated_at}`,
    insights: topic.entries.map((entry) => ({
      id: String(entry.id),
      title: entry.content,
      citations: 0,
      block: mapEntryTypeToBlock(entry.entry_type),
    })),
  };
}

export function TopicWorkspace({
  topic,
  onBack,
  onAddBook,
  onEditTopic,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onTraceJump,
}: {
  topic: TopicDetail;
  onBack: () => void;
  onAddBook: (bookId: number) => Promise<void>;
  onEditTopic: (input: { name: string; description: string }) => Promise<void>;
  onCreateEntry: (input: { entry_type: 'QUESTION' | 'JUDGMENT' | 'COMPARISON'; content: string }) => Promise<void>;
  onUpdateEntry: (entryId: number, content: string) => Promise<void>;
  onDeleteEntry: (entryId: number) => Promise<void>;
  onTraceJump?: (trace: TopicTrace) => void;
}) {
  const mappedTopic = useMemo(() => mapTopicDetailToViewModel(topic), [topic]);
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingInsight, setEditingInsight] = useState<TopicInsight | null>(null);
  const [submittingBook, setSubmittingBook] = useState(false);
  const [submittingTopic, setSubmittingTopic] = useState(false);
  const [submittingEntry, setSubmittingEntry] = useState(false);

  const groupedInsights = {
    问题: mappedTopic.insights.filter((item) => item.block === '问题'),
    判断: mappedTopic.insights.filter((item) => item.block === '判断'),
    比较: mappedTopic.insights.filter((item) => item.block === '比较'),
  } satisfies Record<TopicWorkspaceBlock, TopicInsight[]>;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
              <button type="button" onClick={onBack} className="hover:text-foreground">
                话题列表
              </button>
              <span>/</span>
              <span className="font-medium text-foreground">{mappedTopic.title}</span>
            </div>
            <p className="text-sm text-muted-foreground">{mappedTopic.description || '这个话题还没有描述。'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setBookDialogOpen(true)}>
              <BookOpen className="h-4 w-4" />
              添加书籍
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTopicDialogOpen(true)}>
              编辑话题
            </Button>
            <Button size="sm" onClick={() => { setEditingInsight(null); setEntryDialogOpen(true); }}>
              <CirclePlus className="h-4 w-4" />
              新建沉淀
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="space-y-4 lg:col-span-3">
            <SectionPanel title="关联书籍" className="rounded-lg p-4">
              <div className="space-y-3">
                {mappedTopic.books.map((book) => (
                  <div key={book.id} className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent">
                    <div className={cn('h-14 w-10 shrink-0 rounded', book.tone)} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{book.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {book.traceCount} 条痕迹 · {book.citationCount} 条引用
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setBookDialogOpen(true)} className="mt-3 h-8 w-full rounded-md border border-dashed border-input text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
                + 添加书籍
              </button>
            </SectionPanel>

            <SectionPanel title="话题标签" className="rounded-lg p-4">
              <div className="flex flex-wrap gap-2">
                {mappedTopic.tags.length > 0 ? mappedTopic.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-[3px] text-xs text-muted-foreground">
                    {tag}
                  </span>
                )) : <span className="text-xs text-muted-foreground">当前未设置话题标签</span>}
              </div>
            </SectionPanel>
          </aside>

          <section className="space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">阅读痕迹</h3>
              <div className="flex items-center gap-2">
                <CompactSelect options={['全部来源', ...mappedTopic.books.map((book) => book.title)]} />
                <CompactSelect options={['按时间', '按书籍']} />
              </div>
            </div>

            <div className="space-y-3">
              {mappedTopic.traces.length > 0 ? (
                mappedTopic.traces.map((trace) => <TraceCard key={trace.id} trace={trace} onJump={onTraceJump} />)
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">这个话题还没有整理出阅读痕迹。</div>
              )}
            </div>
          </section>

          <aside className="space-y-4 lg:col-span-3">
            <SectionPanel
              title="沉淀内容"
              action={
                <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { setEditingInsight(null); setEntryDialogOpen(true); }}>
                  + 新建
                </Button>
              }
              className="rounded-lg p-4"
            >
              {(['问题', '判断', '比较'] as TopicWorkspaceBlock[]).map((block) => (
                <div key={block} className="mb-4 last:mb-0">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <InsightBlockIcon block={block} />
                    {block}
                  </div>
                  <div className="space-y-2">
                    {groupedInsights[block].length > 0 ? groupedInsights[block].map((insight) => (
                      <InsightCard
                        key={insight.id}
                        insight={insight}
                        onEdit={(item) => {
                          setEditingInsight(item);
                          setEntryDialogOpen(true);
                        }}
                        onDelete={async (item) => {
                          const entryId = Number(item.id);
                          try {
                            await onDeleteEntry(entryId);
                            toast.success('沉淀已删除');
                          } catch (error) {
                            const message = error instanceof Error ? error.message : '删除沉淀失败';
                            toast.error(message);
                          }
                        }}
                      />
                    )) : <div className="text-xs text-muted-foreground">暂无{block}类沉淀</div>}
                  </div>
                </div>
              ))}
            </SectionPanel>

            <SectionPanel title="AI 辅助" className="rounded-lg bg-gradient-to-b from-background to-secondary/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-semibold text-foreground">AI 辅助</span>
              </div>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">生成话题总结</Button>
                <Button variant="outline" size="sm" className="w-full justify-start">回答话题问题</Button>
                <Button variant="outline" size="sm" className="w-full justify-start">发现观点冲突</Button>
              </div>
            </SectionPanel>
          </aside>
        </div>
      </div>

      <AddBookDialog
        open={bookDialogOpen}
        loading={submittingBook}
        onCancel={() => setBookDialogOpen(false)}
        onConfirm={async (bookId) => {
          setSubmittingBook(true);
          try {
            await onAddBook(bookId);
            toast.success('已添加关联书籍');
            setBookDialogOpen(false);
          } catch (error) {
            const message = error instanceof Error ? error.message : '添加书籍失败';
            toast.error(message);
          } finally {
            setSubmittingBook(false);
          }
        }}
      />

      <TopicEditDialog
        open={topicDialogOpen}
        loading={submittingTopic}
        initialName={topic.name}
        initialDescription={topic.description ?? ''}
        onCancel={() => setTopicDialogOpen(false)}
        onConfirm={async (input) => {
          setSubmittingTopic(true);
          try {
            await onEditTopic(input);
            toast.success('话题已更新');
            setTopicDialogOpen(false);
          } catch (error) {
            const message = error instanceof Error ? error.message : '更新话题失败';
            toast.error(message);
          } finally {
            setSubmittingTopic(false);
          }
        }}
      />

      <TopicEntryDialog
        open={entryDialogOpen}
        loading={submittingEntry}
        initialType={editingInsight?.block === '判断' ? 'JUDGMENT' : editingInsight?.block === '比较' ? 'COMPARISON' : 'QUESTION'}
        initialContent={editingInsight?.title ?? ''}
        onCancel={() => {
          setEntryDialogOpen(false);
          setEditingInsight(null);
        }}
        onConfirm={async (input) => {
          setSubmittingEntry(true);
          try {
            if (editingInsight) {
              await onUpdateEntry(Number(editingInsight.id), input.content);
              toast.success('沉淀已更新');
            } else {
              await onCreateEntry(input);
              toast.success('沉淀已创建');
            }
            setEntryDialogOpen(false);
            setEditingInsight(null);
          } catch (error) {
            const message = error instanceof Error ? error.message : '保存沉淀失败';
            toast.error(message);
          } finally {
            setSubmittingEntry(false);
          }
        }}
      />
    </>
  );
}

export function ViewSwitch({
  view,
  setView,
}: {
  view: 'list' | 'workspace';
  setView: (view: 'list' | 'workspace') => void;
}) {
  return (
    <>
      <SegmentedToggle className="rounded-md border-input bg-background p-1">
        <SegmentedToggleItem active={view === 'list'} onClick={() => setView('list')} className="rounded-md text-sm">
          <LayoutGrid className="h-4 w-4" />
          网格
        </SegmentedToggleItem>
        <SegmentedToggleItem active={view === 'workspace'} onClick={() => setView('workspace')} className="rounded-md text-sm">
          <List className="h-4 w-4" />
          工作区
        </SegmentedToggleItem>
      </SegmentedToggle>

      <SegmentedToggle className="rounded-lg border-input bg-background p-1">
        <SegmentedToggleItem active={view === 'list'} onClick={() => setView('list')} className="rounded-md text-sm">
          话题列表
        </SegmentedToggleItem>
        <SegmentedToggleItem active={view === 'workspace'} onClick={() => setView('workspace')} className="rounded-md text-sm">
          话题工作区视图
        </SegmentedToggleItem>
      </SegmentedToggle>
    </>
  );
}
