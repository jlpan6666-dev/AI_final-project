import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, getDoc, doc, addDoc,
  updateDoc, deleteDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import {
  ArrowLeft, Plus, Edit, Trash2, CalendarClock, BookOpen, AlertCircle,
  Users, CheckCircle2, XCircle, Clock, ExternalLink, FileText, Search
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { toDatetimeLocalValue, formatDeadline } from '../lib/deadline';
import { extractFolderId } from '../lib/drive';

const EMPTY_ASSIGNMENT = {
  title: '', deadline: '', allowLate: false,
  fields: { url: true, description: true, file: false },
  driveFolderId: '',
};

function FieldToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors"></div>
        <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
      </div>
    </label>
  );
}

function ConfirmDelete({ title, desc, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} icon={<AlertCircle size={22} className="text-rose-600" />}
      footer={(
        <>
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200">取消</button>
          <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl font-medium bg-rose-600 hover:bg-rose-700 text-white">確認刪除</button>
        </>
      )}>
      <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
    </Modal>
  );
}

function Tag({ children }) {
  return <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">{children}</span>;
}

function SubmissionBadge({ p }) {
  // 連結優先：網址 > 檔案
  const href = p?.url || p?.fileUrl || '';
  const Icon = p?.isLate ? Clock : CheckCircle2;
  const colorClass = p?.isLate ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50';
  const label = p?.isLate ? '遲交' : '已繳';
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}
        title={p.title || ''}>
        <Icon size={12} /> {label} <ExternalLink size={10} className="opacity-60" />
      </a>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${p?.isLate ? 'text-amber-600' : 'text-emerald-600'}`}>
      <Icon size={12} /> {label}
    </span>
  );
}

export default function AdminCoursePage() {
  const { id } = useParams();
  const showToast = useToast();
  const { isAdmin, adminLoading } = useAuth();
  
  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_ASSIGNMENT);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // 學生名單與繳交狀況
  const [students, setStudents] = useState([]);   // [{ uid, name, studentId, className, email }]
  const [projects, setProjects] = useState([]);   // 本課程所有 projects
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const snap = await getDoc(doc(db, 'courses', id));
      if (active) {
        setCourse(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      }
    })();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    const q = query(collection(db, 'assignments'), where('courseId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [id]);

  // 監聽本課程的學生（透過 enrollments → users 撈個人資料）
  useEffect(() => {
    const q = query(collection(db, 'enrollments'), where('courseId', '==', id));
    const unsub = onSnapshot(q, async (snap) => {
      const uids = snap.docs.map((d) => d.data().uid);
      const profiles = await Promise.all(uids.map(async (uid) => {
        try {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (!uSnap.exists()) return { uid, name: '(尚未填寫資料)', studentId: '', className: '', email: '' };
          const u = uSnap.data();
          return {
            uid,
            name: u.name || u.displayName || '',
            studentId: u.studentId || '',
            className: u.className || '',
            email: u.email || '',
          };
        } catch {
          return { uid, name: '(讀取失敗)', studentId: '', className: '', email: '' };
        }
      }));
      // 依學號或姓名排序
      profiles.sort((a, b) => (a.studentId || a.name).localeCompare(b.studentId || b.name));
      setStudents(profiles);
    });
    return () => unsub();
  }, [id]);

  // 監聽本課程所有專案（用來判斷繳交狀況）
  useEffect(() => {
    const q = query(collection(db, 'projects'), where('courseId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [id]);

  // 對應表：projectByUidAndAssignment[uid][assignmentId] = project
  const projectIndex = useMemo(() => {
    const idx = {};
    for (const p of projects) {
      if (!p.authorUid) continue;
      if (!idx[p.authorUid]) idx[p.authorUid] = {};
      idx[p.authorUid][p.assignmentId || '__legacy__'] = p;
    }
    return idx;
  }, [projects]);

  // 過濾後的學生
  const filteredStudents = useMemo(() => {
    const kw = studentSearch.trim().toLowerCase();
    if (!kw) return students;
    return students.filter((s) =>
      (s.name || '').toLowerCase().includes(kw)
      || (s.studentId || '').toLowerCase().includes(kw)
      || (s.className || '').toLowerCase().includes(kw)
      || (s.email || '').toLowerCase().includes(kw)
    );
  }, [students, studentSearch]);

  // 各作業統計
  const assignmentStats = useMemo(() => {
    const m = {};
    for (const a of assignments) {
      let submitted = 0, late = 0;
      for (const s of students) {
        const p = projectIndex[s.uid]?.[a.id];
        if (p) { submitted += 1; if (p.isLate) late += 1; }
      }
      m[a.id] = { submitted, late, missing: students.length - submitted };
    }
    return m;
  }, [assignments, students, projectIndex]);

  if (adminLoading || loading) return <Spinner label="載入中..." />;
  if (!isAdmin) return <div className="p-8 text-center text-rose-600 font-bold">權限不足</div>;
  if (!course) return <div className="p-8 text-center text-slate-500">找不到此課程</div>;

  const openCreate = () => {
    setForm(EMPTY_ASSIGNMENT);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (a) => {
    setForm({
      title: a.title || '',
      deadline: toDatetimeLocalValue(a.deadline),
      allowLate: !!a.allowLate,
      fields: { url: !!a.fields?.url, description: !!a.fields?.description, file: !!a.fields?.file },
      driveFolderId: a.driveFolderId || '',
    });
    setEditingId(a.id);
    setOpen(true);
  };

  const close = () => { setOpen(false); setEditingId(null); setForm(EMPTY_ASSIGNMENT); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('請填寫作業標題', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        courseId: id,
        title: form.title.trim(),
        deadline: form.deadline ? Timestamp.fromDate(new Date(form.deadline)) : null,
        allowLate: form.allowLate,
        fields: form.fields,
        driveFolderId: form.fields.file ? extractFolderId(form.driveFolderId) : '',
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'assignments', editingId), payload);
        showToast('作業已更新', 'success');
      } else {
        await addDoc(collection(db, 'assignments'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast('作業已建立', 'success');
      }
      close();
    } catch (err) {
      console.error('儲存作業失敗:', err);
      showToast('儲存失敗，請稍後再試', 'error');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'assignments', deleteId));
      showToast('作業已刪除', 'success');
    } catch {
      showToast('刪除失敗', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 text-sm font-medium">
        <ArrowLeft size={16} /> 回管理後台
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <BookOpen size={24} className="text-indigo-600" /> {course.name}
            </h1>
            <p className="text-slate-500 mt-1">課程代碼：<span className="font-mono font-semibold text-slate-700">{course.code}</span></p>
          </div>
          <button onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm">
            <Plus size={18} /> 新增作業單元
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignments.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-100">尚未建立任何作業單元</div>
        ) : assignments.map(a => (
          <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden group">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{a.title}</h3>
                <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-2">
                  <CalendarClock size={15} /> {formatDeadline(a.deadline)}
                </div>
              </div>
              <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(a)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={16} /></button>
                <button onClick={() => setDeleteId(a.id)} className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.allowLate ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {a.allowLate ? '允許遲交' : '不允許遲交'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.fields?.url && <Tag>網址</Tag>}
                {a.fields?.description && <Tag>說明</Tag>}
                {a.fields?.file && <Tag>檔案</Tag>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 學生繳交狀況 */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">學生繳交狀況</h2>
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {students.length} 位學生
            </span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="搜尋學號 / 姓名 / 班級"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
        </div>

        {/* 各作業統計列 */}
        {assignments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            {assignments.map((a) => {
              const s = assignmentStats[a.id] || { submitted: 0, late: 0, missing: students.length };
              const total = students.length || 0;
              const pct = total === 0 ? 0 : Math.round((s.submitted / total) * 100);
              return (
                <div key={a.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold text-slate-700 truncate">{a.title}</span>
                    <span className="text-xs font-bold text-indigo-600">{s.submitted}/{total}</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" /> 已繳 {s.submitted}</span>
                    {s.late > 0 && <span className="flex items-center gap-1"><Clock size={11} className="text-amber-500" /> 遲交 {s.late}</span>}
                    <span className="flex items-center gap-1"><XCircle size={11} className="text-rose-400" /> 未繳 {s.missing}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 學生列表 */}
        {students.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            尚無學生加入本課程
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            找不到符合「{studentSearch}」的學生
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2 font-medium">學號</th>
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">班級</th>
                  {assignments.length === 0 ? (
                    <th className="px-3 py-2 font-medium text-center">繳交</th>
                  ) : (
                    assignments.map((a) => (
                      <th key={a.id} className="px-3 py-2 font-medium text-center whitespace-nowrap">{a.title}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.uid} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-slate-700">{s.studentId || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {s.name || '—'}
                      {!s.studentId && !s.name && <span className="text-xs text-rose-500 ml-1">未填資料</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 hidden sm:table-cell">{s.className || '—'}</td>
                    {assignments.length === 0 ? (
                      <td className="px-3 py-2.5 text-center">
                        {projectIndex[s.uid]?.['__legacy__']
                          ? <SubmissionBadge p={projectIndex[s.uid]['__legacy__']} />
                          : <span className="text-slate-300">—</span>}
                      </td>
                    ) : (
                      assignments.map((a) => {
                        const p = projectIndex[s.uid]?.[a.id];
                        return (
                          <td key={a.id} className="px-3 py-2.5 text-center">
                            {p ? <SubmissionBadge p={p} /> : <span className="text-rose-300 font-bold">✕</span>}
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open && (
        <Modal
          title={editingId ? '編輯作業單元' : '新增作業單元'}
          icon={<BookOpen size={22} className="text-indigo-600" />}
          onClose={close}
          footer={(
            <>
              <button type="button" onClick={close} disabled={saving} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200">取消</button>
              <button type="submit" form="assignmentForm" disabled={saving}
                className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-70">
                {saving ? '儲存中...' : (editingId ? '儲存修改' : '建立作業')}
              </button>
            </>
          )}
        >
          <form id="assignmentForm" onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">作業標題 <span className="text-rose-500">*</span></label>
              <input type="text" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="例如：期中專案、期末專題" className="ce-input" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">繳交截止時間</label>
              <input type="datetime-local" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="ce-input" />
              <p className="text-xs text-slate-400 mt-1">留空表示無期限。</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.allowLate} onChange={(e) => setForm((f) => ({ ...f, allowLate: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm font-medium text-slate-700">允許逾期補交（補交會被標記為遲交）</span>
            </label>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">學生需繳交的欄位</label>
              <div className="space-y-2">
                <FieldToggle label="網站連結 (URL)" checked={form.fields.url}
                  onChange={(v) => setForm((f) => ({ ...f, fields: { ...f.fields, url: v } }))} />
                <FieldToggle label="專案說明" checked={form.fields.description}
                  onChange={(v) => setForm((f) => ({ ...f, fields: { ...f.fields, description: v } }))} />
                <FieldToggle label="檔案上傳 (Google Drive)" checked={form.fields.file}
                  onChange={(v) => setForm((f) => ({ ...f, fields: { ...f.fields, file: v } }))} />
              </div>
              <p className="text-xs text-slate-400 mt-1">「題目 / 系統名稱」為必填，固定收集。</p>
            </div>

            {form.fields.file && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  繳交資料夾 (Google Drive) <span className="text-rose-500">*</span>
                </label>
                <input type="text" value={form.driveFolderId}
                  onChange={(e) => setForm((f) => ({ ...f, driveFolderId: e.target.value }))}
                  placeholder="貼上 Drive 資料夾連結或 ID" className="ce-input font-mono text-sm" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  學生的檔案會直接上傳到這個資料夾。請先在你的 Drive 建立資料夾，並
                  <b>分享為「知道連結的人 → 編輯者」</b>，否則學生無法上傳。
                  未填寫的話，學生將無法繳交檔案。
                </p>
              </div>
            )}
          </form>
          <style>{`
            .ce-input { width:100%; padding:0.625rem 1rem; border-radius:0.75rem; border:1px solid #cbd5e1; outline:none; transition:all .15s; }
            .ce-input:focus { border-color:#6366f1; box-shadow:0 0 0 2px #c7d2fe; }
          `}</style>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDelete
          title="確定要刪除這個作業單元嗎？"
          desc="刪除後，學生無法再繳交此作業；既有繳交的專案資料不會自動移除。"
          onCancel={() => setDeleteId(null)}
          onConfirm={executeDelete}
        />
      )}
    </div>
  );
}
