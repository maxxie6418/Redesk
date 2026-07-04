import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon,
  valueClassName,
  iconClassName,
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  valueClassName?: string;
  iconClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card px-4 py-4', className)}>
      <div className="mb-2 flex items-center gap-2">
        {icon ? (
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground', iconClassName)}>
            {icon}
          </div>
        ) : null}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className={cn('text-[28px] font-bold tabular-nums text-foreground', valueClassName)}>{value}</div>
    </div>
  );
}
