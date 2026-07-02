import type { ReactNode } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditableField } from './types';

interface InlineEditTextProps {
  field: EditableField;
  label: string;
  value: string;
  multiline?: boolean;
  editMode: boolean;
  editingField: EditableField;
  editValue: string;
  setEditValue: (v: string) => void;
  saveField: (field: EditableField, value: string) => void;
  cancelEdit: () => void;
  startEdit: (field: EditableField, value: string) => void;
}

export function InlineEditText({
  field, label, value, multiline = false,
  editMode, editingField, editValue,
  setEditValue, saveField, cancelEdit, startEdit,
}: InlineEditTextProps) {
  const isEditing = editMode && editingField === field;
  if (isEditing) {
    return (
      <div className="min-w-0 space-y-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {multiline ? (
          <textarea
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveField(field, editValue)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelEdit();
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveField(field, editValue);
            }}
            className="w-full rounded-md border border-primary bg-muted px-2 py-1 text-[13px] outline-none"
            rows={3}
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveField(field, editValue)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelEdit();
              if (e.key === 'Enter') saveField(field, editValue);
            }}
            className="h-7 w-full min-w-0 rounded-md border border-primary bg-muted px-2 text-[13px] outline-none"
          />
        )}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {editMode ? (
        <button
          type="button"
          onClick={() => startEdit(field, value)}
          className="min-w-0 flex-1 truncate text-right font-medium text-foreground hover:text-primary transition-colors"
        >
          {value || '—'}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-right font-medium text-foreground">{value || '—'}</span>
      )}
    </div>
  );
}

interface InlineEditSelectProps {
  field: EditableField;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  editMode: boolean;
  editingField: EditableField;
  editValue: string;
  setEditValue: (v: string) => void;
  saveField: (field: EditableField, value: string) => void;
  startEdit: (field: EditableField, value: string) => void;
}

export function InlineEditSelect({
  field, label, value, options,
  editMode, editingField, editValue,
  setEditValue, saveField, startEdit,
}: InlineEditSelectProps) {
  const isEditing = editMode && editingField === field;
  if (isEditing) {
    return (
      <div className="min-w-0 space-y-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <select
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveField(field, editValue)}
          className="h-7 w-full min-w-0 rounded-md border border-primary bg-muted px-2 text-[13px] outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }
  const displayLabel = options.find((o) => o.value === value)?.label ?? value;
  return (
    <div className="flex min-w-0 justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {editMode ? (
        <button
          type="button"
          onClick={() => startEdit(field, value)}
          className="min-w-0 flex-1 truncate text-right font-medium text-foreground hover:text-primary transition-colors"
        >
          {displayLabel || '—'}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-right font-medium text-foreground">{displayLabel || '—'}</span>
      )}
    </div>
  );
}

interface InlineRatingProps {
  editMode: boolean;
  editingField: EditableField;
  currentRating: number | null;
  editValue: string;
  setEditValue: (v: string) => void;
  saveField: (field: EditableField, value: string) => void;
  startEdit: (field: EditableField, value: string) => void;
}

export function InlineRating({
  editMode, editingField, currentRating,
  editValue, setEditValue, saveField, startEdit,
}: InlineRatingProps) {
  const isEditing = editMode && editingField === 'rating';
  const displayRating = isEditing ? (editValue ? Number(editValue) : null) : currentRating;
  if (isEditing) {
    return (
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">评分</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                const newVal = displayRating === r ? '' : String(r);
                setEditValue(newVal);
                saveField('rating', newVal);
              }}
              className={cn(r <= (displayRating ?? 0) ? 'text-[#f5c842]' : 'text-muted-foreground/40')}
            >
              <Star className="h-4 w-4 fill-current" />
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">评分</span>
      {editMode ? (
        <button
          type="button"
          onClick={() => startEdit('rating', currentRating ? String(currentRating) : '')}
          className="flex items-center gap-1 font-medium text-foreground hover:text-primary transition-colors"
        >
          {currentRating != null ? (
            <>
              <Star className="h-3.5 w-3.5 fill-[#f5c842] text-[#f5c842]" />
              {currentRating}
            </>
          ) : (
            '—'
          )}
        </button>
      ) : (
        <span className="flex items-center gap-1 font-medium text-foreground">
          {currentRating != null ? (
            <>
              <Star className="h-3.5 w-3.5 fill-[#f5c842] text-[#f5c842]" />
              {currentRating}
            </>
          ) : (
            '—'
          )}
        </span>
      )}
    </div>
  );
}

export function TagAtom({ children, size = 'default' }: { children: ReactNode; size?: 'default' | 'small' | 'tiny' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border border-border bg-muted text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground',
        size === 'default' && 'rounded-md px-2.5 py-[3px] text-xs leading-[1.4]',
        size === 'small' && 'rounded px-2 py-[2px] text-[11px] leading-[1.4]',
        size === 'tiny' && 'rounded px-2 py-[2px] text-[11px] leading-[1.4]',
      )}
    >
      {children}
    </span>
  );
}
