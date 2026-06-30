import { useNavigate, useParams } from 'react-router-dom';
import { BookDetailSheet } from '@/components/book-detail-sheet';

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <BookDetailSheet
        bookId={isNaN(bookId) ? null : bookId}
        open={true}
        onClose={() => navigate(-1)}
      />
    </div>
  );
}
