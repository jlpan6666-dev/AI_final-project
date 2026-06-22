import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthProvider';
import { ToastProvider } from './context/ToastProvider';
import { FullScreenSpinner } from './components/Spinner';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SetupProfilePage from './pages/SetupProfilePage';
import HomePage from './pages/HomePage';
import CoursePage from './pages/CoursePage';
import AdminPage from './pages/AdminPage';
import AdminCoursePage from './pages/AdminCoursePage';

// 未登入 → 導向登入頁
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// 已登入但資料未填完整 → 導向填資料頁（管理者＝教師/助教 可略過）
function RequireProfile() {
  const { profileComplete, isAdmin, loading } = useAuth();
  if (loading) return <FullScreenSpinner />;
  if (!profileComplete && !isAdmin) return <Navigate to="/setup-profile" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* 需登入 */}
          <Route element={<RequireAuth />}>
            <Route path="/setup-profile" element={<SetupProfilePage />} />

            <Route element={<Layout />}>
              {/* 管理後台：教師/助教免填學生資料即可進入 */}
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/course/:id" element={<AdminCoursePage />} />

              {/* 需登入 + 資料完整（管理者可略過） */}
              <Route element={<RequireProfile />}>
                <Route index element={<HomePage />} />
                <Route path="/course/:id" element={<CoursePage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
