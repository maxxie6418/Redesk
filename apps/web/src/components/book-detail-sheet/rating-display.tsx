import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingDisplayProps {
  rating: number | null;
  editMode: boolean;
  onSave?: (rating: number | null) => Promise<void>;
}

export function RatingDisplay({ rating, editMode, onSave }: RatingDisplayProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const handleClick = async (r: number) => {
    if (!onSave || isSaving) return;
    setIsSaving(true);
    try {
      const newRating = rating === r ? null : r;
      await onSave(newRating);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const displayRating = hovered ?? rating ?? 0;

  const stars = (
    <div className="flex shrink-0 items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((r) => (
        <button
          key={r}
          type="button"
          disabled={!editMode || isSaving}
          onClick={() => handleClick(r)}
          onMouseEnter={() => editMode && setHovered(r)}
          onMouseLeave={() => setHovered(null)}
          className={cn(
            'transition-transform duration-150',
            editMode && !isSaving && 'cursor-pointer',
            r <= displayRating ? 'text-[#f5c842]' : 'text-muted-foreground/30',
          )}
        >
          <Star className={cn('h-4 w-4 fill-current', r <= displayRating && editMode && 'hover:scale-110')} />
        </button>
      ))}
      {isSaving && <Loader2 className="ml-1 h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );

  const label = (
    <span className="ml-1.5 text-[13px] font-semibold">
      {rating != null ? rating : editMode ? '未评分' : '—'}
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="shrink-0 text-muted-foreground">评分</span>
      <div className="flex items-center">
        {stars}
        <span className="flex justify-between gap-2 flex-1">{label}</span>
      </div>
      {editMode && rating != null && (
        <button
          type="button"
          onClick={() => handleClick(rating)}
          disabled={isSaving}
          className="text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          清空
        </button>
      )}
    </div>
  );
}
