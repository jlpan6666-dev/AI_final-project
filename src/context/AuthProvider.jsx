/* 此檔同時匯出 Provider 與 useAuth hook（標準 Context 模式）；
   且需在 effect 中同步 Firebase 登入這類外部系統的狀態，屬 effect 正當用途。 */
/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup, signOut, onAuthStateChanged
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
  const [user, setUser] = useState(null);              // Firebase 使用者（僅真實 Google 帳號）
  const [authLoading, setAuthLoading] = useState(true);

  // 用「已同步給哪個 uid 的快照」追蹤是否真的拿到當前使用者的資料
  // 避免 effect 還沒跑到、profile 仍是上次值就被誤判為 "未填寫"。
  const [profile, setProfile] = useState(null);        // users/{uid} 文件
  const [profileSyncedFor, setProfileSyncedFor] = useState(null);

  const [adminDoc, setAdminDoc] = useState(null);      // admins/{uid} 文件
  const [adminSyncedFor, setAdminSyncedFor] = useState(null);

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
      setProfileSyncedFor('__no_user__');
      return;
    }
    // user 改變後，舊的同步標記作廢，避免 RequireProfile 用舊 profile 誤判
    setProfileSyncedFor(null);
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setProfileSyncedFor(user.uid);
      },
      () => setProfileSyncedFor(user.uid) // 讀取失敗也要解除 loading，否則永遠卡住
    );
    return () => unsub();
  }, [user]);

  // 監聽管理者身分（並自動接受邀請）
  useEffect(() => {
    if (!user) {
      setAdminDoc(null);
      setAdminSyncedFor('__no_user__');
      return;
    }
    setAdminSyncedFor(null);
    const unsub = onSnapshot(
      doc(db, 'admins', user.uid),
      async (snap) => {
        if (snap.exists()) {
          setAdminDoc({ id: snap.id, ...snap.data() });
          setAdminSyncedFor(user.uid);
          return;
        }
        // 沒有管理者文件 → 檢查是否有對應 email 的邀請（自動接受）
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
              return; // setDoc 會觸發下一次 onSnapshot，那邊會 setAdminSyncedFor
            }
          } catch (err) {
            console.error('檢查邀請失敗:', err);
          }
        }
        setAdminDoc(null);
        setAdminSyncedFor(user.uid);
      },
      () => setAdminSyncedFor(user.uid)
    );
    return () => unsub();
  }, [user, showToast]);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  // 「已同步」= 沒登入，或者同步標記指向當前使用者
  const profileReady = !user || profileSyncedFor === user.uid;
  const adminReady = !user || adminSyncedFor === user.uid;

  // 個人資料是否填寫完整（必須等資料已同步才下判斷）
  const profileComplete = !!(
    profileReady && profile && profile.studentId && profile.name && profile.className && profile.startAcademicYear
  );

  const isAdmin = !!adminDoc;
  const isSuper = adminDoc?.role === 'super';

  const value = {
    user,
    authLoading,
    profile,
    profileLoading: !profileReady,
    profileComplete,
    adminDoc,
    adminLoading: !adminReady,
    isAdmin,
    isSuper,
    login,
    logout,
    // 整體載入：任一狀態尚未就緒（gate 用這個來顯示 spinner，避免錯誤跳轉）
    loading: authLoading || !!(user && (!profileReady || !adminReady)),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
