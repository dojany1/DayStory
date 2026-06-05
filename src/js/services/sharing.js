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
  /* ⚠️ html2canvas 1.x 는 flexbox align-items 를 제대로 렌더링하지 못한다.
        (브라우저에선 중앙이지만 캡처 결과에선 텍스트가 baseline 으로 쏠림)
        → flex 를 쓰지 않고 line-height + vertical-align:middle 로 수직 정렬한다.
        컨테이너 line-height 를 아이콘 높이(16px)와 같게 두면, 16px line-box
        안에서 아이콘과 텍스트가 함께 중앙에 놓인다. */
  const ICON = 16;

  const wm = doc.createElement('div');
  wm.className = 'card-watermark-tmp';
  wm.setAttribute('aria-hidden', 'true');
  wm.style.cssText = [
    'position:absolute',
    'bottom:16px',
    'right:16px',
    'padding:6px 10px',
    'background:rgba(0,0,0,0.55)',
    'border-radius:999px',
    'color:#fff',
    'font-family:-apple-system,sans-serif',
    'font-size:12px',
    'font-weight:700',
    'letter-spacing:0.01em',
    `line-height:${ICON}px`, /* 아이콘 높이와 동일 — 텍스트 수직 중앙 */
    'white-space:nowrap',
    'z-index:9999',
    'pointer-events:none',
    'box-sizing:border-box',
  ].join(';');

  const img = doc.createElement('img');
  img.src = '/daystory_icon_light.png';
  img.alt = '';
  img.style.cssText = `width:${ICON}px;height:${ICON}px;vertical-align:middle;object-fit:contain;margin-right:6px`;
  img.crossOrigin = 'anonymous';

  const label = doc.createElement('span');
  label.textContent = 'DayStory';
  label.style.cssText = `vertical-align:middle;line-height:${ICON}px`;

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

/* =====================================================================
   🐞 캡처 디버그 모드 토글 (실기기 검증용)
   ---------------------------------------------------------------------
   true 이면 모든 카드 공유 버튼이 "공유 시트" 대신 캡처 결과 이미지를
   전체화면 오버레이로 띄운다. As-Is 캡처 결과를 실기기(iOS/Android)에서
   눈으로 바로 확인하기 위한 스위치. import.meta.env.DEV 와 무관하게
   빌드된 앱에서도 동작하므로, 검증이 끝나면 반드시 false 로 되돌릴 것.
   ===================================================================== */
const DEBUG_CAPTURE_PREVIEW = false;

