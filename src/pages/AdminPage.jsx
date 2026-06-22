import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, getDocs, doc, setDoc, addDoc,
  updateDoc, deleteDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import {
  Shield, Lock, Plus, Edit, Trash2, BookOpen, UserCog, Crown,
  Check, X, Mail, AlertCircle, Send, CalendarClock
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { toDatetimeLocalValue, formatDeadline } from '../lib/deadline';
import { extractFolderId } from '../lib/drive';

const EMPTY_COURSE = {
  name: '', code: '', deadline: '', allowLate: false,
  fields: { url: true, description: true, file: false },
  driveFolderId: '',
};

export default function AdminPage() {
  const { isAdmin, isSuper, adminLoading } = useAuth();

  if (adminLoading) return <Spinner label="檢查權限中..." />;
  if (!isAdmin) return <BootstrapClaim />;

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-2">
        <Shield size={24} className="text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-800">管理後台</h1>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isSuper ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
          {isSuper ? '超級管理者' : '一般管理者'}
        </span>
      </div>

      <CourseManager />
      <AdminManager />
    </div>
  );
}

// ==========================================
// 首次綁定：輸入密碼成為超級管理者
// ==========================================
function BootstrapClaim() {
  const { user } = useAuth();
  const showToast = useToast();
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClaim = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1) 先寫入 adminClaims（Security Rules 會在伺服器端比對密碼，密碼不外洩）
      await setDoc(doc(db, 'adminClaims', user.uid), {
        secret: pwd,
        createdAt: serverTimestamp(),
      });
      // 2) 建立超級管理者身分
      await setDoc(doc(db, 'admins', user.uid), {
        role: 'super',
        email: user.email || '',
        createdAt: serverTimestamp(),
      });
      showToast('已成為超級管理者！', 'success');
    } catch (err) {
      console.error('綁定失敗:', err);
      showToast('密碼錯誤，或尚未於後台設定密碼文件', 'error');
    } finally {
      setLoading(false);
      setPwd('');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8 mt-6">
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Crown size={28} />
        </div>
        <h1 className="text-xl font-bold text-slate-800">成為管理者</h1>
        <p className="text-slate-500 text-sm mt-1">輸入管理密碼即可將目前的 Google 帳號綁定為超級管理者。</p>
      </div>
      <form onSubmit={handleClaim} className="space-y-4">
        <label className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
          <Lock size={15} /> 管理密碼
        </label>
        <input type="password" required autoFocus value={pwd} onChange={(e) => setPwd(e.target.value)}
          placeholder="請輸入密碼"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
        <button type="submit" disabled={loading}
          className="w-full px-5 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-70">
          {loading ? '驗證中...' : '確認綁定'}
        </button>
      </form>
    </div>
  );
}

