import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { EditablePopover } from './editable-popover';
import { EditableFieldRow } from './editable-field-row';

interface EditableDateFieldProps {
  label: string;
  value: string | null;
  editMode: boolean;
  onSave: (value: string | null) => Promise<void>;
}

function formatDisplay(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr.slice(0, 10);
  }
}

export function EditableDateField({
  label,
  value,
  editMode,
  onSave,
}: EditableDateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ? value.slice(0, 10) : '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback(() => {
    setDraft(value ? value.slice(0, 10) : '');
    setError(null);
    setOpen(true);
  }, [value]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setOpen(false);
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setIsSaving(true);
      setError(null);
      try {
        await onSave(null);
        setOpen(false);
      } catch {
        setError('保存失败');
      } finally {
        setIsSaving(false);
      }
      return;
    }
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) {
      setError('无效日期');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(date.toISOString());
      setOpen(false);
    } catch {
      setError('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [draft, onSave]);

  const displayValue = formatDisplay(value);

  const trigger = (
    <EditableFieldRow
      label={label}
      value={editMode ? displayValue : displayValue}
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
      className="p-3"
      matchWidth
    >
      <input
        autoFocus
        type="date"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') handleSave();
        }}
        className="h-8 w-full min-w-[160px] rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={isSaving}
      />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setDraft('');
            setError(null);
          }}
          disabled={isSaving}
          className="text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          清空
        </button>
        <div className="flex gap-2">
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
      </div>
      {error && (
        <p className="mt-1.5 text-[12px] text-destructive">{error}</p>
      )}
    </EditablePopover>
  );
}
