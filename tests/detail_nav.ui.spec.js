import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  fetchStoryByIdMock,
  isBookmarkedMock,
  toggleBookmarkMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  fetchStoryByIdMock: vi.fn(),
  isBookmarkedMock: vi.fn(),
  toggleBookmarkMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  getPreviousRoute: vi.fn(() => null),
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../src/js/services/stories.js', () => ({
  fetchStoryById: fetchStoryByIdMock,
}));

vi.mock('../src/js/services/bookmarks.js', () => ({
  isBookmarked: isBookmarkedMock,
  toggleBookmark: toggleBookmarkMock,
}));

vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
})));

const { renderDetail } = await import('../src/js/pages/detail.js');

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
    body: 'Line one\nLine two',
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

async function flushCloseAnimation() {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 220));
}

describe('Detail page editor remark', () => {
  beforeEach(() => {
    document.body.innerHTML = '';

    navigateMock.mockReset();
    fetchStoryByIdMock.mockReset();
    isBookmarkedMock.mockReset();
    toggleBookmarkMock.mockReset();

    fetchStoryByIdMock.mockResolvedValue(buildStory());
    isBookmarkedMock.mockResolvedValue(false);
    toggleBookmarkMock.mockResolvedValue({ bookmarked: true, error: null });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Given a story with an editor remark, when the detail page renders, then the editor section should show the editor name and comment text without a badge label', async () => {
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();

    const text = page.textContent || '';
    expect(page.querySelector('.detail-editor-note')).not.toBeNull();
    expect(page.querySelector('.detail-editor-note-label')).toBeNull();
    expect(text).not.toContain('에디터의 말');
    expect(text).toContain('DayStory');
    expect(text).toContain('Editor note');
  });

  it('Given the detail page opens, when the shell renders, then it should use a bottom sheet with backdrop handle and close button', async () => {
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();

    expect(page.querySelector('.detail-sheet-backdrop')).not.toBeNull();
    expect(page.querySelector('.detail-sheet')).not.toBeNull();
    expect(page.querySelector('.detail-sheet-handle')).not.toBeNull();
    expect(page.querySelector('#detail-close')).not.toBeNull();
    expect(page.querySelector('.detail-sheet-scroll')).not.toBeNull();
    expect(page.querySelector('.detail-header')).toBeNull();
  });

  it('Given the detail backdrop is tapped, when it receives a click, then the sheet closes via history back', async () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();
    page.querySelector('.detail-sheet-backdrop')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushCloseAnimation();

    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('Given the sheet handle is dragged down from the top, when the threshold is passed, then the sheet closes', async () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();
    const dragZone = page.querySelector('.detail-sheet-drag-zone');
    dragZone?.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [{ clientY: 100 }] }));
    dragZone?.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [{ clientY: 220 }] }));
    dragZone?.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [{ clientY: 220 }] }));
    await flushCloseAnimation();

    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('Given the sheet content is scrolled, when the user drags inside content, then it should not close the sheet', async () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();
    const scrollArea = page.querySelector('.detail-sheet-scroll');
    Object.defineProperty(scrollArea, 'scrollTop', { value: 48, configurable: true });

    scrollArea?.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [{ clientY: 100 }] }));
    scrollArea?.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [{ clientY: 240 }] }));
    scrollArea?.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [{ clientY: 240 }] }));

    expect(backSpy).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });

  it('Given the detail page hero, when the story renders, then the image area should not show the title or country tag', async () => {
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();

    const hero = page.querySelector('.detail-hero');

    expect(hero).not.toBeNull();
    expect(hero?.querySelector('.card-image-title')).toBeNull();
    expect(hero?.querySelector('.detail-hero-tag')).toBeNull();
  });

  it('Given a story with a country, when the detail page renders, then the country should appear as plain text next to the body date', async () => {
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();

    const dateText = page.querySelector('.detail-historical-date')?.textContent?.trim();

    expect(dateText).toBe('1592-04-24 · Korea');
  });

  it('Given the detail page styles, when the editor note rule is inspected, then the editor note should use a solid card background without a gradient', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const editorNoteRule = css.match(/\.detail-editor-note\s*\{[\s\S]*?\}/)?.[0];

    expect(editorNoteRule).toBeTruthy();
    expect(editorNoteRule).toMatch(/background:\s*var\(--color-bg-secondary\)/);
    expect(editorNoteRule).not.toMatch(/gradient/i);
  });

  it('Given the detail page styles, when inspected, then the detail surface should animate as a fixed bottom sheet', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const sheetRule = css.match(/\.detail-sheet\s*\{[\s\S]*?\}/)?.[0];
    const closeRule = css.match(/\.detail-sheet-close\s*\{[\s\S]*?\}/)?.[0];
    const openRule = css.match(/\.detail-page\.is-open\s+\.detail-sheet\s*\{[\s\S]*?\}/)?.[0];
    const backdropRule = css.match(/\.detail-sheet-backdrop\s*\{[\s\S]*?\}/)?.[0];

    expect(sheetRule).toMatch(/position:\s*fixed/);
    expect(sheetRule).toMatch(/bottom:\s*0/);
    expect(sheetRule).toMatch(/height:\s*calc\(100vh - var\(--safe-top\)\)/);
    expect(sheetRule).toMatch(/height:\s*calc\(100dvh - var\(--safe-top\)\)/);
    expect(sheetRule).toMatch(/transform:\s*translateY\(100%\)/);
    expect(sheetRule).toMatch(/transition:\s*transform/);
    expect(closeRule).toMatch(/left:\s*var\(--space-4\)/);
    expect(closeRule).not.toMatch(/right:\s*var\(--space-4\)/);
    expect(openRule).toMatch(/transform:\s*translateY\(0\)/);
    expect(backdropRule).toMatch(/position:\s*fixed/);
  });

  it('Given the detail page title area, when the story renders, then bookmark and share buttons should sit beside the title instead of in the top header', async () => {
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();

    const titleRow = page.querySelector('.detail-title-row');

    expect(titleRow).not.toBeNull();
    expect(titleRow?.querySelector('.detail-figure-name')?.textContent).toContain('Test Figure');
    expect(titleRow?.querySelector('#detail-bookmark')).not.toBeNull();
    expect(titleRow?.querySelector('#detail-share')).not.toBeNull();
    expect(page.querySelector('#detail-header')).toBeNull();
  });

  it('Given the detail page content, when the story renders, then the bottom bookmark share report action nav should not render', async () => {
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();

    expect(page.querySelector('.detail-actions-bar')).toBeNull();
    expect(page.querySelector('#action-bookmark')).toBeNull();
    expect(page.querySelector('#action-share')).toBeNull();
    expect(page.querySelector('#action-report')).toBeNull();
  });

  it('Given image attribution metadata, when the detail page renders, then the attribution should sit directly below the editor note', async () => {
    fetchStoryByIdMock.mockResolvedValue(buildStory({
      image_source: 'Wikimedia Commons',
      image_license: 'CC BY-SA 4.0',
      story_sources: [
        'Archive | https://example.com/archive',
        { title: 'Book reference', url: '' },
      ],
    }));

    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();

    const editorNote = page.querySelector('.detail-editor-note');
    const attribution = page.querySelector('.detail-attribution');

    expect(attribution).not.toBeNull();
    expect(editorNote?.nextElementSibling).toBe(attribution);
    expect(attribution?.textContent).toContain('이미지 출처');
    expect(attribution?.textContent).toContain('Wikimedia Commons');
    expect(attribution?.textContent).toContain('CC BY-SA 4.0');
    expect(attribution?.textContent).toContain('Archive');
    expect(attribution?.textContent).toContain('Book reference');
    expect(attribution?.querySelector('a.detail-source-item')?.getAttribute('href')).toBe('https://example.com/archive');
  });

  it('Given attribution metadata without an editor remark, when the detail page renders, then the attribution should sit below the historical date', async () => {
    fetchStoryByIdMock.mockResolvedValue(buildStory({
      editor_comment: '',
      image_source: 'Museum collection',
    }));

    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();

    const historicalDate = page.querySelector('.detail-historical-date');
    const attribution = page.querySelector('.detail-attribution');

    expect(page.querySelector('.detail-editor-note')).toBeNull();
    expect(attribution).not.toBeNull();
    expect(historicalDate?.nextElementSibling).toBe(attribution);
    expect(attribution?.textContent).toContain('Museum collection');
  });
});

