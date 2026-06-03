import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  lockScrollMock,
  unlockScrollMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  lockScrollMock: vi.fn(),
  unlockScrollMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
}));

vi.mock('../src/js/services/stories.js', () => ({
  fetchStories: vi.fn(),
}));

vi.mock('../src/js/services/mystories.js', () => ({
  fetchMyStories: vi.fn(),
}));

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

vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../src/js/firebase.js', () => ({
  auth: { currentUser: null },
}));

vi.mock('../src/js/state.js', () => ({
  getState: vi.fn(() => null),
}));

vi.mock('../src/js/services/sharing.js', () => ({
  shareStory: vi.fn(),
  captureAndShareCard: vi.fn(),
}));

vi.mock('../src/js/i18n/index.js', () => ({
  getCurrentLang: vi.fn(() => 'ko'),
  t: vi.fn((key) => key),
}));

vi.mock('../src/js/utils/scrollLock.js', () => ({
  lockScroll: lockScrollMock,
  unlockScroll: unlockScrollMock,
}));

vi.mock('../src/js/components/confirmDialog.js', () => ({
  showConfirm: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
  },
  ImpactStyle: {
    Light: 'light',
  },
}));

const { openCardPopup } = await import('../src/js/pages/calendar.js');

function makeStory() {
  return {
    id: 'story-1',
    publish_date: '2026-06-03',
    historical_year: '1937',
    country: '영국',
    image_url: 'https://example.com/story.png',
    figure_name: '왕위보다 사랑',
    body: '본문',
    editor_comment: '에디터 코멘트',
    editor: { displayName: 'HU DOK' },
  };
}

describe('calendar card popup detail transition', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    navigateMock.mockReset();
    lockScrollMock.mockReset();
    unlockScrollMock.mockReset();
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      callback();
      return 1;
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('Given a calendar card popup is open, when detail is opened, then the popup should remain open behind the detail sheet', () => {
    openCardPopup(makeStory(), 'history', []);

    const popup = document.querySelector('.calendar-card-popup');
    expect(popup?.classList.contains('open')).toBe(true);

    document.querySelector('.card-detail-shortcut-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/detail/story-1');
    expect(unlockScrollMock).not.toHaveBeenCalled();
    expect(document.querySelector('.calendar-card-popup')).toBe(popup);
    expect(popup?.classList.contains('open')).toBe(true);
  });
});
