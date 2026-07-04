import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EditableFieldRowProps {
  label: string;
  value: ReactNode;
  editMode: boolean;
  emptyLabel?: string;
  isSaving?: boolean;
  className?: string;
  valueClassName?: string;
  layout?: 'row' | 'block';
  align?: 'left' | 'right';
  truncate?: boolean;
  onClick?: () => void;
}

export function EditableFieldRow({
  label,
  value,
  editMode,
  emptyLabel = '—',
  isSaving = false,
  className,
  valueClassName,
  layout = 'row',
  align = 'right',
  truncate: truncateProp = true,
  onClick,
}: EditableFieldRowProps) {
  if (layout === 'block') {
    return (
      <div className={cn('min-w-0', className)}>
        {label ? (
          <div className="mb-1 text-[13px] text-muted-foreground">{label}</div>
        ) : null}
        {editMode ? (
          <button
            type="button"
            onClick={onClick}
            disabled={isSaving}
            className={cn(
              'block w-full text-left transition-colors',
              'hover:text-primary hover:bg-muted/50 rounded',
              isSaving && 'opacity-50 cursor-not-allowed',
              truncateProp && 'truncate',
              valueClassName,
            )}
          >
            {value || (
              <span className="text-muted-foreground/60">点击添加</span>
            )}
          </button>
        ) : (
          <span
            className={cn(
              'block w-full text-left text-foreground',
              truncateProp && 'truncate',
              valueClassName,
            )}
          >
            {value || emptyLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 justify-between gap-2', className)}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {editMode ? (
        <button
          type="button"
          onClick={onClick}
          disabled={isSaving}
          className={cn(
            'min-w-0 flex-1 transition-colors',
            align === 'right' ? 'text-right' : 'text-left',
            truncateProp ? 'truncate' : '',
            'font-medium',
            'hover:text-primary hover:bg-muted/50 rounded px-1 -mr-1',
            isSaving && 'opacity-50 cursor-not-allowed',
            valueClassName,
          )}
        >
          {value || (
            <span className="text-muted-foreground/60">点击添加</span>
          )}
        </button>
      ) : (
        <span
          className={cn(
            'min-w-0 flex-1',
            align === 'right' ? 'text-right' : 'text-left',
            truncateProp ? 'truncate' : '',
            'font-medium text-foreground',
            valueClassName,
          )}
        >
          {value || emptyLabel}
        </span>
      )}
    </div>
  );
}
