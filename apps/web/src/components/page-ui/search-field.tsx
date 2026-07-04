import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <div className={cn('relative max-w-md flex-1', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={cn('h-9 pl-9', inputClassName)}
        placeholder={placeholder}
      />
    </div>
  );
}
