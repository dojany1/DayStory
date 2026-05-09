import imageCompression from 'browser-image-compression';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase.js';

const IMAGE_OUTPUT_TYPE = 'image/webp';
const IMAGE_OUTPUT_EXT = 'webp';
const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const DISPLAY_IMAGE_OPTIONS = {
  maxSizeMB: 0.32,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  initialQuality: 0.72,
  fileType: IMAGE_OUTPUT_TYPE,
};

const THUMB_IMAGE_OPTIONS = {
  maxSizeMB: 0.04,
  maxWidthOrHeight: 360,
  useWebWorker: true,
  initialQuality: 0.68,
  fileType: IMAGE_OUTPUT_TYPE,
};

const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 400;
const backfilledStories = new Set();

function isInlineImageUrl(value) {
  return typeof value === 'string' && /^data:image\//i.test(value.trim());
}

async function optimizeImage(file, options) {
  try {
    return await imageCompression(file, options);
  } catch (err) {
    console.warn('Image compression skipped:', err);
    return file;
  }
}

function makeStorageSafeName(name = 'daystory-image.jpg') {
  return String(name).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'daystory-image.jpg';
}

function extensionFromType(type) {
  if (type === IMAGE_OUTPUT_TYPE) return IMAGE_OUTPUT_EXT;
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/png') return 'png';
  return IMAGE_OUTPUT_EXT;
}

function replaceImageExtension(name, extension = IMAGE_OUTPUT_EXT) {
  const safeName = makeStorageSafeName(name || 'daystory-image');
  return safeName.replace(/\.[a-z0-9]+$/i, '') + `.${extension}`;
}

function toUploadBlob(blob, sourceName, prefix) {
  const type = blob?.type || IMAGE_OUTPUT_TYPE;
  const fileName = `${prefix || 'image'}_${replaceImageExtension(sourceName, extensionFromType(type))}`;

  if (typeof File === 'function') {
    return new File([blob], fileName, {
      type,
      lastModified: blob?.lastModified || Date.now(),
    });
  }

  blob.name = fileName;
  return blob;
}

async function uploadOptimizedFile(optimizedFile, { uid, folder, prefix }) {
  if (!storage) throw new Error('Firebase Storage missing');

  const safeUid = uid || 'guest';
  const safeName = makeStorageSafeName(optimizedFile?.name || `${prefix || 'image'}.webp`);
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${prefix || 'image'}_${safeName}`;
  const storageRef = ref(storage, `users/${safeUid}/${folder}/${fileName}`);
  await uploadBytes(storageRef, optimizedFile, {
    contentType: optimizedFile.type || IMAGE_OUTPUT_TYPE,
    cacheControl: IMAGE_CACHE_CONTROL,
  });
  return getDownloadURL(storageRef);
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image load failed'));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Thumbnail encoding failed'));
    }, IMAGE_OUTPUT_TYPE, 0.68);
  });
}

async function createThumbnailBlob(blob) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return optimizeImage(blob, THUMB_IMAGE_OPTIONS);
  }

  const img = await loadImageFromBlob(blob);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return optimizeImage(blob, THUMB_IMAGE_OPTIONS);

  const sourceRatio = img.width / img.height;
  const targetRatio = THUMB_WIDTH / THUMB_HEIGHT;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (sourceRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
  return canvasToBlob(canvas);
}

export async function uploadCardImageVariants(file, { uid = 'guest', folder = 'editor_images' } = {}) {
  const sourceName = file?.name || 'daystory-image.webp';
  const optimizedFile = toUploadBlob(
    await optimizeImage(file, DISPLAY_IMAGE_OPTIONS),
    sourceName,
    'display',
  );

  const thumbBlob = toUploadBlob(
    await createThumbnailBlob(optimizedFile),
    sourceName,
    'thumb',
  );

  const [image_url, image_thumb_url] = await Promise.all([
    uploadOptimizedFile(optimizedFile, { uid, folder, prefix: 'display' }),
    uploadOptimizedFile(thumbBlob, { uid, folder, prefix: 'thumb' }),
  ]);

  return { image_url, image_thumb_url };
}

function isStoryInMonth(story, year, month) {
  if (!story?.publish_date) return false;
  const [storyYear, storyMonth] = story.publish_date.split('-').map(Number);
  return storyYear === year && storyMonth === month;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function backfillStoryThumbnailsForMonth(stories, {
  collectionName,
  uid = 'guest',
  year,
  month,
  limit = 8,
} = {}) {
  if (!db || !storage || !collectionName || !Array.isArray(stories)) return;

  const candidates = stories
    .filter((story) => story?.id && story.image_url && !story.image_thumb_url && isStoryInMonth(story, year, month))
    .filter((story) => !isInlineImageUrl(story.image_url))
    .filter((story) => !backfilledStories.has(`${collectionName}:${story.id}`))
    .slice(0, limit);

  for (const story of candidates) {
    const key = `${collectionName}:${story.id}`;
    backfilledStories.add(key);

    try {
      const response = await fetch(story.image_url);
      if (!response.ok) throw new Error('Image fetch failed');
      const sourceBlob = await response.blob();
      const thumbBlob = toUploadBlob(
        await createThumbnailBlob(sourceBlob),
        `thumb_${story.id}.webp`,
        'thumb',
      );

      const image_thumb_url = await uploadOptimizedFile(thumbBlob, {
        uid,
        folder: collectionName === 'userStories' ? 'diary_thumbs' : 'story_thumbs',
        prefix: 'thumb',
      });

      await updateDoc(doc(db, collectionName, story.id), { image_thumb_url });
      story.image_thumb_url = image_thumb_url;
      await delay(150);
    } catch (err) {
      console.warn('Thumbnail backfill skipped:', err);
    }
  }
}
