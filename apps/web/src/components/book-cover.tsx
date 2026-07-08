import { cn } from '@/lib/utils';
import { COVER_TONES } from '@/components/book-cover-tones';
import type { BookSummary } from '@/hooks/use-books';

interface BookCoverProps {
  book: Pick<BookSummary, 'id' | 'title' | 'cover_path'> & { cover_url?: string | null; publish_year?: number | null };
  index?: number;
  className: string;
  rounded?: string;
}

export function BookCover({ book, index = 0, className, rounded = 'rounded-md' }: BookCoverProps) {
  const imageUrl = book.cover_url ?? (book.cover_path ? `/api/v1/books/${book.id}/cover` : null);
  if (imageUrl) {
    return <img src={imageUrl} alt={book.title} className={cn(className, rounded, 'block bg-muted object-cover shadow-sm')} loading="lazy" />;
  }

  return (
    <div className={cn(className, rounded, 'flex flex-col justify-between bg-muted px-2 py-1.5 font-display text-xs font-semibold shadow-sm', COVER_TONES[index % COVER_TONES.length])}>
      <span className="line-clamp-3 leading-tight">{book.title}</span>
      <span className="truncate text-[10px] opacity-70">{book.publish_year ?? 'Redesk'}</span>
    </div>
  );
}
