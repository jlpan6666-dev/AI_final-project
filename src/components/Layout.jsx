import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Trophy, LogOut, Shield, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import { gradeLabel } from '../lib/grade';

export default function Layout() {
  const { user, profile, isAdmin, isSuper, logout } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      showToast('已登出', 'success');
      navigate('/login');
    } catch {
      showToast('登出失敗', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center gap-4">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 text-indigo-600">
            <Trophy className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5]" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">課程學習平台</h1>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 px-3 py-2 rounded-xl font-medium transition-all"
                title="管理後台"
              >
                <UserCog size={18} />
                <span className="hidden sm:inline">{isSuper ? '超級管理' : '管理後台'}</span>
              </Link>
            )}

            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full">
              {isAdmin ? (
                <Shield size={16} className="text-indigo-600 flex-shrink-0" />
              ) : (
                <img
                  src={user?.photoURL || `https://ui-avatars.com/api/?name=${profile?.name || 'U'}&background=random`}
                  alt="avatar"
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
                />
              )}
              <span className="truncate max-w-[90px] sm:max-w-[140px] text-xs sm:text-sm">
                {profile?.name || user?.displayName || '使用者'}
                {profile?.startAcademicYear ? ` · ${gradeLabel(profile.startAcademicYear)}` : ''}
              </span>
            </div>

            <Link
              to="/setup-profile"
              className="hidden sm:flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 px-3 py-2 rounded-xl font-medium transition-all"
              title="編輯個人資料"
            >
              <UserCog size={18} />
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-xl font-medium transition-all shadow-sm flex-shrink-0"
              title="登出"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <Outlet />
      </main>
    </div>
  );
}
