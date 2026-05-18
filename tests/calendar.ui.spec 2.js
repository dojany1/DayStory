import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Calendar image loading', () => {
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
      .join('\n');

    expect(calendarToggleRule).toMatch(/border-radius/);
    expect(calendarToggleBtnRule).toMatch(/flex/);
    expect(calendarToggleActiveRule).toMatch(/color/);
    expect(calendarToggleThumbRule).toMatch(/transition/);
  });

  it('Given the calendar grid cell layout, when source is inspected, then day label should precede peek image and styles should be correct', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const renderGridSnippet = calendar.match(/export function renderGrid[\s\S]*?^}/m)?.[0] || calendar;
    const calendarCellRule = css.match(/\.cal-cell\s*\{[\s\S]*?\}/)?.[0] || '';
    const calendarStoryCellRule = css.match(/\.cal-cell-has-story\s*\{[\s\S]*?\}/)?.[0] || '';
    const calendarDayRule = css.match(/(^|\n)\.cal-cell-day\s*\{[\s\S]*?\}/)?.[0] || '';
    const peekRule = css.match(/\.cal-cell-peek\s*\{[\s\S]*?\}/)?.[0] || '';
    const peekImageRule = css.match(/\.cal-cell-peek-img\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(renderGridSnippet.indexOf('${peekHtml}')).toBeGreaterThan(-1);
    expect(renderGridSnippet.indexOf('<span class="cal-cell-day">${d}</span>'))
      .toBeLessThan(renderGridSnippet.indexOf('${peekHtml}'));
    expect(calendarCellRule).toMatch(/display:\s*flex/);
    expect(calendarCellRule).toMatch(/flex-direction:\s*column/);
    expect(calendarStoryCellRule).toMatch(/box-shadow:\s*var\(--shadow-sm\)/);
    expect(calendarDayRule).not.toMatch(/position:\s*absolute/);
    expect(calendarDayRule).not.toMatch(/background:\s*var\(--color-bg-overlay\)/);
    expect(calendarDayRule).toMatch(/font-size:\s*var\(--text-xs\)/);
    expect(peekRule).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(peekRule).toMatch(/aspect-ratio:\s*4\s*\/\s*5/);
    expect(peekRule).toMatch(/position:\s*relative/);
    expect(peekImageRule).toMatch(/object-fit:\s*contain/);
  });

  it('Given compact image surfaces, when source is inspected, then cards use story.image_url directly', () => {
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');

    expect(calendar).toMatch(/story\.image_url/);
    expect(calendar).toMatch(/role\s*===\s*'editor'/);
  });
});
