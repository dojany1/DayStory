const preloadedImageUrls = new Set();

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

export function preloadStoryImages(stories, limit = 4) {
  if (!Array.isArray(stories)) return;

  stories
    .filter(Boolean)
    .map((story) => story.image_url || story.photoURL || '')
    .filter(Boolean)
    .slice(0, limit)
    .forEach(preloadImage);
}
