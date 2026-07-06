import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Tags, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { SearchField } from '@/components/page-ui/search-field';
import { StatCard } from '@/components/page-ui/stat-card';
import { ProtectedShell } from '@/components/protected-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { useHighlights, useNotes, useReadingMarkStats, useCreateNote, useUpdateNote, useDeleteNote, useNotesSearch, useHighlightsSearch, type NoteItem, type HighlightItem } from '@/hooks/use-notes';
import { CreateNoteDialog } from '@/components/create-note-dialog';
import { AddToTopicDialog } from '@/components/add-to-topic-dialog';
import { useAddTopicHighlight, useAddTopicNote } from '@/hooks/use-topics';
import { CompactSelect, ExportActions, PaginationButton, ReadingNoteCard, SidebarPanel, SourcePill } from './components';

interface NoteEditForm {
  id: number;
  title: string;
  content_markdown: string;
}

export function ReadingNotesPage() {
  const navigate = useNavigate();
  const sidebarStats = useSidebarStats();
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteEditForm | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
  const [topicTarget, setTopicTarget] = useState<{ type: 'highlight' | 'note'; id: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: highlightsData } = useHighlights();
  const { data: notesData } = useNotes();
  const { data: statsData } = useReadingMarkStats();
  const { data: searchNotesData } = useNotesSearch(debouncedSearch, selectedBookId !== 'all' ? Number(selectedBookId) : undefined);
  const { data: searchHighlightsData } = useHighlightsSearch(debouncedSearch, selectedBookId !== 'all' ? Number(selectedBookId) : undefined);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const addTopicHighlight = useAddTopicHighlight();
  const addTopicNote = useAddTopicNote();

  const highlights = useMemo(() => highlightsData ?? [], [highlightsData]);
  const allNotes = useMemo(() => notesData ?? [], [notesData]);
  const stats = useMemo(() => statsData ?? { total_highlights: 0, total_notes: 0, notes_this_month: 0, annotated: 0 }, [statsData]);

  const formatChapterLabel = (cfi: string | undefined): string => {
    if (!cfi) return '未知位置';
    const matches = cfi.match(/\[([^\]]+)\]/g);
    if (matches && matches.length > 0) {
      return matches.map((m) => m.slice(1, -1)).join(' > ');
    }
    if (cfi.length > 30) return cfi.slice(0, 28) + '...';
    return cfi;
  };

  const isSearching = debouncedSearch.trim().length > 0;

  const allMarks = useMemo(() => {
    // 搜索模式：使用搜索 API 结果
    if (isSearching) {
      const searchNotes = (searchNotesData ?? []) as NoteItem[];
      const searchHighlights = (searchHighlightsData ?? []) as HighlightItem[];
      const hlMarks = searchHighlights.map((h) => ({
        id: `h-${h.id}`,
        rawId: h.id,
        isNote: false as const,
        noteId: undefined as number | undefined,
        type: 'highlight' as const,
        book_id: h.book_id,
        book_title: h.book_title ?? '未知书籍',
        book_author: h.book_author ?? '',
        chapter: formatChapterLabel(h.cfi_start),
        chapterCfi: h.cfi_start,
        created_at: h.created_at,
        quote: h.text,
        summary: h.note ?? undefined,
        tags: [] as string[],
        mark_type: h.mark_type,
        color: h.color,
      }));
      const nMarks = searchNotes.map((n) => ({
        id: `n-${n.id}`,
        rawId: n.id,
        isNote: true as const,
        noteId: n.id,
        type: 'note' as const,
        book_id: n.book_id,
        book_title: n.book_title ?? '未知书籍',
        book_author: n.book_author ?? '',
        chapter: formatChapterLabel(n.cfi ?? undefined),
        chapterCfi: n.cfi ?? '',
        created_at: n.created_at,
        quote: undefined as string | undefined,
        summary: n.content_markdown ?? n.title ?? undefined,
        tags: [] as string[],
        mark_type: n.mark_type,
        color: null as string | null,
      }));
      return [...hlMarks, ...nMarks].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    // 正常模式：使用全量数据
    const highlightMarks = highlights.map((h) => ({
      id: `h-${h.id}`,
      rawId: h.id,
      isNote: false as const,
      noteId: undefined as number | undefined,
      type: 'highlight' as const,
      book_id: h.book_id,
      book_title: h.book_title ?? '未知书籍',
      book_author: h.book_author ?? '',
      chapter: formatChapterLabel(h.cfi_start),
      chapterCfi: h.cfi_start,
      created_at: h.created_at,
      quote: h.text,
      summary: h.note ?? undefined,
      tags: [] as string[],
      mark_type: h.mark_type,
      color: h.color,
    }));

    const noteMarks = allNotes.map((n) => ({
      id: `n-${n.id}`,
      rawId: n.id,
      isNote: true as const,
      noteId: n.id,
      type: 'note' as const,
      book_id: n.book_id,
      book_title: n.book_title ?? '未知书籍',
      book_author: n.book_author ?? '',
      chapter: formatChapterLabel(n.cfi ?? undefined),
      chapterCfi: n.cfi ?? '',
      created_at: n.created_at,
      quote: undefined as string | undefined,
      summary: n.content_markdown ?? n.title ?? undefined,
      tags: [] as string[],
      mark_type: n.mark_type,
      color: null as string | null,
    }));

    return [...highlightMarks, ...noteMarks].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [highlights, allNotes, isSearching, searchNotesData, searchHighlightsData]);

  const handleCreateNote = async (data: { book_id: number; title: string; content_markdown: string }) => {
    try {
      await createNote.mutateAsync(data);
      setNoteDialogOpen(false);
    } catch {
      // 创建失败，忽略
    }
  };

  const handleEditNote = (mark: (typeof allMarks)[number]) => {
    if (!mark.isNote) return;
    const note = allNotes.find((n) => n.id === mark.noteId);
    if (!note) return;
    setEditingNote({
      id: note.id,
      title: note.title ?? '',
      content_markdown: note.content_markdown ?? '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingNote) return;
    try {
      await updateNote.mutateAsync({
        id: editingNote.id,
        title: editingNote.title.trim() || undefined,
        content_markdown: editingNote.content_markdown.trim() || undefined,
      });
      setEditingNote(null);
    } catch {
      // 更新失败，忽略
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingNoteId === null) return;
    try {
      await deleteNote.mutateAsync(deletingNoteId);
      setDeletingNoteId(null);
    } catch {
      // 删除失败，忽略
    }
  };

  const handleNavigateToReader = (bookId: number, cfi: string | undefined) => {
    if (cfi) {
      const params = new URLSearchParams({ cfi }).toString();
      navigate(`/books/${bookId}/read?${params}`);
    } else {
      navigate(`/books/${bookId}/read`);
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
                <SearchField placeholder="搜索笔记内容、书名、作者..." value={searchQuery} onChange={setSearchQuery} />
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
                  {isSearching ? '未找到匹配的结果，请尝试其他关键词。' : '暂无阅读笔记，开始阅读后这里的高亮和批注会自动汇总。'}
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
                    onEdit={mark.isNote ? () => handleEditNote(mark) : undefined}
                    onDelete={mark.isNote ? () => setDeletingNoteId(mark.noteId!) : undefined}
                    onNavigate={() => handleNavigateToReader(mark.book_id, mark.chapterCfi || undefined)}
                    onAddToTopic={() => setTopicTarget({ type: mark.isNote ? 'note' : 'highlight', id: mark.rawId })}
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

            <SidebarPanel title="导出笔记" description="选择一本具体书籍后再导出。">
              <ExportActions
                bookId={selectedBookId !== 'all' ? Number(selectedBookId) : undefined}
                bookTitle={selectedBookId !== 'all' ? (sourceBooks.find((b) => String(b.id) === selectedBookId)?.title) : undefined}
              />
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

      <AddToTopicDialog
        open={topicTarget !== null}
        onCancel={() => setTopicTarget(null)}
        loading={addTopicHighlight.isPending || addTopicNote.isPending}
        onConfirm={async (topicId) => {
          if (!topicTarget) return;
          if (topicTarget.type === 'highlight') {
            await addTopicHighlight.mutateAsync({ topicId, highlightId: topicTarget.id });
          } else {
            await addTopicNote.mutateAsync({ topicId, noteId: topicTarget.id });
          }
          toast.success('已加入话题');
          setTopicTarget(null);
        }}
      />

      {/* 编辑笔记对话框 */}
      <Dialog open={editingNote !== null} onOpenChange={(open: boolean) => { if (!open) setEditingNote(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑笔记</DialogTitle>
          </DialogHeader>
          {editingNote && (
            <div className="space-y-3 py-2">
              <input
                type="text"
                placeholder="笔记标题"
                value={editingNote.title}
                onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <textarea
                placeholder="笔记内容（Markdown 格式）"
                value={editingNote.content_markdown}
                onChange={(e) => setEditingNote({ ...editingNote, content_markdown: e.target.value })}
                className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                rows={6}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNote(null)}>
              <X className="mr-1.5 h-4 w-4" />
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editingNote?.title.trim()}>
              <Check className="mr-1.5 h-4 w-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deletingNoteId !== null} onOpenChange={(open: boolean) => { if (!open) setDeletingNoteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">确定要删除这条笔记吗？删除后不可恢复。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingNoteId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedShell>
  );
}