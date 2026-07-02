import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { EditablePopover } from './editable-popover';
import { EditableFieldRow } from './editable-field-row';

interface EditableTextFieldProps {
  label: string;
  value: string;
  editMode: boolean;
  onSave: (value: string) => Promise<void>;
  required?: boolean;
  placeholder?: string;
}

export function EditableTextField({
  label,
  value,
  editMode,
  onSave,
  required = false,
  placeholder,
}: EditableTextFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback(() => {
    setDraft(value);
    setError(null);
    setOpen(true);
  }, [value]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setOpen(false);
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (required && !draft.trim()) {
      setError('不能为空');
      return;
    }
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
  }, [draft, required, onSave]);

  const displayValue = value || '—';

  const trigger = (
    <EditableFieldRow
      label={label}
      value={displayValue}
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
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
          }
          if (e.key === 'Enter') {
            handleSave();
          }
        }}
        placeholder={placeholder}
        className="h-8 w-full min-w-[200px] rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={isSaving}
      />
      {error && (
        <p className="mt-1.5 text-[12px] text-destructive">{error}</p>
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
    </EditablePopover>
  );
}
