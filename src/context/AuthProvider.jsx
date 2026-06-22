/* 此檔同時匯出 Provider 與 useAuth hook（標準 Context 模式）；
   且需在 effect 中同步 Firebase 登入這類外部系統的狀態，屬 effect 正當用途。 */
/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'firebase/auth';
import { doc, onSnapshot, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { useToast } from './ToastProvider';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const showToast = useToast();
  const [user, setUser] = useState(null);          // Firebase 使用者（僅真實 Google 帳號）
  const [authLoading, setAuthLoading] = useState(true);

  const [profile, setProfile] = useState(null);    // users/{uid} 文件
  const [profileLoading, setProfileLoading] = useState(true);

  const [adminDoc, setAdminDoc] = useState(null);  // admins/{uid} 文件
  const [adminLoading, setAdminLoading] = useState(true);

  // 監聽登入狀態（已移除自動匿名登入：未登入即看不到內容）
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser && !currentUser.isAnonymous ? currentUser : null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // 監聽個人資料
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );
    return () => unsub();
  }, [user]);

  // 監聽管理者身分
  useEffect(() => {
    if (!user) {
      setAdminDoc(null);
      setAdminLoading(false);
      return;
    }
    setAdminLoading(true);
    const unsub = onSnapshot(
      doc(db, 'admins', user.uid),
      async (snap) => {
        if (snap.exists()) {
          setAdminDoc({ id: snap.id, ...snap.data() });
          setAdminLoading(false);
        } else {
          // 若無管理者文件，檢查是否有對應 email 的邀請（自動接受）
          if (user.email) {
            const emailKey = user.email.toLowerCase();
            try {
              const invRef = doc(db, 'invitations', emailKey);
              const invSnap = await getDoc(invRef);
              if (invSnap.exists()) {
                await setDoc(doc(db, 'admins', user.uid), {
                  role: 'admin',
                  email: emailKey,
                  createdAt: serverTimestamp(),
                });
                await deleteDoc(invRef);
                showToast('已透過邀請自動成為一般管理者 🎉', 'success');
                return; // setDoc 會觸發下一次 onSnapshot
              }
            } catch (err) {
              console.error('檢查邀請失敗:', err);
            }
          }
          setAdminDoc(null);
          setAdminLoading(false);
        }
      },
      () => setAdminLoading(false)
    );
    return () => unsub();
  }, [user, showToast]);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  // 個人資料是否填寫完整
  const profileComplete = !!(
    profile && profile.studentId && profile.name && profile.className && profile.startAcademicYear
  );

  const isAdmin = !!adminDoc;
  const isSuper = adminDoc?.role === 'super';

  const value = {
    user,
    authLoading,
    profile,
    profileLoading,
    profileComplete,
    adminDoc,
    adminLoading,
    isAdmin,
    isSuper,
    login,
    logout,
    // 整體載入：任一狀態尚未就緒
    loading: authLoading || (user && (profileLoading || adminLoading)),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
