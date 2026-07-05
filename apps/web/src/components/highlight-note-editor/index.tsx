import { type FC, useState, useRef, useEffect } from 'react';
import { Trash2, Check, X } from 'lucide-react';

interface HighlightNoteEditorProps {
  note: string | null;
  markType: string;
  visible: boolean;
  position: { top: number; left: number } | null;
  onSave: (note: string, markType: string) => void;
  onDelete: () => void;
  onDismiss: () => void;
}

const MARK_TYPES = [
  { value: 'NONE', label: '无标记' },
  { value: 'IMPORTANT', label: '重要' },
  { value: 'QUESTION', label: '疑问' },
  { value: 'INSIGHT', label: '洞见' },
];

export const HighlightNoteEditor: FC<HighlightNoteEditorProps> = ({
  note,
  markType,
  visible,
  position,
  onSave,
  onDelete,
  onDismiss,
}) => {
  const [editNote, setEditNote] = useState(note ?? '');
  const [editMark, setEditMark] = useState(markType);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditNote(note ?? '');
    setEditMark(markType);
  }, [note, markType, visible]);

  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible, onDismiss]);

  if (!visible || !position) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="mb-2 flex items-center gap-1">
        {MARK_TYPES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setEditMark(m.value)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
              editMark === m.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <textarea
        value={editNote}
        onChange={(e) => setEditNote(e.target.value)}
        placeholder="添加附注..."
        className="mb-2 w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        rows={3}
        autoFocus
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="删除"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onSave(editNote, editMark)}
            className="rounded p-1 text-primary hover:bg-primary/10"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};