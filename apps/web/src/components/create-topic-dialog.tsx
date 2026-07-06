import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface CreateTopicDialogProps {
  open: boolean;
  onConfirm: (input: { name: string; description: string }) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function CreateTopicDialog({ open, onConfirm, onCancel, loading }: CreateTopicDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onConfirm({ name: name.trim(), description: description.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-topic-title"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 id="create-topic-title" className="font-display text-base font-semibold text-foreground">
            新建话题
          </h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="topic-name">话题名称 *</Label>
            <input
              id="topic-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="围绕一个问题或研究方向..."
              autoFocus
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) handleSubmit();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-description">话题描述</Label>
            <textarea
              id="topic-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充这个话题的目标、比较维度、待回答问题..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
          >
            {loading ? '创建中...' : '确认创建'}
          </Button>
        </div>
      </div>
    </div>
  );
}
