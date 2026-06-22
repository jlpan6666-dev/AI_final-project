import React from 'react';
import { Navigate } from 'react-router-dom';
import { LogIn, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import { FullScreenSpinner } from '../components/Spinner';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const showToast = useToast();

  if (loading) return <FullScreenSpinner />;

  // 已登入則導回首頁（首頁會再決定是否需補填資料）
  if (user) return <Navigate to="/" replace />;

  const handleLogin = async () => {
    try {
      await login();
      showToast('登入成功！', 'success');
    } catch (e) {
      console.error('登入失敗:', e);
      showToast('登入失敗，請重試', 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-10 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Trophy size={32} className="stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">課程學習平台</h1>
        <p className="text-slate-500 mb-8 text-sm leading-relaxed">
          請使用 Google 帳號登入後，填寫基本資料並輸入課程代碼，即可開始繳交專題。
        </p>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
        >
          <LogIn size={20} />
          <span>使用 Google 登入</span>
        </button>
        <p className="text-xs text-slate-400 mt-6">登入即代表你同意以校園學習用途使用本平台。</p>
      </div>
    </div>
  );
}
