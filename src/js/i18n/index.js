/* =====================================================================
   i18n/index.js — 다국어(한국어/English/日本語) 핵심 모듈
   =====================================================================
   - getCurrentLang() / setLang() / t(key, vars)
   - 영/일 번역 누락 시 자동 한국어 폴백
   - 부팅 시 navigator.language 추정 (위치 권한 미사용)
   - 언어 변경 시 <html lang> 동기화 + 현재 페이지 강제 재렌더
   ===================================================================== */

import koMessages from "../../i18n/ko.json";
import enMessages from "../../i18n/en.json";
import jaMessages from "../../i18n/ja.json";
import { getState, setState, subscribe } from "../state.js";
import { forceRoute } from "../router.js";

const SUPPORTED_LANGS = ["ko", "en", "ja"];
const DEFAULT_LANG = "ko";

const messages = {
  ko: koMessages,
  en: enMessages,
  ja: jaMessages,
};

/**
 * detectInitialLang — 첫 부팅 시 사용자 언어 추정
 * 1) localStorage에 저장된 값이 있으면 그걸 사용
 * 2) 없으면 navigator.language 보고 ko/ja → 해당, 그 외 → en
 */
export function detectInitialLang() {
  const stored = localStorage.getItem("ds_lang");
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;

  const navLang = (
    (typeof navigator !== "undefined" &&
      (navigator.language || navigator.userLanguage)) ||
    ""
  ).toLowerCase();
  if (navLang.startsWith("ko")) return "ko";
  if (navLang.startsWith("ja")) return "ja";
  return "en";
}

export function getCurrentLang() {
  return getState("lang") || DEFAULT_LANG;
}

export function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  if (getCurrentLang() === lang) return;
  setState("lang", lang);
}

/**
 * t — 번역 키 조회 (네임스페이스 점 표기 지원: "bookmarks.title")
 * 누락 시 한국어 폴백, 그래도 없으면 키 자체를 반환.
 * vars 객체로 {name} 같은 자리 표시자 치환.
 */
export function t(key, vars) {
  if (!key) return "";
  const lang = getCurrentLang();
  const lookup = (langCode) => {
    const dict = messages[langCode];
    if (!dict) return null;
    let cur = dict;
    for (const part of key.split(".")) {
      if (cur == null || typeof cur !== "object") return null;
      cur = cur[part];
    }
    return typeof cur === "string" ? cur : null;
  };

  let val = lookup(lang);
  // 빈 문자열도 폴백 (사용자가 채우기 전 빈 값)
  if (!val) val = lookup(DEFAULT_LANG);
  if (!val) return key;

  if (vars && typeof vars === "object") {
    Object.entries(vars).forEach(([k, v]) => {
      val = val.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
  }
  return val;
}

function applyHtmlLang(lang) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang || DEFAULT_LANG;
  }
}

/**
 * initI18n — 앱 부팅 시 1회 호출
 * navigator.language 추정 → state 발행 → <html lang> 적용 → lang 변경 구독
 */
export function initI18n() {
  const lang = detectInitialLang();
  setState("lang", lang);
  applyHtmlLang(lang);

  subscribe("lang", (newLang) => {
    applyHtmlLang(newLang);
    /* 현재 페이지 강제 재렌더 — 모든 t() 호출 재평가 */
    try {
      forceRoute();
    } catch {
      /* router 초기화 전이면 무시 */
    }
  });
}
