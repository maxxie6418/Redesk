import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOAST_ICONS, type StatusMessage, type ToastType } from './types';

const TYPE_STYLES: Record<ToastType, string> = {
  info: 'border-primary/15 bg-primary/5 text-foreground dark:border-primary/30 dark:bg-primary/10',
  warning: 'border-amber-200/60 bg-amber-50/95 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200',
  error: 'border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15',
};

const ICON_COLORS: Record<ToastType, string> = {
  info: 'text-primary',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-destructive',
};

export function StatusToast({ message, onClose, className }: { message: StatusMessage; onClose: () => void; className?: string }) {
  if (!message) return null;
  return (
    <div className={cn('pointer-events-auto fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-200', className)}>
      <div className={cn('flex items-center gap-2.5 rounded-lg border px-4 py-2.5 shadow-lg backdrop-blur-sm', TYPE_STYLES[message.type])}>
        <span className={cn('shrink-0', ICON_COLORS[message.type])}>{TOAST_ICONS[message.type]}</span>
        <span className="text-sm font-medium">{message.text}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 rounded-md p-0.5 opacity-50 transition-opacity hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
