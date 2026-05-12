/* =====================================================================
   storyI18n.js — Story 객체의 다국어 필드 조회 헬퍼
   =====================================================================
   Firestore stories 스키마:
     - 한국어 텍스트는 최상위(figure_name, body, summary, editor_comment, country, title)
     - 영/일 번역은 story.i18n.{en|ja}.{field}
   현재 언어가 ko면 최상위 필드 그대로, 그 외엔 i18n.{lang}.field 우선,
   누락 시 한국어로 폴백.
   ===================================================================== */

import { getCurrentLang } from '../i18n/index.js';

const LOCALIZABLE_FIELDS = new Set([
  'figure_name',
  'body',
  'summary',
  'editor_comment',
  'country',
  'title',
]);

/**
 * localizedField — 현재 언어에 맞는 필드 값을 반환합니다.
 * @param {object} story
 * @param {string} field
 * @returns {string}
 */
export function localizedField(story, field) {
  if (!story) return '';
  const fallback = story[field] || '';
  if (!LOCALIZABLE_FIELDS.has(field)) return fallback;

  const lang = getCurrentLang();
  if (lang === 'ko') return fallback;

  const translated = story?.i18n?.[lang]?.[field];
  if (typeof translated === 'string' && translated.trim() !== '') return translated;
  return fallback;
}

/**
 * localizedStory — story 전체를 현재 언어 기준으로 펼친 새 객체 반환
 * 카드 렌더링 시 한 번 호출하면 그 후 .figure_name 등 직접 접근해도 OK.
 * 원본 객체는 변경하지 않습니다.
 */
export function localizedStory(story) {
  if (!story) return story;
  const lang = getCurrentLang();
  if (lang === 'ko') return story;

  const translations = story?.i18n?.[lang] || {};
  const out = { ...story };
  LOCALIZABLE_FIELDS.forEach((f) => {
    const v = translations[f];
    if (typeof v === 'string' && v.trim() !== '') out[f] = v;
  });
  return out;
}
