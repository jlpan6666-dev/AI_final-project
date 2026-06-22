import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, getDocs, doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { BookOpen, Plus, LogIn, ChevronRight } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import Spinner from '../components/Spinner';

export default function HomePage() {
  const { user } = useAuth();
  const showToast = useToast();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  // 監聽我加入的課程
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'enrollments'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const courseIds = snap.docs.map((d) => d.data().courseId);
      const results = await Promise.all(
        courseIds.map(async (cid) => {
          const cSnap = await getDoc(doc(db, 'courses', cid));
          return cSnap.exists() ? { id: cSnap.id, ...cSnap.data() } : null;
        })
      );
      setCourses(results.filter(Boolean));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  const handleJoin = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setJoining(true);
    try {
      // 以課程代碼查詢課程
      const q = query(collection(db, 'courses'), where('code', '==', trimmed));
      const snap = await getDocs(q);
      if (snap.empty) {
        showToast('找不到這個課程代碼，請確認後再試', 'error');
        return;
      }
      const courseDoc = snap.docs[0];
      // 建立註冊（doc id 用 courseId_uid 確保不重複）
      const enrollId = `${courseDoc.id}_${user.uid}`;
      await setDoc(doc(db, 'enrollments', enrollId), {
        courseId: courseDoc.id,
        uid: user.uid,
        joinedAt: serverTimestamp(),
      });
      showToast(`已加入課程：${courseDoc.data().name}`, 'success');
      setCode('');
    } catch (err) {
      console.error('加入課程失敗:', err);
      showToast('加入失敗，請稍後再試', 'error');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 加入課程 */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
          <Plus size={20} className="text-indigo-600" /> 加入課程
        </h2>
        <p className="text-slate-500 text-sm mb-4">輸入老師提供的課程代碼即可註冊該課程。</p>
        <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="輸入課程代碼，例如：AI2026"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
          />
          <button
            type="submit"
            disabled={joining || !code.trim()}
            className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <LogIn size={18} /> {joining ? '加入中...' : '加入'}
          </button>
        </form>
      </section>

      {/* 我的課程 */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <BookOpen size={20} className="text-indigo-600" /> 我的課程
        </h2>

        {loading ? (
          <Spinner label="載入課程中..." />
        ) : courses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
            <BookOpen size={44} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">還沒有加入任何課程</h3>
            <p className="text-slate-500 text-sm">向老師索取課程代碼，於上方輸入即可加入。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => {
              return (
                <Link
                  key={c.id}
                  to={`/course/${c.id}`}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow border border-slate-100 p-5 flex flex-col group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{c.name}</h3>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1" />
                  </div>
                  <div className="text-xs font-medium text-slate-400">課程代碼：{c.code}</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
