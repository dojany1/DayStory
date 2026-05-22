import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  getParamsMock,
  getStateMock,
  setStateMock,
  getBookmarkedStoriesMock,
  getBookmarkedStoryIdsMock,
  toggleBookmarkMock,
  fetchStoriesMock,
  fetchTodayStoryMock,
  fetchMyStoriesMock,
  fetchMyStoryByIdMock,
  createMyStoryMock,
  updateMyStoryMock,
  deleteMyStoryMock,
  showConfirmMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getParamsMock: vi.fn(),
  getStateMock: vi.fn(),
  setStateMock: vi.fn(),
  getBookmarkedStoriesMock: vi.fn(),
  getBookmarkedStoryIdsMock: vi.fn(),
  toggleBookmarkMock: vi.fn(),
  fetchStoriesMock: vi.fn(),
  fetchTodayStoryMock: vi.fn(),
  fetchMyStoriesMock: vi.fn(),
  fetchMyStoryByIdMock: vi.fn(),
  createMyStoryMock: vi.fn(),
  updateMyStoryMock: vi.fn(),
  deleteMyStoryMock: vi.fn(),
  showConfirmMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  getParams: getParamsMock,
  setOnUnmount: vi.fn(),
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
  setState: setStateMock,
}));

vi.mock('../src/js/services/bookmarks.js', () => ({
  getBookmarkedStories: getBookmarkedStoriesMock,
  getBookmarkedStoryIds: getBookmarkedStoryIdsMock,
  toggleBookmark: toggleBookmarkMock,
}));

vi.mock('../src/js/services/stories.js', () => ({
  fetchStories: fetchStoriesMock,
  fetchTodayStory: fetchTodayStoryMock,
}));

vi.mock('../src/js/services/mystories.js', () => ({
  fetchMyStories: fetchMyStoriesMock,
  fetchMyStoryById: fetchMyStoryByIdMock,
  createMyStory: createMyStoryMock,
  updateMyStory: updateMyStoryMock,
  deleteMyStory: deleteMyStoryMock,
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../src/js/components/confirmDialog.js', () => ({
  showConfirm: showConfirmMock,
}));

