import { useMemo, useState } from 'react';
import { CirclePlus, Search } from 'lucide-react';
import { ProtectedShell } from '@/components/protected-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { CompactSelect, TopicCard, TopicWorkspace, ViewSwitch } from './components';
import { topics } from './data';

export function ReadingTopicsPage() {
  const sidebarStats = useSidebarStats();
  const [view, setView] = useState<'list' | 'workspace'>('list');
  const [selectedTopicId, setSelectedTopicId] = useState(topics[0]?.id ?? '');

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? topics[0],
    [selectedTopicId],
  );

  return (
    <ProtectedShell
      activeKey="reading-topics"
      stats={sidebarStats}
      mainClassName="min-w-0 flex-1 px-6 py-6 lg:px-8"
    >
      <div className="space-y-5">
        <section className="border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">阅读话题</h1>
              <p className="mt-1 text-sm text-muted-foreground">围绕问题或研究方向聚合多本书的思考空间</p>
            </div>
            <Button>
              <CirclePlus className="h-4 w-4" />
              新建话题
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 pl-9" placeholder="搜索话题名称..." />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CompactSelect options={['最近更新', '创建时间', '书籍数']} />
              <ViewSwitch view={view} setView={setView} />
            </div>
          </div>
        </section>

        {view === 'list' ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onOpen={() => {
                  setSelectedTopicId(topic.id);
                  setView('workspace');
                }}
              />
            ))}
            <button
              type="button"
              className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <CirclePlus className="mb-3 h-10 w-10" />
              <span className="text-base font-medium">创建新话题</span>
              <span className="mt-1 text-xs">围绕一个问题聚合多本书</span>
            </button>
          </div>
        ) : selectedTopic ? (
          <TopicWorkspace topic={selectedTopic} onBack={() => setView('list')} />
        ) : null}
      </div>
    </ProtectedShell>
  );
}
