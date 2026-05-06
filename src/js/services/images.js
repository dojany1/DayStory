import imageCompression from 'browser-image-compression';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase.js';

const DISPLAY_IMAGE_OPTIONS = {
  maxSizeMB: 0.45,
  maxWidthOrHeight: 1400,
  useWebWorker: true,
  initialQuality: 0.82,
};

const THUMB_IMAGE_OPTIONS = {
  maxSizeMB: 0.08,
  maxWidthOrHeight: 420,
  useWebWorker: true,
  initialQuality: 0.76,
};

const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 400;
const backfilledStories = new Set();

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

async function uploadOptimizedFile(optimizedFile, { uid, folder, prefix }) {
  if (!storage) throw new Error('Firebase Storage missing');

  const safeUid = uid || 'guest';
  const safeName = makeStorageSafeName(optimizedFile?.name || `${prefix || 'image'}.jpg`);
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${prefix || 'image'}_${safeName}`;
  const storageRef = ref(storage, `users/${safeUid}/${folder}/${fileName}`);
  await uploadBytes(storageRef, optimizedFile);
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
    }, 'image/jpeg', 0.76);
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
  const sourceName = file?.name || 'daystory-image.jpg';
  const optimizedFile = await optimizeImage(file, DISPLAY_IMAGE_OPTIONS);
  if (!optimizedFile.name) optimizedFile.name = sourceName;

  const thumbBlob = await createThumbnailBlob(optimizedFile);
  if (!thumbBlob.name) thumbBlob.name = `thumb_${sourceName}`;

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
    .filter((story) => !backfilledStories.has(`${collectionName}:${story.id}`))
    .slice(0, limit);

  for (const story of candidates) {
    const key = `${collectionName}:${story.id}`;
    backfilledStories.add(key);

    try {
      const response = await fetch(story.image_url);
      if (!response.ok) throw new Error('Image fetch failed');
      const sourceBlob = await response.blob();
      const thumbBlob = await createThumbnailBlob(sourceBlob);
      if (!thumbBlob.name) thumbBlob.name = `thumb_${story.id}.jpg`;

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
