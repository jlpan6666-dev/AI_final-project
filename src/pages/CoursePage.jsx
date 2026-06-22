import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  doc, getDoc, collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import {
  ArrowLeft, Plus, Edit, Trash2, Heart, ExternalLink, Users, Monitor,
  CalendarClock, Clock, AlertCircle, FileText, Link as LinkIcon, X
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import { formatDeadline, deadlineStatus } from '../lib/deadline';

const EMPTY_FORM = { title: '', description: '', url: '', fileUrl: '' };

export default function CoursePage() {
  const { id } = useParams();
  const { user, profile, isAdmin } = useAuth();
  const showToast = useToast();

  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projLoading, setProjLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // 載入課程
  useEffect(() => {
    let active = true;
    (async () => {
      const snap = await getDoc(doc(db, 'courses', id));
      if (active) {
        setCourse(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setCourseLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  // 是否已註冊
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'enrollments', `${id}_${user.uid}`), (snap) => {
      setEnrolled(snap.exists());
    });
    return () => unsub();
  }, [id, user]);

  // 監聽本課程所有專案
  useEffect(() => {
    const q = query(collection(db, 'projects'), where('courseId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setProjLoading(false);
    }, () => setProjLoading(false));
    return () => unsub();
  }, [id]);

  const status = course ? deadlineStatus(course.deadline, course.allowLate) : null;
  const myProject = useMemo(
    () => projects.find((p) => p.authorUid === user?.uid) || null,
    [projects, user]
  );

  // 依愛心排序
  const ranked = useMemo(() => {
    return [...projects].sort((a, b) => {
      const la = a.likedBy?.length || 0;
      const lb = b.likedBy?.length || 0;
      if (la !== lb) return lb - la;
      return (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0);
    });
  }, [projects]);

  const fields = course?.fields || { url: true, description: true, file: false };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setIsModalOpen(true);
  };
  const openEdit = (p) => {
    setForm({ title: p.title || '', description: p.description || '', url: p.url || '', fileUrl: p.fileUrl || '' });
    setEditingId(p.id);
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!status.canSubmit && !editingId) {
      showToast('本課程已截止且不開放補交', 'error');
      return;
    }
    if (fields.url && form.url && !/^https?:\/\//.test(form.url)) {
      showToast('網址請包含 http:// 或 https://', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        courseId: id,
        title: form.title.trim(),
        description: fields.description ? form.description.trim() : '',
        url: fields.url ? form.url.trim() : '',
        fileUrl: fields.file ? form.fileUrl.trim() : '',
        // 提交者快照
        studentId: profile?.studentId || '',
        name: profile?.name || user?.displayName || '',
        className: profile?.className || '',
      };

      if (editingId) {
        await updateDoc(doc(db, 'projects', editingId), { ...payload, updatedAt: serverTimestamp() });
        showToast('專案更新成功！', 'success');
      } else {
        await addDoc(collection(db, 'projects'), {
          ...payload,
          authorUid: user.uid,
          likedBy: [],
          isLate: status.isLate,
          submittedAt: serverTimestamp(),
        });
        showToast(status.isLate ? '已補交專案（標記為遲交）' : '專案繳交成功！', 'success');
      }
      closeModal();
    } catch (err) {
      console.error('儲存專案失敗:', err);
      showToast('儲存失敗，請稍後再試', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'projects', deleteId));
      showToast('專案已刪除', 'success');
    } catch (err) {
      console.error('刪除失敗:', err);
      showToast('刪除失敗', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const toggleLike = async (project) => {
    const liked = project.likedBy?.includes(user.uid);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (err) {
      console.error('按讚失敗:', err);
      showToast('操作失敗，請確認連線', 'error');
    }
  };

  const joinCourse = async () => {
    try {
      await setDoc(doc(db, 'enrollments', `${id}_${user.uid}`), {
        courseId: id, uid: user.uid, joinedAt: serverTimestamp(),
      });
      showToast('已加入課程', 'success');
    } catch {
      showToast('加入失敗', 'error');
    }
  };

  if (courseLoading) return <Spinner label="載入課程中..." />;
  if (!course) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
        <AlertCircle size={44} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-700 mb-2">找不到這個課程</h3>
        <Link to="/" className="text-indigo-600 hover:underline text-sm">← 回首頁</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 text-sm font-medium">
        <ArrowLeft size={16} /> 回我的課程
      </Link>

      {/* 課程標頭 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{course.name}</h1>
            <div className="text-sm text-slate-400 mt-1">課程代碼：{course.code}</div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="flex items-center gap-2 text-sm">
              <CalendarClock size={16} className={status.color} />
              <span className={status.color}>{formatDeadline(course.deadline)}</span>
            </div>
            <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${status.badgeClass}`}>
              <Clock size={12} /> {status.label}
            </div>
          </div>
        </div>

        {/* 繳交區 */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          {!enrolled ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">你尚未加入本課程，加入後才能繳交專案。</p>
              <button onClick={joinCourse} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">加入課程</button>
            </div>
          ) : myProject ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                你已繳交：<span className="font-semibold text-slate-800">{myProject.title}</span>
                {myProject.isLate && <span className="ml-2 text-xs text-amber-600 font-medium">（遲交）</span>}
              </div>
              <button
                onClick={() => openEdit(myProject)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
              >
                <Edit size={16} /> 編輯我的專案
              </button>
            </div>
          ) : status.canSubmit ? (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              <Plus size={18} /> 繳交專案
            </button>
          ) : (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
              本課程已截止且不開放補交，無法繳交新專案。
            </div>
          )}
        </div>
      </div>

      {/* 專案排行榜 */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">專案排行榜（依愛心）</h2>
        {projLoading ? (
          <Spinner label="載入專案中..." />
        ) : ranked.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
            <Monitor size={44} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">目前還沒有專案，成為第一個繳交的人吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ranked.map((p, index) => (
              <ProjectCard
                key={p.id}
                project={p}
                rank={index + 1}
                canEdit={isAdmin || p.authorUid === user?.uid}
                likedByMe={p.likedBy?.includes(user?.uid)}
                onLike={() => toggleLike(p)}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeleteId(p.id)}
                showFile={fields.file}
              />
            ))}
          </div>
        )}
      </div>

      {/* 繳交 / 編輯 Modal */}
      {isModalOpen && (
        <Modal
          title={editingId ? '編輯專案' : '繳交專案'}
          icon={editingId ? <Edit size={22} className="text-indigo-600" /> : <Monitor size={22} className="text-indigo-600" />}
          onClose={closeModal}
          footer={(
            <>
              <button type="button" onClick={closeModal} disabled={submitting}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors">取消</button>
              <button type="submit" form="projectForm" disabled={submitting}
                className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-70 flex items-center gap-2">
                {submitting
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> 儲存中...</>
                  : (editingId ? '儲存修改' : '確認繳交')}
              </button>
            </>
          )}
        >
          <form id="projectForm" onSubmit={handleSubmit} className="space-y-4">
            {status.isLate && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-2.5">
                ⚠️ 已超過截止時間，此次繳交將被標記為「遲交」。
              </div>
            )}

            <Field label="題目 / 系統名稱" required>
              <input type="text" name="title" required value={form.title} onChange={handleChange}
                placeholder="例如：智慧校園導覽機器人" className="field-input" />
            </Field>

            {fields.description && (
              <Field label="專案說明" required>
                <textarea name="description" rows="4" required value={form.description} onChange={handleChange}
                  placeholder="簡短描述你們的 AI 專案提供什麼功能..." className="field-input resize-none"></textarea>
              </Field>
            )}

            {fields.url && (
              <Field label="網站連結 (URL)" required icon={<LinkIcon size={15} />}>
                <input type="url" name="url" required value={form.url} onChange={handleChange}
                  placeholder="https://your-ai-website.com" className="field-input" />
              </Field>
            )}

            {fields.file && (
              <Field label="檔案連結 (Google Drive)" icon={<FileText size={15} />}>
                <input type="url" name="fileUrl" value={form.fileUrl} onChange={handleChange}
                  placeholder="貼上 Google Drive 分享連結" className="field-input" />
                <p className="text-xs text-slate-400 mt-1">
                  目前為連結貼上模式；直接從瀏覽器上傳到 Drive 的功能將於下一階段開放。
                </p>
              </Field>
            )}
          </form>
          <style>{`
            .field-input { width:100%; padding:0.625rem 1rem; border-radius:0.75rem; border:1px solid #cbd5e1; outline:none; transition:all .15s; }
            .field-input:focus { border-color:#6366f1; box-shadow:0 0 0 2px #c7d2fe; }
          `}</style>
        </Modal>
      )}

      {/* 刪除確認 */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteId(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in text-center p-6">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">確定要刪除這個專案嗎？</h2>
            <p className="text-slate-500 mb-6 text-sm">此動作無法復原，相關愛心紀錄也會一併刪除。</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteId(null)}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 flex-1">取消</button>
              <button onClick={executeDelete}
                className="px-5 py-2.5 rounded-xl font-medium bg-rose-600 hover:bg-rose-700 text-white flex-1">確認刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, icon, required, children }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
        {icon} {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function ProjectCard({ project, rank, canEdit, likedByMe, onLike, onEdit, onDelete, showFile }) {
  const likesCount = project.likedBy?.length || 0;
  let domain = '';
  try { if (project.url) domain = new URL(project.url).hostname; } catch { /* ignore */ }

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col border border-slate-100 relative group">
      {rank <= 3 && (
        <div className="absolute top-0 left-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white w-12 h-12 flex items-center justify-center font-bold text-lg rounded-br-2xl shadow-md z-10">
          #{rank}
        </div>
      )}

      {canEdit && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} title="編輯"
            className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 rounded-lg shadow-sm transition-all">
            <Edit size={16} />
          </button>
          <button onClick={onDelete} title="刪除"
            className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 rounded-lg shadow-sm transition-all">
            <Trash2 size={16} />
          </button>
        </div>
      )}

      <div className="p-4 sm:p-6 flex-grow flex flex-col">
        <div className={`mb-3 ${canEdit ? 'pr-14' : ''} ${rank <= 3 ? 'ml-10 sm:ml-12' : ''}`}>
          <div className="flex items-center gap-2">
            {domain && (
              <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt=""
                className="w-7 h-7 rounded-md bg-white border border-slate-200 p-0.5 flex-shrink-0 shadow-sm"
                onError={(e) => { e.target.style.display = 'none'; }} />
            )}
            <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1" title={project.title}>
              {project.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-indigo-500 font-medium mt-2">
            <Users size={15} />
            <span className="line-clamp-1">{project.name}{project.className ? ` · ${project.className}` : ''}</span>
          </div>
        </div>

        {project.description && (
          <p className="text-slate-600 text-sm mb-4 line-clamp-3 flex-grow" title={project.description}>
            {project.description}
          </p>
        )}

        {project.isLate && (
          <span className="inline-block text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full w-max mb-2">遲交</span>
        )}
      </div>

      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between mt-auto gap-2">
        <button onClick={onLike}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
            likedByMe ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
              : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-rose-500 border border-slate-200 shadow-sm'}`}>
          <Heart size={18} className={likedByMe ? 'fill-rose-500' : ''} />
          <span className="font-bold">{likesCount}</span>
        </button>

        <div className="flex items-center gap-2">
          {showFile && project.fileUrl && (
            <a href={project.fileUrl} target="_blank" rel="noopener noreferrer" title="檔案"
              className="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-2 rounded-full transition-colors">
              <FileText size={15} />
            </a>
          )}
          {project.url && (
            <a href={project.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors">
              <span>前往</span><ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
