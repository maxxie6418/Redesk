import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/routes/protected-layout';
import { LoginRoute } from '@/routes/login';
import { SetupRoute } from '@/routes/setup';
import { Bookshelf } from '@/routes/bookshelf';
import { BookDetailPage } from '@/routes/book-detail';
import { SettingsPage } from '@/routes/settings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/setup" element={<SetupRoute />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Bookshelf />} />
        <Route path="/books/:id" element={<BookDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
