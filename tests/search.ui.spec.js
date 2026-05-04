import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  fetchStoriesMock,
  searchStoriesDBMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  fetchStoriesMock: vi.fn(),
  searchStoriesDBMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  setOnUnmount: vi.fn(),
}));

vi.mock('../src/js/services/stories.js', () => ({
  fetchStories: fetchStoriesMock,
  searchStoriesDB: searchStoriesDBMock,
}));

const { renderSearch } = await import('../src/js/pages/search.js');

function flush() {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
}

function makeStory(id, overrides = {}) {
  return {
    id,
    publish_date: '2026-04-14',
    country: 'Korea',
    figure_name: `Figure ${id}`,
    summary: `Summary ${id}`,
    image_url: `https://example.com/${id}.png`,
    ...overrides,
  };
}

describe('Search page', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    navigateMock.mockReset();
    fetchStoriesMock.mockReset();
    searchStoriesDBMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('escapes HTML in story summary so XSS payloads do not execute', async () => {
    const xssPayload = '<img src=x onerror="window.__xss=true">';
    fetchStoriesMock.mockResolvedValue([
      makeStory('s1', { summary: xssPayload, figure_name: xssPayload }),
    ]);

    const page = renderSearch();
    document.body.appendChild(page);

    await flush();

    const item = page.querySelector('.search-result-item');
    expect(item).not.toBeNull();
    /* 원본 HTML 태그 형태로는 DOM에 들어가지 않아야 한다 */
    expect(item?.querySelector('img[src="x"]')).toBeNull();
    /* escapeHtml을 거쳐 텍스트로 표시되어야 한다 */
    expect(item?.textContent || '').toContain('<img src=x onerror=');
    expect(window.__xss).toBeUndefined();
  });

  it('navigates to detail page when a search result item is clicked', async () => {
    fetchStoriesMock.mockResolvedValue([makeStory('story-7')]);

    const page = renderSearch();
    document.body.appendChild(page);

    await flush();

    const item = page.querySelector('.search-result-item');
    expect(item).not.toBeNull();

    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/detail/story-7');
  });

  it('uses class-based loading container instead of inline styles', () => {
    fetchStoriesMock.mockResolvedValue([]);
    const page = renderSearch();
    const loading = page.querySelector('.search-results-loading');
    /* 회귀: 인라인 style 정리 후 search-results-loading 클래스가 사용되어야 한다 */
    expect(loading).not.toBeNull();
    expect(loading?.getAttribute('style') || '').not.toMatch(/display\s*:/);
  });
});
