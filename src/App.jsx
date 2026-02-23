import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { Heart, ExternalLink, Plus, Trophy, Users, Monitor, Info, X, Link as LinkIcon, AlertCircle, CheckCircle2, Clock, LogIn, LogOut, Edit, Trash2, Shield, Lock } from 'lucide-react';

// ==========================================
// Firebase 初始化設定 (使用你的專屬 Config)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCh2PByMUxJCY3cmg36WvTE_3PXOyCxNBY",
  authDomain: "ai-final-project-a69b4.firebaseapp.com",
  projectId: "ai-final-project-a69b4",
  storageBucket: "ai-final-project-a69b4.firebasestorage.app",
  messagingSenderId: "1011815467681",
  appId: "1:1011815467681:web:fb282cdaf87a0ab385bee0",
  measurementId: "G-PJRKHDNJDG"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const appId = "ai-final-project-a69b4";

export default function App() {
  // --- 狀態管理 ---
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState('likes'); // 'likes' 或 'newest'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [cssLoaded, setCssLoaded] = useState(false); // 新增：追蹤 CSS 是否載入完成

  // 權限與管理狀態
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPwdInput, setAdminPwdInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // 表單狀態
  const [formData, setFormData] = useState({
    systemName: '',
    groupName: '',
    members: '',
    description: '',
    url: ''
  });

  // ==========================================
  // 動態載入 Tailwind CSS (解決沒有樣式的問題)
  // ==========================================
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      script.onload = () => {
        // 給予一點點緩衝時間讓 Tailwind 掃描並生成樣式
        setTimeout(() => setCssLoaded(true), 50);
      };
      document.head.appendChild(script);
    } else {
      setCssLoaded(true);
    }
  }, []);

  // --- Firebase 驗證與資料監聽 ---
  useEffect(() => {
    // 監聽 Auth 狀態 (Google 登入)
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribeAuth();
  }, []);

  // Google 登入功能
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      showToast("登入成功！", "success");
    } catch (error) {
      console.error("登入失敗:", error);
      showToast("登入失敗，請重試", "error");
    }
  };

  // 登出功能
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdmin(false); // 登出時一併清除管理員身分
      showToast("已登出", "success");
    } catch (error) {
      console.error("登出失敗:", error);
    }
  };

  useEffect(() => {
    // 只有在取得 user 狀態後才查詢 Firestore
    if (!user) {
      // 若未登入，依然可以讀取公開的專案資料
      const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'ai_projects');
      const unsubscribeDB = onSnapshot(
        projectsRef,
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setProjects(data);
          setLoading(false);
        },
        (error) => {
          console.error("讀取專案失敗:", error);
          setLoading(false);
        }
      );
      return () => unsubscribeDB();
    }

    // 登入狀態下讀取資料
    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'ai_projects');
    const unsubscribeDB = onSnapshot(
      projectsRef,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProjects(data);
        setLoading(false);
      },
      (error) => {
        console.error("讀取專案失敗:", error);
        showToast("無法載入專案資料", "error");
        setLoading(false);
      }
    );

    return () => unsubscribeDB();
  }, [user]);

  // --- 功能邏輯 ---

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 管理員登入驗證
  const handleAdminLoginSubmit = (e) => {
    e.preventDefault();
    if (adminPwdInput === 'minar7917') {
      setIsAdmin(true);
      setIsAdminModalOpen(false);
      setAdminPwdInput('');
      showToast("管理員身分已啟用", "success");
    } else {
      showToast("管理員密碼錯誤", "error");
    }
  };

  // 開啟編輯視窗
  const openEditModal = (project) => {
    setFormData({
      systemName: project.systemName,
      groupName: project.groupName,
      members: project.members,
      description: project.description,
      url: project.url
    });
    setEditingId(project.id);
    setIsModalOpen(true);
  };

  // 關閉新增/編輯視窗
  const closeProjectModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ systemName: '', groupName: '', members: '', description: '', url: '' });
  };

  // 執行刪除專題
  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ai_projects', deleteConfirmId));
      showToast("專題已成功刪除", "success");
    } catch (error) {
      console.error("刪除失敗:", error);
      showToast("刪除失敗，請檢查權限", "error");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user && !isAdmin) {
      showToast("請先登入才能操作專題", "error");
      return;
    }

    if (!formData.url.startsWith('http://') && !formData.url.startsWith('https://')) {
      showToast("請輸入完整的網址 (包含 http:// 或 https://)", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        // 更新現有專題
        const projectRef = doc(db, 'artifacts', appId, 'public', 'data', 'ai_projects', editingId);
        await updateDoc(projectRef, {
          systemName: formData.systemName,
          groupName: formData.groupName,
          members: formData.members,
          description: formData.description,
          url: formData.url
        });
        showToast("專案更新成功！ 🎉");
      } else {
        // 新增專題
        const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'ai_projects');
        await addDoc(projectsRef, {
          ...formData,
          likedBy: [], 
          createdAt: serverTimestamp(),
          authorUid: user?.uid || 'admin'
        });
        showToast("專案上傳成功！ 🎉");
      }
      
      closeProjectModal();
    } catch (error) {
      console.error("儲存失敗:", error);
      showToast("儲存失敗，請稍後再試", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLike = async (projectId, currentLikedBy) => {
    if (!user) {
      showToast("請先登入才能按讚哦！", "error");
      return;
    }
    
    const projectRef = doc(db, 'artifacts', appId, 'public', 'data', 'ai_projects', projectId);
    const isLiked = currentLikedBy.includes(user.uid);

    try {
      if (isLiked) {
        await updateDoc(projectRef, {
          likedBy: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(projectRef, {
          likedBy: arrayUnion(user.uid)
        });
      }
    } catch (error) {
      console.error("按讚操作失敗:", error);
      showToast("操作失敗，請確認網路連線", "error");
    }
  };

  // --- 資料排序 ---
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (sortBy === 'likes') {
        const likesA = a.likedBy?.length || 0;
        const likesB = b.likedBy?.length || 0;
        if (likesA !== likesB) return likesB - likesA; 
        return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      } else {
        return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      }
    });
  }, [projects, sortBy]);

  // --- UI 元件 ---

  // 在 Tailwind 尚未完全載入前，使用純內聯樣式顯示過渡畫面，避免無樣式閃爍
  if (!cssLoaded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '20px', color: '#64748b', fontSize: '16px', fontWeight: '600', letterSpacing: '0.05em' }}>系統載入中...</p>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      {/* 直接寫入自訂 CSS 動畫樣式 */}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.3s ease-out forwards;
        }
        .animate-scale-in {
          animation: scaleIn 0.2s ease-out forwards;
        }
      `}</style>

      {/* 頂部導覽列 */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 text-indigo-600">
            <Trophy size={32} className="stroke-[2.5]" />
            <h1 className="text-2xl font-bold tracking-tight">AI 專題排行榜</h1>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            {/* 排序選擇器 */}
            <div className="relative flex-grow sm:flex-grow-0">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full appearance-none bg-slate-100 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition-colors"
              >
                <option value="likes">🔥 依喜愛程度</option>
                <option value="newest">✨ 最新上傳</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>

            {/* 登入 / 登出與使用者狀態 */}
            {user || isAdmin ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                  {isAdmin ? (
                    <Shield size={16} className="text-indigo-600" />
                  ) : (
                    <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.email}&background=random`} alt="avatar" className="w-6 h-6 rounded-full" />
                  )}
                  <span className="truncate max-w-[100px]">{isAdmin ? '管理員' : (user?.displayName || '使用者')}</span>
                </div>
                {/* 新增專案按鈕 */}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-sm hover:shadow-md flex-shrink-0"
                >
                  <Plus size={20} />
                  <span className="hidden sm:inline">上傳專題</span>
                  <span className="sm:hidden">上傳</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-xl font-medium transition-all shadow-sm flex-shrink-0"
                  title="登出"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAdminModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 px-3 py-2 rounded-xl font-medium transition-all flex-shrink-0"
                  title="管理員登入"
                >
                  <Shield size={18} />
                </button>
                <button
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium transition-all shadow-sm hover:shadow-md flex-shrink-0"
                >
                  <LogIn size={20} />
                  <span>Google 登入</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 提示訊息 (Toast) */}
      {toast && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-sm font-medium ${
            toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'
          }`}>
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {toast.message}
          </div>
        </div>
      )}

      {/* 主要內容區塊 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-slate-500 font-medium">載入專題中，請稍候...</p>
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
            <Monitor size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">目前還沒有組別上傳專題</h3>
            <p className="text-slate-500 mb-6">成為第一個展示你們 AI 網站的組別吧！</p>
            <button
              onClick={() => (user || isAdmin) ? setIsModalOpen(true) : handleGoogleLogin()}
              className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              {(user || isAdmin) ? <Plus size={20} /> : <LogIn size={20} />}
              {(user || isAdmin) ? '立即上傳' : '登入以上傳'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProjects.map((project, index) => {
              const likesCount = project.likedBy?.length || 0;
              const isLikedByMe = user && project.likedBy?.includes(user.uid);
              const rank = index + 1;
              const canEdit = isAdmin || (user && project.authorUid === user.uid);

              // 擷取網址的網域 (Domain) 來取得網站 Icon
              let domain = '';
              try {
                domain = new URL(project.url).hostname;
              } catch (e) {
                console.error("無法解析網址:", project.url);
              }

              return (
                <div key={project.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col border border-slate-100 relative group">
                  
                  {/* 排行榜名次標籤 */}
                  {sortBy === 'likes' && rank <= 3 && (
                    <div className="absolute top-0 left-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white w-12 h-12 flex items-center justify-center font-bold text-lg rounded-br-2xl shadow-md z-10">
                      #{rank}
                    </div>
                  )}

                  {/* 編輯 / 刪除按鈕 (僅作者或管理員可見) */}
                  {canEdit && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button 
                        onClick={() => openEditModal(project)} 
                        className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 rounded-lg shadow-sm transition-all"
                        title="編輯專題"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmId(project.id)} 
                        className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 rounded-lg shadow-sm transition-all"
                        title="刪除專題"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}

                  <div className="p-6 flex-grow flex flex-col">
                    <div className={`mb-4 ${(sortBy === 'likes' && rank <= 3) || canEdit ? 'pr-16' : ''} ${sortBy === 'likes' && rank <= 3 ? 'ml-8' : ''}`}>
                      <div className="flex items-center gap-3">
                        {/* 網站 Icon (Favicon) */}
                        {domain && (
                          <img 
                            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
                            alt="Site icon" 
                            className="w-7 h-7 rounded-md bg-white border border-slate-200 p-0.5 flex-shrink-0 shadow-sm"
                            onError={(e) => { e.target.style.display = 'none'; }} // 若圖片載入失敗則隱藏
                          />
                        )}
                        <h2 className="text-xl font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors" title={project.systemName}>
                          {project.systemName}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-indigo-500 font-medium mt-1">
                        <Users size={16} />
                        <span>{project.groupName}</span>
                      </div>
                    </div>

                    <p className="text-slate-600 text-sm mb-4 line-clamp-3 flex-grow" title={project.description}>
                      {project.description}
                    </p>

                    <div className="bg-slate-50 rounded-lg p-3 mb-6">
                      <div className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">小組成員</div>
                      <div className="text-sm text-slate-700 font-medium">{project.members}</div>
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between mt-auto">
                    <button 
                      onClick={() => toggleLike(project.id, project.likedBy || [])}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                        isLikedByMe 
                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                          : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-rose-500 border border-slate-200 shadow-sm'
                      }`}
                    >
                      <Heart size={18} className={isLikedByMe ? "fill-rose-500" : ""} />
                      <span className="font-bold">{likesCount}</span>
                    </button>

                    <a 
                      href={project.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors"
                    >
                      <span>前往網站</span>
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 新增專案 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/40 backdrop-blur-sm z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {editingId ? <Edit size={24} className="text-indigo-600" /> : <Monitor size={24} className="text-indigo-600" />}
                {editingId ? '編輯 AI 網頁專題' : '發布 AI 網頁專題'}
              </h2>
              <button 
                onClick={closeProjectModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="projectForm" onSubmit={handleSubmit} className="space-y-5">
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    系統名稱 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="systemName"
                    required
                    value={formData.systemName}
                    onChange={handleInputChange}
                    placeholder="例如：智慧校園導覽機器人"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      組別名稱 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="groupName"
                      required
                      value={formData.groupName}
                      onChange={handleInputChange}
                      placeholder="例如：第 1 組"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      小組成員 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="members"
                      required
                      value={formData.members}
                      onChange={handleInputChange}
                      placeholder="王大明, 李小華..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    網頁功能說明 <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    name="description"
                    required
                    rows="3"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="簡短描述你們的 AI 網站提供了什麼服務或功能..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none resize-none"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    網站連結 (URL) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <LinkIcon size={18} />
                    </div>
                    <input
                      type="url"
                      name="url"
                      required
                      value={formData.url}
                      onChange={handleInputChange}
                      placeholder="https://your-ai-website.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                    />
                  </div>
                </div>

              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
              <button
                type="button"
                onClick={closeProjectModal}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                type="submit"
                form="projectForm"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-70 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {editingId ? '儲存中...' : '發布中...'}
                  </>
                ) : (
                  editingId ? '儲存修改' : '確認發布'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 管理員登入 Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/40 backdrop-blur-sm z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Shield size={24} className="text-indigo-600" />
                管理員登入
              </h2>
              <button 
                onClick={() => { setIsAdminModalOpen(false); setAdminPwdInput(''); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Lock size={16} /> 管理密碼
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={adminPwdInput}
                    onChange={(e) => setAdminPwdInput(e.target.value)}
                    placeholder="請輸入密碼"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-5 py-2.5 mt-2 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                  確認登入
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/40 backdrop-blur-sm z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-scale-in text-center p-6">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">確定要刪除這個專題嗎？</h2>
            <p className="text-slate-500 mb-6 text-sm">這個動作無法復原，與該專題相關的所有愛心與紀錄都會被永久刪除。</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex-1"
              >
                取消
              </button>
              <button
                onClick={executeDelete}
                className="px-5 py-2.5 rounded-xl font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors flex-1"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
