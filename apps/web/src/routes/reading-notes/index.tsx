import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Tags } from 'lucide-react';
import { ProtectedShell } from '@/components/protected-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { ExportActions, CompactSelect, PaginationButton, ReadingNoteCard, SidebarPanel, SourcePill } from './components';
import { filterChips, highFrequencyTags, notes, pageStats, sourceBooks } from './data';

export function ReadingNotesPage() {
  const sidebarStats = useSidebarStats();
  const [selectedSourceId, setSelectedSourceId] = useState<string>('thinking-fast-slow');

  const selectedSource = sourceBooks.find((book) => book.id === selectedSourceId) ?? sourceBooks[0];
  const visibleNotes = useMemo(
    () => notes.filter((note) => note.sourceBookId === selectedSourceId),
    [selectedSourceId],
  );

  return (
    <ProtectedShell
      activeKey="reading-notes"
      stats={sidebarStats}
      mainClassName="min-w-0 flex-1 px-6 py-6 lg:px-8"
    >
      <div className="space-y-6">
        <section className="border-b border-border pb-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl flex-1">
              <h1 className="font-display text-3xl font-semibold text-foreground">阅读笔记</h1>
              <p className="mt-1 text-sm text-muted-foreground">所有高亮、摘录与批注的集中仓库</p>

              <div className="mt-5 flex flex-col gap-3 lg:flex-row">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="搜索笔记内容、书名、作者..." />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CompactSelect options={['全部类型', '高亮摘录', '高亮 + 批注', '独立笔记']} />
                  <CompactSelect options={['最近 30 天', '最近 7 天', '最近一年', '全部时间']} />
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Tags className="h-4 w-4" />
                    标签
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">已筛选：</span>
                {filterChips.map((chip) => (
                  <span key={chip} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                    {chip}
                    <span className="text-muted-foreground">×</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="xl:w-80 xl:shrink-0">
              <div className="grid grid-cols-2 gap-3">
                {pageStats.map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                    <div className="font-display text-3xl font-semibold text-foreground">{item.value}</div>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                  </div>
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
            <SourcePill active={selectedSourceId === 'all'} title="全部" count={24} onClick={() => setSelectedSourceId('all')} />
            {sourceBooks.map((book) => (
              <SourcePill
                key={book.id}
                active={selectedSourceId === book.id}
                title={book.title}
                count={book.count}
                tone={book.tone}
                onClick={() => setSelectedSourceId(book.id)}
              />
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {selectedSourceId === 'all' ? '全部笔记' : `《${selectedSource.title}》`}
                </p>
                <p className="text-xs text-muted-foreground">
                  共 {selectedSourceId === 'all' ? notes.length : visibleNotes.length} 条笔记
                </p>
              </div>
              <CompactSelect options={['按时间倒序', '按阅读章节', '按标签分组']} />
            </div>

            <div className="space-y-4">
              {(selectedSourceId === 'all' ? notes : visibleNotes).map((note) => (
                <ReadingNoteCard key={note.id} note={note} />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-1">
              <PaginationButton disabled>
                <ChevronLeft className="h-4 w-4" />
              </PaginationButton>
              <PaginationButton active>1</PaginationButton>
              <PaginationButton>2</PaginationButton>
              <PaginationButton>3</PaginationButton>
              <PaginationButton>
                <ChevronRight className="h-4 w-4" />
              </PaginationButton>
            </div>
          </section>

          <aside className="space-y-6">
            <SidebarPanel title="高频标签">
              <div className="flex flex-wrap gap-2">
                {highFrequencyTags.map(([tag, count]) => (
                  <span
                    key={tag}
                    className="inline-flex cursor-pointer items-center rounded-md border border-border bg-muted px-2 py-[3px] text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {tag}
                    <span className="ml-1 text-muted-foreground/70">{count}</span>
                  </span>
                ))}
              </div>
            </SidebarPanel>

            <SidebarPanel title="来源书籍">
              <div className="space-y-2">
                {sourceBooks.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => setSelectedSourceId(book.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left transition-colors hover:bg-accent"
                  >
                    <div className={book.tone + ' h-11 w-8 rounded'} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{book.title}</div>
                      <div className="text-xs text-muted-foreground">{book.count} 条笔记</div>
                    </div>
                  </button>
                ))}
              </div>
            </SidebarPanel>

            <SidebarPanel title="导出笔记" description="将当前筛选结果导出为通用格式。">
              <ExportActions />
            </SidebarPanel>
          </aside>
        </div>
      </div>
    </ProtectedShell>
  );
}
