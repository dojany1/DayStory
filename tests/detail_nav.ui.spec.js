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

  it('Given the detail page title area, when the story renders, then bookmark and share buttons should sit beside the title instead of in the top header', async () => {
    const page = renderDetail({ id: 'story-1' });
    document.body.appendChild(page);

    await flushRender();

    const titleRow = page.querySelector('.detail-title-row');

    expect(titleRow).not.toBeNull();
    expect(titleRow?.querySelector('.detail-figure-name')?.textContent).toContain('Test Figure');
    expect(titleRow?.querySelector('#detail-bookmark')).not.toBeNull();
    expect(titleRow?.querySelector('#detail-share')).not.toBeNull();
    expect(page.querySelector('#detail-header #detail-bookmark')).toBeNull();
    expect(page.querySelector('#detail-header #detail-share')).toBeNull();
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
});

describe('Bottom navigation visuals', () => {
  it('Given the three main bottom navigation icons, when their base styles are inspected, then the profile icon should match the shared 28px size and not have a profile-only active border change', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/base.css'), 'utf8');
    const navIconRule = css.match(/\.bottom-nav\.redesigned-nav \.nav-icon\s*\{[\s\S]*?\}/)?.[0];
    const profileWrapRule = css.match(/\.nav-profile-img-wrap\s*\{[\s\S]*?\}/)?.[0];
    const guestAvatarRule = css.match(/\.nav-profile-img-wrap \.guest-avatar\s*\{[\s\S]*?\}/)?.[0];

    expect(navIconRule).toMatch(/width:\s*28px/);
    expect(navIconRule).toMatch(/height:\s*28px/);
    expect(profileWrapRule).toMatch(/width:\s*28px/);
    expect(profileWrapRule).toMatch(/height:\s*28px/);
    expect(guestAvatarRule).not.toMatch(/width:\s*16px/);
    expect(guestAvatarRule).not.toMatch(/height:\s*16px/);
    expect(css).not.toMatch(/\.nav-item\.active\s+\.nav-profile-img-wrap\s*\{[\s\S]*?border-color:/);
  });

  it('Given the home navigation icon, when the nav markup is inspected, then the first icon should use a letter-style envelope SVG instead of the current target icon', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const editorNavMarkup = html.match(/<button class="nav-item active" data-route="\/editorstory"[\s\S]*?<\/button>/)?.[0];

    expect(editorNavMarkup).not.toMatch(/<circle cx="12" cy="12" r="10"><\/circle>/);
    expect(editorNavMarkup).not.toMatch(/<polygon points="16\.24 7\.76 14\.12 14\.12 7\.76 16\.24 9\.88 9\.88 16\.24 7\.76"><\/polygon>/);
    expect(editorNavMarkup).toMatch(/<path[^>]+d="M3(?:\.5)? 7(?:\.5)?(?:\s|,)12(?:\s|,)13(?:\.5)?(?:\s|,)20\.5 7\.5"/);
  });

  it('Given the home navigation letter icon, when its envelope bounds are inspected, then it should not be flatter than the other main icons', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const editorNavMarkup = html.match(/<button class="nav-item active" data-route="\/editorstory"[\s\S]*?<\/button>/)?.[0] || '';
    const rectMarkup = editorNavMarkup.match(/<rect[^>]+>/)?.[0] || '';
    const width = Number(rectMarkup.match(/width="([^"]+)"/)?.[1]);
    const height = Number(rectMarkup.match(/height="([^"]+)"/)?.[1]);

    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width / height).toBeLessThanOrEqual(1.25);
  });

  it('Given a user profile photo changes, when the bottom navigation code is inspected, then the profile tab should keep the static main icon instead of rendering the photo', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');

    expect(main).not.toMatch(/navWrap\.innerHTML\s*=\s*`<img/);
    expect(main).toMatch(/guest-avatar/);
  });
});
