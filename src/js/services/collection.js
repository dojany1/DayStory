/* =====================================================================
   collection.js — 카드 수집 서비스
   =====================================================================
   오늘 날짜의 카드만 수집할 수 있습니다.
   하루가 지나면 수집 불가(회색 처리) 상태가 됩니다.
   수집 기록은 localStorage에 저장됩니다.
   ===================================================================== */

import { getLocalToday } from '../utils/date.js';

const STORAGE_KEY = 'ds_collected_cards';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * isCollected — 해당 스토리가 수집되었는지 여부
 */
export function isCollected(storyId) {
  return !!load()[storyId];
}

/**
 * getCollectedIds — 수집된 모든 storyId 배열
 */
export function getCollectedIds() {
  return Object.keys(load());
}

/**
 * canCollect — 오늘 날짜 카드만 수집 가능
 * @param {string} publishDate — 'YYYY-MM-DD'
 */
export function canCollect(publishDate) {
  return publishDate === getLocalToday();
}

/**
 * collect — 카드 수집. 오늘 날짜가 아니면 실패.
 * @returns {{ ok: boolean, alreadyCollected: boolean }}
 */
export function collect(storyId, publishDate) {
  if (isCollected(storyId)) {
    return { ok: true, alreadyCollected: true };
  }
  if (!canCollect(publishDate)) {
    return { ok: false, alreadyCollected: false };
  }
  const data = load();
  data[storyId] = getLocalToday();
  save(data);
  return { ok: true, alreadyCollected: false };
}
