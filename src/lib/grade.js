// ==========================================
// 年級自動計算（以 9/1 為學年度分界，無需排程）
// 內部一律使用西元年（學年度起始年）。
// ==========================================

// 給定日期所屬的「學年度」(以 9/1 換年)。例：2026/6 => 2025；2026/9 => 2026
export function currentAcademicYear(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1~12
  return m >= 9 ? y : y - 1;
}

// 由「入學那年的學年度」推算目前年級（會在每年 9/1 自動 +1）
export function gradeFromStartYear(startAcademicYear, date = new Date()) {
  if (!startAcademicYear) return null;
  return currentAcademicYear(date) - startAcademicYear + 1;
}

// 由「目前年級」反推「入學那年的學年度」（註冊資料時存這個值）
export function startYearFromGrade(grade, date = new Date()) {
  return currentAcademicYear(date) - (grade - 1);
}

// 顯示文字，例如「3 年級」；超出常規範圍時仍如實顯示
export function gradeLabel(startAcademicYear, date = new Date()) {
  const g = gradeFromStartYear(startAcademicYear, date);
  if (g == null) return '—';
  return `${g} 年級`;
}
