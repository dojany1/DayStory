/* =====================================================================
   i18n_language_settings.spec.js
   ---------------------------------------------------------------------
   다국어(i18n) 설정 기능 활성화 및 버그 수정 검증
   - 작업1: 설정 페이지 언어 선택 UI 연결
   - 작업2: <meta property="og:locale"> 동적 변경
   - 작업3: Firestore languagePreference 저장(무해) + 언어는 기기 로컬(ds_lang) 기준
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
   작업 3-a: 언어는 기기 로컬(ds_lang) 을 단일 진실원으로 삼는다
   (로그인 시 DB 로 덮어쓰지 않음 — 계정 간 언어 leak 제거)
   ────────────────────────────────────────────── */
describe('작업3 — 언어는 기기 로컬 저장(ds_lang) 기준', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '<meta property="og:locale" content="ko_KR" />';
  });

  it('i18n 는 applyLangFromProfile(로그인 덮어쓰기) 를 더 이상 export 하지 않는다', async () => {
    const mod = await import('../src/js/i18n/index.js');
    expect(mod.applyLangFromProfile).toBeUndefined();
  });

  it('사용자가 변경한 언어는 localStorage(ds_lang) 에 저장된다', async () => {
    const { setState } = await import('../src/js/state.js');
    setState('lang', 'ja');
    expect(localStorage.getItem('ds_lang')).toBe('ja');
  });

  it('detectInitialLang 은 저장된 ds_lang 을 최우선으로 사용한다', async () => {
    localStorage.setItem('ds_lang', 'ja');
    const { detectInitialLang } = await import('../src/js/i18n/index.js');
    expect(detectInitialLang()).toBe('ja');
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
   작업 3-c: 로그인은 기기 언어를 덮어쓰지 않는다 (정적 소스 검증)
   ────────────────────────────────────────────── */
describe('작업3 — 로그인 경로는 언어를 덮어쓰지 않는다', () => {
  const src = () => readFileSync(root('src/js/pages/login.js'), 'utf8');

  it('login.js 는 applyLangFromProfile 를 호출/import 하지 않는다', () => {
    expect(src()).not.toMatch(/applyLangFromProfile/);
  });

  it('신규 프로필 생성 시 현재 기기 언어를 languagePreference 기본값으로 저장한다', () => {
    expect(src()).toMatch(/languagePreference:\s*getCurrentLang\(\)/);
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
