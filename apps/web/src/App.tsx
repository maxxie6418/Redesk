import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/routes/protected-layout';
import { LoginRoute } from '@/routes/login';
import { SetupRoute } from '@/routes/setup';
import { Bookshelf } from '@/routes/bookshelf';
import { BookDetailPage } from '@/routes/book-detail';
import { OverviewPage } from '@/routes/overview';
import { ReadingNotesPage } from '@/routes/reading-notes';
import { ReadingTopicsPage } from '@/routes/reading-topics';
import { SettingsPage } from '@/routes/settings';
import { FileLibraryPage } from '@/routes/file-library';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/setup" element={<SetupRoute />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Bookshelf />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/books/:id" element={<BookDetailPage />} />
        <Route path="/files" element={<FileLibraryPage />} />
        <Route path="/reading-notes" element={<ReadingNotesPage />} />
        <Route path="/reading-topics" element={<ReadingTopicsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
