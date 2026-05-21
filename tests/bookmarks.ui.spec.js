import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  getBookmarkedStoriesMock,
  toggleBookmarkMock,
  openCardPopupMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getBookmarkedStoriesMock: vi.fn(),
  toggleBookmarkMock: vi.fn(),
  openCardPopupMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  setOnUnmount: vi.fn(),
}));

vi.mock('../src/js/state.js', () => ({
  getState: vi.fn((key) => ({ theme: 'system', fontSize: 'medium', lang: null }[key] ?? null)),
  setState: vi.fn(),
  subscribe: vi.fn(),
  applyTheme: vi.fn(),
}));

vi.mock('../src/js/services/bookmarks.js', () => ({
  getBookmarkedStories: getBookmarkedStoriesMock,
  toggleBookmark: toggleBookmarkMock,
}));

vi.mock('../src/js/pages/calendar.js', () => ({
  openCardPopup: openCardPopupMock,
}));

const { renderBookmarks } = await import('../src/js/pages/bookmarks.js');

function flush() {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
}

function makeStory(id, overrides = {}) {
  return {
    id,
    publish_date: '2026-04-14',
    historical_year: 1900,
    card_count: '1/365',
    country: 'Korea',
    figure_name: `Figure ${id}`,
    summary: `Summary ${id}`,
    image_url: `https://example.com/${id}.png`,
    ...overrides,
  };
}

