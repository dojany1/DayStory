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
 * collect — 카드 수집. 기본: 오늘 날짜 카드만. options.bypass=true 면 날짜 제한 무시.
 *
 * bypass 사용처: 어드민·구독자가 지난 카드를 열람했을 때 자동 수집 (구독 해지 후에도
 * 한 번 본 카드는 영구 보관되도록).
 *
 * @param {string} storyId
 * @param {string} publishDate
 * @param {{ bypass?: boolean }} [options]
 * @returns {{ ok: boolean, alreadyCollected: boolean }}
 */
export function collect(storyId, publishDate, options = {}) {
  if (isCollected(storyId)) {
    return { ok: true, alreadyCollected: true };
  }
  if (!options.bypass && !canCollect(publishDate)) {
    return { ok: false, alreadyCollected: false };
  }
  const data = load();
  data[storyId] = getLocalToday();
  save(data);
  return { ok: true, alreadyCollected: false };
}

/**
 * bulkCollect — 구독자/어드민용 일괄 수집. localStorage 1회 쓰기로 효율적.
 * 이미 수집된 카드는 skip. 날짜 제한 무시(bypass 효과).
 *
 * @param {string[]} storyIds
 * @returns {number} 새로 추가된 카드 수
 */
export function bulkCollect(storyIds) {
  if (!Array.isArray(storyIds) || storyIds.length === 0) return 0;
  const data = load();
  const today = getLocalToday();
  let added = 0;
  for (const id of storyIds) {
    if (!id || data[id]) continue;
    data[id] = today;
    added += 1;
  }
  if (added > 0) save(data);
  return added;
}
