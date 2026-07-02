import { useState, useCallback } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditablePopover } from './editable-popover';
import { EditableFieldRow } from './editable-field-row';

interface SelectOption {
  value: string;
  label: string;
}

interface EditableSelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  editMode: boolean;
  onSave: (value: string) => Promise<void>;
}

export function EditableSelectField({
  label,
  value,
  options,
  editMode,
  onSave,
}: EditableSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLabel = options.find((o) => o.value === value)?.label ?? value;

  const handleSelect = useCallback(
    async (newValue: string) => {
      if (isSaving) return;
      setIsSaving(true);
      setError(null);
      try {
        await onSave(newValue);
        setOpen(false);
      } catch {
        setError('保存失败');
      } finally {
        setIsSaving(false);
      }
    },
    [onSave, isSaving],
  );

  const trigger = (
    <EditableFieldRow
      label={label}
      value={editMode ? currentLabel : (currentLabel || '—')}
      editMode={editMode}
      onClick={() => {
        if (editMode && !isSaving) {
          setOpen(true);
          setError(null);
        }
      }}
      isSaving={isSaving}
    />
  );

  if (!editMode) return trigger;

  return (
    <EditablePopover open={open} onOpenChange={setOpen} trigger={trigger}>
      <div className="py-1 max-h-64 overflow-y-auto">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSelect(opt.value)}
            disabled={isSaving}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors',
              'hover:bg-muted disabled:opacity-50',
              opt.value === value && 'font-semibold text-primary',
            )}
          >
            <span className="flex-1 text-left">{opt.label}</span>
            {opt.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>
        ))}
      </div>
      {isSaving && (
        <div className="flex items-center justify-center border-t border-border px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="border-t border-border px-3 py-2 text-[12px] text-destructive">
          {error}
        </div>
      )}
    </EditablePopover>
  );
}
