/* =====================================================================
   widget.js — 안드로이드 홈 화면 위젯 동기화
   =====================================================================
   네이티브(안드로이드)에 등록된 DayStoryWidget 플러그인을 호출하여
   - 오늘의 편지 미열람 여부(빨간 점)
   - 오늘의 일기 작성 여부(펜 버튼 활성/비활성)
   상태를 SharedPreferences에 저장하고 위젯을 새로 그립니다.
   웹/iOS 등 다른 플랫폼에서는 모든 호출이 무해한 no-op로 동작합니다.
   ===================================================================== */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { getLocalToday } from '../utils/date.js';

const DayStoryWidget = registerPlugin('DayStoryWidget');

const isAndroid = () => Capacitor.getPlatform && Capacitor.getPlatform() === 'android';

const LETTER_READ_KEY_PREFIX = 'daystory:letterReadDate:';

export function todayIsoDate() {
  return getLocalToday();
}

export async function setLetterState(hasNewLetter) {
  if (!isAndroid()) return;
  try {
    await DayStoryWidget.setLetterState({ hasNewLetter: !!hasNewLetter });
  } catch (err) {
    console.warn('[widget] setLetterState 실패:', err);
  }
}

export async function setDiaryState(hasTodayDiary, diaryDate = todayIsoDate()) {
  if (!isAndroid()) return;
  try {
    await DayStoryWidget.setDiaryState({
      hasTodayDiary: !!hasTodayDiary,
      diaryDate: diaryDate || todayIsoDate(),
    });
  } catch (err) {
    console.warn('[widget] setDiaryState 실패:', err);
  }
}

export async function refreshWidget() {
  if (!isAndroid()) return;
  try {
    await DayStoryWidget.refresh();
  } catch (err) {
    console.warn('[widget] refresh 실패:', err);
  }
}

export async function setWidgetTheme(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  if (!isAndroid()) return;
  try {
    await DayStoryWidget.setTheme({ theme: normalized });
  } catch (err) {
    console.warn('[widget] setTheme 실패:', err);
  }
}

/**
 * markLetterRead — 편지 화면에 진입했을 때 호출.
 * 같은 날에 한 번만 위젯을 갱신해 불필요한 호출을 줄입니다.
 */
export async function markLetterRead() {
  const today = todayIsoDate();
  const flagKey = LETTER_READ_KEY_PREFIX + today;
  try {
    if (localStorage.getItem(flagKey) === '1') return;
    localStorage.setItem(flagKey, '1');
  } catch (_) { /* localStorage 차단 환경에서는 매번 갱신 */ }
  await setLetterState(false);
}

/**
 * markLetterUnread — 새 날이 시작되어 빨간 점을 다시 켤 때 사용.
 */
export async function markLetterUnread() {
  await setLetterState(true);
}

/**
 * syncDiaryStateFromList — 사용자의 일기 목록을 받아 오늘 작성 여부를 위젯에 반영합니다.
 * @param {Array<{publish_date?: string}>} stories
 */
export async function syncDiaryStateFromList(stories) {
  if (!Array.isArray(stories)) return;
  const today = todayIsoDate();
  const has = stories.some((s) => s && s.publish_date === today);
  await setDiaryState(has, today);
}
