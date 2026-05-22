import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase.js';

const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function makeStorageSafeName(name = 'daystory-image') {
  return String(name).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'daystory-image';
}

export async function uploadImage(file, { uid, folder = 'editor_images' } = {}) {
  if (!storage) throw new Error('Firebase Storage missing');
  if (!uid) throw new Error('uploadImage: uid is required (login enforced)');
  const safeName = makeStorageSafeName(file?.name || 'daystory-image');
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const storageRef = ref(storage, `users/${uid}/${folder}/${fileName}`);
  await uploadBytes(storageRef, file, {
    contentType: file.type || 'image/jpeg',
    cacheControl: IMAGE_CACHE_CONTROL,
  });
  return { image_url: await getDownloadURL(storageRef) };
}
