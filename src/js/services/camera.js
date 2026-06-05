/* =====================================================================
   camera.js — 카메라/사진 선택 통합 서비스
   =====================================================================
   App Store 2.1a (iPad 카메라 크래시) 대응.
   네이티브(iOS/Android): @capacitor/camera 플러그인 사용 — Info.plist 권한
     설명과 함께 사용해야 권한 다이얼로그가 정상 표시된다.
   웹: 숨김 <input type="file"> 폴백.

   제공 API:
     - pickFromCamera()   — 카메라 촬영
     - pickFromGallery()  — 사진 보관함에서 선택
   반환: { dataUrl, mimeType } 또는 null (사용자 취소).
   권한 거부: CameraPermissionError throw — 호출처는 toast로 안내.
   ===================================================================== */

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { t } from '../i18n/index.js';

export class CameraPermissionError extends Error {
  constructor(message) {
    super(message || t('camera.permission_message'));
    this.name = 'CameraPermissionError';
  }
}

const CANCEL_HINTS = [
  'cancel', 'cancelled', 'canceled', '취소', 'user denied',
  'not available while running in simulator',
];
const PERMISSION_HINTS = ['permission', 'denied', 'not authorized', 'unauthorized'];
/* Capacitor Camera 액션시트 라벨 — 호출 시점에 현재 언어로 조회 */
function getCameraPromptLabels() {
  return {
    promptLabelHeader: t('camera.prompt_header'),
    promptLabelPhoto: t('camera.prompt_photo'),
    promptLabelPicture: t('camera.prompt_picture'),
    promptLabelCancel: t('camera.prompt_cancel'),
  };
}

function isCancelError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return CANCEL_HINTS.some((h) => msg.includes(h)) && !PERMISSION_HINTS.some((h) => msg.includes(h));
}

function isPermissionError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return PERMISSION_HINTS.some((h) => msg.includes(h));
}

async function pickViaCapacitor(source) {
  try {
    const photo = await Camera.getPhoto({
      source,
      resultType: CameraResultType.DataUrl,
      ...getCameraPromptLabels(),
      quality: 90,
      allowEditing: false,
      presentationStyle: 'fullscreen',
      saveToGallery: false,
      correctOrientation: true,
    });
    if (!photo?.dataUrl) return null;
    const mimeType = photo.format ? `image/${photo.format}` : 'image/jpeg';
    return { dataUrl: photo.dataUrl, mimeType };
  } catch (err) {
    if (isCancelError(err)) return null;
    if (isPermissionError(err)) throw new CameraPermissionError();
    throw err;
  }
}

function pickViaInput({ capture }) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    input.addEventListener('change', () => {
      settled = true;
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        return resolve(null);
      }
      const reader = new FileReader();
      reader.onload = () => {
        cleanup();
        resolve({ dataUrl: String(reader.result), mimeType: file.type || 'image/jpeg' });
      };
      reader.onerror = () => {
        cleanup();
        reject(reader.error || new Error(t('camera.file_read_error')));
      };
      reader.readAsDataURL(file);
    });

    /* 모바일 브라우저 일부에서 change 가 발화되지 않는 경우를 대비한 안전망 — 포커스 복귀 후 잠시 뒤 미선택이면 취소로 간주 */
    const focusFallback = () => {
      setTimeout(() => {
        if (settled) return;
        if (!input.files || input.files.length === 0) {
          settled = true;
          cleanup();
          resolve(null);
        }
      }, 500);
      window.removeEventListener('focus', focusFallback);
    };
    setTimeout(() => window.addEventListener('focus', focusFallback), 0);

    input.click();
  });
}

export async function pickFromCamera() {
  if (Capacitor.isNativePlatform()) {
    return pickViaCapacitor(CameraSource.Camera);
  }
  return pickViaInput({ capture: true });
}

export async function pickFromGallery() {
  if (Capacitor.isNativePlatform()) {
    return pickViaCapacitor(CameraSource.Photos);
  }
  return pickViaInput({ capture: false });
}

/** 카메라 / 갤러리 중 선택 (네이티브에서 Prompt 시트 표시) */
export async function pickImage() {
  if (Capacitor.isNativePlatform()) {
    return pickViaCapacitor(CameraSource.Prompt);
  }
  return pickViaInput({ capture: false });
}
