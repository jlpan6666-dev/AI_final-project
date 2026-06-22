import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  doc, getDoc, collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import {
  ArrowLeft, Plus, Edit, Trash2, Heart, ExternalLink, Users, Monitor,
  CalendarClock, Clock, AlertCircle, FileText, Link as LinkIcon, Check, BookOpen
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import { formatDeadline, deadlineStatus } from '../lib/deadline';
import { uploadFileToDrive } from '../lib/drive';

const EMPTY_FORM = { title: '', description: '', url: '', fileUrl: '', fileName: '' };

export default function CoursePage() {
  const { id } = useParams();
  const { user, profile, isAdmin } = useAuth();
  const showToast = useToast();

  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingAssign, setLoadingAssign] = useState(true);
  const [loadingProj, setLoadingProj] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // 1. Load Course
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

  // 2. Check Enrollment
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'enrollments', `${id}_${user.uid}`), (snap) => {
      setEnrolled(snap.exists());
    });
    return () => unsub();
  }, [id, user]);

  // 3. Load Assignments
  useEffect(() => {
    const q = query(collection(db, 'assignments'), where('courseId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()));
      setLoadingAssign(false);
    }, () => setLoadingAssign(false));
    return () => unsub();
  }, [id]);

  // 4. Load Projects
  useEffect(() => {
    const q = query(collection(db, 'projects'), where('courseId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingProj(false);
    }, () => setLoadingProj(false));
    return () => unsub();
  }, [id]);

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

  const openCreate = (assign) => {
    setActiveAssignment(assign);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (p, assign) => {
    setActiveAssignment(assign);
    setForm({ title: p.title || '', description: p.description || '', url: p.url || '', fileUrl: p.fileUrl || '', fileName: p.fileName || '' });
    setEditingId(p.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setActiveAssignment(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const triggerFilePick = () => {
    if (!activeAssignment?.driveFolderId) {
      showToast('老師尚未設定繳交資料夾，請聯絡老師', 'error');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!activeAssignment?.driveFolderId) {
      showToast('老師尚未設定繳交資料夾，請聯絡老師', 'error');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const res = await uploadFileToDrive(file, activeAssignment.driveFolderId, setUploadProgress);
      setForm((f) => ({ ...f, fileUrl: res.url, fileName: res.name }));
      showToast(`已上傳：${res.name}`, 'success');
    } catch (err) {
      console.error('Drive 上傳失敗:', err);
      showToast('上傳失敗：請確認已授權 Google，且老師的繳交資料夾已設為可編輯', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeAssignment) return;
    const status = deadlineStatus(activeAssignment.deadline, activeAssignment.allowLate);
    
    if (!status.canSubmit && !editingId) {
      showToast('本作業已截止且不開放補交', 'error');
      return;
    }
    const fields = activeAssignment.fields || {};
    if (fields.url && form.url && !/^https?:\/\//.test(form.url)) {
      showToast('網址請包含 http:// 或 https://', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        courseId: id,
        assignmentId: activeAssignment.id,
        title: form.title.trim(),
        description: fields.description ? form.description.trim() : '',
        url: fields.url ? form.url.trim() : '',
        fileUrl: fields.file ? form.fileUrl.trim() : '',
        fileName: fields.file ? form.fileName.trim() : '',
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

  // 處理沒有 assignmentId 的舊專案
  const legacyProjects = projects.filter(p => !p.assignmentId).sort((a, b) => {
    const la = a.likedBy?.length || 0;
    const lb = b.likedBy?.length || 0;
    if (la !== lb) return lb - la;
    return (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0);
  });

  return (
    <div className="space-y-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 text-sm font-medium">
        <ArrowLeft size={16} /> 回我的課程
      </Link>

      {/* 課程標頭 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <BookOpen size={28} className="text-indigo-600" />
              {course.name}
            </h1>
            <div className="text-sm text-slate-500 mt-2">課程代碼：<span className="font-mono font-semibold text-slate-700">{course.code}</span></div>
          </div>
          {!enrolled && (
            <button onClick={joinCourse} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors">
              加入課程
            </button>
          )}
        </div>
      </div>

      {/* 作業單元列表 */}
      {loadingAssign || loadingProj ? (
        <Spinner label="載入作業中..." />
      ) : assignments.length === 0 && legacyProjects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
          <Monitor size={44} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">目前還沒有任何作業單元。</p>
        </div>
      ) : (
        <div className="space-y-12">
          {assignments.map(assign => {
            const status = deadlineStatus(assign.deadline, assign.allowLate);
            const assignProjects = projects.filter(p => p.assignmentId === assign.id);
            const myProject = assignProjects.find(p => p.authorUid === user?.uid);
            
            const ranked = [...assignProjects].sort((a, b) => {
              const la = a.likedBy?.length || 0;
              const lb = b.likedBy?.length || 0;
              if (la !== lb) return lb - la;
              return (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0);
            });

            return (
              <div key={assign.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                {/* 作業標頭 & 繳交狀態區 */}
                <div className="bg-slate-50 p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{assign.title}</h2>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <CalendarClock size={16} className={status.color} />
                        <span className={status.color}>{formatDeadline(assign.deadline)}</span>
                      </div>
                      <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${status.badgeClass}`}>
                        <Clock size={12} /> {status.label}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    {!enrolled ? (
                      <div className="text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
                        加入課程後才能繳交
                      </div>
                    ) : myProject ? (
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-slate-600 text-right">
                          已繳交：<span className="font-semibold text-slate-800">{myProject.title}</span>
                          {myProject.isLate && <span className="block text-xs text-amber-600 mt-0.5">（遲交）</span>}
                        </div>
                        <button onClick={() => openEdit(myProject, assign)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm font-medium transition-colors">
                          <Edit size={16} /> 編輯
                        </button>
                      </div>
                    ) : status.canSubmit ? (
                      <button onClick={() => openCreate(assign)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors">
                        <Plus size={18} /> 繳交專案
                      </button>
                    ) : (
                      <div className="text-sm text-rose-700 bg-rose-50 px-4 py-2 rounded-lg border border-rose-200">
                        已截止，無法繳交
                      </div>
                    )}
                  </div>
                </div>

                {/* 作業排行榜 */}
                <div className="p-6">
                  {ranked.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      目前還沒有人繳交，成為第一個吧！
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {ranked.map((p, index) => (
                        <ProjectCard
                          key={p.id} project={p} rank={index + 1}
                          canEdit={isAdmin || p.authorUid === user?.uid}
                          likedByMe={p.likedBy?.includes(user?.uid)}
                          onLike={() => toggleLike(p)}
                          onEdit={() => openEdit(p, assign)}
                          onDelete={() => setDeleteId(p.id)}
                          showFile={assign.fields?.file}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 舊資料 / 未分類的專案 (相容性) */}
          {legacyProjects.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">其他專案 (未分類)</h2>
                <p className="text-sm text-slate-500 mt-1">這些是系統升級前繳交的專案。</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {legacyProjects.map((p, index) => (
                    <ProjectCard
                      key={p.id} project={p} rank={index + 1}
                      canEdit={isAdmin || p.authorUid === user?.uid}
                      likedByMe={p.likedBy?.includes(user?.uid)}
                      onLike={() => toggleLike(p)}
                      onEdit={() => openEdit(p, course)} // Fallback to course fields
                      onDelete={() => setDeleteId(p.id)}
                      showFile={true} // Just show it if it exists
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 繳交 / 編輯 Modal */}
      {isModalOpen && activeAssignment && (
        <Modal
          title={editingId ? '編輯專案' : '繳交專案'}
          icon={<Monitor size={22} className="text-indigo-600" />}
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
            {deadlineStatus(activeAssignment.deadline, activeAssignment.allowLate).isLate && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-2.5">
                ⚠️ 已超過截止時間，此次繳交將被標記為「遲交」。
              </div>
            )}

            <Field label="題目 / 系統名稱" required>
              <input type="text" name="title" required value={form.title} onChange={handleChange}
                placeholder="例如：智慧校園導覽機器人" className="field-input" />
            </Field>

            {activeAssignment.fields?.description && (
              <Field label="專案說明" required>
                <textarea name="description" rows="4" required value={form.description} onChange={handleChange}
                  placeholder="簡短描述你們的 AI 專案提供什麼功能..." className="field-input resize-none"></textarea>
              </Field>
            )}

            {activeAssignment.fields?.url && (
              <Field label="網站連結 (URL)" required icon={<LinkIcon size={15} />}>
                <input type="url" name="url" required value={form.url} onChange={handleChange}
                  placeholder="https://your-ai-website.com" className="field-input" />
              </Field>
            )}

            {activeAssignment.fields?.file && (
              <Field label="專案檔案 (Google Drive)" icon={<FileText size={15} />}>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

                {!activeAssignment.driveFolderId ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-2.5">
                    老師尚未設定繳交資料夾，暫時無法上傳檔案，請聯絡老師。
                  </div>
                ) : uploading ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                        上傳中...
                      </span>
                      <span className="font-semibold text-indigo-600">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                ) : form.fileUrl ? (
                  <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                    <a href={form.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-emerald-800 font-medium truncate hover:underline">
                      <Check size={16} className="flex-shrink-0" />
                      <span className="truncate">{form.fileName || '已上傳檔案'}</span>
                    </a>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button type="button" onClick={triggerFilePick}
                        className="text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 px-3 py-1 rounded-lg text-xs font-semibold">
                        重新選擇
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onClick={triggerFilePick}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer transition-colors group">
                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-indigo-100 rounded-full flex items-center justify-center mb-3 transition-colors">
                      <UploadCloud size={24} className="text-slate-400 group-hover:text-indigo-600" />
                    </div>
                    <p className="text-sm font-medium">點擊選擇檔案 (上傳至課程資料夾)</p>
                    <p className="text-xs text-slate-400 mt-1">自動同步至 Google Drive</p>
                  </div>
                )}
              </Field>
            )}
          </form>
          <style>{`
            .field-input { width:100%; padding:0.625rem 1rem; border-radius:0.75rem; border:1px solid #cbd5e1; outline:none; transition:all .15s; background:#fff; }
            .field-input:focus { border-color:#6366f1; box-shadow:0 0 0 2px #c7d2fe; }
          `}</style>
        </Modal>
      )}

      {deleteId && (
        <Modal
          title="確定要刪除專案嗎？"
          icon={<AlertCircle size={22} className="text-rose-600" />}
          onClose={() => setDeleteId(null)}
          footer={(
            <>
              <button onClick={() => setDeleteId(null)} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200">取消</button>
              <button onClick={executeDelete} className="px-5 py-2.5 rounded-xl font-medium bg-rose-600 hover:bg-rose-700 text-white">確認刪除</button>
            </>
          )}>
          <p className="text-slate-600 text-sm leading-relaxed">專案刪除後將無法復原。確定要繼續嗎？</p>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, icon, required, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
        {icon} {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function ProjectCard({ project, rank, canEdit, likedByMe, onLike, onEdit, onDelete, showFile }) {
  const likes = project.likedBy?.length || 0;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col h-full hover:shadow-md transition-shadow relative group">
      {rank <= 3 && (
        <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md z-10
          ${rank === 1 ? 'bg-amber-400' : rank === 2 ? 'bg-slate-300' : 'bg-amber-700'}`}>
          {rank}
        </div>
      )}
      
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-lg font-bold text-slate-800 line-clamp-2 leading-tight">{project.title}</h3>
          <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 bg-white/80 rounded-lg">
            {canEdit && (
              <>
                <button onClick={onEdit} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"><Edit size={16} /></button>
                <button onClick={onDelete} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md"><Trash2 size={16} /></button>
              </>
            )}
          </div>
        </div>
        
        {project.description && (
          <p className="text-sm text-slate-500 line-clamp-3 mb-4 leading-relaxed">{project.description}</p>
        )}
        
        <div className="flex flex-col gap-2 mt-auto">
          {project.url && (
            <a href={project.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline font-medium break-all">
              <ExternalLink size={14} className="flex-shrink-0" />
              <span className="line-clamp-1">{project.url}</span>
            </a>
          )}
          {showFile && project.fileUrl && (
            <a href={project.fileUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-emerald-600 hover:underline font-medium break-all">
              <FileText size={14} className="flex-shrink-0" />
              <span className="line-clamp-1">{project.fileName || '查看檔案'}</span>
            </a>
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
            {project.name?.[0] || '?'}
          </div>
          <div className="text-sm">
            <div className="font-semibold text-slate-700">{project.name || '匿名'}</div>
            {project.className && <div className="text-xs text-slate-400">{project.className}</div>}
          </div>
        </div>

        <button
          onClick={onLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border
            ${likedByMe 
              ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' 
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
        >
          <Heart size={16} className={likedByMe ? 'fill-current' : ''} />
          {likes > 0 && <span>{likes}</span>}
        </button>
      </div>
    </div>
  );
}
