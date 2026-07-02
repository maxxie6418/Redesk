import { Navigate, useParams } from 'react-router-dom';

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);

  if (!Number.isInteger(bookId) || bookId <= 0) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={`/?book=${bookId}`} replace />;
}
