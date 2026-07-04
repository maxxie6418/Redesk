import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface FilterSelectOption {
  value: string;
  label: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  className,
  size = 'sm',
  shape = 'rounded',
  tone = 'card',
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterSelectOption[];
  className?: string;
  size?: 'sm' | 'md';
  shape?: 'rounded' | 'pill';
  tone?: 'card' | 'muted';
}) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'w-auto min-w-[96px] shadow-none',
        size === 'sm' ? 'h-8 px-2 pr-8 text-xs' : 'h-9 px-3 pr-8 text-sm',
        shape === 'pill' ? 'rounded-full' : 'rounded-lg',
        tone === 'muted' ? 'border-border bg-muted' : 'border-border bg-card',
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
