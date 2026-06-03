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
import { showToast, dismissToast } from '../components/toast.js';
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
   캡처 전략 (new Image() + canvas Base64 + onclone):
   1) 캡처 전 new Image() 로 crossOrigin='anonymous' → src 순으로 설정해
      CORS 모드 요청. 서버가 CORS 헤더를 반환하면 canvas.toDataURL() 로
      Base64 Data URL 획득. html2canvas 는 로컬 데이터만 그려 tainted canvas 없음.
   2) html2canvas(cardElement, { onclone }) — onclone 콜백에서:
      · 변환 실패 이미지에 crossOrigin + cache-bust 2차 적용
      · 복제본 부모 체인의 Swiper translateX 제거 → 레이아웃 보호
      · 복제된 카드 하단에 워터마크 주입
   3) finally 에서 dataset.originalSrc 로 원본 src 원상 복구.
   4) Native: Filesystem.Cache 저장 → Share.share({ url: fileUri })
      Web   : Web Share Level 2 (files) → 미지원 시 다운로드 폴백
   ===================================================================== */

/**
 * imageToBase64 — 외부 URL 이미지를 Base64 Data URL 로 변환합니다.
 *
 * crossOrigin = 'anonymous' 를 src 할당 이전에 설정해야
 * 브라우저가 CORS 모드로 요청하고 canvas 오염이 발생하지 않습니다.
 * 변환 실패(CORS 차단, 네트워크 오류) 시 null 을 반환합니다.
 *
 * @param {string} src - 변환할 이미지 URL
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<string|null>} Base64 Data URL 또는 null
 */
function imageToBase64(src, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const probe = new Image();
    /* crossOrigin 은 반드시 src 보다 먼저 설정해야 CORS 모드로 요청됨 */
    probe.crossOrigin = 'anonymous';
    /* 캐시 버스팅 — 브라우저에 CORS 없이 캐시된 응답을 재사용하지 않도록 */
    const sep = src.includes('?') ? '&' : '?';
    probe.src = `${src}${sep}_t=${Date.now()}`;

    const timer = setTimeout(() => resolve(null), timeoutMs);

    probe.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = probe.naturalWidth || 1;
        canvas.height = probe.naturalHeight || 1;
        canvas.getContext('2d').drawImage(probe, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        /* canvas 오염 → null 반환 (onclone 에서 crossOrigin 설정으로 재시도) */
        resolve(null);
      }
    };
    probe.onerror = () => { clearTimeout(timer); resolve(null); };
  });
}

/**
 * buildWatermarkElement — 캡처용 워터마크 DOM 을 생성합니다.
 * onclone 콜백 내에서 호출될 때는 복제된 문서(clonedDoc)를 전달합니다.
 * @param {Document} [doc]
 */