/**
 * captureAndShareCard — `.history-card-front` 요소를 PNG로 캡처해 네이티브 공유 시트로 전달.
 *
 * 캡처 전략: As-Is (WYSIWYG).
 *   브라우저가 CSS 로 이미 렌더링해 둔 카드를 "있는 그대로" html2canvas 에 넘긴다.
 *   픽셀 사이즈를 JS 로 강제 주입하지 않는다 — 디바이스별 폰트 렌더링·Safe Area·
 *   OS 설정 차이를 하드코딩 상수로는 절대 따라갈 수 없기 때문(하이브리드 앱).
 *   onclone 은 레이아웃 구조를 건드리지 않고 ① 불필요 UI 숨김 ② Safari 텍스트
 *   클리핑 보정 ③ 워터마크 주입만 수행한다.
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
      allowTaint: true,
      scale: 2,
      backgroundColor: null,
      logging: false,
      /* width/height 를 지정하지 않는다 — 화면에 렌더된 카드의 실제 크기를
         그대로 캡처(As-Is). 픽셀 강제 주입은 디바이스 차이를 못 따라간다. */
      onclone: (clonedDoc) => {
        /* ── onclone 의 역할은 최소화: 레이아웃 구조(width/height/flex 등)는
              절대 건드리지 않고, 캡처 결과 품질에 필요한 보정만 수행한다. ── */

        /* ① 불필요 UI 숨김 (레이아웃 미변경, display 만 끔)
              · 공유/북마크 버튼이 이미지에 찍히지 않도록
              · status-bar-spacer / bottom-nav / 모달 등 오버레이가 클론 문서에서
                카드 위에 겹쳐 렌더링되는 현상 방지 */
        clonedDoc.querySelectorAll(`${FIXED_HIDE},.card-actions`).forEach((el) => {
          el.style.setProperty('display', 'none', 'important');
        });

        const cloned = clonedDoc.querySelector(`[data-capture-id="${captureId}"]`);
        if (!cloned) return;

        /* ② Safari 텍스트 하단 클리핑 방어 — 대형 날짜 글자에만 line-height:1.
              (그 외 폰트 크기·레이아웃은 브라우저 CSS 렌더 결과를 그대로 신뢰) */
        const clonedDateEl = cloned.querySelector('.card-date');
        if (clonedDateEl) clonedDateEl.style.lineHeight = '1';

        /* ③ Swiper 캐러셀 transform 무력화 — 부모 translateX 때문에 캡처가
              비거나 어긋나는 것을 방지 (크기 조작이 아니라 위치 정상화). */
        let el = cloned.parentElement;
        while (el && el !== clonedDoc.body) {
          if (el.style && el.style.transform) el.style.transform = 'none';
          el = el.parentElement;
        }
        cloned.querySelectorAll('[style*="transform"]').forEach((child) => {
          child.style.transform = 'none';
        });

        /* ④ 백화(CORS) 2차 방어 — Base64 변환 실패한 외부 이미지에 crossOrigin +
              cache-bust 적용, lazy/async 제거로 즉시 렌더 보장. (절대 유지) */
        cloned.querySelectorAll('img').forEach((imgEl) => {
          imgEl.removeAttribute('loading');
          imgEl.removeAttribute('decoding');
          const s = imgEl.getAttribute('src') || '';
          if (s && !s.startsWith('data:') && !s.startsWith('blob:')) {
            imgEl.crossOrigin = 'anonymous';
            const sep = s.includes('?') ? '&' : '?';
            imgEl.setAttribute('src', `${s}${sep}_cors=${Date.now()}`);
          }
        });

        /* ⑤ 워터마크 주입 — 우측 하단 (카드 기준 position:absolute) */
        cloned.appendChild(buildWatermarkElement(clonedDoc));
      },
    });

    dataUrl = canvas.toDataURL('image/png');
  } catch (err) {
    console.error('카드 캡처 실패:', err?.message || err);
    showToast('이미지 공유에 실패했습니다.', 'error');
    return { ok: false, withImage: false, reason: 'capture-failed' };
  } finally {
    /* ── Step 5: 원본 img src 복구 + 임시 식별자 제거 ── */
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

  /* 🐞 디버그 모드: 공유 대신 캡처 결과를 오버레이로 표시 (실기기 검증용) */
  if (DEBUG_CAPTURE_PREVIEW || options._debugPreview) {
    showDebugPreviewOverlay(dataUrl);
    return { ok: true, withImage: true, reason: 'debug-preview' };
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


/* =====================================================================
   🐞 캡처 디버그 — 캡처 결과를 공유 대신 전체화면 오버레이로 표시
   ===================================================================== */

/**
 * previewCaptureCard — captureAndShareCard 와 동일한 캡처 파이프라인을 실행하되,
 * 공유 시트 대신 전체화면 오버레이로 결과 이미지를 표시한다.
 *
 * 브라우저 콘솔에서 직접 호출 가능 (DEV):  __previewCard()
 *
 * @param {HTMLElement} cardElement - 캡처 대상 (.history-card-front)
 */
export async function previewCaptureCard(cardElement) {
  return captureAndShareCard(cardElement, { _debugPreview: true });
}

/* 개발 환경에서 콘솔 한 줄로 호출 가능하도록 window 에 노출: __previewCard() */
if (import.meta.env?.DEV) {
  window.__previewCard = () => {
    const el = document.querySelector('.history-card-front');
    if (!el) { console.warn('카드를 찾을 수 없습니다. 카드가 있는 화면으로 이동 후 실행하세요.'); return; }
    return previewCaptureCard(el);
  };
}

/**
 * showDebugPreviewOverlay — 캡처된 dataURL 을 전체화면 오버레이 + 치수 레이블로 표시.
 * 닫기 버튼 또는 배경 탭으로 닫는다.
 * @param {string} dataUrl
 */
export function showDebugPreviewOverlay(dataUrl) {
  /* 기존 오버레이 제거 */
  document.getElementById('__capture-debug-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '__capture-debug-overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:rgba(0,0,0,0.85)',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'gap:12px', 'padding:16px', 'box-sizing:border-box',
  ].join(';');

  /* 이미지 */
  const img = document.createElement('img');
  img.src = dataUrl;
  img.style.cssText = 'max-width:90vw;max-height:80vh';

  /* 치수 레이블 */
  const label = document.createElement('div');
  label.style.cssText = 'color:#fff;font-size:13px;font-family:monospace;opacity:0.8';
  img.onload = () => {
    label.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
  };

  /* 닫기 버튼 */
  const btn = document.createElement('button');
  btn.textContent = '닫기';
  btn.style.cssText = [
    'padding:10px 32px', 'border:none', 'border-radius:8px',
    'background:#fff', 'color:#000',
    'font-size:15px', 'font-weight:700', 'cursor:pointer',
  ].join(';');
  btn.onclick = () => overlay.remove();

  /* 배경 탭으로도 닫기 */
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.appendChild(img);
  overlay.appendChild(label);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}
