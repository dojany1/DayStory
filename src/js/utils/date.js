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

/**
 * getDaysInMonth — 1월=1, 2월=2 ... 12월=12 형식의 1-indexed month 입력으로 해당 월의 일수를 반환.
 * 호출 측(calendar.js, editorstory.js, mystory.js)이 모두 1-indexed 로 호출하므로 함수도 1-indexed.
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
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

/**
 * toLocalDateFromIso — 'YYYY-MM-DD' 문자열을 로컬 자정의 Date 객체로 변환.
 * UTC 파싱(new Date('2026-05-04'))이 타임존에 따라 다른 날로 해석되는 이슈를 회피한다.
 * 잘못된 입력이면 null 을 반환한다.
 */
export function toLocalDateFromIso(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (!isValidCalendarDate(year, month, day)) return null;
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * formatLocalIsoDate — Date 객체를 로컬 'YYYY-MM-DD' 문자열로 변환.
 * toISOString() 의 UTC 변환을 피해 사용자 기기의 날짜 그대로 반환한다.
 */
export function formatLocalIsoDate(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * isValidCalendarDate — 주어진 (year, month, day) 가 실제로 존재하는 날짜인지 확인.
 * 예: 2026, 2, 30 → false (2월에는 30일이 없음)
 */
export function isValidCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const last = getDaysInMonth(year, month);
  return day <= last;
}

/**
 * safeStoryDateParts — story 객체의 publish_date 를 안전하게 분해해 { valid, year, month, day } 를 반환.
 * 잘못된 형식이면 valid=false 를 반환해 호출 측이 fallback 을 표시할 수 있도록 한다.
 */
export function safeStoryDateParts(story) {
  const iso = story?.publish_date || '';
  const date = toLocalDateFromIso(iso);
  if (!date) return { valid: false, year: null, month: null, day: null };
  return {
    valid: true,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}
