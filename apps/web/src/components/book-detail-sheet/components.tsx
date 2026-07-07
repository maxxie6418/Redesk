import { AlertTriangle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusMessage } from './types';

interface BookDetailFrameHeaderProps {
  isDialog: boolean;
  onClose: () => void;
}

export function BookDetailFrameHeader({ isDialog, onClose }: BookDetailFrameHeaderProps) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border px-5">
      {!isDialog && (
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="返回"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
      )}
      <span className="font-display text-[15px] font-medium text-foreground">书籍详情</span>
      {isDialog && <div className="flex-1" />}
      <div className="flex items-center gap-2">
        {isDialog && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface StatusToastProps {
  message: StatusMessage | null;
}

export function StatusToast({ message }: StatusToastProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        'fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm transition-all duration-300',
        message.type === 'info'
          ? 'border-primary/15 bg-primary/5 text-foreground dark:border-primary/30 dark:bg-primary/10'
          : message.type === 'warning'
            ? 'border-amber-200/60 bg-amber-50/95 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
            : 'border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15',
      )}
    >
      <span className="flex items-center gap-2">
        {message.type === 'info' ? <Check className="h-4 w-4 text-primary" /> : message.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : <X className="h-4 w-4 text-destructive" />}
        <span className="font-medium">{message.text}</span>
      </span>
    </div>
  );
}
