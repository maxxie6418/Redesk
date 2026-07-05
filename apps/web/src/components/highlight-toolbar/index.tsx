import { type FC, useRef, useEffect } from 'react';
import { Highlighter, Underline, MessageSquare } from 'lucide-react';

interface HighlightToolbarProps {
  rect: DOMRect | null;
  visible: boolean;
  onHighlight: (color: string) => void;
  onUnderline: (color: string) => void;
  onNote: () => void;
  onDismiss: () => void;
}

const COLORS = [
  { value: '#fde047', label: '黄' },
  { value: '#93c5fd', label: '蓝' },
  { value: '#86efac', label: '绿' },
  { value: '#f9a8d4', label: '粉' },
];

export const HighlightToolbar: FC<HighlightToolbarProps> = ({
  rect,
  visible,
  onHighlight,
  onUnderline,
  onNote,
  onDismiss,
}) => {
  const ref = useRef<HTMLDivElement>(null);

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

  if (!visible || !rect) return null;

  const top = rect.top - 48;
  const left = rect.left + rect.width / 2;

  return (
    <div
      ref={ref}
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-1 shadow-lg"
      style={{ top: Math.max(8, top), left, transform: 'translateX(-50%)' }}
    >
      {COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          className="rounded p-1.5 hover:bg-muted"
          title={`${c.label}色高亮`}
          onClick={() => onHighlight(c.value)}
          style={{ backgroundColor: `${c.value}40` }}
        >
          <Highlighter className="h-4 w-4" style={{ color: c.value }} />
        </button>
      ))}
      <div className="mx-0.5 h-5 w-px bg-border" />
      {COLORS.map((c) => (
        <button
          key={`ul-${c.value}`}
          type="button"
          className="rounded p-1.5 hover:bg-muted"
          title={`${c.label}色划线`}
          onClick={() => onUnderline(c.value)}
          style={{ backgroundColor: `${c.value}20` }}
        >
          <Underline className="h-4 w-4" style={{ color: c.value }} />
        </button>
      ))}
      <div className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        className="rounded p-1.5 hover:bg-muted"
        title="添加附注"
        onClick={onNote}
      >
        <MessageSquare className="h-4 w-4 text-foreground/70" />
      </button>
    </div>
  );
};