import { useState, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditablePopover } from './editable-popover';
import { EditableFieldRow } from './editable-field-row';
import { TagAtom } from './tags-utils';

interface TagOption {
  id: number;
  name: string;
}

interface EditableTagsFieldProps {
  label: string;
  tagIds: number[];
  tagNames: string[];
  allTags: TagOption[];
  editMode: boolean;
  onSave: (tagIds: number[]) => Promise<void>;
}

export function EditableTagsField({
  label,
  tagIds,
  tagNames,
  allTags,
  editMode,
  onSave,
}: EditableTagsFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>(tagIds);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback(() => {
    setDraft([...tagIds]);
    setError(null);
    setOpen(true);
  }, [tagIds]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setOpen(false);
  }, []);

  const toggleTag = useCallback((id: number) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setOpen(false);
    } catch {
      setError('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [draft, onSave]);

  const displayValue = useMemo(() => {
    if (tagNames.length === 0) return null;
    return (
      <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1">
        {tagNames.map((name) => (
          <TagAtom key={name} size="tiny">{name}</TagAtom>
        ))}
      </div>
    );
  }, [tagNames]);

  const currentValue = tagNames.join(', ') || '无标签';

  const trigger = (
    <EditableFieldRow
      label={label}
      value={editMode ? displayValue ?? currentValue : displayValue ?? currentValue}
      editMode={editMode}
      onClick={editMode ? handleOpen : undefined}
      isSaving={isSaving}
    />
  );

  if (!editMode) return trigger;

  return (
    <EditablePopover
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      className="p-3 w-64"
      matchWidth={false}
    >
      {allTags.length === 0 ? (
        <p className="py-2 text-center text-[12px] text-muted-foreground">
          暂无可选标签
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              disabled={isSaving}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition-all disabled:opacity-50',
                draft.includes(tag.id)
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
              )}
            >
              {draft.includes(tag.id) && (
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
              )}
              {tag.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isSaving}
          className="h-7 rounded-md border border-border px-3 text-[12px] text-foreground hover:bg-muted disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex h-7 items-center gap-1 rounded-md bg-primary px-3 text-[12px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
          保存
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-[12px] text-destructive">{error}</p>
      )}
    </EditablePopover>
  );
}
