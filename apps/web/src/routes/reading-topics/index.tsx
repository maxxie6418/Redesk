import { useState } from 'react';
import { CirclePlus } from 'lucide-react';
import { SearchField } from '@/components/page-ui/search-field';
import { ProtectedShell } from '@/components/protected-shell';
import { Button } from '@/components/ui/button';
import { useSidebarStats } from '@/hooks/use-sidebar-stats';
import { useTopics, useCreateTopic, useTopic } from '@/hooks/use-topics';
import { CreateTopicDialog } from '@/components/create-topic-dialog';
import { CompactSelect, TopicCard, TopicWorkspace, ViewSwitch } from './components';

export function ReadingTopicsPage() {
  const sidebarStats = useSidebarStats();
  const [view, setView] = useState<'list' | 'workspace'>('list');
  const [selectedTopicId, setSelectedTopicId] = useState<number>(0);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);

  const { data: topicsData } = useTopics();
  const { data: selectedTopic } = useTopic(selectedTopicId);
  const createTopic = useCreateTopic();

  const topics = topicsData ?? [];

  const handleCreateTopic = async (name: string) => {
    try {
      const newTopic = await createTopic.mutateAsync({ name });
      setSelectedTopicId(newTopic.id);
      setView('workspace');
      setTopicDialogOpen(false);
    } catch {
      // 创建失败，忽略
    }
  };

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
            <Button onClick={() => setTopicDialogOpen(true)}>
              <CirclePlus className="h-4 w-4" />
              新建话题
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <SearchField placeholder="搜索话题名称..." />
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
                topic={{
                  id: String(topic.id),
                  title: topic.name,
                  updatedAt: topic.updated_at,
                  description: topic.description ?? '',
                  tags: [],
                  books: [],
                  traces: [],
                  latestUpdate: '',
                  insights: [],
                }}
                onOpen={() => {
                  setSelectedTopicId(topic.id);
                  setView('workspace');
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => setTopicDialogOpen(true)}
              className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <CirclePlus className="mb-3 h-10 w-10" />
              <span className="text-base font-medium">创建新话题</span>
              <span className="mt-1 text-xs">围绕一个问题聚合多本书</span>
            </button>
          </div>
        ) : selectedTopic ? (
          <TopicWorkspace
            topic={{
              id: String(selectedTopic.id),
              title: selectedTopic.name,
              updatedAt: selectedTopic.updated_at,
              description: selectedTopic.description ?? '',
              tags: [],
              books: selectedTopic.books.map((b) => ({
                id: String(b.book_id),
                title: b.title,
                traceCount: 0,
                citationCount: 0,
                tone: 'bg-muted',
              })),
              traces: [
                ...selectedTopic.highlights.map((h) => ({
                  id: String(h.highlight_id),
                  bookTitle: h.book_title ?? '未知书籍',
                  chapter: h.cfi_start,
                  createdAt: h.added_at,
                  quote: h.text,
                  note: h.note ?? undefined,
                  tone: 'primary' as const,
                })),
                ...selectedTopic.notes.map((n) => ({
                  id: String(n.note_id),
                  bookTitle: n.book_title ?? '未知书籍',
                  chapter: '',
                  createdAt: n.added_at,
                  quote: n.content_markdown ?? n.title ?? '',
                  note: undefined,
                  tone: 'success' as const,
                })),
              ],
              latestUpdate: selectedTopic.updated_at,
              insights: selectedTopic.entries.map((e) => ({
                id: String(e.id),
                title: e.content,
                citations: 0,
                block: (e.entry_type === 'QUESTION' ? '问题' : e.entry_type === 'JUDGMENT' ? '判断' : '比较') as '问题' | '判断' | '比较',
              })),
            }}
            onBack={() => setView('list')}
          />
        ) : null}
      </div>
      <CreateTopicDialog
        open={topicDialogOpen}
        onConfirm={handleCreateTopic}
        onCancel={() => setTopicDialogOpen(false)}
        loading={createTopic.isPending}
      />
    </ProtectedShell>
  );
}
