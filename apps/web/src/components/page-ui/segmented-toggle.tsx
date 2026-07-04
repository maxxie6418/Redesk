import { cn } from '@/lib/utils';

export function SegmentedToggle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('inline-flex items-center border border-border bg-muted p-0.5', className)}>{children}</div>;
}

export function SegmentedToggleItem({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
        active && 'bg-card text-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </button>
  );
}
