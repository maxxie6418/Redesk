import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Tags } from 'lucide-react';
import { SearchField } from '@/components/page-ui/search-field';
import { StatCard } from '@/components/page-ui/stat-card';
import { ProtectedShell } from '@/components/protected-shell';
import { Button } from '@/components/ui/button';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { useHighlights, useNotes, useReadingMarkStats, useCreateNote } from '@/hooks/use-notes';
import { CreateNoteDialog } from '@/components/create-note-dialog';
import { CompactSelect, ExportActions, PaginationButton, ReadingNoteCard, SidebarPanel, SourcePill } from './components';

export function ReadingNotesPage() {
  const sidebarStats = useSidebarStats();
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  const { data: highlightsData } = useHighlights();
  const { data: notesData } = useNotes();
  const { data: statsData } = useReadingMarkStats();
  const createNote = useCreateNote();

  const highlights = useMemo(() => highlightsData ?? [], [highlightsData]);
  const allNotes = useMemo(() => notesData ?? [], [notesData]);
  const stats = useMemo(() => statsData ?? { total_highlights: 0, total_notes: 0, notes_this_month: 0, annotated: 0 }, [statsData]);

  const allMarks = useMemo(() => {
    const highlightMarks = highlights.map((h) => ({
      id: `h-${h.id}`,
      type: 'highlight' as const,
      book_id: h.book_id,
      book_title: h.book_title ?? '未知书籍',
      book_author: h.book_author ?? '',
      chapter: h.cfi_start,
      created_at: h.created_at,
      quote: h.text,
      summary: h.note ?? undefined,
      tags: [] as string[],
      mark_type: h.mark_type,
      color: h.color,
    }));

    const noteMarks = allNotes.map((n) => ({
      id: `n-${n.id}`,
      type: 'note' as const,
      book_id: n.book_id,
      book_title: n.book_title ?? '未知书籍',
      book_author: n.book_author ?? '',
      chapter: n.cfi ?? '',
      created_at: n.created_at,
      quote: undefined,
      summary: n.content_markdown ?? n.title ?? undefined,
      tags: [] as string[],
      mark_type: n.mark_type,
      color: null,
    }));

    return [...highlightMarks, ...noteMarks].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [highlights, allNotes]);

  const handleCreateNote = async (data: { book_id: number; title: string; content_markdown: string }) => {
    try {
      await createNote.mutateAsync(data);
      setNoteDialogOpen(false);
    } catch {
      // 创建失败，忽略
    }
  };

  const sourceBooks = useMemo(() => {
    const bookMap = new Map<number, { id: number; title: string; count: number }>();
    for (const mark of allMarks) {
      const existing = bookMap.get(mark.book_id);
      if (existing) {
        existing.count++;
      } else {
        bookMap.set(mark.book_id, { id: mark.book_id, title: mark.book_title, count: 1 });
      }
    }
    return Array.from(bookMap.values());
  }, [allMarks]);

  const filteredMarks = useMemo(() => {
    if (selectedBookId === 'all') return allMarks;
    const bookId = Number(selectedBookId);
    return allMarks.filter((m) => m.book_id === bookId);
  }, [allMarks, selectedBookId]);

  const pageStats = [
    { label: '总高亮', value: String(stats.total_highlights) },
    { label: '总笔记', value: String(stats.total_notes) },
    { label: '本月新增', value: String(stats.notes_this_month) },
    { label: '已批注', value: String(stats.annotated) },
  ];

  return (
    <ProtectedShell activeKey="reading-notes" stats={sidebarStats} mainClassName="min-w-0 flex-1 px-6 py-6 lg:px-8">
      <div className="space-y-6">
        <section className="border-b border-border pb-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl flex-1">
              <h1 className="font-display text-3xl font-semibold text-foreground">阅读笔记</h1>
              <p className="mt-1 text-sm text-muted-foreground">所有高亮、摘录与批注的集中仓库</p>

              <div className="mt-5 flex flex-col gap-3 lg:flex-row">
                <SearchField placeholder="搜索笔记内容、书名、作者..." />
                <div className="flex flex-wrap items-center gap-2">
                  <CompactSelect options={['全部类型', '高亮摘录', '高亮 + 批注', '独立笔记']} />
                  <CompactSelect options={['最近 30 天', '最近 7 天', '最近一年', '全部时间']} />
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Tags className="h-4 w-4" />
                    标签
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => setNoteDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    添加笔记
                  </Button>
                </div>
              </div>
            </div>

            <div className="xl:w-80 xl:shrink-0">
              <div className="grid grid-cols-2 gap-3">
                {pageStats.map((item) => (
                  <StatCard key={item.label} label={item.label} value={item.value} className="p-4" valueClassName="font-display text-3xl font-semibold" />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">书源</span>
            <span className="text-xs text-muted-foreground">点击快速筛选该书笔记</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourcePill active={selectedBookId === 'all'} title="全部" count={allMarks.length} onClick={() => setSelectedBookId('all')} />
            {sourceBooks.map((book) => (
              <SourcePill key={book.id} active={selectedBookId === String(book.id)} title={book.title} count={book.count} onClick={() => setSelectedBookId(String(book.id))} />
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {selectedBookId === 'all' ? '全部笔记' : `《${sourceBooks.find((b) => String(b.id) === selectedBookId)?.title ?? ''}》`}
                </p>
                <p className="text-xs text-muted-foreground">共 {filteredMarks.length} 条笔记</p>
              </div>
              <CompactSelect options={['按时间倒序', '按阅读章节', '按标签分组']} />
            </div>

            <div className="space-y-4">
              {filteredMarks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                  暂无阅读笔记，开始阅读后这里的高亮和批注会自动汇总。
                </div>
              ) : (
                filteredMarks.map((mark) => (
                  <ReadingNoteCard
                    key={mark.id}
                    note={{
                      id: mark.id,
                      sourceBookId: String(mark.book_id),
                      sourceTitle: mark.book_title,
                      author: mark.book_author,
                      chapter: mark.chapter,
                      createdAt: mark.created_at,
                      type: mark.type === 'highlight' ? (mark.summary ? 'annotated' : 'highlight') : 'standalone',
                      quote: mark.quote,
                      summary: mark.summary,
                      tags: mark.tags,
                    }}
                  />
                ))
              )}
            </div>

            <div className="mt-6 flex items-center justify-center gap-1">
              <PaginationButton disabled>
                <ChevronLeft className="h-4 w-4" />
              </PaginationButton>
              <PaginationButton active>1</PaginationButton>
              <PaginationButton>
                <ChevronRight className="h-4 w-4" />
              </PaginationButton>
            </div>
          </section>

          <aside className="space-y-6">
            <SidebarPanel title="来源书籍">
              <div className="space-y-2">
                {sourceBooks.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => setSelectedBookId(String(book.id))}
                    className="flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left transition-colors hover:bg-accent"
                  >
                    <div className="h-11 w-8 rounded bg-muted" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{book.title}</div>
                      <div className="text-xs text-muted-foreground">{book.count} 条笔记</div>
                    </div>
                  </button>
                ))}
                {sourceBooks.length === 0 && (
                  <div className="text-xs text-muted-foreground">暂无来源书籍</div>
                )}
              </div>
            </SidebarPanel>

            <SidebarPanel title="导出笔记" description="将当前筛选结果导出为通用格式。">
              <ExportActions />
            </SidebarPanel>
          </aside>
        </div>
      </div>
      <CreateNoteDialog
        open={noteDialogOpen}
        onConfirm={handleCreateNote}
        onCancel={() => setNoteDialogOpen(false)}
        loading={createNote.isPending}
      />
    </ProtectedShell>
  );
}
