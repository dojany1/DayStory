import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function listJsFiles(dir) {
  const out = [];
  const entries = readdirSync(dir);
  for (const name of entries) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

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
  imageCompressionMock,
  storageRefMock,
  uploadBytesMock,
  getDownloadURLMock,
  cropperCanvasOptions,
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
  imageCompressionMock: vi.fn(),
  storageRefMock: vi.fn(),
  uploadBytesMock: vi.fn(),
  getDownloadURLMock: vi.fn(),
  cropperCanvasOptions: [],
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

vi.mock('../src/js/firebase.js', () => ({
  auth: {
    currentUser: { uid: 'user-1' },
  },
  db: {},
  storage: {},
}));

vi.mock('firebase/storage', () => ({
  ref: storageRefMock,
  uploadBytes: uploadBytesMock,
  getDownloadURL: getDownloadURLMock,
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn().mockResolvedValue(undefined),
    selectionChanged: vi.fn().mockResolvedValue(undefined),
  },
  ImpactStyle: {
    Light: 'Light',
    Medium: 'Medium',
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('browser-image-compression', () => ({
  default: imageCompressionMock,
}));

vi.mock('cropperjs', () => ({
  default: class CropperMock {
    destroy() {}
    rotate() {}
    getCroppedCanvas(options) {
      cropperCanvasOptions.push(options);
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
const { renderBookmarks } = await import('../src/js/pages/bookmarks.js');

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

function makeEditorStoryOnDate(isoDate, title) {
  return {
    ...makeEditorStory(Number(isoDate.slice(-2))),
    id: `editor-${isoDate}`,
    publish_date: isoDate,
    historical_date: `1900-${isoDate.slice(5)}`,
    figure_name: title,
    image_url: `https://example.com/${isoDate}.png`,
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

function makeMyStoryOnDate(isoDate, title) {
  return {
    ...makeMyStory(Number(isoDate.slice(-2))),
    id: `my-${isoDate}`,
    publish_date: isoDate,
    title,
    image_url: `https://example.com/my-${isoDate}.png`,
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
    imageCompressionMock.mockReset();
    storageRefMock.mockReset();
    uploadBytesMock.mockReset();
    getDownloadURLMock.mockReset();
    cropperCanvasOptions.length = 0;

    setDefaultState();
    getParamsMock.mockReturnValue({});
    getBookmarkedStoryIdsMock.mockResolvedValue([]);
    toggleBookmarkMock.mockResolvedValue({ bookmarked: true, error: null });
    imageCompressionMock.mockImplementation(async (file) => file);
    storageRefMock.mockReturnValue({ fullPath: 'users/user-1/diary/test.jpg' });
    uploadBytesMock.mockResolvedValue(undefined);
    getDownloadURLMock.mockResolvedValue('https://firebasestorage.googleapis.com/edited.jpg');
  });

  afterEach(() => {
    cleanupGlobalMouseHandlers();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
  });

  it('Given many bookmarks on a slow device, when bookmark loading exceeds five seconds, then the bookmarks page should still render the saved cards instead of timing out', async () => {
    getBookmarkedStoriesMock.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => {
        resolve([makeEditorStory(24)]);
      }, 5500);
    }));

    const page = renderBookmarks();
    document.body.appendChild(page);

    await flushTimers(5500);

    expect(page.querySelector('.history-card-mini')).not.toBeNull();
  });

  it('Given the bookmarks page collection search, when the page renders, then the saved-story title should be removed and the search bar should fill the row proportionally', () => {
    getBookmarkedStoriesMock.mockResolvedValue([]);

    const page = renderBookmarks();
    document.body.appendChild(page);

    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const searchRule = css.match(/\.profile-collection-search\s*\{[\s\S]*?\}/)?.[0];
    const searchBar = page.querySelector('#collection-search-bar');

    expect(page.textContent || '').not.toContain('보관한 스토리');
    expect(page.querySelector('.profile-collection-toolbar')).not.toBeNull();
    expect(searchBar).not.toBeNull();
    expect(searchBar?.classList.contains('profile-collection-search')).toBe(true);
    expect(searchRule).toMatch(/flex:\s*1\s+1\s+auto/);
  });

  it('Given an admin account on the profile page, when the page renders, then the content manager entry should appear in the editor tools section without broken markup', () => {
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

      return null;
    });

    const page = renderProfile();
    document.body.appendChild(page);

    const editorEntry = page.querySelector('#setting-editor');
    const editorTitle = editorEntry?.querySelector('.list-item-title');

    expect(editorEntry).not.toBeNull();
    expect(editorTitle?.textContent?.trim()).toBe('콘텐츠 관리');
    expect(editorTitle?.textContent || '').not.toContain('/div');
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

  it('Given the production source tree, when JS files are inspected, then no stray console.log calls should remain (warn/error are allowed)', () => {
    const root = resolve(process.cwd(), 'src/js');
    const files = listJsFiles(root);

    const offenders = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      /* 라인별로 스캔하면서 line/block 주석 안의 예시는 제외한다 */
      const lines = source.split(/\r?\n/);
      let inBlockComment = false;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (inBlockComment) {
          const closeIdx = line.indexOf('*/');
          if (closeIdx === -1) continue;
          line = line.slice(closeIdx + 2);
          inBlockComment = false;
        }

        /* 한 줄 안에서 여는 /* 만 있고 안 닫히면 다음 라인부터 주석 모드 */
        const openIdx = line.indexOf('/*');
        const closeIdx = line.indexOf('*/');
        if (openIdx !== -1 && (closeIdx === -1 || closeIdx < openIdx)) {
          line = line.slice(0, openIdx);
          inBlockComment = true;
        } else if (openIdx !== -1 && closeIdx > openIdx) {
          line = line.slice(0, openIdx) + line.slice(closeIdx + 2);
        }

        /* 단일 라인 주석 */
        const lineCommentIdx = line.indexOf('//');
        if (lineCommentIdx !== -1) {
          line = line.slice(0, lineCommentIdx);
        }

        /* JSDoc 라인은 * 로 시작 */
        if (/^\s*\*/.test(lines[i])) continue;

        if (/console\.log\s*\(/.test(line)) {
          offenders.push(`${file.replace(process.cwd(), '')}:${i + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('Given Firebase Storage CORS config, when inspected, then Capacitor localhost origins should be allowed for Android image editing', () => {
    const corsConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'cors.json'), 'utf8'));
    const origins = corsConfig?.[0]?.origin || [];

    expect(origins).toContain('https://localhost');
    expect(origins).toContain('capacitor://localhost');
  });

  it('Given light theme list separators, when design tokens are inspected, then the separator should be visible while dark theme stays unchanged', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/variables.css'), 'utf8');
    const darkThemeBlock = css.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] || '';

    expect(css).toMatch(/--color-border-light:\s*#e5e5ea/);
    expect(darkThemeBlock).toMatch(/--color-border-light:\s*#2c2c2e/);
  });

  it('Given ISO publish dates, when display pages are inspected, then they should parse those dates through the local date helper', () => {
    /* bookmarks.js와 search.js는 safeStoryDateParts 헬퍼를 통해 toLocalDateFromIso를 간접 호출한다 */
    const directHelper = [
      'src/js/pages/detail.js',
      'src/js/pages/editor.js',
      'src/js/pages/editorstory.js',
    ];
    const indirectHelper = [
      'src/js/pages/bookmarks.js',
      'src/js/pages/search.js',
    ];

    for (const path of directHelper) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source).not.toContain('new Date(story.publish_date)');
      expect(source).toContain('toLocalDateFromIso');
    }

    for (const path of indirectHelper) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source).not.toContain('new Date(story.publish_date)');
      expect(source).toContain('safeStoryDateParts');
    }

    /* 헬퍼 자체는 toLocalDateFromIso를 사용해야 한다 */
    const dateUtilSource = readFileSync(resolve(process.cwd(), 'src/js/utils/date.js'), 'utf8');
    expect(dateUtilSource).toContain('export function safeStoryDateParts');
    expect(dateUtilSource).toMatch(/safeStoryDateParts[\s\S]*?toLocalDateFromIso/);
  });

  it('Given a new my-story form without an image, when the image control is clicked, then the single button should open the hidden file input', async () => {
    fetchMyStoriesMock.mockResolvedValue([]);

    const page = renderMyStoryNew();
    document.body.appendChild(page);

    await flushTimers(0);

    const imageButtons = page.querySelectorAll('#ms-image-edit-btn');
    const fileInput = page.querySelector('#ms-image-file');
    const button = imageButtons[0];
    fileInput.click = vi.fn();

    expect(imageButtons).toHaveLength(1);
    expect(page.querySelector('label[for="ms-image-file"]')).toBeNull();
    expect(button?.textContent?.trim()).toBe('\uC0AC\uC9C4 \uCD94\uAC00');

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fileInput.click).toHaveBeenCalledTimes(1);
  });

  it('Given an existing my-story form image, when the form loads, then the single image control should switch to photo editing', async () => {
    getParamsMock.mockReturnValue({ edit: 'my-24' });
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(24)]);
    fetchMyStoryByIdMock.mockResolvedValue(makeMyStory(24));

    const page = renderMyStoryNew();
    document.body.appendChild(page);

    await flushTimers(0);

    const imageButtons = page.querySelectorAll('#ms-image-edit-btn');

    expect(imageButtons).toHaveLength(1);
    expect(page.querySelector('label[for="ms-image-file"]')).toBeNull();
    expect(imageButtons[0]?.textContent?.trim()).toBe('\uC0AC\uC9C4 \uD3B8\uC9D1');
    expect(page.querySelector('#ms-image-preview')?.style.display).toBe('block');
  });

  it('Given the device is in Korea after midnight on May first, when opening a new my-story form without a date param, then the default date should be May first instead of UTC April thirtieth', async () => {
    vi.setSystemTime(new Date('2026-04-30T16:30:00.000Z'));
    getParamsMock.mockReturnValue({});
    fetchMyStoriesMock.mockResolvedValue([]);

    const page = renderMyStoryNew();
    document.body.appendChild(page);

    await flushTimers(0);

    expect(page.querySelector('#ms-date')?.value).toBe('2026-05-01');
  });

  it('Given the my-story crop modal, when source is inspected, then it should expose the same close and rotate controls as the main editor modal', () => {
    const mystory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');

    expect(mystory).toContain('id="btn-crop-cancel"');
    expect(mystory).toContain('class="crop-modal-title"');
    expect(mystory).toContain('<path d="M21 12a9 9 0 1 1-3-6.7"/>');
    expect(mystory).toContain('<path d="M21 3v5h-5"/>');
  });

  it('Given a my-story image stored on Google Storage, when editing it, then the cropper should load it as an editable card-sized image', async () => {
    getParamsMock.mockReturnValue({ edit: 'my-24' });
    fetchMyStoriesMock.mockResolvedValue([]);
    fetchMyStoryByIdMock.mockResolvedValue({
      ...makeMyStory(24),
      image_url: 'https://storage.googleapis.com/daystory-bucket/users/user-1/diary/photo.jpg',
    });
    const originalFetch = globalThis.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['remote-image'], { type: 'image/jpeg' }),
    });
    URL.createObjectURL = vi.fn(() => 'blob:editable-my-story');
    URL.revokeObjectURL = vi.fn();

    try {
      const page = renderMyStoryNew();
      document.body.appendChild(page);

      await flushTimers(0);

      page.querySelector('#ms-image-edit-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushTimers(0);
      document.querySelector('#cropper-image')?.dispatchEvent(new Event('load'));
      document.querySelector('#btn-crop-confirm')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushTimers(400);

      expect(globalThis.fetch).toHaveBeenCalledWith('https://storage.googleapis.com/daystory-bucket/users/user-1/diary/photo.jpg');
      expect(cropperCanvasOptions[0]).toMatchObject({ maxWidth: 1200, maxHeight: 1500 });
      expect(uploadBytesMock).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('Given a previously logged-in user reopens the app, when auth wiring is inspected, then the session marker should persist via localStorage so the login is restored', () => {
    const mainSource = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');
    const loginSource = readFileSync(resolve(process.cwd(), 'src/js/pages/login.js'), 'utf8');
    const settingsSource = readFileSync(resolve(process.cwd(), 'src/js/components/settingsSections.js'), 'utf8');

    /* 로그인 유지: AUTH_SESSION_KEY는 더 이상 sessionStorage가 아닌 localStorage에 저장되어
       앱을 닫았다 다시 열어도 복원된 Firebase 세션이 그대로 받아들여진다. */
    expect(mainSource).toContain('AUTH_SESSION_KEY');
    expect(mainSource).toContain('localStorage.getItem(AUTH_SESSION_KEY)');
    expect(mainSource).not.toContain('sessionStorage.getItem(AUTH_SESSION_KEY)');
    expect(loginSource).toContain('localStorage.setItem(AUTH_SESSION_KEY, \'true\')');
    expect(loginSource).not.toContain('sessionStorage.setItem(AUTH_SESSION_KEY');
    expect(settingsSource).toContain('localStorage.removeItem(AUTH_SESSION_KEY)');
    expect(settingsSource).not.toContain('sessionStorage.removeItem(AUTH_SESSION_KEY)');
  });

  it('Given wheel scroll settles after a programmatic swipe click, when source is inspected, then both card pages should guard that one duplicate scroll-end pass', () => {
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');
    const mystory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');

    expect(editorStory).toContain('programmaticWheelSelectionKey');
    expect(mystory).toContain('programmaticWheelSelectionKey');
  });

  it('Given the tutorial replay setting, when the user taps it, then the focused page tour should start without resetting stale storage', () => {
    localStorage.setItem('tutorial_done', 'true');
    localStorage.setItem('daystory:tip-seen:editorstory-card', 'true');
    localStorage.setItem('daystory:tip-seen:calendar-mode', 'true');

    const page = renderSettings();
    document.body.appendChild(page);

    page.querySelector('#setting-tutorial')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(localStorage.getItem('tutorial_done')).toBe('true');
    expect(localStorage.getItem('daystory:tip-seen:editorstory-card')).toBe('true');
    expect(localStorage.getItem('daystory:tip-seen:calendar-mode')).toBe('true');
    expect(sessionStorage.getItem('daystory:tutorial-tour-active')).toBe('true');
    expect(navigateMock).toHaveBeenCalledWith('/editorstory');
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
    expect(loginSource).toContain('function getAdminEmails()');
    expect(loginSource.match(/getAdminEmails\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(loginAdminLists.length).toBeGreaterThanOrEqual(1);
    loginAdminLists.forEach((adminEmails) => {
      expect(adminEmails).toEqual(canonicalAdminEmails);
    });
  });

  it('Given an editor story swipe on mobile, when a compatibility mouse gesture follows the touch swipe, then the date should advance only once', async () => {
    /* editorstory.js가 getLocalToday()를 기준 날짜로 쓰므로, fetchTodayStory가 반환하는 날짜와 시스템 시간을 동일하게 맞춘다. */
    vi.setSystemTime(new Date('2026-04-26T12:00:00'));
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

  it('Given an editor story swipe on mobile, when a delayed compatibility mouse gesture follows the touch swipe, then the date should still advance only once', async () => {
    vi.setSystemTime(new Date('2026-04-26T12:00:00'));
    const stories = [makeEditorStory(24), makeEditorStory(25), makeEditorStory(26)];
    fetchStoriesMock.mockResolvedValue(stories);
    fetchTodayStoryMock.mockResolvedValue(makeEditorStory(26));

    const page = renderEditorStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const flipper = page.querySelector('.flipper');
    expect(flipper).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(700);
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

  it('Given a flipped editor story card back body, when the user swipes horizontally from the body, then it should move to the adjacent day', async () => {
    vi.setSystemTime(new Date('2026-04-26T12:00:00'));
    const stories = [makeEditorStory(24), makeEditorStory(25), makeEditorStory(26)];
    fetchStoriesMock.mockResolvedValue(stories);
    fetchTodayStoryMock.mockResolvedValue(makeEditorStory(26));

    const page = renderEditorStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const backBody = page.querySelector('.back-body');
    expect(backBody).not.toBeNull();

    dispatchTouchSwipe(backBody, 100, 220);
    await flushTimers(600);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('Editor Story 25');
  });

  it('Given a flipped my-story card back body, when the user swipes horizontally from the body, then it should move to the adjacent day', async () => {
    vi.setSystemTime(new Date('2026-04-26T12:00:00'));
    getParamsMock.mockReturnValue({ date: '2026-04-26' });
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(24), makeMyStory(25), makeMyStory(26)]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const backBody = page.querySelector('.back-body');
    expect(backBody).not.toBeNull();

    dispatchTouchSwipe(backBody, 100, 220);
    await flushTimers(600);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('My Story 25');
  });

  it('Given a my-story swipe on mobile, when a delayed compatibility mouse gesture follows the touch swipe, then the date should still advance only once', async () => {
    vi.setSystemTime(new Date('2026-04-26T12:00:00'));
    getParamsMock.mockReturnValue({ date: '2026-04-26' });
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(24), makeMyStory(25), makeMyStory(26)]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const flipper = page.querySelector('.flipper');
    expect(flipper).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(700);
    dispatchMouseSwipe(flipper, 100, 220);
    await flushTimers(600);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('My Story 25');
  });

  it('Given an editor story swipe already selected the next wheel item, when smooth scrolling emits a scroll end, then it should not advance a second time', async () => {
    vi.setSystemTime(new Date('2026-04-26T12:00:00'));
    const stories = [makeEditorStory(24), makeEditorStory(25), makeEditorStory(26)];
    fetchStoriesMock.mockResolvedValue(stories);
    fetchTodayStoryMock.mockResolvedValue(makeEditorStory(26));

    const page = renderEditorStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const flipper = page.querySelector('.flipper');
    const dayWheel = page.querySelector('#editorstory-calendar');
    expect(flipper).not.toBeNull();
    expect(dayWheel).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(300);
    dayWheel.dispatchEvent(new Event('scroll', { bubbles: true }));
    await flushTimers(200);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('Editor Story 25');
  });

  it('Given an editor story swipe already selected the next wheel item, when smooth scrolling emits repeated scroll ends, then it should not advance a second time', async () => {
    vi.setSystemTime(new Date('2026-04-26T12:00:00'));
    const stories = [makeEditorStory(24), makeEditorStory(25), makeEditorStory(26)];
    fetchStoriesMock.mockResolvedValue(stories);
    fetchTodayStoryMock.mockResolvedValue(makeEditorStory(26));

    const page = renderEditorStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const flipper = page.querySelector('.flipper');
    const dayWheel = page.querySelector('#editorstory-calendar');
    expect(flipper).not.toBeNull();
    expect(dayWheel).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(300);
    dayWheel.dispatchEvent(new Event('scroll', { bubbles: true }));
    await flushTimers(200);
    dayWheel.dispatchEvent(new Event('scroll', { bubbles: true }));
    await flushTimers(200);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('Editor Story 25');
  });

  it('Given the home wheel is on May 1, when the user swipes to the previous day, then it should move directly to April 30', async () => {
    vi.setSystemTime(new Date('2026-05-01T12:00:00'));
    const april30 = makeEditorStoryOnDate('2026-04-30', 'April 30 Story');
    const may1 = makeEditorStoryOnDate('2026-05-01', 'May 1 Story');
    fetchStoriesMock.mockResolvedValue([april30, may1]);
    fetchTodayStoryMock.mockResolvedValue(may1);

    const page = renderEditorStory();
    document.body.appendChild(page);

    await flushTimers(0);
    await flushTimers(2000);

    const flipper = page.querySelector('.flipper');
    expect(flipper).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(500);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('April 30 Story');
    expect(page.querySelector('#editorstory-month-scroll .wheel-item.active')?.dataset.month).toBe('4');
    expect(page.querySelector('#editorstory-calendar .wheel-item.active')?.dataset.day).toBe('30');
  });

  it('Given a my-story swipe already selected the next wheel item, when smooth scrolling emits a scroll end, then it should not advance a second time', async () => {
    vi.setSystemTime(new Date('2026-04-26T12:00:00'));
    getParamsMock.mockReturnValue({ date: '2026-04-26' });
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(24), makeMyStory(25), makeMyStory(26)]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const flipper = page.querySelector('.flipper');
    const dayWheel = page.querySelector('#mystory-calendar');
    expect(flipper).not.toBeNull();
    expect(dayWheel).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(300);
    dayWheel.dispatchEvent(new Event('scroll', { bubbles: true }));
    await flushTimers(200);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('My Story 25');
  });

  it('Given the my-story wheel is on May 1, when the user swipes to the previous day, then it should move directly to April 30', async () => {
    vi.setSystemTime(new Date('2026-05-01T12:00:00'));
    getParamsMock.mockReturnValue({ date: '2026-05-01' });
    fetchMyStoriesMock.mockResolvedValue([
      makeMyStoryOnDate('2026-04-30', 'My April 30 Story'),
      makeMyStoryOnDate('2026-05-01', 'My May 1 Story'),
    ]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);
    await flushTimers(2000);

    const flipper = page.querySelector('.flipper');
    expect(flipper).not.toBeNull();

    dispatchTouchSwipe(flipper, 100, 220);
    await flushTimers(500);

    expect(page.querySelector('.card-image-title')?.textContent).toContain('My April 30 Story');
    expect(page.querySelector('#mystory-month-scroll .wheel-item.active')?.dataset.month).toBe('4');
    expect(page.querySelector('#mystory-calendar .wheel-item.active')?.dataset.date).toBe('2026-04-30');
  });

  it('Given February in a common year, when the my-story wheel renders, then impossible dates should be absent', async () => {
    vi.setSystemTime(new Date('2026-04-24T12:00:00'));
    getParamsMock.mockReturnValue({ date: '2026-04-24' });
    fetchMyStoriesMock.mockResolvedValue([]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    page.querySelector('#mystory-month-scroll .wheel-item[data-month="2"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushTimers(0);

    expect(page.querySelector('#mystory-calendar .wheel-item[data-date="2026-02-28"]')?.classList.contains('disabled')).toBe(false);
    expect(page.querySelector('#mystory-calendar .wheel-item[data-date="2026-02-29"]')).toBeNull();
    expect(page.querySelector('#mystory-calendar .wheel-item[data-date="2026-02-30"]')).toBeNull();
    expect(page.querySelector('#mystory-calendar .wheel-item[data-date="2026-02-31"]')).toBeNull();
  });

  it('Given an empty my-story card, when markup and styles are inspected, then the write button should use the widget pen icon while matching shared button styling', async () => {
    const expectedWriteLabel = '\uB098\uC758 \uC77C\uD654 \uC4F0\uAE30';
    getParamsMock.mockReturnValue({ date: '2026-04-24' });
    fetchMyStoriesMock.mockResolvedValue([]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const mystory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');
    const button = page.querySelector('.mystory-write-btn');
    const iconRule = css.match(/\.mystory-write-icon\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(mystory).not.toMatch(/class="btn btn-primary mystory-write-btn"/);
    expect(mystory).toMatch(/class="btn btn-secondary mystory-write-btn"/);
    expect(button).not.toBeNull();
    expect(button?.classList.contains('btn')).toBe(true);
    expect(button?.classList.contains('btn-secondary')).toBe(true);
    expect(button?.classList.contains('btn-primary')).toBe(false);
    expect(button?.textContent || '').toContain(expectedWriteLabel);
    const writeIcon = button?.querySelector('.mystory-write-icon');
    expect(writeIcon?.tagName.toLowerCase()).toBe('svg');
    expect(writeIcon?.getAttribute('aria-hidden')).toBe('true');
    expect(writeIcon?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(writeIcon?.textContent?.trim()).toBe('');
    expect(Array.from(writeIcon?.querySelectorAll('path') || []).map(path => path.getAttribute('d'))).toEqual([
      'M4 20l5-1.5L19 8.5 15.5 5 5.5 15 4 20Z',
      'M14 6.5 17.5 10',
      'M5 18.5h4',
    ]);
    expect(iconRule).toMatch(/width:\s*22px/);
    expect(iconRule).toMatch(/height:\s*22px/);
    expect(iconRule).not.toMatch(/border:/);
  });

  it('Given the profile tab page, when it renders, then it should present as a centered settings page', () => {
    const page = renderProfile();
    document.body.appendChild(page);

    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const headerRule = css.match(/\.settings-main-header\s*\{[\s\S]*?\}/)?.[0] || '';
    const title = page.querySelector('.settings-main-header .page-header-title');

    expect(title?.textContent?.trim()).toBe('설정');
    expect(page.textContent || '').not.toContain('내 프로필');
    expect(headerRule).toMatch(/justify-content:\s*center/);
    expect(headerRule).toMatch(/text-align:\s*center/);
  });

  it('Given an empty my-story card, when the quiet write CTA is clicked, then it should still route to the dated writing form', async () => {
    getParamsMock.mockReturnValue({ date: '2026-04-24' });
    fetchMyStoriesMock.mockResolvedValue([]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    page.querySelector('.mystory-write-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/mystory/new?date=2026-04-24');
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
