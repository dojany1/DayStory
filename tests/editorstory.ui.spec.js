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
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  fetchStoriesMock: vi.fn(),
  fetchTodayStoryMock: vi.fn(),
  getBookmarkedStoryIdsMock: vi.fn(),
  toggleBookmarkMock: vi.fn(),
  getStateMock: vi.fn(),
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

describe('Editor Story comment styles', () => {
  it('Given editor comment styling, when inspected, then the exclamation badge is removed and the bubble uses the original neutral card color', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/components.css'), 'utf8');
    const bubbleBlockMatch = css.match(/\.editor-comment-bubble\s*\{[\s\S]*?\}/);

    expect(css).not.toMatch(/\.editor-badge\s*\{/);
    expect(css).not.toMatch(/badgePop/);
    expect(bubbleBlockMatch?.[0]).toMatch(/background:\s*var\(--color-bg-elevated,\s*var\(--color-bg-secondary\)\)/);
    expect(bubbleBlockMatch?.[0]).not.toMatch(/border:/);
    expect(bubbleBlockMatch?.[0]).not.toMatch(/background:\s*var\(--color-editor-comment,\s*#ffe16a\)/);
  });

  it('Given an admin profile photo exists, when editor surfaces are inspected, then editor avatar should prefer the profile image over auth fallback', () => {
    const editor = readFileSync(resolve(process.cwd(), 'src/js/pages/editor.js'), 'utf8');

    expect(editor).toMatch(/photoURL:\s*stateProfile\.photoURL\s*\|\|\s*u\?\.photoURL\s*\|\|\s*''/);
    expect(editor).toMatch(/const\s+editorPhotoURL\s*=\s*stateProfile\.photoURL\s*\|\|\s*u\?\.photoURL\s*\|\|\s*''/);
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

  it('Given image-heavy card surfaces, when source is inspected, then visible images should decode async and uploads should create display and thumbnail variants', () => {
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');
    const myStory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');
    const detail = readFileSync(resolve(process.cwd(), 'src/js/pages/detail.js'), 'utf8');
    const storiesService = readFileSync(resolve(process.cwd(), 'src/js/services/stories.js'), 'utf8');
    const imageService = readFileSync(resolve(process.cwd(), 'src/js/services/images.js'), 'utf8');
    const editor = readFileSync(resolve(process.cwd(), 'src/js/pages/editor.js'), 'utf8');

    expect(editorStory).toMatch(/loading="eager"/);
    expect(editorStory).toMatch(/decoding="async"/);
    expect(editorStory).toMatch(/fetchpriority="high"/);
    expect(editorStory).toMatch(/preloadStoryImages/);
    expect(myStory).toMatch(/decoding="async"/);
    expect(myStory).toMatch(/preloadStoryImages/);
    expect(detail).toMatch(/fetchpriority="high"/);
    expect(detail).toMatch(/preloadImage/);
    expect(storiesService).toMatch(/uploadCardImageVariants/);
    expect(imageService).toMatch(/export async function uploadCardImageVariants/);
    expect(imageService).toMatch(/image_thumb_url/);
    expect(imageService).toMatch(/maxSizeMB:\s*0\.[0-9]+/);
    expect(imageService).toMatch(/uploadBytes\(storageRef,\s*optimizedFile\)/);
    expect(editor).toMatch(/id="sf-image-thumb"/);
    expect(editor).toMatch(/image_thumb_url/);
  });

  it('Given compact image surfaces, when source is inspected, then calendar, bookmarks, and search should prefer thumbnail URLs', () => {
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const bookmarks = readFileSync(resolve(process.cwd(), 'src/js/pages/bookmarks.js'), 'utf8');
    const search = readFileSync(resolve(process.cwd(), 'src/js/pages/search.js'), 'utf8');

    expect(calendar).toMatch(/getStoryImageUrl\(story,\s*'thumb'\)/);
    expect(bookmarks).toMatch(/getStoryImageUrl\(story,\s*'thumb'\)/);
    expect(search).toMatch(/getStoryImageUrl\(story,\s*'thumb'\)/);
  });

  it('Given shared image fallbacks, when source is inspected, then card placeholder data URIs should not be redeclared in pages', () => {
    const imageLoading = readFileSync(resolve(process.cwd(), 'src/js/utils/imageLoading.js'), 'utf8');
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const bookmarks = readFileSync(resolve(process.cwd(), 'src/js/pages/bookmarks.js'), 'utf8');
    const myStory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');
    const editor = readFileSync(resolve(process.cwd(), 'src/js/pages/editor.js'), 'utf8');

    expect(imageLoading).toMatch(/export const CARD_PLACEHOLDER_IMAGE/);
    expect(imageLoading).toMatch(/export const EDITOR_PREVIEW_PLACEHOLDER_IMAGE/);
    expect(calendar).not.toMatch(/const PLACEHOLDER_IMG/);
    expect(bookmarks).not.toMatch(/const PLACEHOLDER_IMG/);
    expect(myStory).not.toMatch(/const PLACEHOLDER_IMG/);
    expect(editor).not.toMatch(/const PLACEHOLDER_IMG/);
  });

  it('Given editor image forms, when source is inspected, then thumb reset behavior should be shared', () => {
    const imageFields = readFileSync(resolve(process.cwd(), 'src/js/utils/imageFields.js'), 'utf8');
    const editor = readFileSync(resolve(process.cwd(), 'src/js/pages/editor.js'), 'utf8');
    const myStory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');

    expect(imageFields).toMatch(/export function bindImageVariantFields/);
    expect(editor).toMatch(/bindImageVariantFields/);
    expect(myStory).toMatch(/bindImageVariantFields/);
    expect(editor).not.toMatch(/suppressImageThumbClear/);
    expect(myStory).not.toMatch(/suppressImageThumbClear/);
  });

  it('Given the daily letter gate, when styles and code are inspected, then opening the letter should not use postcard or card reveal animations', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');

    expect(css).not.toMatch(/dailyLetterArrive/);
    expect(css).not.toMatch(/dailyLetterCardReveal/);
    expect(css).not.toMatch(/daily-letter-reveal-card/);
    expect(editorStory).not.toMatch(/\.animate\(/);
    expect(editorStory).not.toMatch(/animateDailyLetterCard/);
  });
});

describe('Editor Story interactions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    cleanupEditorStoryWindowListeners();
    localStorage.clear();
    localStorage.setItem('tutorial_done', 'true');
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

    const story = buildStory();
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

  it('Given a flipped card with an editor comment, when the card flips and the remark button is clicked, then no exclamation badge appears and the comment opens', async () => {
    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const flipper = page.querySelector('.flipper');
    const editorButton = page.querySelector('.back-editor-btn');

    expect(flipper).not.toBeNull();
    expect(editorButton).not.toBeNull();

    flipper.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(page.querySelector('.editor-badge')).toBeNull();

    editorButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(page.querySelector('.editor-badge')).toBeNull();
    expect(page.querySelector('.editor-comment-bubble')?.textContent).toContain('Editor note');
  });

  it('Given today editor story has not been opened, when the editor story page renders, then the daily letter gate should show before the card', async () => {
    localStorage.removeItem('daystory:daily-letter-opened:story-1');

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const letterGate = page.querySelector('.daily-letter-gate');

    expect(letterGate).not.toBeNull();
    expect(letterGate?.querySelector('.daily-letter-postmark')?.textContent).toContain('4. 24');
    expect(letterGate?.querySelector('.daily-letter-title')?.textContent).toContain('오늘의 편지');
    expect(page.querySelector('.editorstory-card-area > .flip-container')).toBeNull();
  });

  it('Given today editor story has not been opened, when the daily letter is clicked, then the story card should reveal and remember the opened state', async () => {
    localStorage.removeItem('daystory:daily-letter-opened:story-1');

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const letterGate = page.querySelector('.daily-letter-gate');
    expect(letterGate).not.toBeNull();

    letterGate?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(page.querySelector('.daily-letter-gate')).toBeNull();
    expect(page.querySelector('.editorstory-card-area > .flip-container')).not.toBeNull();
    expect(page.querySelector('.card-image-title')?.textContent).toContain('Test Figure');
    expect(localStorage.getItem('daystory:daily-letter-opened:story-1')).toBe('true');
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
    expect(page.querySelector('.editor-badge')).toBeNull();

    editorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(page.querySelector('.editor-badge')).toBeNull();
    expect(page.querySelector('.editor-comment-bubble')?.textContent).toContain('Editor note');

    editorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(page.querySelector('.editor-badge')).toBeNull();
    expect(page.querySelector('.editor-comment-bubble')).toBeNull();
  });

  it('Given an editor comment was opened before, when the user returns to the same story, then no exclamation badge appears and the editor comment still opens', async () => {
    const firstPage = renderEditorStory();
    document.body.appendChild(firstPage);
    await flushRender();

    const firstFlipper = firstPage.querySelector('.flipper');
    const firstEditorButton = firstPage.querySelector('.back-editor-btn');

    firstFlipper?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(firstPage.querySelector('.editor-badge')).toBeNull();

    firstEditorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(firstPage.querySelector('.editor-badge')).toBeNull();
    expect(firstPage.querySelector('.editor-comment-bubble')?.textContent).toContain('Editor note');

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
