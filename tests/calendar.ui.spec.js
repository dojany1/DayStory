import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Calendar image loading', () => {
  it('Given calendar thumbnails, when source is inspected, then cells should prefer image_thumb_url without preloading original images', () => {
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const imageLoading = readFileSync(resolve(process.cwd(), 'src/js/utils/imageLoading.js'), 'utf8');

    expect(imageLoading).toMatch(/export function getStoryImageUrl/);
    expect(imageLoading).toMatch(/image_thumb_url/);
    expect(imageLoading).toMatch(/fallback/);
    expect(calendar).toMatch(/getStoryImageUrl\(story,\s*'thumb'\)/);
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

  it('Given editor users open calendar, when source is inspected, then missing thumbnails should backfill only for the visible month', () => {
    const calendar = readFileSync(resolve(process.cwd(), 'src/js/pages/calendar.js'), 'utf8');
    const imageService = readFileSync(resolve(process.cwd(), 'src/js/services/images.js'), 'utf8');

    expect(calendar).toMatch(/backfillStoryThumbnailsForMonth/);
    expect(calendar).toMatch(/role\s*===\s*'editor'/);
    expect(calendar).toMatch(/collectionName:\s*state\.mode\s*===\s*'history'\s*\?\s*'stories'\s*:\s*'userStories'/);
    expect(imageService).toMatch(/image_thumb_url/);
    expect(imageService).toMatch(/for\s*\(const story of candidates\)/);
  });
});
