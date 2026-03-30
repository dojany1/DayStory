/* ============================================
   DayStory — Date Utilities
   ============================================ */

const WEEKDAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export function formatDateKR(date) {
  const d = new Date(date);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS_KR[d.getDay()]}요일`;
}

export function formatShortDate(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}. ${d.getDate()}`;
}

export function getToday() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function formatMonthYear(date) {
  const d = new Date(date);
  return `${d.getFullYear()}년 ${MONTHS_KR[d.getMonth()]}`;
}

export function getMonthDay(dateStr) {
  /* "3월 26일" format from a publish_date "2026-03-26" */
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}. ${d.getDate()}`;
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
