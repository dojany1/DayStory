/* =====================================================================
   sharing.js — SNS 공유 통합 헬퍼
   =====================================================================
   카드 공유 시 이미지를 직접 첨부하여 카카오톡/SMS/메시지에서
   미리보기가 이쁘게 보이도록 합니다. 트위터/페이스북 피드 미리보기는
   Cloud Functions(/share/:id) 의 동적 Open Graph HTML이 담당합니다.

   - shareStory(story, options) : 통합 공유 함수
   - shareToKakao(story)        : 카카오톡 전용 공유 (Wave 6, .env: VITE_KAKAO_APP_KEY)
   - buildShareUrl(storyId)     : 공식 공유 URL 생성
   ===================================================================== */

import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
/* html2canvas 는 captureAndShareCard 안에서 동적 import — 초기 번들 분리. */

/* 공유 URL 도메인. 실제 배포 도메인으로 변경 시 한 곳만 수정. */
const SHARE_DOMAIN = 'https://daystory.app';

/**
 * buildShareUrl — 카드별 공유 URL을 생성합니다.
 * 이 경로는 firebase.json rewrites + Cloud Functions에서 처리되어
 * 봇에게는 OG HTML, 사용자에게는 SPA를 응답합니다.
 */
export function buildShareUrl(storyId) {
  if (!storyId) return SHARE_DOMAIN;
  return `${SHARE_DOMAIN}/share/${encodeURIComponent(storyId)}`;
}

/**
 * fetchAsFile — 이미지 URL을 fetch해 File 객체로 만듭니다.
 * Web Share Level 2 (navigator.share with files)에 첨부 가능한 형태.
 */
async function fetchAsFile(url, filename) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    return new File([blob], filename || `daystory.${ext}`, { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

/**
 * shareStory — 카드를 공유합니다.
 * 우선순위:
 *   1) navigator.share + files (이미지 첨부) — 카톡/SMS에서 미리보기 ★
 *   2) Capacitor Share (텍스트 + URL)        — 일반 공유 시트
 *
 * @param {object} story    - { id, figure_name, title, summary, body, ... }
 * @param {object} options
 *   - kind: 'history' | 'mystory'
 *   - includeImage: boolean (기본 true) — 이미지 첨부 시도 여부
 */
export async function shareStory(story, options = {}) {
  const kind = options.kind || 'history';
  const includeImage = options.includeImage !== false;

  const title = kind === 'history'
    ? (story.figure_name || story.title || 'DayStory')
    : (story.title || 'DayStory');

  const summary = (story.summary || story.body || '').toString().slice(0, 160);
  const text = `[DayStory] ${title}${summary ? `\n\n${summary}` : ''}`;
  const url = story.id ? buildShareUrl(story.id) : SHARE_DOMAIN;

  /* 1) 이미지 첨부 시도 (Web Share Level 2) */
  if (includeImage && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const imageUrl = story.image_url || '';
      if (imageUrl) {
        const file = await fetchAsFile(imageUrl, `daystory_${story.id || 'card'}.jpg`);
        if (file && navigator.canShare({ files: [file] })) {
          await navigator.share({ title, text, url, files: [file] });
          return { ok: true, withImage: true };
        }
      }
    } catch {
      /* 사용자가 시트를 닫았거나 이미지 fetch 실패 → 폴백 */
    }
  }

  /* 2) Capacitor Share 폴백 */
  try {
    await Share.share({ title, text, url });
    return { ok: true, withImage: false };
  } catch {
    return { ok: false, withImage: false };
  }
}


/* =====================================================================
   Wave 6: 카카오톡 공유 (한국 시장 바이럴 루프)
   =====================================================================
   `VITE_KAKAO_APP_KEY` 환경 변수가 있을 때만 동작. 키가 없으면
   조용히 일반 shareStory() 로 폴백한다. SDK 는 첫 호출 시 동적 로드
   (초기 번들 부담 0). 카카오 콘솔에서 앱 등록 + JS 키 발급 후
   `.env` 의 `VITE_KAKAO_APP_KEY=...` 에 주입.
   ===================================================================== */

const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
let kakaoLoadPromise = null;

/**
 * loadKakaoSdk — 카카오 JS SDK 를 동적으로 로드 (최초 1회만).
 * @returns {Promise<object>} window.Kakao 또는 reject
 */
function loadKakaoSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Kakao SDK: no window'));
  if (window.Kakao) return Promise.resolve(window.Kakao);
  if (kakaoLoadPromise) return kakaoLoadPromise;

  kakaoLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (window.Kakao) resolve(window.Kakao);
      else reject(new Error('Kakao SDK load: global missing'));
    };
    script.onerror = () => {
      kakaoLoadPromise = null;  /* 재시도 가능하게 */
      reject(new Error('Kakao SDK load: network'));
    };
    document.head.appendChild(script);
  });
  return kakaoLoadPromise;
}

