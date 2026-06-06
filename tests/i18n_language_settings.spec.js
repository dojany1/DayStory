/* =====================================================================
   i18n_language_settings.spec.js
   ---------------------------------------------------------------------
   다국어(i18n) 설정 기능 활성화 및 버그 수정 검증
   - 작업1: 설정 페이지 언어 선택 UI 연결
   - 작업2: <meta property="og:locale"> 동적 변경
   - 작업3: Firestore languagePreference 저장 + 로그인 동기화
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = (p) => resolve(process.cwd(), p);

/* state.js 가 모듈 로드 시 applyTheme() → window.matchMedia 를 호출한다.
   jsdom 기본 환경엔 matchMedia 가 없으므로 detail_nav.ui.spec.js 와 동일하게 스텁. */
vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
})));

/* ──────────────────────────────────────────────
   작업 1: 설정 페이지 언어 UI 연결 (정적 소스 검증)
   ────────────────────────────────────────────── */
describe('작업1 — 설정 페이지 언어 선택 UI 연결', () => {
  const src = () => readFileSync(root('src/js/components/settingsSections.js'), 'utf8');

  it('renderSettingsSections 가 renderLanguageListItem 을 실제로 호출한다', () => {
    const s = src();
    /* 언어 UI 가 리스트 항목+바텀시트 패턴으로 리팩터링됨 (renderLangOption → renderLanguageListItem).
       정의("function renderLanguageListItem")가 아니라 호출도 본문에 있어야 함 → 2회 이상 등장 */
    const callMatches = s.match(/renderLanguageListItem\(/g) || [];
    expect(callMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('언어 그룹에 ko/en/ja 3개 옵션과 section_language 라벨이 렌더된다', () => {
    const s = src();
    expect(s).toMatch(/settings\.lang_ko/);
    expect(s).toMatch(/settings\.lang_en/);
    expect(s).toMatch(/settings\.lang_ja/);
    expect(s).toMatch(/settings\.section_language/);
  });

  it('bindSettingsSections 가 bindLanguageItem(page) 를 호출한다', () => {
    const s = src();
    /* bindSettingsSections 함수 본문 내부에서 bindLanguageItem 이 호출되는지 확인
       (언어 선택 행 클릭 → openLanguageSheet 바텀시트 연결) */
    const fnStart = s.indexOf('export function bindSettingsSections');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = s.slice(fnStart, fnStart + 600);
    expect(fnBody).toMatch(/bindLanguageItem\(\s*page\s*\)/);
  });

  it('언어 변경 시 Firestore 저장(saveLanguagePreference)을 트리거한다', () => {
    const s = src();
    expect(s).toMatch(/saveLanguagePreference/);
  });
});

/* ──────────────────────────────────────────────
   작업 2: og:locale 동적 변경 (functional - jsdom)
   ────────────────────────────────────────────── */
describe('작업2 — og:locale 메타 동적 변경', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta property="og:locale" content="ko_KR" />';
    document.documentElement.lang = 'ko';
  });

  it('applyHtmlLang(en) 호출 시 <html lang> 과 og:locale 이 en_US 로 변경된다', async () => {
    const { applyHtmlLang } = await import('../src/js/i18n/index.js');
    applyHtmlLang('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.querySelector('meta[property="og:locale"]').getAttribute('content')).toBe('en_US');
  });

  it('applyHtmlLang(ja) 호출 시 og:locale 이 ja_JP 로 변경된다', async () => {
    const { applyHtmlLang } = await import('../src/js/i18n/index.js');
    applyHtmlLang('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.querySelector('meta[property="og:locale"]').getAttribute('content')).toBe('ja_JP');
  });

  it('applyHtmlLang(ko) 호출 시 og:locale 이 ko_KR 로 변경된다', async () => {
    const { applyHtmlLang } = await import('../src/js/i18n/index.js');
    applyHtmlLang('ja');
    applyHtmlLang('ko');
    expect(document.querySelector('meta[property="og:locale"]').getAttribute('content')).toBe('ko_KR');
  });

  it('지원하지 않는 값은 기본(ko_KR)으로 폴백한다', async () => {
    const { applyHtmlLang } = await import('../src/js/i18n/index.js');
    applyHtmlLang('zz');
    expect(document.querySelector('meta[property="og:locale"]').getAttribute('content')).toBe('ko_KR');
  });
});

/* ──────────────────────────────────────────────
   작업 3-a: applyLangFromProfile (functional - jsdom)
   ────────────────────────────────────────────── */
describe('작업3 — applyLangFromProfile DB→state 동기화', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '<meta property="og:locale" content="ko_KR" />';
  });

  it('profile.languagePreference 값으로 state(lang) 와 localStorage(ds_lang) 를 덮어쓴다', async () => {
    const { applyLangFromProfile, getCurrentLang } = await import('../src/js/i18n/index.js');
    const { setState } = await import('../src/js/state.js');
    setState('lang', 'ko');
    applyLangFromProfile({ languagePreference: 'ja' });
    expect(getCurrentLang()).toBe('ja');
    expect(localStorage.getItem('ds_lang')).toBe('ja');
  });

  it('languagePreference 가 없으면 현재 언어를 유지한다', async () => {
    const { applyLangFromProfile, getCurrentLang } = await import('../src/js/i18n/index.js');
    const { setState } = await import('../src/js/state.js');
    setState('lang', 'ko');
    applyLangFromProfile({ nickname: 'tester' });
    expect(getCurrentLang()).toBe('ko');
  });

  it('지원하지 않는 languagePreference 는 무시한다', async () => {
    const { applyLangFromProfile, getCurrentLang } = await import('../src/js/i18n/index.js');
    const { setState } = await import('../src/js/state.js');
    setState('lang', 'en');
    applyLangFromProfile({ languagePreference: 'fr' });
    expect(getCurrentLang()).toBe('en');
  });

  it('null/undefined profile 에도 예외 없이 동작한다', async () => {
    const { applyLangFromProfile } = await import('../src/js/i18n/index.js');
    expect(() => applyLangFromProfile(null)).not.toThrow();
    expect(() => applyLangFromProfile(undefined)).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
   작업 3-b: saveLanguagePreference 서비스 (functional + 정적)
   ────────────────────────────────────────────── */
describe('작업3 — saveLanguagePreference 서비스', () => {
  it('아키텍처 규칙: 서비스 레이어(services/userProfile.js)에 존재한다', () => {
    const s = readFileSync(root('src/js/services/userProfile.js'), 'utf8');
    expect(s).toMatch(/export\s+async\s+function\s+saveLanguagePreference/);
    /* profiles 컬렉션에 merge 저장 */
    expect(s).toMatch(/profiles/);
    expect(s).toMatch(/merge:\s*true/);
  });

  it('languagePreference 필드명을 사용한다', () => {
    const s = readFileSync(root('src/js/services/userProfile.js'), 'utf8');
    expect(s).toMatch(/languagePreference/);
  });
});

/* ──────────────────────────────────────────────
   작업 3-c: 로그인 동기화 연결 (정적 소스 검증)
   ────────────────────────────────────────────── */
describe('작업3 — 로그인 경로 languagePreference 동기화', () => {
  const src = () => readFileSync(root('src/js/pages/login.js'), 'utf8');

  it('login.js 가 applyLangFromProfile 를 import 한다', () => {
    expect(src()).toMatch(/applyLangFromProfile/);
  });

  it('setState("profile") 직후 applyLangFromProfile 가 호출되는 경로가 있다', () => {
    const s = src();
    /* setState('profile', ...) 와 applyLangFromProfile 가 모두 존재 */
    expect(s).toMatch(/setState\(\s*['"]profile['"]/);
    const applyCalls = s.match(/applyLangFromProfile\(/g) || [];
    /* 3개 로그인 경로(소셜/이메일로그인/회원가입) 모두 연결 */
    expect(applyCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('신규 프로필 생성 시 languagePreference 기본값을 저장한다', () => {
    expect(src()).toMatch(/languagePreference/);
  });
});

/* ──────────────────────────────────────────────
   작업 3-d: 프로필 저장 시 languagePreference 포함 (정적)
   ────────────────────────────────────────────── */
describe('작업3 — 프로필 업데이트 시 languagePreference 저장', () => {
  it('profile.js 프로필 저장 로직이 languagePreference 를 포함한다', () => {
    const s = readFileSync(root('src/js/pages/profile.js'), 'utf8');
    expect(s).toMatch(/languagePreference/);
  });
});
