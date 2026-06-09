import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* 같은 publish_date 를 가진 스토리가 여러 건일 때(에디터 중복 발행 등),
   캘린더 셀은 날짜당 1건만 보이지만 스와이프 팝업 묶음에 중복이 새던 회귀를 방지한다.
   (예: 1월 한 달에 31일 초과 35장이 잡혀 "1월 23일 카드 여러 장"으로 넘어가던 버그) */

vi.mock('../src/js/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../src/js/services/stories.js', () => ({ fetchStories: vi.fn() }));
vi.mock('../src/js/services/mystories.js', () => ({ fetchMyStories: vi.fn() }));
vi.mock('../src/js/services/bookmarks.js', () => ({
  toggleBookmark: vi.fn(),
  getBookmarkedStoryIds: vi.fn(),
}));
vi.mock('../src/js/services/collection.js', () => ({
  collect: vi.fn(() => ({ ok: true })),
  isCollected: vi.fn(() => true),
  canCollect: vi.fn(() => true),
  bulkCollect: vi.fn(),
}));
vi.mock('../src/js/components/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../src/js/services/firebase.js', () => ({ auth: { currentUser: null } }));
vi.mock('../src/js/state.js', () => ({ getState: vi.fn(() => null) }));
vi.mock('../src/js/services/sharing.js', () => ({
  shareStory: vi.fn(),
  captureAndShareCard: vi.fn(),
}));
vi.mock('../src/js/i18n/index.js', () => ({
  getCurrentLang: vi.fn(() => 'ko'),
  t: vi.fn((key) => key),
}));
vi.mock('../src/js/utils/scrollLock.js', () => ({
  lockScroll: vi.fn(),
  unlockScroll: vi.fn(),
}));
vi.mock('../src/js/components/confirmDialog.js', () => ({ showConfirm: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn() },
  ImpactStyle: { Light: 'light' },
}));

const { renderGrid } = await import('../src/js/pages/calendar.js');

function makeStory(id, isoDate) {
  return {
    id,
    publish_date: isoDate,
    historical_year: '1830',
    country: '프랑스',
    image_url: 'https://example.com/story.png',
    figure_name: '제목',
    body: '본문',
    editor: { displayName: 'ED' },
  };
}

function buildPage() {
  const page = document.createElement('div');
  page.innerHTML = `
    <div id="cal-month-label"></div>
    <button id="cal-next-month"></button>
    <div id="calendar-grid"></div>
  `;
  return page;
}

describe('calendar swipe set deduplicates by publish_date', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 1; });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('Given multiple stories sharing one date, when a cell is clicked, then the popup swipe set has one card per date', () => {
    const page = buildPage();
    document.body.appendChild(page);

    /* 1월 23일에 3건 중복 발행 + 다른 2개 날짜 = 고유 날짜 3개 */
    const stories = [
      makeStory('a', '2026-01-23'),
      makeStory('b', '2026-01-23'),
      makeStory('c', '2026-01-23'),
      makeStory('d', '2026-01-10'),
      makeStory('e', '2026-01-15'),
    ];
    const today = new Date(2026, 5, 9); // 2026-06-09
    const state = {
      mode: 'history',
      year: 2026,
      month: 0, // January
      historyStories: stories,
      myStories: [],
      bookmarkedIds: [],
    };

    renderGrid(page, state, today);

    const cell = page.querySelector('.cal-cell-has-story[data-date="2026-01-23"]');
    expect(cell).toBeTruthy();
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const nav = document.querySelector('.calendar-card-popup-nav');
    expect(nav).toBeTruthy();
    /* 고유 날짜 3개 → "1 / 3" 형태. 중복이 새면 "1 / 5" 가 되어 실패한다. */
    expect(nav.textContent).toMatch(/\/\s*3\s*$/);
  });
});