/**
 * shareToKakao — 카카오톡으로 카드 공유.
 *
 * 동작 순서:
 *   1) VITE_KAKAO_APP_KEY 없음 → shareStory() 폴백.
 *   2) SDK 로드 실패 → shareStory() 폴백.
 *   3) Kakao.Share.sendDefault 호출. 카카오톡 미설치/팝업 차단 시 카카오가 자체 폴백 UI 표시.
 *
 * @param {object} story  - { id, figure_name, title, summary, image_url, ... }
 * @returns {Promise<{ok:boolean, via:'kakao'|'fallback'}>}
 */
export async function shareToKakao(story) {
  const appKey = import.meta.env?.VITE_KAKAO_APP_KEY;
  if (!appKey) {
    /* 키 없음 — 조용히 일반 공유로 폴백. 개발 환경에서 흔한 케이스. */
    const result = await shareStory(story);
    return { ok: result.ok, via: 'fallback' };
  }

  let Kakao;
  try {
    Kakao = await loadKakaoSdk();
  } catch {
    const result = await shareStory(story);
    return { ok: result.ok, via: 'fallback' };
  }

  if (!Kakao.isInitialized || !Kakao.isInitialized()) {
    try { Kakao.init(appKey); } catch { /* 이미 init 됐으면 무시 */ }
  }

  const title = story.figure_name || story.title || 'DayStory';
  const description = (story.summary || story.body || '').toString().slice(0, 200);
  const imageUrl = story.image_url || '';
  const link = story.id ? buildShareUrl(story.id) : SHARE_DOMAIN;

  try {
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title,
        description,
        imageUrl,
        link: { mobileWebUrl: link, webUrl: link },
      },
      buttons: [
        {
          title: '앱에서 보기',
          link: { mobileWebUrl: link, webUrl: link },
        },
      ],
    });
    return { ok: true, via: 'kakao' };
  } catch {
    const result = await shareStory(story);
    return { ok: result.ok, via: 'fallback' };
  }
}


/* =====================================================================
   카드 캡처 공유 (.history-card-front → PNG → 네이티브 공유)
   =====================================================================
   1) 워터마크(앱 아이콘 + 'DayStory') DOM 을 카드 하단 우측에 임시 주입
   2) html2canvas 로 카드 앞면을 PNG로 캡처 (useCORS: true)
   3) finally 에서 워터마크 제거 + 카드 position 원복
   4) Native: Filesystem.Cache 에 저장 → Share.share({ url: fileUri })
      Web   : Web Share Level 2 (files) → 미지원 시 다운로드 폴백
   ===================================================================== */

/**
 * buildWatermarkElement — 캡처용 워터마크 DOM 을 생성합니다.
 * 캡처 직전에 카드 안에 appendChild 되고, 캡처 후 즉시 제거됩니다.
 */
function buildWatermarkElement() {
  const wm = document.createElement('div');
  wm.className = 'card-watermark-tmp';
  wm.setAttribute('aria-hidden', 'true');
  /* 인라인 스타일 — 캡처 직전에만 살아있으므로 CSS 의존을 최소화. */
  wm.style.cssText = [
    'position:absolute',
    'bottom:10px',
    'right:10px',
    'display:flex',
    'align-items:center',
    'gap:6px',
    'padding:6px 10px',
    'background:rgba(0,0,0,0.55)',
    'border-radius:999px',
    'color:#fff',
    'font-family:var(--font-ui, -apple-system, sans-serif)',
    'font-size:12px',
    'font-weight:700',
    'letter-spacing:0.01em',
    'z-index:9999',
    'pointer-events:none',
    'line-height:1',
  ].join(';');

  const img = document.createElement('img');
  /* public/daystory_icon_light.png — same-origin 이므로 CORS 이슈 없음. */
  img.src = '/daystory_icon_light.png';
  img.alt = '';
  img.style.cssText = 'width:16px;height:16px;display:block;object-fit:contain';
  img.crossOrigin = 'anonymous';

  const label = document.createElement('span');
  label.textContent = 'DayStory';

  wm.appendChild(img);
  wm.appendChild(label);
  return wm;
}