// ==========================================
// 課程管理（super / admin 皆可）
// ==========================================
function CourseManager() {
  const showToast = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_COURSE);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'courses'), (snap) => {
      setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_COURSE, code: genCode() });
    setEditingId(null);
    setOpen(true);
  };
  const openEdit = (c) => {
    setForm({
      name: c.name || '',
      code: c.code || '',
      deadline: toDatetimeLocalValue(c.deadline),
      allowLate: !!c.allowLate,
      fields: { url: !!c.fields?.url, description: !!c.fields?.description, file: !!c.fields?.file },
      driveFolderId: c.driveFolderId || '',
    });
    setEditingId(c.id);
    setOpen(true);
  };
  const close = () => { setOpen(false); setEditingId(null); setForm(EMPTY_COURSE); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      showToast('請填寫課程名稱與代碼', 'error');
      return;
    }
    setSaving(true);
    try {
      // 檢查代碼是否重複（排除自己）
      const dupSnap = await getDocs(query(collection(db, 'courses'), where('code', '==', form.code.trim())));
      const dup = dupSnap.docs.find((d) => d.id !== editingId);
      if (dup) {
        showToast('這個課程代碼已被使用，請換一個', 'error');
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        deadline: form.deadline ? Timestamp.fromDate(new Date(form.deadline)) : null,
        allowLate: form.allowLate,
        fields: form.fields,
        driveFolderId: form.fields.file ? extractFolderId(form.driveFolderId) : '',
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'courses', editingId), payload);
        showToast('課程已更新', 'success');
      } else {
        await addDoc(collection(db, 'courses'), {
          ...payload,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
        });
        showToast('課程已建立', 'success');
      }
      close();
    } catch (err) {
      console.error('儲存課程失敗:', err);
      showToast('儲存失敗，請稍後再試', 'error');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'courses', deleteId));
      showToast('課程已刪除', 'success');
    } catch {
      showToast('刪除失敗', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <BookOpen size={20} className="text-indigo-600" /> 課程管理
        </h2>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-sm">
          <Plus size={18} /> 新增課程
        </button>
      </div>

      {loading ? (
        <Spinner label="載入課程中..." />
      ) : courses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 text-slate-500">尚未建立任何課程</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{c.name}</h3>
                  <div className="text-sm text-slate-400 mt-0.5">代碼：<span className="font-mono font-semibold text-indigo-600">{c.code}</span></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(c)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200"><Edit size={16} /></button>
                  <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1 text-slate-500"><CalendarClock size={13} /> {formatDeadline(c.deadline)}</span>
                <span className={`px-2 py-0.5 rounded-full ${c.allowLate ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {c.allowLate ? '可補交' : '不可補交'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {c.fields?.url && <Tag>網址</Tag>}
                {c.fields?.description && <Tag>說明</Tag>}
                {c.fields?.file && <Tag>檔案</Tag>}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal
          title={editingId ? '編輯課程' : '新增課程'}
          icon={<BookOpen size={22} className="text-indigo-600" />}
          onClose={close}
          footer={(
            <>
              <button type="button" onClick={close} disabled={saving} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200">取消</button>
              <button type="submit" form="courseForm" disabled={saving}
                className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-70">
                {saving ? '儲存中...' : (editingId ? '儲存修改' : '建立課程')}
              </button>
            </>
          )}
        >
          <form id="courseForm" onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">課程名稱 <span className="text-rose-500">*</span></label>
              <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="例如：113-2 人工智慧導論" className="ce-input" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">課程代碼 <span className="text-rose-500">*</span></label>
              <div className="flex gap-2">
                <input type="text" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="學生用此代碼加入" className="ce-input font-mono" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, code: genCode() }))}
                  className="px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium whitespace-nowrap">隨機產生</button>
              </div>
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
          title="確定要刪除這個課程嗎？"
          desc="課程刪除後，學生將無法再於此課程繳交；既有專案資料不會自動移除。"
          onCancel={() => setDeleteId(null)}
          onConfirm={executeDelete}
        />
      )}
    </section>
  );
}

// ==========================================
// 管理者管理
// ==========================================
function AdminManager() {
  const { user, isSuper } = useAuth();
  const showToast = useToast();
  const [admins, setAdmins] = useState([]);
  const [requests, setRequests] = useState([]);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // super 才讀取完整管理者名單
  useEffect(() => {
    if (!isSuper) return;
    const unsub = onSnapshot(collection(db, 'admins'), (snap) => {
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (e) => console.error(e));
    return () => unsub();
  }, [isSuper]);

  // 待審核的「升為 super」申請
  useEffect(() => {
    const q = query(collection(db, 'adminRequests'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (e) => console.error(e));
    return () => unsub();
  }, []);

  const addAdmin = async (e) => {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) return;
    setAdding(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', target)));
      if (snap.empty) {
        showToast('查無此使用者，請對方先用 Google 登入過一次', 'error');
        return;
      }
      const u = snap.docs[0];
      await setDoc(doc(db, 'admins', u.id), {
        role: 'admin',
        email: u.data().email || target,
        addedBy: user.uid,
        createdAt: serverTimestamp(),
      });
      showToast(`已新增管理者：${target}`, 'success');
      setEmail('');
    } catch (err) {
      console.error('新增管理者失敗:', err);
      showToast('新增失敗，請確認你具有超級管理者權限', 'error');
    } finally {
      setAdding(false);
    }
  };

  const removeAdmin = async (uid) => {
    try {
      await deleteDoc(doc(db, 'admins', uid));
      showToast('已移除管理者', 'success');
    } catch {
      showToast('移除失敗', 'error');
    }
  };

  const requestSuper = async () => {
    setRequesting(true);
    try {
      await addDoc(collection(db, 'adminRequests'), {
        fromUid: user.uid,
        fromEmail: user.email || '',
        type: 'promote_super',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      showToast('已送出升級申請，等待超級管理者同意', 'success');
    } catch (err) {
      console.error('送出申請失敗:', err);
      showToast('送出失敗，請稍後再試', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const resolveRequest = async (req, approve) => {
    try {
      if (approve) {
        // 同意：將申請人「加入」super（既有 super 全部保留）
        await setDoc(doc(db, 'admins', req.fromUid), {
          role: 'super', email: req.fromEmail || '', promotedBy: user.uid, promotedAt: serverTimestamp(),
        }, { merge: true });
      }
      await updateDoc(doc(db, 'adminRequests', req.id), {
        status: approve ? 'approved' : 'rejected',
        resolvedBy: user.uid,
        resolvedAt: serverTimestamp(),
      });
      showToast(approve ? '已同意並升級為超級管理者' : '已拒絕申請', 'success');
    } catch (err) {
      console.error('處理申請失敗:', err);
      showToast('處理失敗', 'error');
    }
  };

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
        <UserCog size={20} className="text-indigo-600" /> 管理者管理
      </h2>

      {!isSuper ? (
        // 一般管理者：只能申請升級
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-sm text-slate-600 mb-3">
            你是一般管理者，可管理課程。若需要管理「管理者名單」的權限，可向超級管理者申請升級。
          </p>
          <button onClick={requestSuper} disabled={requesting}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-70">
            <Send size={16} /> {requesting ? '送出中...' : '申請成為超級管理者'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 待審核申請 */}
          {requests.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Crown size={18} className="text-amber-500" /> 升級申請（{requests.length}）
              </h3>
              <div className="space-y-2">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 bg-amber-50 rounded-xl px-4 py-2.5">
                    <span className="text-sm text-slate-700 truncate">{r.fromEmail} 申請成為超級管理者</span>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => resolveRequest(r, true)} className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg" title="同意"><Check size={16} /></button>
                      <button onClick={() => resolveRequest(r, false)} className="p-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg" title="拒絕"><X size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 新增一般管理者 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-bold text-slate-800 mb-3">新增一般管理者</h3>
            <form onSubmit={addAdmin} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="輸入對方的 Google email（需先登入過一次）"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all" />
              </div>
              <button type="submit" disabled={adding || !email.trim()}
                className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 flex items-center justify-center gap-2">
                <Plus size={16} /> {adding ? '新增中...' : '新增'}
              </button>
            </form>
          </div>

          {/* 管理者名單 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-bold text-slate-800 mb-3">目前管理者（{admins.length}）</h3>
            <div className="space-y-2">
              {admins.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {a.role === 'super'
                      ? <Crown size={16} className="text-amber-500 flex-shrink-0" />
                      : <Shield size={16} className="text-slate-400 flex-shrink-0" />}
                    <span className="text-sm text-slate-700 truncate">{a.email || a.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${a.role === 'super' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                      {a.role === 'super' ? '超級' : '一般'}
                    </span>
                  </div>
                  {a.id !== user.uid && (
                    <button onClick={() => removeAdmin(a.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex-shrink-0" title="移除">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">提示：移除自己或最後一位超級管理者前請三思；必要時可於 Firebase 後台直接調整。</p>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- 小元件 ----------
function Tag({ children }) {
  return <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{children}</span>;
}

function FieldToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

function ConfirmDelete({ title, desc, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in text-center p-6">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-500 mb-6 text-sm">{desc}</p>
        <div className="flex justify-center gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 flex-1">取消</button>
          <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl font-medium bg-rose-600 hover:bg-rose-700 text-white flex-1">確認刪除</button>
        </div>
      </div>
    </div>
  );
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
