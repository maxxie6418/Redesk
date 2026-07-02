import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { EditablePopover } from './editable-popover';
import { EditableFieldRow } from './editable-field-row';

interface EditableNumberFieldProps {
  label: string;
  value: number | null;
  editMode: boolean;
  onSave: (value: number | null) => Promise<void>;
  min?: number;
  max?: number;
  integer?: boolean;
}

export function EditableNumberField({
  label,
  value,
  editMode,
  onSave,
  min,
  max,
  integer = false,
}: EditableNumberFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback(() => {
    setDraft(value != null ? String(value) : '');
    setError(null);
    setOpen(true);
  }, [value]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setOpen(false);
  }, []);

  const validate = useCallback(
    (raw: string): number | null | 'error' => {
      const trimmed = raw.trim();
      if (trimmed === '') return null;
      const num = Number(trimmed);
      if (isNaN(num)) return 'error';
      if (integer && !Number.isInteger(num)) return 'error';
      if (min != null && num < min) return 'error';
      if (max != null && num > max) return 'error';
      return num;
    },
    [integer, min, max],
  );

  const handleSave = useCallback(async () => {
    const result = validate(draft);
    if (result === 'error') {
      setError('请输入有效数字');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(result);
      setOpen(false);
    } catch {
      setError('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [draft, validate, onSave]);

  const displayValue = value != null ? String(value) : '—';

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
        type="number"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') handleSave();
        }}
        min={min}
        max={max}
        step={integer ? 1 : undefined}
        className="h-8 w-full min-w-[160px] rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={isSaving}
      />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setDraft('')}
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
