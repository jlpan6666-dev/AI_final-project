import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserCog, LogOut, IdCard, User, GraduationCap } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthProvider';
import { useToast } from '../context/ToastProvider';
import { startYearFromGrade, gradeFromStartYear, currentAcademicYear } from '../lib/grade';

export default function SetupProfilePage() {
  const { user, profile, logout } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ studentId: '', name: '', className: '', grade: '1' });
  const [saving, setSaving] = useState(false);

  // 載入既有資料（編輯情境）
  useEffect(() => {
    if (profile) {
      setForm({
        studentId: profile.studentId || '',
        name: profile.name || user?.displayName || '',
        className: profile.className || '',
        grade: String(profile.startAcademicYear ? gradeFromStartYear(profile.startAcademicYear) : 1),
      });
    } else if (user?.displayName) {
      setForm((f) => ({ ...f, name: user.displayName }));
    }
  }, [profile, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const grade = parseInt(form.grade, 10);
    if (!grade || grade < 1) {
      showToast('請選擇有效的年級', 'error');
      return;
    }
    setSaving(true);
    try {
      // 存「入學學年度」而非固定年級，之後每年 9/1 自動升級
      const startAcademicYear = startYearFromGrade(grade);
      await setDoc(
        doc(db, 'users', user.uid),
        {
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          studentId: form.studentId.trim(),
          name: form.name.trim(),
          className: form.className.trim(),
          startAcademicYear,
          updatedAt: serverTimestamp(),
          ...(profile ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );
      showToast('基本資料已儲存！', 'success');
      navigate('/');
    } catch (err) {
      console.error('儲存個人資料失敗:', err);
      showToast('儲存失敗，請稍後再試', 'error');
    } finally {
      setSaving(false);
    }
  };

  const thisYear = currentAcademicYear();
  const isEditing = !!profile;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCog size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">{isEditing ? '編輯基本資料' : '填寫基本資料'}</h1>
          <p className="text-slate-500 text-sm mt-1">完成後即可加入課程並繳交專題</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="學號" icon={<IdCard size={16} />} required>
            <input
              type="text" name="studentId" required value={form.studentId} onChange={handleChange}
              placeholder="例如：411234567"
              className="input"
            />
          </Field>

          <Field label="姓名" icon={<User size={16} />} required>
            <input
              type="text" name="name" required value={form.name} onChange={handleChange}
              placeholder="王大明"
              className="input"
            />
          </Field>

          <Field label="班級" icon={<GraduationCap size={16} />} required>
            <input
              type="text" name="className" required value={form.className} onChange={handleChange}
              placeholder="例如：資管系四技一甲"
              className="input"
            />
          </Field>

          <Field label="目前年級" icon={<GraduationCap size={16} />} required>
            <select name="grade" value={form.grade} onChange={handleChange} className="input">
              {[1, 2, 3, 4, 5, 6, 7].map((g) => (
                <option key={g} value={g}>{g} 年級</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              系統會於每年 9/1 自動升級（依此設定推算入學學年度 {thisYear - (parseInt(form.grade, 10) - 1)}）
            </p>
          </Field>

          <button
            type="submit"
            disabled={saving}
            className="w-full px-5 py-3 mt-2 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> 儲存中...</>
            ) : (isEditing ? '儲存修改' : '完成並進入平台')}
          </button>
        </form>

        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full mt-3 flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm py-2"
        >
          <LogOut size={15} /> 改用其他帳號登入
        </button>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid #cbd5e1;
          outline: none;
          transition: all 0.15s;
        }
        .input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px #c7d2fe; }
      `}</style>
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
