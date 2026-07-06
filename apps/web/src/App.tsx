import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTheme } from '@/components/use-theme';
import { PublicShell, RequireAuth } from '@/routes/protected-layout';
import { LoginRoute } from '@/routes/login';
import { ChangePasswordRoute } from '@/routes/change-password';
import { Bookshelf } from '@/routes/bookshelf/index';
import { BookDetailPage } from '@/routes/book-detail';

const BookReaderPage = lazy(() => import('@/routes/book-reader').then((module) => ({ default: module.BookReaderPage })));
const OverviewPage = lazy(() => import('@/routes/overview').then((module) => ({ default: module.OverviewPage })));
const ReadingNotesPage = lazy(() => import('@/routes/reading-notes').then((module) => ({ default: module.ReadingNotesPage })));
const ReadingTopicsPage = lazy(() => import('@/routes/reading-topics').then((module) => ({ default: module.ReadingTopicsPage })));
const SettingsPage = lazy(() => import('@/routes/settings').then((module) => ({ default: module.SettingsPage })));
const FileLibraryPage = lazy(() => import('@/routes/file-library').then((module) => ({ default: module.FileLibraryPage })));

function RouteFallback() {
  return <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">页面加载中...</div>;
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export default function App() {
  const { theme } = useTheme();
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/change-password" element={<ChangePasswordRoute />} />
        <Route path="/" element={<PublicShell><Bookshelf /></PublicShell>} />
        <Route path="/trash" element={<PublicShell><Bookshelf initialPageView="trash" /></PublicShell>} />
        <Route element={<RequireAuth />}>
          <Route path="/overview" element={<LazyRoute><OverviewPage /></LazyRoute>} />
          <Route path="/books/:id" element={<BookDetailPage />} />
          <Route path="/books/:id/read" element={<LazyRoute><BookReaderPage /></LazyRoute>} />
          <Route path="/files" element={<LazyRoute><FileLibraryPage /></LazyRoute>} />
          <Route path="/reading-notes" element={<LazyRoute><ReadingNotesPage /></LazyRoute>} />
          <Route path="/reading-topics" element={<LazyRoute><ReadingTopicsPage /></LazyRoute>} />
          <Route path="/settings" element={<LazyRoute><SettingsPage /></LazyRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster theme={theme} position="top-center" richColors closeButton />
    </>
  );
}
