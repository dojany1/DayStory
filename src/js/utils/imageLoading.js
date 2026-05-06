const preloadedImageUrls = new Set();

export function getStoryImageUrl(story, variant = 'display', fallback = true) {
  if (!story) return '';

  if (variant === 'thumb') {
    return story.image_thumb_url || (fallback ? (story.image_url || story.photoURL || '') : '');
  }

  return story.image_url || story.photoURL || story.image_thumb_url || '';
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