vi.mock('../src/js/firebase.js', () => ({
  auth: {
    currentUser: { uid: 'user-1' },
  },
  db: {},
  storage: {},
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('browser-image-compression', () => ({
  default: vi.fn(),
}));

vi.mock('cropperjs', () => ({
  default: class CropperMock {
    destroy() {}
    rotate() {}
    getCroppedCanvas() {
      return {
        toBlob(callback) {
          callback(new Blob(['test'], { type: 'image/jpeg' }));
        },
      };
    }
  },
}));

vi.mock('cropperjs/dist/cropper.css', () => ({}));

const { renderProfile } = await import('../src/js/pages/profile.js');
const { renderSettings } = await import('../src/js/pages/settings.js');
const { renderEditorStory } = await import('../src/js/pages/editorstory.js');
const { renderMyStory, renderMyStoryNew } = await import('../src/js/pages/mystory.js');

function makeEditorStory(day) {
  const paddedDay = String(day).padStart(2, '0');
  return {
    id: `editor-${day}`,
    publish_date: `2026-04-${paddedDay}`,
    historical_year: `190${day}`,
    historical_date: `190${day}-04-${paddedDay}`,
    card_count: `${day}/365`,
    country: 'Korea',
    image_url: `https://example.com/editor-${day}.png`,
    figure_name: `Editor Story ${day}`,
    summary: `Summary ${day}`,
    body: `Body ${day}`,
    editor_comment: `Comment ${day}`,
    editor: {
      displayName: 'Editor',
      photoURL: '',
    },
  };
}

function makeMyStory(day) {
  const paddedDay = String(day).padStart(2, '0');
  return {
    id: `my-${day}`,
    uid: 'user-1',
    publish_date: `2026-04-${paddedDay}`,
    title: `My Story ${day}`,
    body: `Body ${day}`,
    image_url: `https://example.com/my-${day}.png`,
  };
}

function setDefaultState() {
  getStateMock.mockImplementation((key) => {
    if (key === 'user') {
      return {
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'User',
      };
    }

    if (key === 'profile') {
      return {
        nickname: 'User',
      };
    }

    return null;
  });
}

function cleanupGlobalMouseHandlers() {
  if (window._editorStoryMouseMove) {
    window.removeEventListener('mousemove', window._editorStoryMouseMove);
    delete window._editorStoryMouseMove;
  }

  if (window._editorStoryMouseUp) {
    window.removeEventListener('mouseup', window._editorStoryMouseUp);
    delete window._editorStoryMouseUp;
  }

  if (window._myStoryMouseMove) {
    window.removeEventListener('mousemove', window._myStoryMouseMove);
    delete window._myStoryMouseMove;
  }

  if (window._myStoryMouseUp) {
    window.removeEventListener('mouseup', window._myStoryMouseUp);
    delete window._myStoryMouseUp;
  }
}

async function flushTimers(ms = 0) {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
}

function dispatchTouchSwipe(target, startX, endX) {
  const touchStartEvent = new Event('touchstart', { bubbles: true, cancelable: true });
  Object.defineProperty(touchStartEvent, 'touches', {
    value: [{ clientX: startX, clientY: 20 }],
  });
  target.dispatchEvent(touchStartEvent);

  const touchMoveEvent = new Event('touchmove', { bubbles: true, cancelable: true });
  Object.defineProperty(touchMoveEvent, 'touches', {
    value: [{ clientX: endX, clientY: 20 }],
  });
  target.dispatchEvent(touchMoveEvent);

  const touchEndEvent = new Event('touchend', { bubbles: true, cancelable: true });
  Object.defineProperty(touchEndEvent, 'changedTouches', {
    value: [{ clientX: endX, clientY: 20 }],
  });
  target.dispatchEvent(touchEndEvent);
}

function dispatchMouseSwipe(target, startX, endX) {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: startX, clientY: 20 }));
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: endX, clientY: 20 }));
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: endX, clientY: 20 }));
}

