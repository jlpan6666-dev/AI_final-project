// ==========================================
// 截止時間相關工具
// course.deadline 為 Firestore Timestamp（或 null = 無期限）
// ==========================================

function toDate(deadline) {
  if (!deadline) return null;
  if (typeof deadline.toDate === 'function') return deadline.toDate();
  return new Date(deadline);
}

export function formatDeadline(deadline) {
  const d = toDate(deadline);
  if (!d) return '無繳交期限';
  return `截止：${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 回傳目前狀態：是否過期、是否仍可繳交、顯示標籤與顏色
export function deadlineStatus(deadline, allowLate, now = new Date()) {
  const d = toDate(deadline);
  if (!d) {
    return { passed: false, canSubmit: true, isLate: false, label: '開放繳交', color: 'text-emerald-600', badgeClass: 'bg-emerald-50 text-emerald-700' };
  }
  const passed = now.getTime() > d.getTime();
  if (!passed) {
    return { passed: false, canSubmit: true, isLate: false, label: '繳交中', color: 'text-emerald-600', badgeClass: 'bg-emerald-50 text-emerald-700' };
  }
  if (allowLate) {
    return { passed: true, canSubmit: true, isLate: true, label: '已截止 · 可補交', color: 'text-amber-600', badgeClass: 'bg-amber-50 text-amber-700' };
  }
  return { passed: true, canSubmit: false, isLate: true, label: '已截止', color: 'text-rose-600', badgeClass: 'bg-rose-50 text-rose-700' };
}

// 將 Firestore Timestamp 轉成 <input type="datetime-local"> 需要的字串
export function toDatetimeLocalValue(deadline) {
  const d = toDate(deadline);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