/**
 * dataUrlToBase64 — `data:image/png;base64,XXX` → `XXX`
 */
function dataUrlToBase64(dataUrl) {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

/**
 * dataUrlToFile — Base64 dataURL → File (웹 폴백용)
 */
async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

/**
 * captureAndShareCard — `.history-card-front` 요소를 PNG로 캡처해 네이티브 공유 시트로 전달.
 *
 * @param {HTMLElement} cardElement  - 캡처 대상 (.history-card-front)
 * @param {object} [options]
 *   - title:  공유 시트 제목 (기본 'DayStory')
 *   - text:   공유 텍스트
 *   - dialogTitle: Android 공유 시트 헤더
 * @returns {Promise<{ok:boolean, withImage:boolean, reason?:string}>}
 */
export async function captureAndShareCard(cardElement, options = {}) {
  if (!cardElement || !(cardElement instanceof HTMLElement)) {
    return { ok: false, withImage: false, reason: 'no-element' };
  }

  /* 자식의 position:absolute 가 카드 안에서 자리잡도록 임시 relative.
     원래 값이 'static'(기본) 인 경우만 손대고, 원복 시 그대로 복원. */
  const originalInlinePosition = cardElement.style.position;
  const computedPosition = window.getComputedStyle(cardElement).position;
  if (computedPosition === 'static') {
    cardElement.style.position = 'relative';
  }

  const watermark = buildWatermarkElement();
  cardElement.appendChild(watermark);

  /* 워터마크 이미지 디코드를 보장 (html2canvas 가 빈 이미지를 그리는 것 방지). */
  try {
    const wmImg = watermark.querySelector('img');
    if (wmImg && typeof wmImg.decode === 'function') {
      await wmImg.decode().catch(() => { /* decode 실패해도 진행 */ });
    }
  } catch { /* noop */ }

  let dataUrl = null;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(cardElement, {
      useCORS: true,
      backgroundColor: null,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      logging: false,
    });
    dataUrl = canvas.toDataURL('image/png');
  } catch (err) {
    console.error('카드 캡처 실패:', err?.message || err);
    return { ok: false, withImage: false, reason: 'capture-failed' };
  } finally {
    /* 성공/실패 무관: 워터마크 제거 + position 원복.
       JS 스펙상 finally 는 catch 의 return 이전에 실행되므로 cleanup 안전. */
    if (watermark.isConnected) watermark.remove();
    cardElement.style.position = originalInlinePosition;
  }

  if (!dataUrl || dataUrl.length < 32) {
    return { ok: false, withImage: false, reason: 'empty-image' };
  }

  const title = options.title || 'DayStory';
  const text = options.text || '';
  const dialogTitle = options.dialogTitle || '카드 공유';
  const fileName = `daystory_card_${Date.now()}.png`;
  const isNative = (typeof Capacitor !== 'undefined') && Capacitor.isNativePlatform?.();

  /* Native (Android/iOS): Filesystem.Cache 에 저장 후 Share.share({url}) */
  if (isNative) {
    try {
      const write = await Filesystem.writeFile({
        path: fileName,
        data: dataUrlToBase64(dataUrl),
        directory: Directory.Cache,
      });
      await Share.share({
        title,
        text,
        url: write.uri,
        dialogTitle,
      });
      return { ok: true, withImage: true };
    } catch (err) {
      /* 사용자가 시트를 닫은 경우는 정상 흐름 */
      const msg = (err && (err.message || err.code)) || '';
      if (/cancel|dismiss/i.test(String(msg))) {
        return { ok: false, withImage: true, reason: 'cancelled' };
      }
      console.error('네이티브 공유 실패:', msg);
      return { ok: false, withImage: true, reason: 'share-failed' };
    }
  }

  /* Web: Web Share Level 2 (files) 우선, 미지원 시 다운로드 폴백 */
  try {
    if (typeof navigator !== 'undefined' && navigator.canShare) {
      const file = await dataUrlToFile(dataUrl, fileName);
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return { ok: true, withImage: true };
      }
    }
  } catch {
    /* 사용자가 닫았거나 권한 거부 → 다운로드 폴백으로 진행 */
  }

  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true, withImage: true, reason: 'download' };
  } catch (err) {
    console.error('다운로드 폴백 실패:', err?.message || err);
    return { ok: false, withImage: true, reason: 'no-share' };
  }
}
