/* =====================================================================
   membershipCards.js — DOKHU 정기 후원 카드 저장소 (localStorage)
   =====================================================================
   사용자가 구독을 시작하면 1장의 "멤버십 카드"를 자동 생성해
   보관함 "받은 카드" 탭에서 함께 표시합니다.

   카드 객체는 Firestore stories와 동일한 필드 구조 + isMembershipCard 플래그.
   detail.js / bookmarks.js / sharing.js 가 동일 코드로 다룰 수 있도록 호환.
   ===================================================================== */

import { MEMBERSHIP_LETTER, MEMBERSHIP_CARD_IMAGE } from '../../data/membershipLetter.js';
import { formatLocalIsoDate } from '../utils/date.js';

const STORAGE_KEY = 'ds_membership_cards';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * isMembershipCardId — 멤버십 카드 ID 식별 (detail.js 등에서 분기용)
 */
export function isMembershipCardId(id) {
  return typeof id === 'string' && id.startsWith('dokhu-membership-');
}

/**
 * buildMembershipCard — 결제 시각 기반으로 카드 객체를 만듭니다.
 * 다국어는 figure_name/body 등 한국어를 기본으로, i18n.{en|ja}에 영/일 콘텐츠를 채워
 * 기존 storyI18n.localizedStory() 가 자동으로 현재 언어로 펼치게 합니다.
 */
function buildMembershipCard(paidAt) {
  const at = paidAt instanceof Date ? paidAt : new Date(paidAt || Date.now());
  const isoDate = formatLocalIsoDate(at);
  const hh = String(at.getHours()).padStart(2, '0');
  const mm = String(at.getMinutes()).padStart(2, '0');

  const ko = MEMBERSHIP_LETTER.ko;
  return {
    id: `dokhu-membership-${at.getTime()}`,
    /* 카드 앞면 메타 */
    figure_name: ko.figure_name,
    title: ko.title,
    summary: ko.summary,
    country: ko.country,
    historical_year: `${at.getFullYear()}`,
    historical_date: `${at.getFullYear()}년 ${at.getMonth() + 1}월 ${at.getDate()}일 ${hh}:${mm}`,
    publish_date: isoDate,
    /* 본문 (뒷면) */
    body: ko.body,
    editor_comment: '',
    /* 이미지 */
    image_url: MEMBERSHIP_CARD_IMAGE,
    image_thumb_url: MEMBERSHIP_CARD_IMAGE,
    /* 다국어 — 현재 언어 기준으로 자동 펼쳐짐 */
    i18n: {
      en: MEMBERSHIP_LETTER.en,
      ja: MEMBERSHIP_LETTER.ja,
    },
    /* 식별자 + 메타 */
    isMembershipCard: true,
    paid_at: at.toISOString(),
    status: 'published',
  };
}

/**
 * addMembershipCard — 결제 성공 시 1회 호출. 결제 시각을 카드 발행일로 사용.
 * 동일 결제일/시각 중복 방지 — 1분 이내 동일 카드는 추가하지 않음.
 */
export function addMembershipCard(paidAt = new Date()) {
  const card = buildMembershipCard(paidAt);
  const list = load();
  /* 1분 내 동일 카드 중복 방어 (결제 콜백이 두 번 들어오는 사례 대응) */
  const recent = list[list.length - 1];
  if (recent && Math.abs(new Date(recent.paid_at).getTime() - new Date(card.paid_at).getTime()) < 60000) {
    return recent;
  }
  list.push(card);
  save(list);
  return card;
}

/**
 * getMembershipCards — 보관함에서 호출. 받은 시각 내림차순.
 */
export function getMembershipCards() {
  return load().slice().sort((a, b) =>
    String(b.paid_at || '').localeCompare(String(a.paid_at || ''))
  );
}

/**
 * getMembershipCardById — detail 페이지에서 사용 (Firestore fetch 우회).
 */
export function getMembershipCardById(id) {
  return load().find((c) => c.id === id) || null;
}

/**
 * removeMembershipCardById — 보관함에서 멤버십 카드를 직접 제거.
 */
export function removeMembershipCardById(id) {
  if (!id) return;
  const list = load();
  const next = list.filter((c) => c.id !== id);
  if (next.length !== list.length) save(next);
}