function buildWatermarkElement(doc = document) {
  const wm = doc.createElement('div');
  wm.className = 'card-watermark-tmp';
  wm.setAttribute('aria-hidden', 'true');
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
    'font-family:-apple-system,sans-serif',
    'font-size:12px',
    'font-weight:700',
    'letter-spacing:0.01em',
    'z-index:9999',
    'pointer-events:none',
    'line-height:1',
  ].join(';');

  const img = doc.createElement('img');
  img.src = '/daystory_icon_light.png';
  img.alt = '';
  img.style.cssText = 'width:16px;height:16px;display:block;object-fit:contain';
  img.crossOrigin = 'anonymous';

  const label = doc.createElement('span');
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
 * iOS CORS 차단 우회: 캡처 전 모든 <img>.src 를 fetch → Base64 Data URL 로 교체.
 * html2canvas 는 외부 네트워크 없이 로컬 데이터만 그리므로 tainted canvas 오염 없음.
 * Swiper transform 오염: onclone 콜백에서 복제본 부모 체인의 transform 을 제거.
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

  showToast('공유 이미지 생성 중...', 'info', 30000);

  /* onclone 에서 올바른 카드를 찾기 위한 임시 식별자 */
  const captureId = `_cap_${Date.now()}`;
  cardElement.dataset.captureId = captureId;

  const imgs = Array.from(cardElement.querySelectorAll('img'));

  let dataUrl = null;
  try {
    /* ── Step 1: new Image() + canvas 방식으로 Base64 강제 변환 ──
       crossOrigin = 'anonymous' 를 src 이전에 설정하는 것이 핵심.
       변환 실패 이미지는 null 로 처리되고 onclone 에서 2차 방어. */
    await Promise.all(
      imgs.map(async (img) => {
        const src = img.src || '';
        if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
        img.dataset.originalSrc = src;
        const b64 = await imageToBase64(src);
        if (b64) img.src = b64;
        /* b64 가 null 이면 원본 src 유지 — onclone 에서 crossOrigin + cache-bust 처리 */
      })
    );

    /* ── Step 2: html2canvas — onclone 으로 transform 제거 + 워터마크 주입 ──
       html2canvas 호출 전 실제 DOM 에서 치수를 측정해 두어
       onclone 에서 명시적 픽셀값으로 설정한다 (flex/aspect-ratio 오해석 방지). */
    const captureW = cardElement.offsetWidth || 320;
    const captureH = cardElement.offsetHeight || 520;
    const imageWrapEl = cardElement.querySelector('.history-card-image-wrap');
    const wrapW = imageWrapEl ? (imageWrapEl.offsetWidth || captureW) : captureW;
    const wrapH = imageWrapEl ? (imageWrapEl.offsetHeight || 400) : 400;

    /* position:fixed 요소 클래스 목록 — onclone 내에서 숨길 대상 */
    const FIXED_HIDE = [
      '.status-bar-spacer', '.bottom-nav', '#toast-container',
      '.modal-overlay', '.notification-settings-overlay', '.crop-modal-overlay',
      '.page-header-centered', '.page-header-with-back',
      '.detail-page', '.detail-sheet', '.detail-sheet-backdrop',
      '.mystory-form-actions', '.profile-edit-overlay',
    ].join(',');

    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(cardElement, {
      useCORS: true,
      allowTaint: false,
      scale: 3,
      backgroundColor: null,
      logging: false,
      width: captureW,
      height: captureH,
      onclone: (clonedDoc) => {
        /* ① fixed 요소 숨기기: status-bar-spacer / bottom-nav 등이
              html2canvas 클론 문서에서 카드 위에 렌더링되는 현상 방지 */
        clonedDoc.querySelectorAll(FIXED_HIDE).forEach((el) => {
          el.style.display = 'none';
        });

        const cloned = clonedDoc.querySelector(`[data-capture-id="${captureId}"]`);
        if (!cloned) return;

        /* ② 클론 카드에 명시적 픽셀 치수 고정
              html2canvas 가 flex:1 / aspect-ratio 를 잘못 계산하는 경우 방어 */
        cloned.style.cssText += [
          `width:${captureW}px`,
          `height:${captureH}px`,
          'overflow:hidden',
          'position:relative',
          'flex-shrink:0',
        ].join(';');

        /* ③ 이미지 래퍼에 명시적 치수 설정
              object-fit:cover 가 html2canvas 에서 부분적으로만 지원되므로
              img 를 절대 배치로 wrap 안에 꽉 채워 잘림 없이 커버 */
        cloned.querySelectorAll('.history-card-image-wrap').forEach((wrap) => {
          wrap.style.cssText += [
            `width:${wrapW}px`,
            `height:${wrapH}px`,
            'overflow:hidden',
            'position:relative',
            'flex-shrink:0',
          ].join(';');
          const imgEl = wrap.querySelector('img');
          if (imgEl) {
            imgEl.style.cssText += [
              'position:absolute',
              'top:0',
              'left:0',
              `width:${wrapW}px`,
              `height:${wrapH}px`,
              'object-fit:cover',
              'max-width:none',
              'max-height:none',
              'aspect-ratio:unset',
            ].join(';');
          }
        });

        /* ④ 부모 체인(swiper-slide / swiper-wrapper 등)의 transform 제거 */
        let el = cloned.parentElement;
        while (el && el !== clonedDoc.body) {
          if (el.style && el.style.transform) el.style.transform = 'none';
          el = el.parentElement;
        }
        /* 자식 요소에 남은 inline transform 잔재도 제거 */
        cloned.querySelectorAll('[style*="transform"]').forEach((child) => {
          child.style.transform = 'none';
        });

        /* ⑤ 변환 실패 외부 URL 이미지에 crossOrigin + cache-bust 2차 적용 */
        cloned.querySelectorAll('img').forEach((imgEl) => {
          const s = imgEl.getAttribute('src') || '';
          if (s && !s.startsWith('data:') && !s.startsWith('blob:')) {
            imgEl.crossOrigin = 'anonymous';
            const sep = s.includes('?') ? '&' : '?';
            imgEl.setAttribute('src', `${s}${sep}_cors=${Date.now()}`);
          }
        });

        /* ⑥ 워터마크 주입 — clonedDoc 컨텍스트로 생성해야 올바르게 렌더링됨 */
        cloned.appendChild(buildWatermarkElement(clonedDoc));
      },
    });

    dataUrl = canvas.toDataURL('image/png');
  } catch (err) {
    console.error('카드 캡처 실패:', err?.message || err);
    showToast('이미지 공유에 실패했습니다.', 'error');
    return { ok: false, withImage: false, reason: 'capture-failed' };
  } finally {
    /* ── Step 3: 원본 img src 복구 + 임시 식별자 제거 ── */
    imgs.forEach((img) => {
      if (img.dataset.originalSrc) {
        img.src = img.dataset.originalSrc;
        delete img.dataset.originalSrc;
      }
    });
    delete cardElement.dataset.captureId;
  }

  if (!dataUrl || dataUrl.length < 32) {
    showToast('이미지 공유에 실패했습니다.', 'error');
    return { ok: false, withImage: false, reason: 'empty-image' };
  }

  /* 캡처 완료 — 공유 시트 열기 전에 로딩 인디케이터 제거 */
  dismissToast();

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
