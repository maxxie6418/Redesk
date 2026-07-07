import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RatingValue({ rating, size = 'sm', variant = 'stars' }: { rating: number | null; size?: 'sm' | 'xs'; variant?: 'stars' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className={cn('inline-flex items-center gap-1 font-semibold text-foreground', size === 'xs' ? 'text-[13px]' : 'text-sm')}>
        <Star className={cn('fill-[#f5c842] text-[#f5c842]', size === 'xs' ? 'h-3 w-3' : 'h-[13px] w-[13px]')} />
        {rating ?? '—'}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 text-[#f5c842]">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} className={cn(size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5', value <= (rating ?? 0) ? 'fill-current' : 'fill-none text-muted-foreground/25')} />
      ))}
    </div>
  );
}
