/* =====================================================================
   receivedCards.js — 친구로부터 SNS로 공유받은 카드 저장소
   =====================================================================
   사용자가 SNS 공유 링크(https://daystory.app/share/:id)를 눌러
   앱에 들어왔을 때 자동으로 기록됩니다. 북마크와 완전히 별개입니다.

   localStorage에 저장 — 게스트/로그인 무관하게 단말 단위로 보관.
   포맷: { [storyId]: ISO8601_receivedAt }
   ===================================================================== */

import { fetchStoryById } from './stories.js';

const STORAGE_KEY = 'ds_received_cards';

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
 * recordReceived — 카드를 "받은 카드" 목록에 추가합니다.
 * 이미 있으면 중복 추가하지 않고 무시.
 * @returns {boolean} 새로 추가됐는지 여부
 */
export function recordReceived(storyId) {
  if (!storyId) return false;
  const data = load();
  if (data[storyId]) return false;
  data[storyId] = new Date().toISOString();
  save(data);
  return true;
}

/**
 * isReceived — 해당 카드를 받았는지 여부
 */
export function isReceived(storyId) {
  return !!load()[storyId];
}

/**
 * getReceivedIds — 받은 카드 ID 배열 (받은 시각 내림차순)
 */
export function getReceivedIds() {
  const data = load();
  return Object.entries(data)
    .sort((a, b) => String(b[1]).localeCompare(String(a[1])))
    .map(([id]) => id);
}

/**
 * removeReceived — 받은 카드 목록에서 제거
 */
export function removeReceived(storyId) {
  if (!storyId) return;
  const data = load();
  if (!(storyId in data)) return;
  delete data[storyId];
  save(data);
}

/**
 * getReceivedStories — 받은 카드의 전체 데이터를 Firestore에서 가져옵니다.
 */
export async function getReceivedStories() {
  const ids = getReceivedIds();
  if (!ids.length) return [];

  const results = await Promise.allSettled(ids.map((id) => fetchStoryById(id)));
  return results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);
}
