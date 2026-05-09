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
