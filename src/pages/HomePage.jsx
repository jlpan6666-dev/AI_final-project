import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, getDocs, doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore';
import {
  BookOpen, Plus, LogIn, ChevronRight, Users, FileText, CheckCircle2, Clock, Shield
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import Spinner from '../components/Spinner';

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const showToast = useToast();

  const [myCourses, setMyCourses] = useState([]);
  const [myLoading, setMyLoading] = useState(true);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  // 管理者視角資料（顯示所有課程 + 統計）
  const [allCourses, setAllCourses] = useState([]);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [allAssignments, setAllAssignments] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [adminViewLoading, setAdminViewLoading] = useState(true);

  // 學生視角：我加入的課程
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
      setMyCourses(results.filter(Boolean));
      setMyLoading(false);
    }, () => setMyLoading(false));
    return () => unsub();
  }, [user]);

  // 管理者視角：監聽所有課程、所有註冊、所有作業、所有專案
  useEffect(() => {
    if (!isAdmin) {
      setAdminViewLoading(false);
      return;
    }
    const unsubs = [
      onSnapshot(collection(db, 'courses'), (snap) => {
        setAllCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setAdminViewLoading(false);
      }),
      onSnapshot(collection(db, 'enrollments'), (snap) => {
        setAllEnrollments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }),
      onSnapshot(collection(db, 'assignments'), (snap) => {
        setAllAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }),
      onSnapshot(collection(db, 'projects'), (snap) => {
        setAllProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [isAdmin]);

  // 每門課的統計（管理者用）
  const courseStats = useMemo(() => {
    const map = {};
    for (const c of allCourses) {
      const enrollUids = allEnrollments.filter((e) => e.courseId === c.id).map((e) => e.uid);
      const assignmentsOfCourse = allAssignments.filter((a) => a.courseId === c.id);
      const projectsOfCourse = allProjects.filter((p) => p.courseId === c.id);
      const submittedUids = new Set(projectsOfCourse.map((p) => p.authorUid));
      const lateCount = projectsOfCourse.filter((p) => p.isLate).length;
      map[c.id] = {
        studentCount: enrollUids.length,
        assignmentCount: assignmentsOfCourse.length,
        submittedStudentCount: submittedUids.size,
        projectCount: projectsOfCourse.length,
        lateCount,
      };
    }
    return map;
  }, [allCourses, allEnrollments, allAssignments, allProjects]);

  const handleJoin = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setJoining(true);
    try {
      const q = query(collection(db, 'courses'), where('code', '==', trimmed));
      const snap = await getDocs(q);
      if (snap.empty) {
        showToast('找不到這個課程代碼，請確認後再試', 'error');
        return;
      }
      const courseDoc = snap.docs[0];
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

  // ===== 管理者視角 =====
  if (isAdmin) {
    // 全體統計
    const totalStudents = new Set(allEnrollments.map((e) => e.uid)).size;
    const totalSubmissions = allProjects.length;
    const totalLate = allProjects.filter((p) => p.isLate).length;

    return (
      <div className="space-y-8">
        <section className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={20} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">管理者總覽</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={<BookOpen size={18} />} label="課程數" value={allCourses.length} />
            <StatCard icon={<Users size={18} />} label="學生人數" value={totalStudents} />
            <StatCard icon={<FileText size={18} />} label="繳交件數" value={totalSubmissions} />
            <StatCard icon={<Clock size={18} />} label="遲交件數" value={totalLate} highlight={totalLate > 0} />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <BookOpen size={20} className="text-indigo-600" /> 所有課程
          </h2>
          {adminViewLoading ? (
            <Spinner label="載入課程中..." />
          ) : allCourses.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
              <BookOpen size={44} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-1">尚未建立課程</h3>
              <p className="text-slate-500 text-sm">到管理後台建立第一門課程。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {allCourses.map((c) => {
                const s = courseStats[c.id] || { studentCount: 0, assignmentCount: 0, submittedStudentCount: 0, projectCount: 0, lateCount: 0 };
                return (
                  <Link
                    key={c.id}
                    to={`/admin/course/${c.id}`}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow border border-slate-100 p-5 flex flex-col group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{c.name}</h3>
                      <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1" />
                    </div>
                    <div className="text-xs font-medium text-slate-400 mb-4">課程代碼：{c.code}</div>
                    <div className="mt-auto grid grid-cols-2 gap-2 text-sm">
                      <Stat icon={<Users size={14} />} label="學生" value={s.studentCount} />
                      <Stat icon={<FileText size={14} />} label="作業" value={s.assignmentCount} />
                      <Stat icon={<CheckCircle2 size={14} />} label="已繳" value={`${s.submittedStudentCount}/${s.studentCount}`} />
                      <Stat icon={<Clock size={14} />} label="遲交" value={s.lateCount} alert={s.lateCount > 0} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ===== 學生視角（原本邏輯） =====
  return (
    <div className="space-y-8">
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

      <section>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <BookOpen size={20} className="text-indigo-600" /> 我的課程
        </h2>

        {myLoading ? (
          <Spinner label="載入課程中..." />
        ) : myCourses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
            <BookOpen size={44} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">還沒有加入任何課程</h3>
            <p className="text-slate-500 text-sm">向老師索取課程代碼，於上方輸入即可加入。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myCourses.map((c) => (
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div className={`bg-white rounded-xl border p-3 ${highlight ? 'border-amber-300' : 'border-slate-100'}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">{icon} {label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-amber-600' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

function Stat({ icon, label, value, alert }) {
  return (
    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
      <span className="flex items-center gap-1 text-slate-500 text-xs">{icon} {label}</span>
      <span className={`font-bold text-sm ${alert ? 'text-amber-600' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}
