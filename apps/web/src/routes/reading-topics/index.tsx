import { useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { CreateTopicDialog } from '@/components/create-topic-dialog';
import { Button } from '@/components/ui/button';
import {
  useAddTopicBook,
  useCreateTopic,
  useCreateTopicEntry,
  useDeleteTopicEntry,
  useTopic,
  useTopics,
  useUpdateTopic,
  useUpdateTopicEntry,
} from '@/hooks/use-topics';
import { mapTopicDetailToViewModel, TopicCard, TopicWorkspace, ViewSwitch } from './components';

export { default as ReadingTopicsPage } from './index';

export default function ReadingTopicsPage() {
  const [view, setView] = useState<'list' | 'workspace'>('list');
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const topicsQuery = useTopics();
  const createTopic = useCreateTopic();
  const updateTopic = useUpdateTopic();
  const addTopicBook = useAddTopicBook();
  const createTopicEntry = useCreateTopicEntry();
  const updateTopicEntry = useUpdateTopicEntry();
  const deleteTopicEntry = useDeleteTopicEntry();

  const topics = topicsQuery.data ?? [];
  const filteredTopics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return topics;
    return topics.filter((topic) => {
      return topic.name.toLowerCase().includes(query) || (topic.description ?? '').toLowerCase().includes(query);
    });
  }, [searchQuery, topics]);

  const effectiveSelectedTopicId = selectedTopicId ?? filteredTopics[0]?.id ?? topics[0]?.id ?? null;
  const topicDetailQuery = useTopic(effectiveSelectedTopicId ?? 0);
  const selectedTopicDetail = topicDetailQuery.data;

  const openTopic = (topicId: number) => {
    setSelectedTopicId(topicId);
    setView('workspace');
  };

  return (
    <div className="flex-1 space-y-6 p-6 lg:p-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">主题阅读</h1>
          <p className="mt-2 text-sm text-muted-foreground">围绕一个主题收集多本书的阅读痕迹，形成跨书的思考工作区。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            新建话题
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="搜索话题名称、描述..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <ViewSwitch view={view} setView={setView} />
        </div>
      </div>

      {topicsQuery.isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在加载话题...
        </div>
      ) : null}

      {topicsQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {topicsQuery.error instanceof Error ? topicsQuery.error.message : '加载话题失败'}
        </div>
      ) : null}

      {!topicsQuery.isLoading && !topicsQuery.isError && view === 'list' ? (
        filteredTopics.length > 0 ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredTopics.map((topic) => {
              const mapped = mapTopicDetailToViewModel({
                ...topic,
                books: [],
                highlights: [],
                notes: [],
                segments: [],
                entries: [],
              });
              return <TopicCard key={topic.id} topic={mapped} onOpen={() => openTopic(topic.id)} />;
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <div className="text-base font-medium text-foreground">还没有符合条件的话题</div>
            <div className="mt-2 text-sm text-muted-foreground">你可以先新建一个主题阅读话题，或调整搜索条件。</div>
          </div>
        )
      ) : null}

      {!topicsQuery.isLoading && !topicsQuery.isError && view === 'workspace' ? (
        effectiveSelectedTopicId && selectedTopicDetail ? (
          <TopicWorkspace
            topic={selectedTopicDetail}
            onBack={() => setView('list')}
            onAddBook={async (bookId) => {
              await addTopicBook.mutateAsync({ topicId: effectiveSelectedTopicId, bookId });
            }}
            onEditTopic={async (input) => {
              await updateTopic.mutateAsync({ id: effectiveSelectedTopicId, ...input });
            }}
            onCreateEntry={async (input) => {
              await createTopicEntry.mutateAsync({ topicId: effectiveSelectedTopicId, ...input });
            }}
            onUpdateEntry={async (entryId, content) => {
              await updateTopicEntry.mutateAsync({ topicId: effectiveSelectedTopicId, entryId, content });
            }}
            onDeleteEntry={async (entryId) => {
              await deleteTopicEntry.mutateAsync({ topicId: effectiveSelectedTopicId, entryId });
            }}
            onTraceJump={(trace) => {
              toast.info(`将跳转到《${trace.bookTitle}》对应位置，跨页联动将在下一步补齐`);
            }}
          />
        ) : topicDetailQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在加载话题工作区...
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <div className="text-base font-medium text-foreground">请选择一个话题</div>
            <div className="mt-2 text-sm text-muted-foreground">进入工作区后，你可以继续整理书籍、痕迹与沉淀内容。</div>
          </div>
        )
      ) : null}

      <CreateTopicDialog
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onConfirm={async ({ name, description }: { name: string; description: string }) => {
          const created = await createTopic.mutateAsync({ name, description });
          setSelectedTopicId(created.id);
          setView('workspace');
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
