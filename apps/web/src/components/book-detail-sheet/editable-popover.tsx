import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EditablePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  side?: 'bottom' | 'top';
  className?: string;
  matchWidth?: boolean;
}

export function EditablePopover({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'left',
  side = 'bottom',
  className,
  matchWidth = true,
}: EditablePopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

  const updateWidth = useCallback(() => {
    if (containerRef.current && matchWidth) {
      setWidth(containerRef.current.offsetWidth);
    }
  }, [matchWidth]);

  useEffect(() => {
    if (open) {
      updateWidth();
      const observer = new ResizeObserver(updateWidth);
      if (containerRef.current) {
        observer.observe(containerRef.current);
      }
      return () => observer.disconnect();
    }
  }, [open, updateWidth]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} className="relative">
      {trigger}
      {open && (
        <div
          ref={popoverRef}
          style={matchWidth && width > 0 ? { minWidth: width } : undefined}
          className={cn(
            'absolute z-50 rounded-xl border border-border bg-card shadow-lg',
            side === 'bottom' && 'top-full mt-1',
            side === 'top' && 'bottom-full mb-1',
            align === 'left' && 'left-0',
            align === 'right' && 'right-0',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
