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
  setState: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  setOnUnmount: vi.fn(),
  getPreviousRoute: vi.fn(() => null),
  getCurrentPath: vi.fn(() => '/editorstory'),
}));

/* 이 스펙은 카드 동작만 검증한다 — 진입 온보딩(인트로 모달/코치마크)은 no-op 으로
   막아 setTimeout 부수효과로 DOM 이 오염되지 않게 한다. */
vi.mock('../src/js/utils/pageLifecycle.js', () => ({
  afterPageEnter: vi.fn(),
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn().mockResolvedValue(undefined),
  },
}));

/* jsdom 은 레이아웃(geometry)이 없어 실제 Swiper 가 initialSlide(스토리 날짜)에 anchor 하지 못하고
   slide 0(1월 1일 빈 카드)에 머문다. 테스트에서는 createCardSwiper 를 대체해, 실제 스토리가 있는
   슬라이드를 활성 슬라이드로 동기 렌더하고 onSlideReady 로 카드 이벤트를 바인딩한다.
   (editorstory 의 buildSlideHTML / bindFlipCardEvents 등 카드 동작은 그대로 검증된다.) */
vi.mock('../src/js/utils/cardSwiper.js', () => ({
  createCardSwiper: (container, opts = {}) => {
    const { slides = [], renderSlide, onSlideActive, onSlideReady, initialSlide = 0 } = opts;
    let idx = slides.findIndex((s) => s && s.story && (s.story.figure_name || s.story.id));
    if (idx < 0) idx = initialSlide;
    let wrapper = container.querySelector('.swiper-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'swiper-wrapper';
      container.appendChild(wrapper);
    }
    const temp = document.createElement('div');
    temp.innerHTML = renderSlide(slides[idx], idx);
    const slideEl = temp.firstElementChild;
    if (slideEl) {
      slideEl.classList.add('swiper-slide-active');
      wrapper.appendChild(slideEl);
    }
    const swiper = {
      activeIndex: idx,
      destroyed: false,
      destroy() { this.destroyed = true; },
      update() {},
      slideTo() {},
    };
    onSlideActive?.(idx);
    onSlideReady?.(idx);
    return swiper;
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
    image_thumb_url: 'https://example.com/story-thumb.webp',
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
  /* editorstory 의 카드 Swiper 는 requestAnimationFrame 체인(최대 8회 재시도) 안에서
     lazy init 되므로, 카드(.flipper)가 DOM 에 들어올 때까지 여러 매크로태스크를 흘려보낸다. */
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
  }
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
    expect(bubbleBlockMatch?.[0]).toMatch(/background:\s*var\(--color-bg-secondary\)/);
    expect(bubbleBlockMatch?.[0]).toMatch(/border:\s*2px\s+solid\s+var\(--color-text-secondary\)/);
    expect(bubbleBlockMatch?.[0]).not.toMatch(/background:\s*var\(--color-editor-comment,\s*#ffe16a\)/);
    expect(bubbleBlockMatch?.[0]).toMatch(/pointer-events:\s*auto/);
  });

  it('Given a long multilingual editor comment, when bubble styles are inspected, then text should wrap inside the bubble instead of overflowing', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/components.css'), 'utf8');
    const bubbleBlock = css.match(/\.editor-comment-bubble\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(bubbleBlock).toMatch(/box-sizing:\s*border-box/);
    expect(bubbleBlock).toMatch(/white-space:\s*normal/);
    expect(bubbleBlock).toMatch(/overflow-wrap:\s*anywhere/);
    expect(bubbleBlock).toMatch(/word-break:\s*normal/);
    expect(bubbleBlock).not.toMatch(/word-break:\s*keep-all/);
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

    expect(imageWrapRule).toMatch(/flex:\s*1/);
    expect(imageWrapRule).toMatch(/overflow:\s*hidden/);
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

    expect(cardFaceRule).toMatch(/box-shadow:\s*var\(--shadow-card\)/);
    expect(imageOverlayRule).toBeTruthy();
    expect(imageOverlayRule).not.toMatch(/border:\s*1px\s+solid\s+#000/);
    expect(imageOverlayRule).toMatch(/pointer-events:\s*none/);
  });

  it('Given image card surfaces, when source is inspected, then visible images should decode async and upload via uploadImage', () => {
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');
    const myStory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');
    const storiesService = readFileSync(resolve(process.cwd(), 'src/js/services/stories.js'), 'utf8');
    const imageService = readFileSync(resolve(process.cwd(), 'src/js/services/images.js'), 'utf8');
    const editor = readFileSync(resolve(process.cwd(), 'src/js/pages/editor.js'), 'utf8');

    const cardFace = readFileSync(resolve(process.cwd(), 'src/js/components/cardDeck/cardFace.js'), 'utf8');
    /* decoding="async" 는 공통 cardFace.cardImageWrap 에 있음 (두 페이지가 buildCardDeck 경유로 공유) */
    expect(cardFace).toMatch(/decoding="async"/);
    expect(editorStory).toMatch(/buildCardDeck/);
    expect(myStory).toMatch(/buildCardDeck/);
    expect(storiesService).toMatch(/uploadImage/);
    expect(imageService).toMatch(/export async function uploadImage/);
    expect(imageService).toMatch(/uploadBytes/);
    expect(editor).toMatch(/id="sf-image-thumb"/);
  });

  it('Given compact image surfaces, when source is inspected, then card images use story.image_url directly', () => {
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const bookmarks = readFileSync(resolve(process.cwd(), 'src/js/pages/bookmarks.js'), 'utf8');
    const search = readFileSync(resolve(process.cwd(), 'src/js/pages/search.js'), 'utf8');

    expect(calendar).toMatch(/story\.image_url/);
    expect(bookmarks).toMatch(/story\.image_url/);
    expect(search).toMatch(/story\.image_url/);
  });

  it('Given card swipe motion, when source is inspected, then Swiper.js should drive transitions through the shared cardSwiper utility', () => {
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');
    const myStory = readFileSync(resolve(process.cwd(), 'src/js/pages/mystory.js'), 'utf8');
    const cardSwiper = readFileSync(resolve(process.cwd(), 'src/js/utils/cardSwiper.js'), 'utf8');
    const pagesCss = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');

    const cardDeck = readFileSync(resolve(process.cwd(), 'src/js/components/cardDeck/cardDeckController.js'), 'utf8');
    /* 두 페이지가 공통 카드덱 컨트롤러(buildCardDeck)를 통해 동일한 cardSwiper 유틸을 사용해야 한다 (제스처 일관성). */
    expect(editorStory).toMatch(/buildCardDeck/);
    expect(myStory).toMatch(/buildCardDeck/);
    expect(cardDeck).toMatch(/createCardSwiper/);

    /* Swiper 11 기반. Virtual 모듈은 슬라이드 누적 이슈로 제거됨 → 사전 생성 패턴. */
    expect(cardSwiper).toMatch(/import Swiper from 'swiper'/);
    expect(cardSwiper).toMatch(/spaceBetween:\s*16/);
    /* 카드덱 컨트롤러가 swiper-wrapper 에 슬라이드를 렌더한다 (두 페이지 공통). */
    expect(cardDeck).toMatch(/swiper-wrapper/);

    /* 카드 스와이퍼 컨테이너는 수직 스크롤을 보존해야 한다. */
    expect(pagesCss).toMatch(/\.card-swiper/);
    expect(pagesCss).toMatch(/touch-action:\s*pan-y/);

    /* 레거시 stack-enter/exit 스타일은 제거되어야 한다 (Swiper가 슬라이드 전환을 담당). */
    expect(pagesCss).not.toMatch(/\.stack-enter-next/);
    expect(pagesCss).not.toMatch(/\.stack-exit-next/);
  });


  it('Given the removed letter animation, when styles and code are inspected, then the home card should render without an entry motion', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const editorStory = readFileSync(resolve(process.cwd(), 'src/js/pages/editorstory.js'), 'utf8');

    expect(css).not.toMatch(/\.daily-letter-gate/);
    expect(css).not.toMatch(/\.daily-letter-postcard/);
    expect(css).not.toMatch(/dailyLetterArrive/);
    expect(css).not.toMatch(/dailyLetterCardReveal/);
    expect(css).not.toMatch(/daily-letter-reveal-card/);
    expect(css).not.toMatch(/\.card-drop-enter/);
    expect(css).not.toMatch(/translateY\(-32px\)/);
    expect(editorStory).not.toMatch(/renderDailyLetterGate/);
    expect(editorStory).not.toMatch(/card-drop-enter/);
    expect(editorStory).not.toMatch(/\.animate\(/);
    expect(editorStory).not.toMatch(/animateDailyLetterCard/);
  });

  it('Given dark mode is active, when home and card chrome styles are inspected, then wheel borders and card controls should use the white accent token', () => {
    const pagesCss = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const componentsCss = readFileSync(resolve(process.cwd(), 'src/css/components.css'), 'utf8');
    const baseCss = readFileSync(resolve(process.cwd(), 'src/css/base.css'), 'utf8');

    const darkWheelRule = pagesCss.match(/\[data-theme="dark"\]\s+\.wheel-selection-box\s*\{[\s\S]*?\}/)?.[0];
    const darkCardActionsRule = componentsCss.match(/\[data-theme="dark"\]\s+\.card-actions\s*\{[\s\S]*?\}/)?.[0];
    const darkCardShortcutRule = componentsCss.match(/\[data-theme="dark"\]\s+\.card-detail-shortcut-btn\s*\{[\s\S]*?\}/)?.[0];
    expect(darkWheelRule).toMatch(/border:\s*1px\s+solid\s+var\(--color-border\)/);
    expect(darkCardActionsRule).toMatch(/color:\s*var\(--color-accent\)/);
    expect(darkCardShortcutRule).toMatch(/color:\s*var\(--color-accent\)/);
    expect(darkCardShortcutRule).toMatch(/border-color:\s*var\(--color-accent\)/);
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

    /* jsdom 은 레이아웃이 없어 offsetParent 가 항상 null → editorstory 의 ensureSwiper
       offsetParent 가드가 Swiper 를 만들지 못해 카드가 렌더되지 않는다. 부모를 반환하도록
       덮어써 실제로 .flipper 카드가 렌더되게 한다 (테스트 환경 보정). */
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get() { return this.parentNode; },
    });

    /* jsdom 의 기본 rAF(~16ms)는 flushRender 의 setTimeout(0) 창보다 늦게 발화해
       Swiper lazy init 이 누락된다. setTimeout(0) 으로 강제해 즉시 발화시킨다. */
    window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    window.cancelAnimationFrame = (handle) => clearTimeout(handle);

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

  it('Given today editor story has not been opened, when the editor story page renders, then the card should appear directly without the letter animation', async () => {
    localStorage.removeItem('daystory:daily-letter-opened:story-1');

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    expect(page.querySelector('.daily-letter-gate')).toBeNull();
    expect(page.querySelector('.editorstory-card-area .flip-container')).not.toBeNull();
    expect(page.querySelector('.editorstory-card-area .flip-container.card-drop-enter')).toBeNull();
    expect(page.querySelector('.history-card-image-wrap img')?.getAttribute('src')).toContain('story.png');
    expect(page.querySelector('.card-image-title')?.textContent).toContain('Test Figure');
    expect(localStorage.getItem('daystory:daily-letter-opened:story-1')).toBeNull();
  });

  it('Given a legacy story has only image_url, when the editor story page renders, then the card image should not stay on the placeholder', async () => {
    const legacyStory = buildStory({ image_thumb_url: '' });
    fetchStoriesMock.mockResolvedValue([legacyStory]);
    fetchTodayStoryMock.mockResolvedValue(legacyStory);

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    const image = page.querySelector('.history-card-image-wrap img');
    expect(image?.getAttribute('src')).toBe('https://example.com/story.png');
    expect(image?.getAttribute('src') || '').not.toContain('data:image/svg+xml');
  });

  it('Given today editor story was already opened, when the editor story page renders, then the card should render directly without the daily letter gate', async () => {
    localStorage.setItem('daystory:daily-letter-opened:story-1', 'true');

    const page = renderEditorStory();
    document.body.appendChild(page);
    await flushRender();

    expect(page.querySelector('.daily-letter-gate')).toBeNull();
    expect(page.querySelector('.editorstory-card-area .flip-container')).not.toBeNull();
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
    /* 실제 브라우저는 탭(작은 이동)에 대해 touchend 후 호환 click 을 발생시킨다 (jsdom 은 미발생).
       editorBtn 은 click 으로 버블을 열므로 호환 click 을 모사한다. */
    editorButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

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