describe('Bookmarks page', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    navigateMock.mockReset();
    getBookmarkedStoriesMock.mockReset();
    toggleBookmarkMock.mockReset();
    openCardPopupMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders mini cards with NaN-guarded date when publish_date is missing', async () => {
    getBookmarkedStoriesMock.mockResolvedValue([
      makeStory('s1', { publish_date: '' }),
    ]);

    const page = renderBookmarks();
    document.body.appendChild(page);

    await flush();

    const card = page.querySelector('.history-card-mini');
    expect(card).not.toBeNull();
    /* publish_date 비어있어도 NaN 문자열이 보이지 않아야 한다 */
    expect(page.textContent || '').not.toContain('NaN');
    /* 비어있는 publish_date는 dateMeta 영역도 비워둔다 (헬퍼 valid=false 분기) */
    const topRight = card?.querySelector('.mini-top-right');
    expect(topRight?.textContent || '').not.toMatch(/\d{4}\s*\/\s*\d{2}\s*\/\s*\d{2}/);
  });

  it('미니 카드 클릭 시 openCardPopup이 해당 스토리로 호출된다', async () => {
    const story = makeStory('story-42');
    getBookmarkedStoriesMock.mockResolvedValue([story]);

    const page = renderBookmarks();
    document.body.appendChild(page);
    await flush();

    const card = page.querySelector('.history-card-mini');
    expect(card).not.toBeNull();

    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(openCardPopupMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'story-42' }),
      'history',
      expect.arrayContaining(['story-42']),
      expect.any(Object),
    );
  });

  it('falls back to the original image when a bookmark thumbnail is missing', async () => {
    getBookmarkedStoriesMock.mockResolvedValue([
      makeStory('legacy-story', {
        image_url: 'https://example.com/legacy.png',
        image_thumb_url: '',
      }),
    ]);

    const page = renderBookmarks();
    document.body.appendChild(page);

    await flush();

    const image = page.querySelector('.history-card-mini img');
    expect(image?.getAttribute('src') || '').toContain('legacy.png');
    expect(image?.getAttribute('data-src')).toBeNull();
  });

  it('shows empty state when there are no bookmarks', async () => {
    getBookmarkedStoriesMock.mockResolvedValue([]);

    const page = renderBookmarks();
    document.body.appendChild(page);

    await flush();

    const emptyState = page.querySelector('.empty-state');
    expect(emptyState).not.toBeNull();
    expect(emptyState?.textContent || '').toContain('보관된 카드가 없습니다');
  });

  it('mini-top-right 최상단에 북마크 버튼이 active 상태로 렌더링된다', async () => {
    getBookmarkedStoriesMock.mockResolvedValue([makeStory('s1')]);

    const page = renderBookmarks();
    document.body.appendChild(page);
    await flush();

    const btn = page.querySelector('.mini-top-right .mini-bookmark-btn');
    expect(btn).not.toBeNull();
    expect(btn?.classList.contains('active')).toBe(true);
    expect(btn?.classList.contains('bookmark-btn')).toBe(true);
    const svg = btn?.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('북마크 버튼 클릭 시 카드 클릭 이벤트가 전파되지 않는다', async () => {
    getBookmarkedStoriesMock.mockResolvedValue([makeStory('s2')]);
    toggleBookmarkMock.mockResolvedValue({ bookmarked: false });

    const page = renderBookmarks();
    document.body.appendChild(page);
    await flush();

    navigateMock.mockReset();
    const btn = page.querySelector('.mini-bookmark-btn');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('북마크 버튼 클릭 시 toggleBookmark 서비스가 스토리 ID로 호출된다', async () => {
    getBookmarkedStoriesMock.mockResolvedValue([makeStory('s99')]);
    toggleBookmarkMock.mockResolvedValue({ bookmarked: false });

    const page = renderBookmarks();
    document.body.appendChild(page);
    await flush();

    const btn = page.querySelector('.mini-bookmark-btn');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(toggleBookmarkMock).toHaveBeenCalledWith('s99');
  });

  it('미니 카드 북마크 해제 후 카드 클릭 시 팝업 bookmarkedIds에서 제거된다', async () => {
    const story = makeStory('s-sync');
    getBookmarkedStoriesMock.mockResolvedValue([story]);
    toggleBookmarkMock.mockResolvedValue({ bookmarked: false });

    const page = renderBookmarks();
    document.body.appendChild(page);
    await flush();

    /* 북마크 해제 */
    const btn = page.querySelector('.mini-bookmark-btn');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    /* 카드 클릭 → 팝업 열기 */
    const card = page.querySelector('.history-card-mini');
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    /* bookmarkedIds에 s-sync가 없어야 한다 */
    const bookmarkedIds = openCardPopupMock.mock.calls[0]?.[2] ?? [];
    expect(bookmarkedIds).not.toContain('s-sync');
  });

  it('팝업에서 북마크 해제 시 onBookmarkChange 콜백으로 미니 버튼이 비활성화된다', async () => {
    const story = makeStory('s-popup-sync');
    getBookmarkedStoriesMock.mockResolvedValue([story]);

    const page = renderBookmarks();
    document.body.appendChild(page);
    await flush();

    /* 카드 클릭 → openCardPopup 호출됨, onBookmarkChange 콜백 캡처 */
    const card = page.querySelector('.history-card-mini');
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const callOpts = openCardPopupMock.mock.calls[0]?.[3];
    expect(callOpts?.onBookmarkChange).toBeTypeOf('function');

    /* 팝업에서 북마크 해제 시뮬레이션 */
    callOpts.onBookmarkChange('s-popup-sync', false);

    const miniBtn = page.querySelector('.mini-bookmark-btn[data-story-id="s-popup-sync"]');
    expect(miniBtn?.classList.contains('active')).toBe(false);
  });

  it('팝업에서 북마크 재활성화 시 미니 버튼도 active로 동기화된다', async () => {
    const story = makeStory('s-popup-rebook');
    getBookmarkedStoriesMock.mockResolvedValue([story]);
    toggleBookmarkMock.mockResolvedValue({ bookmarked: false });

    const page = renderBookmarks();
    document.body.appendChild(page);
    await flush();

    /* 미니 버튼으로 먼저 해제 */
    const btn = page.querySelector('.mini-bookmark-btn');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    /* 카드 클릭 → 팝업에서 재북마크 시뮬레이션 */
    const card = page.querySelector('.history-card-mini');
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const callOpts = openCardPopupMock.mock.calls[0]?.[3];
    callOpts.onBookmarkChange('s-popup-rebook', true);

    expect(btn?.classList.contains('active')).toBe(true);
  });

  it('uses class-based loading container instead of inline styles', () => {
    getBookmarkedStoriesMock.mockResolvedValue([]);
    const page = renderBookmarks();
    const archive = page.querySelector('#archive-content');
    /* 회귀: 인라인 style 정리 후 archive-content-loading 클래스가 사용되어야 한다 */
    expect(archive?.classList.contains('archive-content-loading')).toBe(true);
    expect(archive?.getAttribute('style') || '').not.toMatch(/display\s*:/);
  });
});
