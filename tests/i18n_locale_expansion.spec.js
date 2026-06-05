/* =====================================================================
   i18n_locale_expansion.spec.js
   ---------------------------------------------------------------------
   지원 언어를 3개(ko/en/ja) → 5개(+es/zh)로 확장하는 작업 검증
   - es/zh 번역 파일이 en.json 과 동일한 키 구조를 가진다 (누락/잉여 0)
   - applyHtmlLang(es|zh) 이 og:locale 을 es_ES / zh_CN 으로 바꾼다
   - setLang(es|zh) 이 정상 적용된다 (SUPPORTED_LANGS 등록)
   - 설정/에디터/서비스 소스에 es/zh 가 연결되어 있다 (정적 검증)
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = (p) => resolve(process.cwd(), p);
const readJson = (p) => JSON.parse(readFileSync(root(p), 'utf8'));

/* state.js 가 모듈 로드 시 applyTheme() → window.matchMedia 를 호출한다 (jsdom 미지원 → 스텁) */
vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
})));

/* 중첩 객체의 모든 leaf 키를 점 표기 경로 집합으로 수집 */
function collectKeyPaths(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...collectKeyPaths(v, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

/* ──────────────────────────────────────────────
   1) 새 번역 파일 키 패리티 (en.json 기준)
   ────────────────────────────────────────────── */
describe('번역 파일 키 패리티 — es/zh 가 en.json 과 동일한 구조', () => {
  const enKeys = collectKeyPaths(readJson('src/i18n/en.json'));

  it('es.json 이 en.json 과 동일한 키 집합을 가진다', () => {
    const esKeys = collectKeyPaths(readJson('src/i18n/es.json'));
    expect(esKeys).toEqual(enKeys);
  });

  it('zh.json 이 en.json 과 동일한 키 집합을 가진다', () => {
    const zhKeys = collectKeyPaths(readJson('src/i18n/zh.json'));
    expect(zhKeys).toEqual(enKeys);
  });

  it('settings.lang_es / settings.lang_zh 라벨이 5개 언어 파일 모두에 존재한다', () => {
    ['ko', 'en', 'ja', 'es', 'zh'].forEach((lang) => {
      const dict = readJson(`src/i18n/${lang}.json`);
      expect(dict.settings.lang_es, `${lang}.json settings.lang_es`).toBeTruthy();
      expect(dict.settings.lang_zh, `${lang}.json settings.lang_zh`).toBeTruthy();
    });
  });
});

/* ──────────────────────────────────────────────
   2) og:locale 동적 변경 (functional - jsdom)
   ────────────────────────────────────────────── */
describe('og:locale — es/zh 매핑', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta property="og:locale" content="ko_KR" />';
    document.documentElement.lang = 'ko';
  });

  it('applyHtmlLang(es) → <html lang>=es, og:locale=es_ES', async () => {
    const { applyHtmlLang } = await import('../src/js/i18n/index.js');
    applyHtmlLang('es');
    expect(document.documentElement.lang).toBe('es');
    expect(document.querySelector('meta[property="og:locale"]').getAttribute('content')).toBe('es_ES');
  });

  it('applyHtmlLang(zh) → <html lang>=zh, og:locale=zh_CN', async () => {
    const { applyHtmlLang } = await import('../src/js/i18n/index.js');
    applyHtmlLang('zh');
    expect(document.documentElement.lang).toBe('zh');
    expect(document.querySelector('meta[property="og:locale"]').getAttribute('content')).toBe('zh_CN');
  });
});

/* ──────────────────────────────────────────────
   3) setLang — es/zh 가 SUPPORTED_LANGS 에 등록됨 (functional)
   ────────────────────────────────────────────── */
describe('setLang — es/zh 적용', () => {
  beforeEach(() => localStorage.clear());

  it('setLang(es) 후 getCurrentLang()===es', async () => {
    const { setLang, getCurrentLang } = await import('../src/js/i18n/index.js');
    const { setState } = await import('../src/js/state.js');
    setState('lang', 'ko');
    setLang('es');
    expect(getCurrentLang()).toBe('es');
  });

  it('setLang(zh) 후 getCurrentLang()===zh', async () => {
    const { setLang, getCurrentLang } = await import('../src/js/i18n/index.js');
    const { setState } = await import('../src/js/state.js');
    setState('lang', 'ko');
    setLang('zh');
    expect(getCurrentLang()).toBe('zh');
  });
});

/* ──────────────────────────────────────────────
   4) 소스 연결 (정적 검증)
   ────────────────────────────────────────────── */
describe('소스 연결 — 설정/에디터/서비스/코어', () => {
  it('i18n/index.js SUPPORTED_LANGS 와 OG_LOCALE_MAP 에 es/zh 가 있다', () => {
    const s = readFileSync(root('src/js/i18n/index.js'), 'utf8');
    expect(s).toMatch(/SUPPORTED_LANGS\s*=\s*\[[^\]]*'es'[^\]]*'zh'[^\]]*\]/);
    expect(s).toMatch(/es:\s*'es_ES'/);
    expect(s).toMatch(/zh:\s*'zh_CN'/);
  });

  it('settingsSections.js 가 lang_es / lang_zh 옵션을 렌더한다', () => {
    const s = readFileSync(root('src/js/components/settingsSections.js'), 'utf8');
    expect(s).toMatch(/settings\.lang_es/);
    expect(s).toMatch(/settings\.lang_zh/);
    expect(s).toMatch(/LANGS\s*=\s*\[[^\]]*'es'[^\]]*'zh'[^\]]*\]/);
  });

  it('userProfile.js SUPPORTED_LANGS 에 es/zh 가 있다', () => {
    const s = readFileSync(root('src/js/services/userProfile.js'), 'utf8');
    expect(s).toMatch(/SUPPORTED_LANGS\s*=\s*\[[^\]]*'es'[^\]]*'zh'[^\]]*\]/);
  });

  it('editor.js 에 es/zh 언어 탭과 formState 항목이 있다', () => {
    const s = readFileSync(root('src/js/pages/editor.js'), 'utf8');
    expect(s).toMatch(/data-lang="es"/);
    expect(s).toMatch(/data-lang="zh"/);
    /* formState 초기화에 es/zh 키가 등장 */
    const formStateIdx = s.indexOf('const formState');
    expect(formStateIdx).toBeGreaterThan(-1);
    const block = s.slice(formStateIdx, formStateIdx + 400);
    expect(block).toMatch(/\bes:\s*\{/);
    expect(block).toMatch(/\bzh:\s*\{/);
  });
});
