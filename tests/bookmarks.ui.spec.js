import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  getBookmarkedStoriesMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getBookmarkedStoriesMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  setOnUnmount: vi.fn(),
}));

vi.mock('../src/js/services/bookmarks.js', () => ({
  getBookmarkedStories: getBookmarkedStoriesMock,
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

  it('navigates to detail page when a mini card is clicked', async () => {
    getBookmarkedStoriesMock.mockResolvedValue([makeStory('story-42')]);

    const page = renderBookmarks();
    document.body.appendChild(page);

    await flush();

    const card = page.querySelector('.history-card-mini');
    expect(card).not.toBeNull();

    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/detail/story-42');
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

  it('uses class-based loading container instead of inline styles', () => {
    getBookmarkedStoriesMock.mockResolvedValue([]);
    const page = renderBookmarks();
    const archive = page.querySelector('#archive-content');
    /* 회귀: 인라인 style 정리 후 archive-content-loading 클래스가 사용되어야 한다 */
    expect(archive?.classList.contains('archive-content-loading')).toBe(true);
    expect(archive?.getAttribute('style') || '').not.toMatch(/display\s*:/);
  });
});
