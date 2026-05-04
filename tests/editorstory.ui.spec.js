import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DETAIL_BUTTON_LABEL = '\uC0C1\uC138 \uBCF4\uAE30';

const {
  navigateMock,
  fetchStoriesMock,
  fetchTodayStoryMock,
  getBookmarkedStoryIdsMock,
  toggleBookmarkMock,
  getStateMock,
  localTodayMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  fetchStoriesMock: vi.fn(),
  fetchTodayStoryMock: vi.fn(),
  getBookmarkedStoryIdsMock: vi.fn(),
  toggleBookmarkMock: vi.fn(),
  getStateMock: vi.fn(),
  localTodayMock: vi.fn(() => '2026-04-24'),
}));

vi.mock('../src/js/services/stories.js', () => ({
  fetchStories: fetchStoriesMock,
  fetchTodayStory: fetchTodayStoryMock,
}));

vi.mock('../src/js/services/bookmarks.js', () => ({
  toggleBookmark: toggleBookmarkMock,
  getBookmarkedStoryIds: getBookmarkedStoryIdsMock,
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  setOnUnmount: vi.fn(),
}));

vi.mock('../src/js/utils/date.js', async () => {
  const actual = await vi.importActual('../src/js/utils/date.js');
  return {
    ...actual,
    /* 테스트의 buildStory()가 publish_date '2026-04-24'를 쓰므로 기본 오늘도 같은 날짜로 고정해
       editorstory가 해당 story를 '오늘 카드'로 인식하게 한다. */
    getLocalToday: () => localTodayMock(),
  };
});

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

const { renderEditorStory } = await import('../src/js/pages/editorstory.js');

function buildStory(overrides = {}) {
  return {
    id: 'story-1',
    publish_date: '2026-04-24',
    historical_year: '1592',
    historical_date: '1592-04-24',
    card_count: '1/365',
    country: 'Korea',
    image_url: 'https://example.com/story.png',
    figure_name: 'Test Figure',
    summary: 'Summary',
    body: 'Line one',
    editor_comment: 'Editor note',
    editor: {
      displayName: 'DayStory',
      photoURL: '',
    },
    ...overrides,
  };
}

async function flushRender() {
  await Promise.resolve();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
}

async function flushFakeTimers(ms = 0) {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
}

async function waitForCondition(condition, timeoutMs = 3000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }

  throw new Error('Timed out waiting for condition');
}

function cleanupEditorStoryWindowListeners() {
  if (window._editorStoryMouseMove) {
    window.removeEventListener('mousemove', window._editorStoryMouseMove);
    delete window._editorStoryMouseMove;
  }

  if (window._editorStoryMouseUp) {
    window.removeEventListener('mouseup', window._editorStoryMouseUp);
    delete window._editorStoryMouseUp;
  }
}

function dispatchTouch(target, type, x, y) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touch = { clientX: x, clientY: y };

  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' ? [] : [touch],
  });
  Object.defineProperty(event, 'changedTouches', {
    value: [touch],
  });

  target.dispatchEvent(event);
}