describe('Regression bugs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:00:00'));

    document.body.innerHTML = '';
    cleanupGlobalMouseHandlers();
    localStorage.clear();

    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }

    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    }

    if (!window.cancelAnimationFrame) {
      window.cancelAnimationFrame = (handle) => clearTimeout(handle);
    }

    navigateMock.mockReset();
    getParamsMock.mockReset();
    getStateMock.mockReset();
    setStateMock.mockReset();
    getBookmarkedStoriesMock.mockReset();
    getBookmarkedStoryIdsMock.mockReset();
    toggleBookmarkMock.mockReset();
    fetchStoriesMock.mockReset();
    fetchTodayStoryMock.mockReset();
    fetchMyStoriesMock.mockReset();
    fetchMyStoryByIdMock.mockReset();
    createMyStoryMock.mockReset();
    updateMyStoryMock.mockReset();
    deleteMyStoryMock.mockReset();
    showConfirmMock.mockReset();

    setDefaultState();
    getParamsMock.mockReturnValue({});
    getBookmarkedStoryIdsMock.mockResolvedValue([]);
    toggleBookmarkMock.mockResolvedValue({ bookmarked: true, error: null });
  });

  afterEach(() => {
    cleanupGlobalMouseHandlers();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
  });

  it('Given the bottom nav archive item, when index markup is inspected, then the bookmarks route should use an archive box icon instead of the bookmark ribbon', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const navButton = html.match(/<button[\s\S]*?id="nav-bookmarks"[\s\S]*?<\/button>/)?.[0] || '';

    expect(navButton).toMatch(/data-route="\/bookmarks"/);
    expect(navButton).toMatch(/<path d="M21 8v13H3V8"><\/path>/);
    expect(navButton).toMatch(/<path d="M1 3h22v5H1z"><\/path>/);
    expect(navButton).toMatch(/<path d="M10 12h4"><\/path>/);
    expect(navButton).not.toMatch(/M19 21l-7-5-7 5/);
  });

  it('Given haptics are removed, when app sources and dependencies are inspected, then no haptics plugin or calls should remain', () => {
    const packageJson = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const myStory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');
    const appSource = [editorStory, calendar, myStory].join('\n');

    expect(packageJson).not.toMatch(/@capacitor\/haptics/);
    expect(appSource).not.toMatch(/@capacitor\/haptics/);
    expect(appSource).not.toMatch(/\bHaptics\b/);
    expect(appSource).not.toMatch(/\bImpactStyle\b/);
  });

  it('Given the profile tab is now the settings page, when the page renders, then the bookmark search bar and bookmark grid should not appear (moved to /bookmarks)', () => {
    const page = renderProfile();
    document.body.appendChild(page);

    expect(page.querySelector('#collection-search-bar')).toBeNull();
    expect(page.querySelector('.profile-collection-toolbar')).toBeNull();
    expect(page.querySelector('.history-card-mini')).toBeNull();
    expect(page.querySelector('.archive-grid')).toBeNull();
  });

  it('Given the profile tab is now the settings page, when the page renders, then the settings sections (display/account/app info) should be inlined and the header should read 설정', () => {
    const page = renderProfile();
    document.body.appendChild(page);

    expect(page.querySelector('.page-header-title')?.textContent?.trim()).toBe('설정');
    expect(page.querySelector('.theme-option-group')).not.toBeNull();
    expect(page.querySelector('#setting-logout')).not.toBeNull();
    expect(page.querySelector('#setting-tutorial')).toBeNull();
    expect(page.querySelector('#setting-license')).not.toBeNull();
    expect(page.querySelector('#setting-widget-theme')).toBeNull();
  });

  it('Given the profile tab renders the settings page, when CSS is inspected, then the user card avatar and row icons should be bounded', () => {
    const pagesCss = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const componentsCss = readFileSync(resolve(process.cwd(), 'src/css/components.css'), 'utf8');
    const avatarRule = pagesCss.match(/\.profile-avatar-wrap\s*\{[\s\S]*?\}/)?.[0];
    const avatarMediaRule = pagesCss.match(/\.profile-avatar-wrap\s+img,\s*\.profile-avatar-wrap\s+svg\s*\{[\s\S]*?\}/)?.[0];
    const listIconRule = componentsCss.match(/\.list-item-icon\s+svg\s*\{[\s\S]*?\}/)?.[0];
    const themeOptionRule = pagesCss.match(/\.theme-option\s*\{[\s\S]*?\}/)?.[0];

    expect(avatarRule).toMatch(/width:\s*56px/);
    expect(avatarRule).toMatch(/height:\s*56px/);
    expect(avatarRule).toMatch(/overflow:\s*hidden/);
    expect(avatarMediaRule).toMatch(/object-fit:\s*cover/);
    expect(listIconRule).toMatch(/width:\s*22px/);
    expect(listIconRule).toMatch(/height:\s*22px/);
    expect(themeOptionRule).toMatch(/border:\s*0/);
    expect(themeOptionRule).toMatch(/background:\s*transparent/);
  });

  it('Given tutorials are removed, when app sources are inspected, then no tutorial runner or replay setting should remain', () => {
    const router = readFileSync(resolve(process.cwd(), 'src/js/router.js'), 'utf8');
    const settingsSections = readFileSync(resolve(process.cwd(), 'src/js/components/settingsSections.js'), 'utf8');
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');
    const pagesCss = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');

    expect(router).not.toMatch(/tutorialTour/);
    expect(router).not.toMatch(/renderTutorialTourForRoute/);
    expect(settingsSections).not.toMatch(/startTutorialTour/);
    expect(settingsSections).not.toMatch(/setting-tutorial/);
    expect(editorStory).not.toMatch(/showTutorial/);
    expect(editorStory).not.toMatch(/tutorial_done/);
    expect(pagesCss).not.toMatch(/tutorial-panel/);
    expect(pagesCss).not.toMatch(/tour-overlay/);
  });

  it('Given an admin account on the settings page, when the editor tools section renders, then the content manager label should not include broken markup text', () => {
    getStateMock.mockImplementation((key) => {
      if (key === 'user') {
        return {
          id: 'admin-1',
          email: 'admin@example.com',
          displayName: 'Admin',
        };
      }

      if (key === 'profile') {
        return {
          nickname: 'Admin',
          role: 'editor',
        };
      }

      if (key === 'theme') return 'light';
      if (key === 'fontSize') return 'base';

      return null;
    });

    const page = renderSettings();
    document.body.appendChild(page);

    const editorItem = page.querySelector('#setting-editor');
    const editorTitle = editorItem?.querySelector('.list-item-title');

    expect(editorItem).not.toBeNull();
    expect(editorTitle?.textContent).not.toContain('/div');
    expect(editorTitle?.textContent).not.toContain('작성');
  });

  it('Given admin login can happen through auth state, email login, Google login, or signup, when admin emails are inspected, then every path should use the same allowlist', () => {
    const mainSource = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');
    const loginSource = readFileSync(resolve(process.cwd(), 'src/js/pages/login.js'), 'utf8');
    const adminListPattern = /ADMIN_EMAILS\s*=\s*\[([\s\S]*?)\]/g;
    const parseEmails = (source) => Array.from(source.matchAll(adminListPattern)).map((match) => (
      Array.from(match[1].matchAll(/'([^']+)'/g)).map((emailMatch) => emailMatch[1]).sort()
    ));

    const mainAdminLists = parseEmails(mainSource);
    const loginAdminLists = parseEmails(loginSource);
    const canonicalAdminEmails = mainAdminLists[0];

    expect(canonicalAdminEmails).toContain('ldj729@gmail.com');
    expect(loginAdminLists.length).toBeGreaterThanOrEqual(3);
    loginAdminLists.forEach((adminEmails) => {
      expect(adminEmails).toEqual(canonicalAdminEmails);
    });
  });

  it('Given the notification settings sheet is already open, when the settings row fires again, then the existing sheet should be reused', () => {
    getStateMock.mockImplementation((key) => {
      if (key === 'theme') return 'light';
      return null;
    });

    const page = renderSettings();
    document.body.appendChild(page);

    const notificationRow = page.querySelector('#setting-notifications');
    notificationRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const firstOverlay = document.querySelector('.notification-settings-overlay');
    expect(firstOverlay).not.toBeNull();

    notificationRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const overlays = document.querySelectorAll('.notification-settings-overlay');
    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toBe(firstOverlay);
  });

  it('Given the notification settings page opens, when source is inspected, then it should use a right-slide page transition', () => {
    const sheetSource = readFileSync(resolve(process.cwd(), 'src/js/components/notificationSettingsSheet.js'), 'utf8');
    const componentsCss = readFileSync(resolve(process.cwd(), 'src/css/components.css'), 'utf8');

    expect(componentsCss).toMatch(/\.notification-settings-overlay[\s\S]*?translateX\(100%\)/);
    expect(componentsCss).toMatch(/\.notification-settings-overlay\.visible/);
    expect(sheetSource).toMatch(/classList\.add\('visible'\)/);
    expect(sheetSource).toMatch(/classList\.remove\('visible'\)/);
    expect(sheetSource).not.toMatch(/bindSheetDragDismiss/);
  });

  it('Given an editor story swipe on mobile, when a compatibility mouse gesture follows the touch swipe, then the date should advance only once', async () => {
    const stories = [makeEditorStory(24), makeEditorStory(25), makeEditorStory(26)];
    fetchStoriesMock.mockResolvedValue(stories);
    fetchTodayStoryMock.mockResolvedValue(makeEditorStory(26));
    localStorage.setItem('daystory:daily-letter-opened:editor-26', 'true');

    const page = renderEditorStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const flipper = page.querySelector('.flipper');
    expect(flipper).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(300);
    dispatchMouseSwipe(flipper, 100, 220);
    await flushTimers(600);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('Editor Story 25');
  });

  it('Given a my-story swipe on mobile, when a compatibility mouse gesture follows the touch swipe, then the date should advance only once', async () => {
    vi.setSystemTime(new Date('2026-04-26T12:00:00'));
    getParamsMock.mockReturnValue({ date: '2026-04-26' });
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(24), makeMyStory(25), makeMyStory(26)]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const flipper = page.querySelector('.flipper');
    expect(flipper).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(300);
    dispatchMouseSwipe(flipper, 100, 220);
    await flushTimers(600);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('My Story 25');
  });

  it('Given an empty my-story date, when the card renders, then the write button should say 나의 일화 쓰기', async () => {
    getParamsMock.mockReturnValue({ date: '2026-04-24' });
    fetchMyStoriesMock.mockResolvedValue([]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const writeButtonText = page.querySelector('.mystory-write-btn')?.textContent || '';

    expect(writeButtonText).toContain('나의 일화 쓰기');
    expect(writeButtonText).not.toContain('이 날의 일화 쓰기');
  });

  it('Given a saved my-story card, when it renders, then the front card should show the year in the year slot and month-day in the date slot', async () => {
    getParamsMock.mockReturnValue({ date: '2026-04-24' });
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(24)]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    expect(page.querySelector('.card-year')?.textContent?.trim()).toBe('2026');
    expect(page.querySelector('.card-date')?.textContent?.trim()).toBe('4. 24');
  });

  it('Given a saved my-story card, when it renders, then actions should match content cards with share and edit only', async () => {
    getParamsMock.mockReturnValue({ date: '2026-04-24' });
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(24)]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    expect(page.querySelector('.share-my-story-btn[aria-label="공유"]')).not.toBeNull();
    expect(page.querySelector('.edit-my-story-btn[aria-label="수정"]')).not.toBeNull();
    expect(page.querySelector('.delete-my-story-btn')).toBeNull();

    page.querySelector('.edit-my-story-btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/mystory/new?edit=my-24');
  });

  it('Given a my-story is opened for editing, when delete is confirmed there, then the story should be deleted from the edit screen', async () => {
    getParamsMock.mockReturnValue({ edit: 'my-24' });
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(24)]);
    fetchMyStoryByIdMock.mockResolvedValue(makeMyStory(24));
    showConfirmMock.mockResolvedValue(true);

    const page = renderMyStoryNew();
    document.body.appendChild(page);

    await flushTimers(0);
    await flushTimers(0);

    const deleteButton = page.querySelector('#delete-my-story-edit');

    expect(deleteButton).not.toBeNull();

    deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushTimers(0);

    expect(showConfirmMock).toHaveBeenCalledWith(expect.objectContaining({
      confirmText: '삭제',
      danger: true,
    }));
    expect(deleteMyStoryMock).toHaveBeenCalledWith('my-24');
    expect(navigateMock).toHaveBeenCalledWith('/mystory', { date: '2026-04-24' });
  });

  it('Given an empty my-story card, when the user swipes to the previous day, then the page should navigate to the adjacent date card instead of blocking the swipe', async () => {
    getParamsMock.mockReturnValue({ date: '2026-04-24' });
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(23)]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const flipper = page.querySelector('.flipper');
    expect(flipper).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(600);

    const title = page.querySelector('.card-image-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('My Story 23');
  });
});
