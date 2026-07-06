import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  size?: 'sm' | 'default';
  shape?: 'rounded' | 'pill';
  tone?: 'card' | 'muted';
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size={size}
        className={cn(
          'shadow-none',
          shape === 'pill' ? 'rounded-full' : 'rounded-lg',
          tone === 'muted' ? 'border-border bg-muted' : 'border-border bg-card',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
