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

/**
 * getLocalToday — 사용자 기기의 로컬 시간 기준 오늘 날짜를 반환합니다
 * 
 * 왜 필요한가?
 *   기존 getToday()는 toISOString()을 사용해 UTC(세계 표준시) 기준이었습니다.
 *   예: 한국 시간 2026-04-14 02:00 → UTC는 아직 2026-04-13 17:00
 *   이 차이 때문에 예약 발행 날짜 비교가 틀어질 수 있습니다.
 *   
 *   이 함수는 사용자 기기의 타임존을 따르므로
 *   한국 사용자가 자정이 지나면 정확히 다음 날로 인식합니다.
 * 
 * @returns {string} 'YYYY-MM-DD' 형식 (예: '2026-04-14')
 */
export function getLocalToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
