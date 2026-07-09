import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import type { QuickTemplate } from '@redesk/shared';

export type MarkType = 'HIGHLIGHT' | 'UNDERLINE' | 'WAVY' | null;

export type { QuickTemplate };

interface BubbleToolbarProps {
  rect: DOMRect | null;
  visible: boolean;
  activeType?: MarkType;
  hasBookmark?: boolean;
  darkMode?: boolean;
  showClear?: boolean;
  onHighlight: () => void;
  onUnderline: () => void;
  onWavy: () => void;
  onBookmark: () => void;
  onComment: () => void;
  onClear?: () => void;
  onDismiss: () => void;
  quickTemplates?: QuickTemplate[];
  onQuickTemplate?: (template: QuickTemplate) => void;
}

export const BubbleToolbar: FC<BubbleToolbarProps> = ({
  rect,
  visible,
  activeType,
  hasBookmark,
  darkMode,
  showClear = false,
  onHighlight,
  onUnderline,
  onWavy,
  onBookmark,
  onComment,
  onClear,
  onDismiss,
  quickTemplates,
  onQuickTemplate,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; flip: boolean }>({ top: 0, left: 0, flip: false });

  useEffect(() => {
    if (!visible || !rect) return;

    const baseWidth = showClear ? 292 : 248;
    const templateCount = quickTemplates?.length ?? 0;
    const toolbarWidth = baseWidth + (templateCount > 0 ? templateCount * 44 + 9 : 0);
    const toolbarHeight = 52;
    const gap = 10;

    let top = rect.top - toolbarHeight - gap;
    let left = rect.left + rect.width / 2;
    let flip = false;

    const vw = window.innerWidth;

    if (top < 8) {
      top = rect.bottom + gap;
      flip = true;
    }

    if (left - toolbarWidth / 2 < 8) {
      left = toolbarWidth / 2 + 8;
    }

    if (left + toolbarWidth / 2 > vw - 8) {
      left = vw - toolbarWidth / 2 - 8;
    }

    setPosition({ top, left, flip });
  }, [rect, showClear, visible, quickTemplates]);

  useEffect(() => {
    if (!visible) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible, onDismiss]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onDismiss]);

  useEffect(() => {
    if (!visible) return;
    const lastScrollY = window.scrollY;
    const handleScroll = () => {
      if (Math.abs(window.scrollY - lastScrollY) > 60) {
        onDismiss();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visible, onDismiss]);

  const handleAction = useCallback((action: () => void) => {
    action();
  }, []);

  if (!visible || !rect) return null;

  const isDark = darkMode;
  const bg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#333333' : '#e5e5e5';
  const dividerColor = isDark ? '#404040' : '#e5e5e5';
  const labelColor = isDark ? '#a1a1a6' : '#737373';
  const labelHoverColor = isDark ? '#d4d4d4' : '#262626';
  const btnHoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <div
      ref={ref}
      className="fixed z-50 anim-pop"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
    >
      <div
        className="relative flex items-center gap-0.5 rounded-[14px] px-1.5 py-1.5"
        style={{
          background: bg,
          border: `1px solid ${borderColor}`,
          boxShadow: isDark
            ? '0 10px 30px -8px rgba(0,0,0,0.4), 0 2px 6px -2px rgba(0,0,0,0.2)'
            : '0 10px 30px -8px rgba(0,0,0,0.08), 0 2px 6px -2px rgba(0,0,0,0.04)',
        }}
      >
        <div
          className="absolute left-1/2 h-3 w-3 -translate-x-1/2"
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

        <ToolbarButton
          label="高亮"
          active={activeType === 'HIGHLIGHT'}
          onClick={() => handleAction(onHighlight)}
          hoverBg={btnHoverBg}
          labelColor={labelColor}
          labelHoverColor={labelHoverColor}
        >
          <div className="h-2 w-5 rounded-sm" style={{ background: 'rgba(250,204,21,0.5)' }} />
        </ToolbarButton>

        <ToolbarButton
          label="下划线"
          active={activeType === 'UNDERLINE'}
          onClick={() => handleAction(onUnderline)}
          hoverBg={btnHoverBg}
          labelColor={labelColor}
          labelHoverColor={labelHoverColor}
        >
          <div className="h-0.5 w-5 rounded-full" style={{ background: '#3b82f6' }} />
        </ToolbarButton>

        <ToolbarButton
          label="波浪线"
          active={activeType === 'WAVY'}
          onClick={() => handleAction(onWavy)}
          hoverBg={btnHoverBg}
          labelColor={labelColor}
          labelHoverColor={labelHoverColor}
        >
          <svg className="h-1.5 w-5" viewBox="0 0 20 4" fill="none">
            <path d="M0 2c2 0 2-1.5 4-1.5S6 2 8 2s2-1.5 4-1.5S14 2 16 2s2-1.5 4-1.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </ToolbarButton>

        <div className="mx-0.5 h-7 w-px" style={{ background: dividerColor }} />

        <ToolbarButton
          label="书签"
          active={hasBookmark}
          onClick={() => handleAction(onBookmark)}
          hoverBg={btnHoverBg}
          labelColor={labelColor}
          labelHoverColor={labelHoverColor}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          label="附注"
          onClick={() => handleAction(onComment)}
          hoverBg={btnHoverBg}
          labelColor={labelColor}
          labelHoverColor={labelHoverColor}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </ToolbarButton>

        {showClear && onClear ? (
          <>
            <div className="mx-0.5 h-7 w-px" style={{ background: dividerColor }} />
            <ToolbarButton
              label="清除"
              onClick={() => handleAction(onClear)}
              hoverBg={btnHoverBg}
              labelColor={labelColor}
              labelHoverColor={labelHoverColor}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </ToolbarButton>
          </>
        ) : null}

        {quickTemplates && quickTemplates.length > 0 && (
          <>
            <div className="mx-0.5 h-7 w-px" style={{ background: dividerColor }} />
            {quickTemplates.map((t) => (
              <ToolbarButton
                key={t.key}
                label={t.label}
                onClick={() => handleAction(() => onQuickTemplate?.(t))}
                hoverBg={btnHoverBg}
                labelColor={labelColor}
                labelHoverColor={labelHoverColor}
              >
                <span className="text-sm">{t.icon}</span>
              </ToolbarButton>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  hoverBg: string;
  labelColor: string;
  labelHoverColor: string;
  children: React.ReactNode;
}

const ToolbarButton: FC<ToolbarButtonProps> = ({
  label,
  active,
  onClick,
  hoverBg,
  labelColor,
  labelHoverColor,
  children,
}) => {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      className="relative flex h-9 w-11 flex-col items-center justify-center gap-0.5 rounded-[10px] transition-colors"
      style={{
        background: active ? hoverBg : 'transparent',
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.12s ease, background 0.15s ease',
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      title={label}
    >
      <span style={{ color: labelColor }}>{children}</span>
      <span className="text-[9px] font-medium leading-none" style={{ color: active ? labelHoverColor : labelColor }}>
        {label}
      </span>
    </button>
  );
};
