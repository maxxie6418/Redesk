import { type FC, useState, useRef, useEffect } from 'react';

interface CommentInputProps {
  rect: DOMRect | null;
  visible: boolean;
  darkMode?: boolean;
  initialValue?: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export const CommentInput: FC<CommentInputProps> = ({
  rect,
  visible,
  darkMode,
  initialValue = '',
  onSave,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; flip: boolean }>({ top: 0, left: 0, flip: false });

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, visible]);

  useEffect(() => {
    if (visible && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [visible]);

  // 定位计算
  useEffect(() => {
    if (!visible || !rect) return;
    const width = 240;
    const height = 100;
    const gap = 10;

    let top = rect.top - height - gap;
    let left = rect.left + rect.width / 2;
    let flip = false;

    const vw = window.innerWidth;

    if (top < 8) {
      top = rect.bottom + gap;
      flip = true;
    }
    if (left - width / 2 < 8) {
      left = width / 2 + 8;
    }
    if (left + width / 2 > vw - 8) {
      left = vw - width / 2 - 8;
    }

    setPosition({ top, left, flip });
  }, [visible, rect]);

  // Esc 取消
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) onSave(trimmed);
      else onCancel();
    }
  };

  if (!visible || !rect) return null;

  const isDark = darkMode;
  const bg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#333333' : '#e5e5e5';

  return (
    <div
      className="fixed z-50 anim-pop"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
    >
      <div
        className="relative flex flex-col gap-2 rounded-[14px] border p-2.5"
        style={{
          width: 240,
          background: bg,
          borderColor,
          boxShadow: isDark
            ? '0 10px 30px -8px rgba(0,0,0,0.4)'
            : '0 10px 30px -8px rgba(0,0,0,0.08)',
        }}
      >
        {/* 尾巴 */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-3 h-3"
          style={{
            background: bg,
            ...(position.flip
              ? {
                  top: -6,
                  borderRight: `1px solid ${borderColor}`,
                  borderBottom: `1px solid ${borderColor}`,
                  transform: 'translateX(-50%) rotate(225deg)',
                }
              : {
                  bottom: -6,
                  borderRight: `1px solid ${borderColor}`,
                  borderBottom: `1px solid ${borderColor}`,
                  transform: 'translateX(-50%) rotate(45deg)',
                }),
          }}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="写下你的想法…"
          rows={3}
          className="w-full bg-transparent text-sm outline-none resize-none leading-relaxed"
          style={{
            color: isDark ? '#d4d4d4' : '#262626',
            minHeight: 48,
            maxHeight: 100,
          }}
        />

        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: isDark ? '#525252' : '#a3a3a3' }}>
            Shift+Enter 换行
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCancel}
              className="h-6 px-2 rounded-md text-[11px] transition-colors"
              style={{
                color: isDark ? '#a1a1a6' : '#525252',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5',
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmed = value.trim();
                if (trimmed) onSave(trimmed);
                else onCancel();
              }}
              className="h-6 px-2.5 rounded-md text-[11px] text-white transition-colors"
              style={{ background: '#171717' }}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
