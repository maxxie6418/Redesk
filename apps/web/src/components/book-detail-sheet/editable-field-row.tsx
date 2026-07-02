import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EditableFieldRowProps {
  label: string;
  value: ReactNode;
  editMode: boolean;
  emptyLabel?: string;
  isSaving?: boolean;
  className?: string;
  onClick?: () => void;
}

export function EditableFieldRow({
  label,
  value,
  editMode,
  emptyLabel = '—',
  isSaving = false,
  className,
  onClick,
}: EditableFieldRowProps) {
  return (
    <div className={cn('flex min-w-0 justify-between gap-2', className)}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {editMode ? (
        <button
          type="button"
          onClick={onClick}
          disabled={isSaving}
          className={cn(
            'min-w-0 flex-1 truncate text-right font-medium transition-colors',
            'hover:text-primary hover:bg-muted/50 rounded px-1 -mr-1',
            isSaving && 'opacity-50 cursor-not-allowed',
          )}
        >
          {value || (
            <span className="text-muted-foreground/60">点击添加</span>
          )}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-right font-medium text-foreground">
          {value || emptyLabel}
        </span>
      )}
    </div>
  );
}
