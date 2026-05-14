import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStoryImageSources, getStoryImageUrl } from '../src/js/utils/imageLoading.js';

describe('Calendar image loading', () => {
  it('Given calendar thumbnails, when source is inspected, then cells should prefer image_thumb_url while preloads skip originals', () => {
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const imageLoading = readFileSync(resolve(process.cwd(), 'src/js/utils/imageLoading.js'), 'utf8');

    expect(imageLoading).toMatch(/export function getStoryImageUrl/);
    expect(imageLoading).toMatch(/export function getStoryImageSources/);
    expect(imageLoading).toMatch(/image_thumb_url/);
    expect(imageLoading).toMatch(/fallback/);
    expect(calendar).toMatch(/getStoryImageSources\(story,\s*'thumb'\)/);
    expect(calendar).toMatch(/src="\$\{escapeHtml\(imageUrl\)\}"/);
    expect(calendar).not.toMatch(/data-src="\$\{escapeHtml\(imageUrl\)\}"/);
    expect(calendar).toMatch(/preloadStoryImages\([\s\S]*variant:\s*'thumb'[\s\S]*fallback:\s*false/);
  });

  it('Given calendar route warmup, when source is inspected, then home should warm the route and current-month thumbnails from the calendar nav', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');

    expect(main).toMatch(/warmCalendarRoute/);
    expect(main).toMatch(/nav-calendar/);
    expect(main).toMatch(/pointerenter/);
    expect(main).toMatch(/touchstart/);
    expect(main).toMatch(/focus/);
    expect(main).toMatch(/warmStoriesCache/);
    expect(main).toMatch(/variant:\s*'thumb'/);
    expect(main).toMatch(/fallback:\s*false/);
  });

  it('Given downloaded card images, when app sources are inspected, then images should be cached locally and future loads should prefer the cache', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');
    const sw = readFileSync(resolve(process.cwd(), 'public/daystory-image-cache-sw.js'), 'utf8');
    const imageService = readFileSync(resolve(process.cwd(), 'src/js/services/images.js'), 'utf8');

    expect(main).toMatch(/serviceWorker\.register\('\/daystory-image-cache-sw\.js'\)/);
    expect(sw).toMatch(/request\.destination\s*===\s*'image'/);
    expect(sw).toMatch(/caches\.match\(request\)/);
    expect(sw).toMatch(/cache\.put\(request,\s*response\.clone\(\)\)/);
    expect(sw).toMatch(/DAYSTORY_IMAGE_CACHE/);
    expect(imageService).toMatch(/cacheControl:\s*IMAGE_CACHE_CONTROL/);
    expect(imageService).toMatch(/max-age=31536000/);
  });

  it('Given editor users open calendar, when source is inspected, then missing thumbnails should backfill only for the visible month', () => {
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const imageService = readFileSync(resolve(process.cwd(), 'src/js/services/images.js'), 'utf8');

    expect(calendar).toMatch(/backfillStoryThumbnailsForMonth/);
    expect(calendar).toMatch(/role\s*===\s*'editor'/);
    expect(calendar).toMatch(/collectionName:\s*state\.mode\s*===\s*'history'\s*\?\s*'stories'\s*:\s*'userStories'/);
    expect(imageService).toMatch(/image_thumb_url/);
    expect(imageService).toMatch(/for\s*\(const story of candidates\)/);
  });

  it('Given a calendar history card front, when source is inspected, then it should not render the collect bar inside the front face', () => {
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const historyCardBuilder = calendar.match(/function buildHistoryCardHtml[\s\S]*?function buildMyCardHtml/)?.[0] || '';

    expect(historyCardBuilder).toContain('history-card-front');
    expect(historyCardBuilder).not.toContain('card-collect-bar');
  });

  it('Given the calendar mode toggle, when styles are inspected, then it should follow the theme option segmented control layout', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const calendarToggleRule = css.match(/\.calendar-toggle\s*\{[\s\S]*?\}/)?.[0] || '';
    const calendarToggleBtnRule = css.match(/\.calendar-toggle-btn\s*\{[\s\S]*?\}/)?.[0] || '';
    const calendarToggleActiveRule = css.match(/\.calendar-toggle-btn\.active\s*\{[\s\S]*?\}/)?.[0] || '';
    const calendarToggleThumbRule = Array.from(css.matchAll(/(^|\n)\.calendar-toggle-thumb\s*\{[\s\S]*?\}/g))
      .map((match) => match[0])
      .find((rule) => rule.trim().startsWith('.calendar-toggle-thumb')) || '';

    expect(calendarToggleRule).toMatch(/background:\s*var\(--color-bg-card-dark\)/);
    expect(calendarToggleRule).toMatch(/padding:\s*4px/);
    expect(calendarToggleRule).toMatch(/gap:\s*4px/);
    expect(calendarToggleBtnRule).toMatch(/display:\s*flex/);
    expect(calendarToggleBtnRule).toMatch(/align-items:\s*center/);
    expect(calendarToggleBtnRule).toMatch(/justify-content:\s*center/);
    expect(calendarToggleBtnRule).toMatch(/border-radius:\s*calc\(var\(--radius-lg\)\s*-\s*2px\)/);
    expect(calendarToggleBtnRule).toMatch(/z-index:\s*2/);
    expect(calendarToggleBtnRule).toMatch(/transition:\s*color\s+var\(--transition-fast\),\s*transform\s+var\(--transition-fast\)/);
    expect(calendarToggleActiveRule).toMatch(/color:\s*#1c1c1e/);
    expect(calendarToggleActiveRule).not.toMatch(/background:/);
    expect(calendarToggleActiveRule).not.toMatch(/box-shadow:/);
    expect(calendarToggleThumbRule).toMatch(/display:\s*block/);
    expect(calendarToggleThumbRule).toMatch(/background:\s*#ffffff/);
    expect(calendarToggleThumbRule).toMatch(/box-shadow:/);
    expect(calendarToggleThumbRule).toMatch(/transition:\s*transform\s+\.25s/);
    expect(css).toMatch(/\.calendar-toggle\[data-mode=mine\]\s+\.calendar-toggle-thumb\s*\{[\s\S]*?transform:\s*translateX\(calc\(100%\s*\+\s*4px\)\)/);
  });

  it('Given the calendar grid, when styles are inspected, then cells should use a wider screen allocation ratio', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const calendarPageRule = css.match(/\.calendar-page\s*\{[\s\S]*?\}/)?.[0] || '';
    const calendarGridRule = css.match(/\.calendar-grid\s*\{[\s\S]*?\}/)?.[0] || '';
    const calendarCellRule = css.match(/\.cal-cell\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(calendarPageRule).toMatch(/padding:\s*var\(--space-3\)\s+var\(--space-3\)\s+var\(--space-6\)/);
    expect(calendarGridRule).toMatch(/gap:\s*1px/);
    expect(calendarGridRule).toMatch(/padding:\s*var\(--space-1\)/);
    expect(calendarCellRule).toMatch(/aspect-ratio:\s*1\s*\/\s*1\.12/);
  });

  it('Given calendar cells with story images, when source and styles are inspected, then dates should overlay uncropped images without collection icons', () => {
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const renderGridSnippet = calendar.match(/const peekHtml = story \? renderCellPeek[\s\S]*?<\/button>/)?.[0] || '';
    const cellPeekBuilder = calendar.match(/function renderCellPeek[\s\S]*?\/\* ─/)?.[0] || '';
    const calendarCellRule = css.match(/\.cal-cell\s*\{[\s\S]*?\}/)?.[0] || '';
    const calendarDayRule = css.match(/(^|\n)\.cal-cell-day\s*\{[\s\S]*?\}/)?.[0] || '';
    const peekRule = css.match(/\.cal-cell-peek\s*\{[\s\S]*?\}/)?.[0] || '';
    const peekImageRule = css.match(/\.cal-cell-peek-img\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(renderGridSnippet.indexOf('${peekHtml}')).toBeGreaterThan(-1);
    expect(renderGridSnippet.indexOf('<span class="cal-cell-day">${d}</span>'))
      .toBeGreaterThan(renderGridSnippet.indexOf('${peekHtml}'));
    expect(calendarCellRule).toMatch(/display:\s*block/);
    expect(calendarDayRule).toMatch(/position:\s*absolute/);
    expect(calendarDayRule).toMatch(/z-index:\s*2/);
    expect(peekRule).toMatch(/position:\s*absolute/);
    expect(peekRule).toMatch(/inset:\s*0/);
    expect(peekImageRule).toMatch(/object-fit:\s*contain/);
    expect(cellPeekBuilder).not.toContain('cal-cell-collected-badge');
    expect(cellPeekBuilder).not.toContain('aria-label="수집됨"');
  });

  it('Given list thumbnails, when no thumbnail exists, then visible images fall back to the stored original', () => {
    expect(getStoryImageUrl({
      image_url: 'https://example.com/original.jpg',
      image_thumb_url: '',
    }, 'thumb')).toBe('https://example.com/original.jpg');

    expect(getStoryImageUrl({
      image_url: 'https://example.com/original.jpg',
      image_thumb_url: '',
    }, 'thumb', false)).toBe('');

    expect(getStoryImageUrl({
      image_url: 'data:image/png;base64,AAA',
      image_thumb_url: '',
    }, 'thumb')).toBe('data:image/png;base64,AAA');

    expect(getStoryImageUrl({
      image_url: 'https://example.com/original.jpg',
      image_thumb_url: 'https://example.com/thumb.webp',
    }, 'thumb', false)).toBe('https://example.com/thumb.webp');

    expect(getStoryImageSources({
      image_url: 'https://example.com/original.jpg',
      image_thumb_url: 'https://example.com/thumb.webp',
    }, 'thumb')).toEqual({
      primary: 'https://example.com/thumb.webp',
      fallback: 'https://example.com/original.jpg',
    });
  });
});