describe('Editor Story badge styles', () => {
  it('Given editor comment styling, when inspected, then the badge text stays white and the bubble uses the original neutral card color', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/components.css'), 'utf8');
    const badgeBlockMatch = css.match(/\.editor-badge\s*\{[\s\S]*?\}/);
    const bubbleBlockMatch = css.match(/\.editor-comment-bubble\s*\{[\s\S]*?\}/);

    expect(badgeBlockMatch?.[0]).toMatch(/color:\s*#fff/);
    expect(badgeBlockMatch?.[0]).not.toMatch(/border:/);
    expect(bubbleBlockMatch?.[0]).toMatch(/background:\s*var\(--color-bg-elevated,\s*var\(--color-bg-secondary\)\)/);
    expect(bubbleBlockMatch?.[0]).not.toMatch(/border:/);
    expect(bubbleBlockMatch?.[0]).not.toMatch(/background:\s*var\(--color-editor-comment,\s*#ffe16a\)/);
  });

  it('Given card image upload cropping, when crop styles and editor cropper configs are inspected, then the crop ratio should match the displayed card image area', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/components.css'), 'utf8');
    const editor = readFileSync(resolve(process.cwd(), 'src/js/pages/editor.js'), 'utf8');
    const mystory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');
    const imageWrapRule = css.match(/\.history-card-image-wrap\s*\{[\s\S]*?\}/)?.[0];

    expect(imageWrapRule).toMatch(/aspect-ratio:\s*4\s*\/\s*5/);
    expect(imageWrapRule).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(editor).toMatch(/const\s+CARD_IMAGE_CROP_ASPECT_RATIO\s*=\s*4\s*\/\s*5/);
    expect(editor).toMatch(/aspectRatio:\s*CARD_IMAGE_CROP_ASPECT_RATIO/);
    expect(editor).not.toMatch(/aspectRatio:\s*3\s*\/\s*4\.8/);
    expect(mystory).toMatch(/const\s+CARD_IMAGE_CROP_ASPECT_RATIO\s*=\s*4\s*\/\s*5/);
    expect(mystory).toMatch(/aspectRatio:\s*CARD_IMAGE_CROP_ASPECT_RATIO/);
    expect(mystory).not.toMatch(/aspectRatio:\s*3\s*\/\s*4\.8/);
  });

  it('Given the main story card image area, when card styles are inspected, then the image overlay should not add a black border or intercept input', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/components.css'), 'utf8');
    const cardFaceRule = css.match(/\.front,\s*\.back\s*\{[\s\S]*?\}/)?.[0];
    const imageOverlayRule = css.match(/\.history-card-image-wrap::after\s*\{[\s\S]*?\}/)?.[0];

    expect(cardFaceRule).toMatch(/border:\s*2px\s+solid\s+var\(--color-border\)/);
    expect(imageOverlayRule).toBeTruthy();
    expect(imageOverlayRule).not.toMatch(/border:\s*1px\s+solid\s+#000/);
    expect(imageOverlayRule).toMatch(/pointer-events:\s*none/);
  });

  it('Given the daily letter animation is removed, when styles and code are inspected, then no today-letter opener or GSAP gate should remain', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');

    expect(editorStory).not.toMatch(/from ['"]gsap['"]/);
    expect(editorStory).not.toMatch(/renderDailyLetterGate/);
    expect(editorStory).not.toMatch(/DAILY_LETTER_(ARRIVAL|OPEN|FADE)_DURATION_MS/);
    expect(editorStory).not.toMatch(/daily-letter-gate|postcard-delivery-gate|monochrome-letter-gate|magazine-letter-gate/);
    expect(css).not.toMatch(/\.daily-letter-gate|\.postcard-delivery-gate|\.postcard-card|\.monochrome-letter-gate|\.magazine-letter-gate/);
  });

  it('Given the tutorial runtime is removed, when styles and code are inspected, then no product-tour or contextual guidance remains', () => {
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');

    expect(editorStory).not.toMatch(/showContextualTip|contextualTip/);
    expect(editorStory).not.toMatch(/TUTORIAL_STEPS|showTutorial|tutorial-panel/);
    expect(css).not.toMatch(/\.contextual-tip-card/);
    expect(css).not.toMatch(/\.contextual-tip-spotlight/);
    expect(css).not.toMatch(/\.tutorial-panel|\.tutorial-blocker/);
    expect(editorStory).not.toMatch(/autoEvent:\s*['"]ds:card-flipped['"]/);
    expect(editorStory).not.toMatch(/autoAdvanceTimer/);
    expect(editorStory).not.toMatch(/document\.addEventListener\(['"]ds:card-flipped['"]/);
  });

  it('Given tutorial is being rebuilt separately, when styles and code are inspected, then no guidance overlay should block app navigation', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');

    expect(editorStory).not.toMatch(/targetSelector/);
    expect(editorStory).not.toMatch(/daystory:tip-seen:|contextualTip/);
    expect(css).not.toMatch(/\.contextual-tip-spotlight/);
    expect(css).not.toMatch(/body\.tutorial-active/);
    expect(css).not.toMatch(/tutorial-panel-positioned|tutorial-arrow-left/);
  });
});

describe('Editor Story interactions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    cleanupEditorStoryWindowListeners();
    localStorage.clear();
    localStorage.setItem('daystory:daily-letter-opened:story-1', 'true');

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
    fetchStoriesMock.mockReset();
    fetchTodayStoryMock.mockReset();
    getBookmarkedStoryIdsMock.mockReset();
    toggleBookmarkMock.mockReset();
    getStateMock.mockReset();
    localTodayMock.mockReset();

    const story = buildStory();
    localTodayMock.mockReturnValue('2026-04-24');
    fetchStoriesMock.mockResolvedValue([story]);
    fetchTodayStoryMock.mockResolvedValue(story);
    getBookmarkedStoryIdsMock.mockResolvedValue([]);
    toggleBookmarkMock.mockResolvedValue({ bookmarked: true, error: null });
    getStateMock.mockReturnValue({ id: 'member-1' });
  });

  afterEach(() => {
    cleanupEditorStoryWindowListeners();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('Given a flipped card with an editor badge, when the editor remark button is clicked, then the badge disappears immediately', async () => {
    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const flipper = page.querySelector('.flipper');
    const editorButton = page.querySelector('.back-editor-btn');

    expect(flipper).not.toBeNull();
    expect(editorButton).not.toBeNull();

    flipper.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const badgeBeforeClick = page.querySelector('.editor-badge');
    expect(badgeBeforeClick).not.toBeNull();

    editorButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(page.querySelector('.editor-badge')).toBeNull();
  });

  it('Given the home date wheel renders, then it should expose a continuous date strip through the current month', async () => {
    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const days = Array.from(page.querySelectorAll('#editorstory-calendar .wheel-item'));

    expect(days[0]?.dataset.date).toBe('2026-01-01');
    expect(days.at(-1)?.dataset.date).toBe('2026-04-30');
    expect(page.querySelector('#editorstory-calendar .wheel-item.active')?.dataset.date).toBe('2026-04-24');
  });

  it('Given today is leap day, when the home date wheel renders February, then February 29 exists and invalid February dates are absent', async () => {
    const leapStory = buildStory({ id: 'story-leap', publish_date: '2024-02-29' });
    localTodayMock.mockReturnValue('2024-02-29');
    fetchTodayStoryMock.mockResolvedValue(leapStory);
    fetchStoriesMock.mockResolvedValue([leapStory]);

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    expect(page.querySelector('#editorstory-month-scroll .wheel-item[data-month="2"]')?.classList.contains('disabled')).toBe(false);
    expect(page.querySelector('#editorstory-calendar .wheel-item[data-date="2024-02-29"]')?.classList.contains('disabled')).toBe(false);
    expect(page.querySelector('#editorstory-calendar .wheel-item[data-date="2024-02-30"]')).toBeNull();
    expect(page.querySelector('#editorstory-calendar .wheel-item[data-date="2024-02-31"]')).toBeNull();
  });

  it('Given the home date wheel is on the current month, then future dates should be disabled', async () => {
    localTodayMock.mockReturnValue('2026-04-24');
    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    expect(page.querySelector('#editorstory-calendar .wheel-item[data-date="2026-04-24"]')?.classList.contains('disabled')).toBe(false);
    expect(page.querySelector('#editorstory-calendar .wheel-item[data-date="2026-04-25"]')?.classList.contains('disabled')).toBe(true);
    expect(page.querySelector('#editorstory-calendar .wheel-item[data-date="2026-04-30"]')?.classList.contains('disabled')).toBe(true);
  });

  it('Given today is May 1, when the home date wheel renders, then April 30 sits immediately before May 1', async () => {
    const mayStory = buildStory({ id: 'story-may-1', publish_date: '2026-05-01' });
    localTodayMock.mockReturnValue('2026-05-01');
    fetchTodayStoryMock.mockResolvedValue(mayStory);
    fetchStoriesMock.mockResolvedValue([mayStory]);

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const days = Array.from(page.querySelectorAll('#editorstory-calendar .wheel-item'));
    const mayFirstIndex = days.findIndex(item => item.dataset.date === '2026-05-01');

    expect(mayFirstIndex).toBeGreaterThan(0);
    expect(days[mayFirstIndex - 1]?.dataset.date).toBe('2026-04-30');
    expect(days[mayFirstIndex]?.classList.contains('active')).toBe(true);
  });

  it('Given the user moves between home cards, then only the active card should be rendered without adjacent silhouettes', async () => {
    localTodayMock.mockReturnValue('2026-04-26');
    const day24 = buildStory({ id: 'story-24', publish_date: '2026-04-24', figure_name: 'Previous Story', image_url: 'https://example.com/prev.png' });
    const day26 = buildStory({ id: 'story-26', publish_date: '2026-04-26', figure_name: 'Next Story', image_url: 'https://example.com/next.png' });
    fetchStoriesMock.mockResolvedValue([day24, day26]);
    fetchTodayStoryMock.mockResolvedValue(day26);
    vi.useFakeTimers();

    try {
      const page = renderEditorStory();
      document.body.appendChild(page);
      await flushFakeTimers(0);

      page.querySelector('#editorstory-calendar')?.dispatchEvent(new CustomEvent('daystory:select-adjacent-day', {
        detail: { offset: -1 },
      }));
      await flushFakeTimers(450);

      const peeks = page.querySelectorAll('.card-side-peek');
      expect(peeks).toHaveLength(0);
      expect(page.querySelectorAll('.editorstory-card-area > .flip-container')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Given adjacent card silhouettes are disabled, when the styles are inspected, then side peek styling should not remain active', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');
    const myStory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');

    expect(css).not.toMatch(/\.card-side-peek/);
    expect(editorStory).not.toContain('card-side-peek');
    expect(myStory).not.toContain('card-side-peek');
  });

  it('Given today editor story has not been opened, when the editor story page renders, then the story card should render directly without the daily letter gate', async () => {
    localStorage.removeItem('daystory:daily-letter-opened:story-1');

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const letterGate = page.querySelector('.daily-letter-gate');

    expect(letterGate).toBeNull();
    expect(page.querySelector('.editorstory-card-area > .flip-container')).not.toBeNull();
    expect(page.querySelector('.card-image-title')?.textContent).toContain('Test Figure');
  });

  it('Given first visit after tutorial removal, when the editor story page renders, then no guidance overlay should appear', async () => {
    localStorage.removeItem('daystory:daily-letter-opened:story-1');
    vi.useFakeTimers();

    try {
      const page = renderEditorStory();
      document.body.appendChild(page);
      await flushFakeTimers(0);
      await flushFakeTimers(500);

      expect(document.querySelector('#tutorial-panel')).toBeNull();
      expect(document.querySelector('.tutorial-blocker')).toBeNull();
      expect(document.body.classList.contains('tutorial-active')).toBe(false);
      expect(document.querySelector('.contextual-tip-card')).toBeNull();
      expect(document.querySelector('.contextual-tip-spotlight')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Given old guidance storage exists, when the page renders again, then it should be ignored and no tip should appear', async () => {
    localStorage.removeItem('daystory:daily-letter-opened:story-1');
    localStorage.setItem('daystory:tip-seen:editorstory-card', 'true');
    vi.useFakeTimers();

    try {
      const page = renderEditorStory();
      document.body.appendChild(page);
      await flushFakeTimers(0);
      await flushFakeTimers(500);

      expect(document.querySelector('.contextual-tip-card')).toBeNull();
      expect(localStorage.getItem('daystory:tip-seen:editorstory-card')).toBe('true');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Given stale tutorial_done is present, when the editor story page renders again, then no guidance should appear and storage should not be touched', async () => {
    localStorage.removeItem('daystory:daily-letter-opened:story-1');
    localStorage.setItem('tutorial_done', 'true');
    vi.useFakeTimers();

    try {
      const page = renderEditorStory();
      document.body.appendChild(page);
      await flushFakeTimers(0);
      await flushFakeTimers(500);

      expect(localStorage.getItem('tutorial_done')).toBe('true');
      expect(document.querySelector('.contextual-tip-card')).toBeNull();
      expect(document.querySelector('#tutorial-panel')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Given tutorial runtime is removed, when the editor story page renders, then contextual tips should stay hidden', async () => {
    vi.useFakeTimers();

    try {
      const page = renderEditorStory();
      document.body.appendChild(page);
      await flushFakeTimers(0);
      await flushFakeTimers(1000);

      expect(document.querySelector('.contextual-tip-card')).toBeNull();
      expect(document.querySelector('#tutorial-panel')).toBeNull();
      expect(document.querySelector('.tutorial-blocker')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Given today editor story has not been opened, when the card renders directly, then it should not write daily-letter opened state', async () => {
    localStorage.removeItem('daystory:daily-letter-opened:story-1');

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    expect(page.querySelector('.daily-letter-gate')).toBeNull();
    expect(page.querySelector('.editorstory-card-area > .flip-container')).not.toBeNull();
    expect(page.querySelector('.card-image-title')?.textContent).toContain('Test Figure');
    expect(localStorage.getItem('daystory:daily-letter-opened:story-1')).toBeNull();
  });

  it('Given today editor story was already opened, when the editor story page renders, then the card should render directly without the daily letter gate', async () => {
    localStorage.setItem('daystory:daily-letter-opened:story-1', 'true');

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    expect(page.querySelector('.daily-letter-gate')).toBeNull();
    expect(page.querySelector('.editorstory-card-area > .flip-container')).not.toBeNull();
    expect(page.querySelector('.card-image-title')?.textContent).toContain('Test Figure');
  });

  it('Given an editor comment containing HTML, when the editor remark opens, then the comment should render as text instead of markup', async () => {
    fetchStoriesMock.mockResolvedValue([
      buildStory({ editor_comment: '<img src=x onerror=alert(1)>raw note' }),
    ]);
    fetchTodayStoryMock.mockResolvedValue(buildStory({ editor_comment: '<img src=x onerror=alert(1)>raw note' }));

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const flipper = page.querySelector('.flipper');
    flipper?.classList.add('flipped');

    const editorButton = page.querySelector('.back-editor-btn');
    editorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const bubble = page.querySelector('.editor-comment-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble?.querySelector('img')).toBeNull();
    expect(bubble?.textContent).toContain('<img src=x onerror=alert(1)>raw note');
  });

  it('Given a touch device opens an editor comment, when the compatibility click follows touchend, then the bubble should remain open', async () => {
    fetchStoriesMock.mockResolvedValue([buildStory()]);
    fetchTodayStoryMock.mockResolvedValue(buildStory());

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const flipper = page.querySelector('.flipper');
    flipper?.classList.add('flipped');

    const editorButton = page.querySelector('.back-editor-btn');
    editorButton?.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
    editorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(page.querySelector('.editor-comment-bubble')).not.toBeNull();
  });

  it('Given a flipped card editor button touch starts, when the finger moves slightly before touchend, then the editor comment bubble should open', async () => {
    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const flipper = page.querySelector('.flipper');
    flipper?.classList.add('flipped');

    const editorButton = page.querySelector('.back-editor-btn');
    expect(editorButton).not.toBeNull();

    dispatchTouch(editorButton, 'touchstart', 100, 100);
    dispatchTouch(editorButton, 'touchmove', 118, 100);
    dispatchTouch(editorButton, 'touchend', 118, 100);

    expect(page.querySelector('.editor-comment-bubble')?.textContent).toContain('Editor note');
  });

  it('Given an editor comment bubble is open, when the editor button is clicked again, then the bubble should toggle closed and the exclamation should stay hidden', async () => {
    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const flipper = page.querySelector('.flipper');
    const editorButton = page.querySelector('.back-editor-btn');

    flipper?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(page.querySelector('.editor-badge')).not.toBeNull();

    editorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(page.querySelector('.editor-badge')).toBeNull();
    expect(page.querySelector('.editor-comment-bubble')?.textContent).toContain('Editor note');

    editorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(page.querySelector('.editor-badge')).toBeNull();
    expect(page.querySelector('.editor-comment-bubble')).toBeNull();
  });

  it('Given an editor comment was checked before, when the user returns to the same story, then the exclamation should stay hidden but the editor comment should still open', async () => {
    const firstPage = renderEditorStory();
    document.body.appendChild(firstPage);
    await flushRender();

    const firstFlipper = firstPage.querySelector('.flipper');
    const firstEditorButton = firstPage.querySelector('.back-editor-btn');

    firstFlipper?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(firstPage.querySelector('.editor-badge')).not.toBeNull();

    firstEditorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(firstPage.querySelector('.editor-badge')).toBeNull();

    cleanupEditorStoryWindowListeners();
    firstPage.remove();

    const secondPage = renderEditorStory();
    document.body.appendChild(secondPage);
    await flushRender();

    const secondFlipper = secondPage.querySelector('.flipper');
    const secondEditorButton = secondPage.querySelector('.back-editor-btn');

    secondFlipper?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(secondPage.querySelector('.editor-badge')).toBeNull();

    secondEditorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(secondPage.querySelector('.editor-comment-bubble')?.textContent).toContain('Editor note');
  });

  it('Given an editor comment bubble is open, when the user clicks outside the editor button and bubble, then the bubble should close', async () => {
    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const flipper = page.querySelector('.flipper');
    const editorButton = page.querySelector('.back-editor-btn');

    flipper?.classList.add('flipped');
    editorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(page.querySelector('.editor-comment-bubble')).not.toBeNull();

    page.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(page.querySelector('.editor-comment-bubble')).toBeNull();
  });

  it('Given an editor story card, when it flips to the back, then only the back date area shows a 상세 보기 button that routes to the detail page', async () => {
    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const flipper = page.querySelector('.flipper');
    const frontYearBlock = page.querySelector('.card-top-left');
    const frontDetailButton = frontYearBlock?.querySelector(`[aria-label="${DETAIL_BUTTON_LABEL}"]`);

    expect(flipper).not.toBeNull();
    expect(frontDetailButton).toBeNull();

    flipper.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const backFooter = page.querySelector('.back-footer');
    const detailButton = backFooter?.querySelector(`[aria-label="${DETAIL_BUTTON_LABEL}"]`);

    expect(detailButton).not.toBeNull();
    expect(detailButton?.textContent?.trim()).toBe(DETAIL_BUTTON_LABEL);
    expect(detailButton?.closest('.back-footer')).toBe(backFooter);

    detailButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/detail/story-1');
  });
});
