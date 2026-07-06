import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCreateTopic, useTopics } from '@/hooks/use-topics';
import { cn } from '@/lib/utils';

export function AddToTopicDialog({
  open,
  title = '加入话题',
  description = '选择一个已有话题，或新建话题后自动关联。',
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title?: string;
  description?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (topicId: number) => Promise<void> | void;
}) {
  const topicsQuery = useTopics();
  const createTopic = useCreateTopic();
  const [selectedTopicId, setSelectedTopicId] = useState<number>(0);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');

  const topics = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data]);
  const submitting = loading || createTopic.isPending;

  useEffect(() => {
    if (!open) return;
    setSelectedTopicId(0);
    setNewTopicName('');
    setNewTopicDescription('');
  }, [open]);

  if (!open) return null;

  const handleExisting = async () => {
    if (!selectedTopicId) return;
    await onConfirm(selectedTopicId);
  };

  const handleCreateAndLink = async () => {
    if (!newTopicName.trim()) return;
    try {
      const topic = await createTopic.mutateAsync({
        name: newTopicName.trim(),
        description: newTopicDescription.trim(),
      });
      await onConfirm(topic.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加入话题失败';
      toast.error(message);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="add-to-topic-title">
        <div className="border-b border-border px-5 py-4">
          <h2 id="add-to-topic-title" className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-5 px-5 py-4">
          <section className="space-y-3">
            <div className="text-sm font-medium text-foreground">选择已有话题</div>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {topicsQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 px-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载话题...
                </div>
              ) : topics.length > 0 ? (
                topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition-colors',
                      selectedTopicId === topic.id ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border hover:bg-accent',
                    )}
                  >
                    <div className="truncate text-sm font-medium text-foreground">{topic.name}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{topic.description || '暂无描述'}</div>
                  </button>
                ))
              ) : (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">还没有话题，可以在下方新建。</div>
              )}
            </div>
            <Button type="button" size="sm" onClick={handleExisting} disabled={!selectedTopicId || submitting}>
              加入选中话题
            </Button>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <div className="text-sm font-medium text-foreground">新建话题并加入</div>
            <input
              type="text"
              value={newTopicName}
              onChange={(event) => setNewTopicName(event.target.value)}
              placeholder="话题名称"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <textarea
              rows={3}
              value={newTopicDescription}
              onChange={(event) => setNewTopicDescription(event.target.value)}
              placeholder="话题描述"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="button" size="sm" variant="outline" onClick={handleCreateAndLink} disabled={!newTopicName.trim() || submitting}>
              <Plus className="h-4 w-4" />
              新建并加入
            </Button>
          </section>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>关闭</Button>
        </div>
      </div>
    </div>
  );
}
