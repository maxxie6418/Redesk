import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import type { TagItem } from '@/hooks/use-tags';
import { cn } from '@/lib/utils';

interface InlineTagManagerProps {
  selectedTagIds: number[];
  allTags: TagItem[];
  pending?: boolean;
  onAddTag: (tagId: number) => Promise<void>;
  onRemoveTag: (tagId: number) => Promise<void>;
  onCreateTag?: (name: string) => Promise<TagItem>;
  className?: string;
}

export function InlineTagManager({
  selectedTagIds,
  allTags,
  pending,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  className,
}: InlineTagManagerProps) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setNewTagName('');
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));
  const availableTags = allTags.filter((t) => !selectedTagIds.includes(t.id));

  const filteredAvailable = newTagName
    ? availableTags.filter((t) => t.name.toLowerCase().includes(newTagName.toLowerCase()))
    : availableTags;

  const exactMatchExists = allTags.some(
    (t) => t.name.toLowerCase() === newTagName.trim().toLowerCase(),
  );

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name || !onCreateTag || creating) return;
    setCreating(true);
    try {
      const created = await onCreateTag(name);
      await onAddTag(created.id);
      setNewTagName('');
    } catch {
      // parent handles error
    } finally {
      setCreating(false);
    }
  }, [newTagName, onCreateTag, onAddTag, creating]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && newTagName.trim() && !exactMatchExists && onCreateTag) {
        e.preventDefault();
        handleCreateTag();
      }
    },
    [newTagName, exactMatchExists, onCreateTag, handleCreateTag],
  );

  return (
    <div ref={containerRef} className={cn('relative inline-flex flex-wrap items-center gap-1.5', className)}>
      {selectedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground group/tag"
        >
          #{tag.name}
          <button
            type="button"
            disabled={pending}
            onClick={() => onRemoveTag(tag.id)}
            className="ml-0.5 rounded-full p-0.5 opacity-50 transition-opacity hover:bg-muted hover:opacity-100 group-hover/tag:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {pending && selectedTags.length === 0 && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
        添加标签
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {onCreateTag && (
            <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
              <input
                ref={inputRef}
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索或创建标签..."
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
              />
              {newTagName.trim() && !exactMatchExists && (
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateTag}
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : '新建'}
                </button>
              )}
            </div>
          )}
          <div className="max-h-40 overflow-y-auto">
            {filteredAvailable.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">无可用标签</p>
            )}
            {filteredAvailable.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  onAddTag(tag.id);
                  setNewTagName('');
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted"
              >
                <span className="text-muted-foreground">#</span>
                {tag.name}
                {tag.book_count > 0 && (
                  <span className="ml-auto text-[10px] text-muted-foreground/50">{tag.book_count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
