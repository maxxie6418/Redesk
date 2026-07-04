import { BookOpen, BrainCircuit, CirclePlus, LayoutGrid, List, MessageSquareText, Network, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Topic, TopicInsight, TopicTrace, TopicWorkspaceBlock } from './data';
import { topicStats } from './data';

export function CompactSelect({ options }: { options: string[] }) {
  return (
    <select className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring">
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

export function ViewModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function WorkspacePanel({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TopicCard({ topic, onOpen }: { topic: Topic; onOpen: () => void }) {
  const stats = topicStats(topic);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-xl border border-border bg-card p-6 text-left transition-shadow hover:shadow-md"
    >
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
  if (block === '问题') {
    return <MessageSquareText className="h-3.5 w-3.5" />;
  }

  if (block === '判断') {
    return <BrainCircuit className="h-3.5 w-3.5" />;
  }

  return <Network className="h-3.5 w-3.5" />;
}

function TraceCard({ trace }: { trace: TopicTrace }) {
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
        <Button variant="outline" size="sm">
          引用到沉淀
        </Button>
        <Button variant="outline" size="sm">
          回到书中
        </Button>
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: TopicInsight }) {
  return (
    <div className="rounded-md border border-border p-2 transition-colors hover:bg-accent">
      <div className="text-sm text-foreground">{insight.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{insight.citations} 条引用</div>
    </div>
  );
}

export function TopicWorkspace({ topic, onBack }: { topic: Topic; onBack: () => void }) {
  const groupedInsights = {
    问题: topic.insights.filter((item) => item.block === '问题'),
    判断: topic.insights.filter((item) => item.block === '判断'),
    比较: topic.insights.filter((item) => item.block === '比较'),
  } satisfies Record<TopicWorkspaceBlock, TopicInsight[]>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <button type="button" onClick={onBack} className="hover:text-foreground">
              话题列表
            </button>
            <span>/</span>
            <span className="font-medium text-foreground">{topic.title}</span>
          </div>
          <p className="text-sm text-muted-foreground">{topic.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm">
            <BookOpen className="h-4 w-4" />
            添加书籍
          </Button>
          <Button variant="outline" size="sm">
            编辑话题
          </Button>
          <Button size="sm">
            <CirclePlus className="h-4 w-4" />
            新建沉淀
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-3">
          <WorkspacePanel title="关联书籍">
            <div className="space-y-3">
              {topic.books.map((book) => (
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
            <button
              type="button"
              className="mt-3 h-8 w-full rounded-md border border-dashed border-input text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              + 添加书籍
            </button>
          </WorkspacePanel>

          <WorkspacePanel title="话题标签">
            <div className="flex flex-wrap gap-2">
              {topic.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-[3px] text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </WorkspacePanel>
        </aside>

        <section className="space-y-4 lg:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">阅读痕迹</h3>
            <div className="flex items-center gap-2">
              <CompactSelect options={['全部来源', ...topic.books.map((book) => book.title)]} />
              <CompactSelect options={['按时间', '按书籍']} />
            </div>
          </div>

          <div className="space-y-3">
            {topic.traces.length > 0 ? (
              topic.traces.map((trace) => <TraceCard key={trace.id} trace={trace} />)
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                这个话题还没有整理出阅读痕迹。
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-3">
          <WorkspacePanel
            title="沉淀内容"
            action={
              <Button size="sm" className="h-7 px-2 text-xs">
                + 新建
              </Button>
            }
          >
            {(['问题', '判断', '比较'] as TopicWorkspaceBlock[]).map((block) => (
              <div key={block} className="mb-4 last:mb-0">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <InsightBlockIcon block={block} />
                  {block}
                </div>
                <div className="space-y-2">
                  {groupedInsights[block].map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              </div>
            ))}
          </WorkspacePanel>

          <WorkspacePanel title="AI 辅助" className="bg-gradient-to-b from-background to-secondary/30">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-semibold text-foreground">AI 辅助</span>
            </div>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                生成话题总结
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                回答话题问题
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                发现观点冲突
              </Button>
            </div>
          </WorkspacePanel>
        </aside>
      </div>
    </div>
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
      <div className="inline-flex items-center rounded-md border border-input bg-background p-1">
        <ViewModeButton active={view === 'list'} onClick={() => setView('list')}>
          <LayoutGrid className="h-4 w-4" />
          网格
        </ViewModeButton>
        <ViewModeButton active={view === 'workspace'} onClick={() => setView('workspace')}>
          <List className="h-4 w-4" />
          工作区
        </ViewModeButton>
      </div>

      <div className="inline-flex items-center rounded-lg border border-input bg-background p-1">
        <ViewModeButton active={view === 'list'} onClick={() => setView('list')}>
          话题列表
        </ViewModeButton>
        <ViewModeButton active={view === 'workspace'} onClick={() => setView('workspace')}>
          话题工作区视图
        </ViewModeButton>
      </div>
    </>
  );
}
