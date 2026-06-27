import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/routes/protected-layout';
import { LoginRoute } from '@/routes/login';
import { SetupRoute } from '@/routes/setup';
import { Bookshelf } from '@/routes/bookshelf';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/setup" element={<SetupRoute />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Bookshelf />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