describe('Bottom navigation visuals', () => {
  it('Given the three main bottom navigation icons, when their base styles are inspected, then the profile icon should match the shared 28px size and not have a profile-only active border change', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/base.css'), 'utf8');
    const navIconRule = css.match(/\.bottom-nav\.redesigned-nav \.nav-icon\s*\{[\s\S]*?\}/)?.[0];
    expect(navIconRule).toMatch(/width:\s*28px/);
    expect(navIconRule).toMatch(/height:\s*28px/);
    /* 프로필 탭은 사진 wrap(.nav-profile-img-wrap) 없이 정적 .nav-icon 만 사용한다 */
    expect(css).not.toMatch(/\.nav-profile-img-wrap\s*\{/);
    expect(css).not.toMatch(/\.nav-item\.active\s+\.nav-profile-img-wrap\s*\{[\s\S]*?border-color:/);
  });

  it('Given a redesigned bottom nav item is active, when styles are inspected, then its icon should use the primary text color token', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/base.css'), 'utf8');
    const activeIconRule = css.match(/\.bottom-nav\.redesigned-nav \.nav-item\.active \.nav-icon\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(activeIconRule).toMatch(/color:\s*var\(--color-accent\)/);
  });

  it('Given the my story bottom navigation icon, when its markup and styles are inspected, then it should use the same nav item treatment as neighboring tabs', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'src/css/base.css'), 'utf8');
    const myStoryNavMarkup = html.match(/<button[^>]+id="nav-mystory"[\s\S]*?<\/button>/)?.[0] || '';

    expect(myStoryNavMarkup).toMatch(/class="nav-item"/);
    expect(myStoryNavMarkup).not.toContain('nav-item-center');
    expect(myStoryNavMarkup).not.toContain('nav-center-circle');
    expect(css).not.toMatch(/\.bottom-nav\.redesigned-nav \.nav-item-center/);
    expect(css).not.toMatch(/\.nav-center-circle\s*\{[\s\S]*?background:\s*var\(--color-accent\)/);
  });

  it('Given the home navigation icon, when the nav markup is inspected, then the first icon should use the bookmarked-book SVG and not a target icon', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const editorNavMarkup = html.match(/<button class="nav-item active" data-route="\/editorstory"[\s\S]*?<\/button>/)?.[0];

    expect(editorNavMarkup).not.toMatch(/<circle cx="12" cy="12" r="10"><\/circle>/);
    expect(editorNavMarkup).not.toMatch(/<polygon points="16\.24 7\.76 14\.12 14\.12 7\.76 16\.24 9\.88 9\.88 16\.24 7\.76"><\/polygon>/);
    expect(editorNavMarkup).toMatch(/<path[^>]+d="M4 19\.5v-15/);
  });

  it('Given the home navigation icon, when its viewBox is inspected, then it should use the shared square 24x24 viewBox like the other main icons', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const editorNavMarkup = html.match(/<button class="nav-item active" data-route="\/editorstory"[\s\S]*?<\/button>/)?.[0] || '';
    const svgMarkup = editorNavMarkup.match(/<svg[^>]*>/)?.[0] || '';

    expect(svgMarkup).toMatch(/class="nav-icon"/);
    expect(svgMarkup).toMatch(/viewBox="0 0 24 24"/);
  });

  it('Given a user profile photo changes, when the bottom navigation code is inspected, then the profile tab should keep the static main icon instead of rendering the photo', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const profileNavMarkup = html.match(/<button class="nav-item" data-route="\/profile"[\s\S]*?<\/button>/)?.[0] || '';

    expect(main).not.toMatch(/navWrap\.innerHTML\s*=\s*`<img/);
    expect(main).not.toMatch(/navWrap\.innerHTML/);
    expect(profileNavMarkup).toMatch(/class="nav-icon"/);
    expect(profileNavMarkup).toMatch(/<line x1="4" x2="20"/);
  });
});
