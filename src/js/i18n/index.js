/* =====================================================================
   i18n/index.js — 다국어(한국어/English/日本語/Español/中文) 핵심 모듈
   =====================================================================
   - getCurrentLang() / setLang() / t(key, vars)
   - 영/일 번역 누락 시 자동 한국어 폴백
   - 부팅 시 navigator.language 추정 (위치 권한 미사용)
   - 언어 변경 시 <html lang> 동기화 + 현재 페이지 강제 재렌더
   ===================================================================== */

import koMessages from '../../i18n/ko.json';
import enMessages from '../../i18n/en.json';
import jaMessages from '../../i18n/ja.json';
import esMessages from '../../i18n/es.json';
import zhMessages from '../../i18n/zh.json';
import { getState, setState, subscribe } from '../state.js';
import { forceRoute } from '../router.js';

const SUPPORTED_LANGS = ['ko', 'en', 'ja', 'es', 'zh'];
const DEFAULT_LANG = 'ko';

/* OG 메타(og:locale)용 언어 → 로케일 매핑 */
const OG_LOCALE_MAP = {
  ko: 'ko_KR',
  en: 'en_US',
  ja: 'ja_JP',
  es: 'es_ES',
  zh: 'zh_CN',
};

const messages = {
  ko: koMessages,
  en: enMessages,
  ja: jaMessages,
  es: esMessages,
  zh: zhMessages,
};

/**
 * detectInitialLang — 첫 부팅 시 사용자 언어 추정
 * 1) localStorage에 저장된 값이 있으면 그걸 사용
 * 2) 없으면 navigator.language 보고 ko/ja → 해당, 그 외 → en
 */
export function detectInitialLang() {
  const stored = localStorage.getItem('ds_lang');
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;

  const navLang = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage) || '').toLowerCase();
  if (navLang.startsWith('ko')) return 'ko';
  if (navLang.startsWith('ja')) return 'ja';
  if (navLang.startsWith('es')) return 'es';
  if (navLang.startsWith('zh')) return 'zh';
  return 'en';
}

export function getCurrentLang() {
  return getState('lang') || DEFAULT_LANG;
}

export function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  if (getCurrentLang() === lang) return;
  setState('lang', lang);
}

/**
 * t — 번역 키 조회 (네임스페이스 점 표기 지원: "bookmarks.title")
 * 누락 시 한국어 폴백, 그래도 없으면 키 자체를 반환.
 * vars 객체로 {name} 같은 자리 표시자 치환.
 */
export function t(key, vars) {
  if (!key) return '';
  const lang = getCurrentLang();
  const lookup = (langCode) => {
    const dict = messages[langCode];
    if (!dict) return null;
    let cur = dict;
    for (const part of key.split('.')) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[part];
    }
    return typeof cur === 'string' ? cur : null;
  };

  let val = lookup(lang);
  // 빈 문자열도 폴백 (사용자가 채우기 전 빈 값)
  if (!val) val = lookup(DEFAULT_LANG);
  if (!val) return key;

  if (vars && typeof vars === 'object') {
    Object.entries(vars).forEach(([k, v]) => {
      val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return val;
}

/**
 * tList — 배열 형태의 번역 값 조회 (예: "date.weekdays")
 * 누락 시 한국어 폴백, 그래도 없으면 빈 배열 반환.
 */
export function tList(key) {
  if (!key) return [];
  const lang = getCurrentLang();
  const lookup = (langCode) => {
    const dict = messages[langCode];
    if (!dict) return null;
    let cur = dict;
    for (const part of key.split('.')) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[part];
    }
    return Array.isArray(cur) ? cur : null;
  };
  return lookup(lang) || lookup(DEFAULT_LANG) || [];
}

/**
 * applyHtmlLang — <html lang> 과 <meta property="og:locale"> 를 선택 언어에 동기화
 * 지원하지 않는 값은 기본 언어(ko)로 폴백.
 * @param {string} lang - 'ko' | 'en' | 'ja'
 */
export function applyHtmlLang(lang) {
  if (typeof document === 'undefined') return;

  const resolved = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  document.documentElement.lang = resolved;

  /* SNS 공유 시 노출되는 og:locale 도 함께 갱신 (정적 ko_KR 고정 버그 수정) */
  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) {
    ogLocale.setAttribute('content', OG_LOCALE_MAP[resolved] || OG_LOCALE_MAP[DEFAULT_LANG]);
  }
}

/**
 * initI18n — 앱 부팅 시 1회 호출
 * navigator.language 추정 → state 발행 → <html lang> 적용 → lang 변경 구독
 */
export function initI18n() {
  const lang = detectInitialLang();
  setState('lang', lang);
  applyHtmlLang(lang);

  subscribe('lang', (newLang) => {
    applyHtmlLang(newLang);
    /* 현재 페이지 강제 재렌더 — 모든 t() 호출 재평가 */
    try {
      forceRoute();
    } catch {
      /* router 초기화 전이면 무시 */
    }
  });
}
