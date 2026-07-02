import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { EditablePopover } from './editable-popover';
import { EditableFieldRow } from './editable-field-row';

interface EditableJsonFieldProps {
  label: string;
  value: Record<string, unknown> | null;
  editMode: boolean;
  onSave: (value: Record<string, unknown> | null) => Promise<void>;
}

export function EditableJsonField({
  label,
  value,
  editMode,
  onSave,
}: EditableJsonFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(
    value ? JSON.stringify(value, null, 2) : '',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback(() => {
    setDraft(value ? JSON.stringify(value, null, 2) : '');
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      setError('JSON 格式错误，请检查');
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setError('JSON 必须是对象格式');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(parsed as Record<string, unknown>);
      setOpen(false);
    } catch {
      setError('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [draft, onSave]);

  const displayValue = value ? Object.keys(value).length > 0 ? `${Object.keys(value).length} 项属性` : '暂无' : '暂无';

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
      className="p-3 w-80"
      matchWidth={false}
    >
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
        }}
        rows={6}
        placeholder='{"key": "value"}'
        spellCheck={false}
        className="w-full rounded-md border border-input bg-background px-2.5 py-2 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        disabled={isSaving}
      />
      {error && (
        <p className="mt-1.5 text-[12px] text-destructive">{error}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Ctrl+Enter 保存</span>
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
    </EditablePopover>
  );
}
