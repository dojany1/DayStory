export const CARD_PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect fill='%23e0e0e0' width='300' height='400'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='40'%3E%F0%9F%93%B7%3C/text%3E%3C/svg%3E";
export const EDITOR_PREVIEW_PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect fill='%23e0e0e0' width='300' height='400'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='40'%3E%F0%9F%93%B7%3C/text%3E%3Ctext x='50%25' y='58%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='14' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";

const preloadedImageUrls = new Set();
const LAZY_IMAGE_ROOT_MARGIN = '360px 0px';

function normalizeImageUrl(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isInlineImageUrl(value) {
  return /^data:image\//i.test(normalizeImageUrl(value));
}

function getListSafeImageUrl(value) {
  const url = normalizeImageUrl(value);
  return url && !isInlineImageUrl(url) ? url : '';
}

function getDisplayImageUrl(value) {
  const url = normalizeImageUrl(value);
  if (!url) return '';
  if (/^data:/i.test(url) && !isInlineImageUrl(url)) return '';
  return url;
}

export function getStoryImageSources(story, variant = 'display', fallback = true) {
  if (!story) return { primary: '', fallback: '' };

  const displayUrl = getDisplayImageUrl(story.image_url || story.photoURL);
  const thumbUrl = getListSafeImageUrl(story.image_thumb_url);

  if (variant === 'thumb') {
    if (thumbUrl) {
      return {
        primary: thumbUrl,
        fallback: fallback && displayUrl !== thumbUrl ? displayUrl : '',
      };
    }

    return {
      primary: fallback ? displayUrl : '',
      fallback: '',
    };
  }

  return {
    primary: displayUrl || thumbUrl,
    fallback: '',
  };
}

export function getStoryImageUrl(story, variant = 'display', fallback = true) {
  return getStoryImageSources(story, variant, fallback).primary;
}

export function preloadImage(url) {
  if (!url || typeof url !== 'string') return;
  if (url.startsWith('data:') || preloadedImageUrls.has(url)) return;

  preloadedImageUrls.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.loading = 'eager';
  img.src = url;

  if (typeof img.decode === 'function') {
    img.decode().catch(() => {});
  }
}

export function preloadStoryImages(stories, options = 4) {
  if (!Array.isArray(stories)) return;

  const settings = typeof options === 'number'
    ? { limit: options, variant: 'display', fallback: true }
    : {
        limit: options.limit ?? 4,
        variant: options.variant || 'display',
        fallback: options.fallback !== false,
      };

  stories
    .filter(Boolean)
    .map((story) => getStoryImageUrl(story, settings.variant, settings.fallback))
    .filter(Boolean)
    .slice(0, settings.limit)
    .forEach(preloadImage);
}

export function prepareLazyImages(root = null) {
  if (typeof document === 'undefined') return () => {};

  const container = root && typeof root.querySelectorAll === 'function' ? root : document;
  const images = Array.from(container.querySelectorAll('img[data-src]'));
  if (!images.length) return () => {};

  const loadImage = (img) => {
    const src = img.getAttribute('data-src');
    if (!src) return;
    img.setAttribute('src', src);
    img.removeAttribute('data-src');
  };

  if (typeof IntersectionObserver !== 'function') {
    images.forEach(loadImage);
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadImage(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    rootMargin: LAZY_IMAGE_ROOT_MARGIN,
    threshold: 0.01,
  });

  images.forEach((img) => observer.observe(img));
  return () => observer.disconnect();
}
