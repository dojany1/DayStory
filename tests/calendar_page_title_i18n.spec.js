// @vitest-environment jsdom
/* =====================================================================
   calendar_page_title_i18n.spec.js
   ---------------------------------------------------------------------
   .calendar-page-title 다국어화 검증
   - mystory / editorstory 가 한국어 리터럴 대신 t() 로 제목을 넘긴다
   - calendar.page_title_mine / page_title_history 키가 5개 로케일에 존재한다
   - buildCardDeck 이 전달받은 제목을 .calendar-page-title 로 렌더한다
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = (p) => resolve(process.cwd(), p);
const readJson = (p) => JSON.parse(readFileSync(root(p), 'utf8'));
const LANGS = ['ko', 'en', 'ja', 'es', 'zh'];

/* ──────────────────────────────────────────────
   1) 번역 키 존재 (5개 로케일)
   ────────────────────────────────────────────── */
describe('번역 키 — calendar.page_title_*', () => {
  it.each(LANGS)('%s.json 에 page_title_mine / page_title_history 가 있다', (lang) => {
    const dict = readJson(`src/i18n/${lang}.json`);
    expect(dict.calendar.page_title_mine, `${lang}.json calendar.page_title_mine`).toBeTruthy();
    expect(dict.calendar.page_title_history, `${lang}.json calendar.page_title_history`).toBeTruthy();
  });

  it('ko 를 제외한 로케일 값에 한글이 남아있지 않다', () => {
    LANGS.filter((l) => l !== 'ko').forEach((lang) => {
      const dict = readJson(`src/i18n/${lang}.json`);
      expect(dict.calendar.page_title_mine, `${lang} page_title_mine`).not.toMatch(/[가-힣]/);
      expect(dict.calendar.page_title_history, `${lang} page_title_history`).not.toMatch(/[가-힣]/);
    });
  });
});

/* ──────────────────────────────────────────────
   2) 호출부 정적 검증 — 한국어 리터럴 제거
   ────────────────────────────────────────────── */
describe('소스 연결 — calendarTitle 은 t() 로만 전달된다', () => {
  it('mystory.js 가 t(\'calendar.page_title_mine\') 를 넘긴다', () => {
    const s = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    expect(s).toMatch(/calendarTitle:\s*t\(\s*'calendar\.page_title_mine'\s*\)/);
  });

  it('editorstory.js 가 t(\'calendar.page_title_history\') 를 넘긴다', () => {
    const s = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    expect(s).toMatch(/calendarTitle:\s*t\(\s*'calendar\.page_title_history'\s*\)/);
  });

  it('어떤 페이지도 calendarTitle 에 한글 리터럴을 넘기지 않는다', () => {
    ['src/js/pages/mystory.js', 'src/js/pages/editorstory.js'].forEach((p) => {
      const s = readFileSync(root(p), 'utf8');
      expect(s, `${p} 에 하드코딩된 한글 calendarTitle`).not.toMatch(/calendarTitle:\s*['"`][^'"`]*[가-힣]/);
    });
  });
});

/* ──────────────────────────────────────────────
   3) 렌더 검증 — buildCardDeck 이 제목을 그대로 출력
   ────────────────────────────────────────────── */
vi.mock('../src/js/state.js', () => ({
  setState: vi.fn(),
  getState: () => 'ko',
  subscribe: vi.fn(),
}));
vi.mock('../src/js/router.js', () => ({ setOnUnmount: vi.fn() }));
vi.mock('../src/js/utils/date.js', () => ({ getLocalToday: () => '2026-06-03' }));
vi.mock('../src/js/utils/cardSwiper.js', () => ({ createCardSwiper: vi.fn() }));
vi.mock('../src/js/pages/calendar.js', () => ({
  getWeekdays: () => ['일', '월', '화', '수', '목', '금', '토'],
  isAtCurrentMonth: vi.fn(() => true),
  renderGrid: vi.fn(),
}));

const { buildCardDeck } = await import('../src/js/components/cardDeck/cardDeckController.js');

describe('cardDeckController — calendar-page-title 렌더', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    localStorage.clear();
  });

  it('Given a localized title, when the deck builds, then .calendar-page-title shows it', () => {
    const page = buildCardDeck({
      idPrefix: 'titledeck',
      pageClass: 'titledeck-page',
      calMode: 'mine',
      lastDateKey: 'lastMyStoryDate',
      calendarTitle: 'My Diary',
      loadData: async () => ({ stories: [], initialDate: '2026-06-03', calStores: {}, bookmarkedIds: [] }),
      renderSlideHTML: () => '<div></div>',
      bindCard: () => {},
    });

    expect(page.querySelector('.calendar-page-title')?.textContent).toBe('My Diary');
  });

  it('Given no title, when the deck builds, then no .calendar-page-title node is emitted', () => {
    const page = buildCardDeck({
      idPrefix: 'notitledeck',
      pageClass: 'notitledeck-page',
      calMode: 'history',
      lastDateKey: 'lastEditorStoryDate',
      loadData: async () => ({ stories: [], initialDate: '2026-06-03', calStores: {}, bookmarkedIds: [] }),
      renderSlideHTML: () => '<div></div>',
      bindCard: () => {},
    });

    expect(page.querySelector('.calendar-page-title')).toBeNull();
  });
});
