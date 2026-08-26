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
import { Media } from '@capacitor-community/media';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { showToast, dismissToast } from '../components/toast.js';
import { t } from '../i18n/index.js';
import { buildShareDeepLink, SHARE_APP_ORIGIN } from '../utils/deepLink.js';
/* 캡처 엔진(modern-screenshot / html2canvas)은 captureAndShareCard 안에서
   동적 import — 초기 번들 분리. */

/* 공유 URL 오리진은 deepLink.js 가 유일한 출처다. 여기서 다시 하드코딩하면
   딥링크와 어긋난다 — 실제로 그렇게 어긋나 공유 링크가 Firebase Hosting 이
   아닌 미배포 도메인을 가리키던 회귀가 있었다(2026-08-26). */

/**
 * buildShareUrl — 카드별 공유 URL을 생성합니다.
 * 이 경로는 firebase.json rewrites + Cloud Functions에서 처리되어
 * 봇에게는 OG HTML, 사용자에게는 SPA를 응답합니다.
 */
export function buildShareUrl(storyId) {
  if (!storyId) return SHARE_APP_ORIGIN;
  return `${SHARE_APP_ORIGIN}/share/${encodeURIComponent(storyId)}`;
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
  const url = story.id ? buildShareUrl(story.id) : SHARE_APP_ORIGIN;

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
  const link = story.id ? buildShareUrl(story.id) : SHARE_APP_ORIGIN;

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
          title: t('share.open_in_app'),
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
   캡처 엔진: modern-screenshot(foreignObject) 1차 + html2canvas 폴백.

   ★ 근본 원인 메모:
   카드 레이아웃은 전부 Flexbox 의존이다 — .history-card-front(column),
   .history-card-top(align-items:center), .history-card-image-wrap(flex:1).
   그런데 html2canvas 1.x 는 flexbox 를 충실히 렌더하지 못해, flex:1 의
   "남은 높이 채우기" 와 align-items 의 수직 중앙정렬이 캡처에서 깨지고
   line-height:0.9 의 대형 날짜가 이미지 위로 흘러내렸다. modern-screenshot
   은 DOM 을 SVG <foreignObject> 에 담아 "실제 브라우저 엔진" 이 렌더하므로
   flex/line-height 가 라이브와 1:1 일치한다 → 레이아웃 보정이 불필요해진다.

   파이프라인:
   1) 캡처 전 new Image() + canvas 로 외부 이미지를 Base64 Data URL 로 사전
      변환(§6.2 CORS 백화 방지). foreignObject 도 외부 <img> 는 canvas 를
      taint 시키므로 인라인이 필요하다.
   2) modern-screenshot.domToPng(cardElement, { scale:2, onCloneNode })
      · onCloneNode: 카드 상단 아이콘 자리(.card-actions)의 공유/북마크 버튼을
        워터마크로 교체. 작은 날짜(.card-meta)는 그 아래에 그대로 남는다.
      (Swiper transform·overlay 숨김·line-height 보정은 foreignObject 가
       대상 서브트리만 직렬화하므로 모두 불필요 → 제거)
   3) 실패 시(WKWebView foreignObject 미지원 등) html2canvas 로 폴백.
   4) finally 에서 dataset.originalSrc 로 원본 src 원상 복구.
   5) Native: Filesystem.Cache 저장 → Share.share({ url: fileUri })
      Web   : Web Share Level 2 (files) → 미지원 시 다운로드 폴백
   ===================================================================== */

/**
 * imageToBase64ViaCanvas — `new Image()` + canvas 로 Base64 Data URL 을 만듭니다.
 *
 * crossOrigin = 'anonymous' 를 src 할당 이전에 설정해야
 * 브라우저가 CORS 모드로 요청하고 canvas 오염이 발생하지 않습니다.
 * 단, 서버(Firebase Storage)가 해당 origin 에 CORS 헤더를 주지 않으면 실패한다 —
 * 네이티브 WebView origin(`https://localhost`/`capacitor://localhost`)이 그 경우다.
 * 변환 실패(CORS 차단, 네트워크 오류, 타임아웃) 시 null 을 반환합니다.
 *
 * @param {string} src - 변환할 이미지 URL
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<string|null>} Base64 Data URL 또는 null
 */
function imageToBase64ViaCanvas(src, timeoutMs = 8000) {
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
 * imageToBase64ViaNativeHttp — 네이티브 HTTP(CapacitorHttp)로 이미지 바이트를 받아
 * Base64 Data URL 로 변환합니다.
 *
 * 요청이 WebView(fetch/Image)가 아니라 OS 네이티브 레이어를 통해 나가므로
 * WebView origin 의 CORS 검사 자체를 우회한다. Android 백화(foreignObject 가
 * cross-origin <img> 를 그리지 못해 빈칸이 되는 문제)의 근본 해결책.
 * 네이티브에서 CapacitorHttp.get 의 응답 data 는 base64 문자열이다.
 *
 * @param {string} src - 변환할 이미지 URL
 * @returns {Promise<string|null>} Base64 Data URL 또는 null
 */
async function imageToBase64ViaNativeHttp(src) {
  try {
    const res = await CapacitorHttp.get({ url: src, responseType: 'blob' });
    /* 네이티브: res.data 는 base64 인코딩 문자열 */
    if (!res || typeof res.data !== 'string' || !res.data) return null;
    const headers = res.headers || {};
    const ctKey = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type');
    let contentType = (ctKey ? headers[ctKey] : '') || 'image/jpeg';
    /* "image/jpeg; charset=..." 형태 방어 */
    contentType = String(contentType).split(';')[0].trim();
    if (!contentType.startsWith('image/')) contentType = 'image/jpeg';
    return `data:${contentType};base64,${res.data}`;
  } catch {
    return null;
  }
}

/**
 * imageToBase64 — 외부 URL 이미지를 Base64 Data URL 로 변환합니다.
 *
 * 네이티브: 네이티브 HTTP 우회(CORS 미적용)를 1차로 시도하고, 실패 시 canvas 로 폴백.
 * 웹: 기존 canvas 경로(브라우저 CORS 적용)를 사용.
 * 어느 경로든 실패하면 null 을 반환한다.
 *
 * @param {string} src - 변환할 이미지 URL
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<string|null>} Base64 Data URL 또는 null
 */
function imageToBase64(src, timeoutMs = 8000) {
  const isNative = (typeof Capacitor !== 'undefined') && Capacitor.isNativePlatform?.();
  if (isNative) {
    return imageToBase64ViaNativeHttp(src)
      .then((b64) => b64 || imageToBase64ViaCanvas(src, timeoutMs));
  }
  return imageToBase64ViaCanvas(src, timeoutMs);
}

/**
 * buildWatermarkElement — 캡처용 워터마크 DOM 을 생성합니다.
 * onclone 콜백 내에서 호출될 때는 복제된 문서(clonedDoc)를 전달합니다.
 *
 * @param {Document} [doc]
 * @param {object} [opts]
 *   - inline: true 면 흐름(static)에 배치 — 카드 상단 아이콘 자리에 끼워넣을 때.
 *             false(기본) 면 카드 우측 하단 절대배치(position:absolute) 폴백.
 */
function buildWatermarkElement(doc = document, { inline = false } = {}) {
  const wm = doc.createElement('div');
  wm.className = 'card-watermark-tmp';
  wm.setAttribute('aria-hidden', 'true');
  /* inline: 카드 상단 .card-actions 슬롯의 흐름에 따른다(우측정렬은 부모가 담당).
     absolute: 카드 우측 하단 고정(폴백 경로). */
  const placement = inline
    ? ['position:static']
    : ['position:absolute', 'bottom:16px', 'right:16px', 'z-index:9999'];
  /* ⚠️ inline-flex + align-items 조합은 html2canvas/foreignObject 캡처에서
     자식 텍스트 노드의 color 가 무시되는 알려진 문제가 있다(이전 구현에서도
     동일한 이유로 flex 를 피했음). display:inline-block + line-height 로
     수직 중앙정렬해 color 인라인 스타일이 그대로 반영되도록 한다. */
  const HEIGHT = 28;
  wm.style.cssText = [
    ...placement,
    'display:inline-block',
    'height:' + HEIGHT + 'px',
    'line-height:' + HEIGHT + 'px',
    'padding:0 12px',
    'box-sizing:border-box',
    /* 라이트 카드(밝은 배경) 위에서 0.45 같은 낮은 불투명도는 필 자체가
       옅은 회색이 되어, 그 위의 흰 글자(#ffffff)와 명도 대비가 낮아져
       회색처럼 보인다(다크 카드에선 같은 필이 충분히 어두워 대비가 확보됨).
       라이트/다크 모두에서 흰 글자가 또렷하도록 0.7로 충분히 어둡게 한다. */
    'background:rgba(0,0,0,0.7)',
    'border-radius:50px',
    'color:#ffffff',
    'font-family:var(--font-ui)',
    'font-size:13px',
    'font-weight:700',
    'letter-spacing:-0.01em',
    'white-space:nowrap',
    'vertical-align:middle',
    'pointer-events:none',
  ].join(';');

  const label = doc.createElement('span');
  label.textContent = 'DayStory';
  /* .card-meta 등 부모 컨텍스트의 color 가 더 높은 특이도로 상속되는 것을 방어 */
  label.style.cssText = 'color:#ffffff;line-height:' + HEIGHT + 'px';

  wm.appendChild(label);
  return wm;
}

/**
 * injectCaptureWatermark — 복제된 카드(.history-card-front)에 워터마크를 주입합니다.
 *
 * 배치: 카드 상단 우측의 아이콘 슬롯(.card-actions, 공유/북마크 버튼이 있던 자리)에
 * 워터마크를 인라인으로 끼워넣는다. 작은 날짜(.card-meta)는 .card-top-right 컬럼에서
 * 워터마크 아래에 그대로 남는다(공유/북마크 버튼은 캡처에서 제거).
 * .card-actions 가 없는 카드는 우측 하단 절대배치로 폴백한다.
 *
 * @param {HTMLElement} cardClone - 복제된 .history-card-front
 */
function injectCaptureWatermark(cardClone) {
  if (!cardClone || cardClone.querySelector('.card-watermark-tmp')) return;
  const doc = cardClone.ownerDocument || document;
  const actions = cardClone.querySelector('.card-actions');
  if (actions) {
    /* 아이콘 자리에 워터마크. 우측정렬은 .card-actions 의 flex(justify-content:flex-end)
       가 담당하되, html2canvas 폴백(flex 미지원, block 처리) 대비 text-align:right 보강. */
    actions.style.textAlign = 'right';
    actions.replaceChildren(buildWatermarkElement(doc, { inline: true }));
  } else {
    cardClone.appendChild(buildWatermarkElement(doc));
  }
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
   갤러리(사진 보관함) 저장 — @capacitor-community/media
   =====================================================================
   안드로이드 ACTION_SEND 공유 시트는 "갤러리/파일 저장" 타겟 노출을 OS가
   보장하지 않는다(제조사·기기별 상이). 그래서 공유에 의존하지 않고 캡처한
   PNG dataURL 을 사진 보관함에 직접 저장한다.

   · Android: identifier(디렉터리 경로)가 필수다. 'DayStory' 앨범을 찾고
     없으면 생성한 뒤 그 identifier 로 savePhoto. 기본(non-gallery) 모드는
     앱 전용 외부 미디어 폴더(getExternalMediaDirs)에 저장 후 미디어 스캔으로
     갤러리에 노출되며 저장소 권한 프롬프트가 필요 없다.
   · iOS: albumIdentifier 생략 시 카메라 롤에 저장(add-only 권한).
   ===================================================================== */

const GALLERY_ALBUM = 'DayStory';

/**
 * resolveAndroidAlbumIdentifier — 'DayStory' 앨범의 identifier(경로)를 확보한다.
 * 없으면 생성 후 다시 조회. 실패 시 null.
 * @returns {Promise<string|null>}
 */
async function resolveAndroidAlbumIdentifier() {
  const findAlbum = async () => {
    const res = await Media.getAlbums();
    const albums = (res && res.albums) || [];
    const hit = albums.find((a) => a && a.name === GALLERY_ALBUM);
    return hit ? hit.identifier : null;
  };

  let identifier = await findAlbum();
  if (identifier) return identifier;

  try {
    await Media.createAlbum({ name: GALLERY_ALBUM });
  } catch {
    /* 이미 존재 등 → 무시하고 재조회 */
  }
  return findAlbum();
}

/**
 * saveImageToGallery — Base64 PNG dataURL 을 기기 사진 보관함에 저장한다.
 * savePhoto 는 dataURL(`data:image/png;base64,...`)을 직접 받는다.
 *
 * @param {string} dataUrl - PNG Data URL
 * @returns {Promise<void>} 실패 시 throw (호출부가 권한/일반 실패를 구분)
 */
async function saveImageToGallery(dataUrl) {
  const platform = Capacitor.getPlatform?.();
  if (platform === 'android') {
    const albumIdentifier = await resolveAndroidAlbumIdentifier();
    if (!albumIdentifier) throw new Error('album-unavailable');
    await Media.savePhoto({ path: dataUrl, albumIdentifier });
    return;
  }
  /* iOS: albumIdentifier 생략 → 카메라 롤 저장 */
  await Media.savePhoto({ path: dataUrl });
}

/* =====================================================================
   🐞 캡처 디버그 모드 토글 (실기기 검증용)
   ---------------------------------------------------------------------
   true 이면 모든 카드 공유 버튼이 "공유 시트" 대신 캡처 결과 이미지를
   전체화면 오버레이로 띄운다. 캡처 결과를 실기기(iOS/Android)에서 눈으로
   바로 확인하기 위한 스위치. import.meta.env.DEV 와 무관하게 빌드된 앱에서도
   동작하므로, 검증이 끝나면 반드시 false 로 되돌릴 것.
   ===================================================================== */
const DEBUG_CAPTURE_PREVIEW = false;

/**
 * captureWithModernScreenshot — foreignObject 기반 1차 캡처.
 *
 * DOM 을 SVG <foreignObject> 로 직렬화해 실제 브라우저 엔진이 렌더하므로
 * flex:1 / align-items:center / line-height 가 라이브와 1:1 일치한다.
 * 대상 서브트리만 직렬화하므로 Swiper 부모 transform·오버레이 보정이 불필요.
 *
 * @param {HTMLElement} cardElement
 * @returns {Promise<string>} PNG Data URL
 */
async function captureWithModernScreenshot(cardElement) {
  const { domToPng } = await import('modern-screenshot');
  return domToPng(cardElement, {
    scale: 2,                 /* 2x 고해상도 (html2canvas scale:2 동등) */
    backgroundColor: null,    /* 카드 자체 배경 사용 */
    /* 복제 루트(.history-card-front)의 상단 아이콘 자리에 워터마크 주입.
       공유/북마크 버튼은 injectCaptureWatermark 가 워터마크로 교체한다. */
    onCloneNode: (cloned) => {
      if (
        cloned && cloned.nodeType === 1 &&
        cloned.classList && cloned.classList.contains('history-card-front')
      ) {
        injectCaptureWatermark(cloned);
      }
    },
  });
}

/**
 * captureWithHtml2canvas — 폴백 캡처(레거시).
 *
 * WKWebView 가 foreignObject 직렬화에 실패하는 등 1차 캡처가 던질 때만 사용.
 * html2canvas 는 flexbox 를 충실히 못 그리므로 결과 레이아웃 품질이 떨어질 수
 * 있으나, 완전 실패(공유 불가)보다는 낫다. onclone 으로 ① 불필요 UI 숨김 ②
 * Swiper transform 무력화 ③ CORS 2차 방어 ④ 워터마크 주입을 수행한다.
 *
 * @param {HTMLElement} cardElement
 * @param {string} captureId  - clonedDoc 에서 대상 카드를 찾기 위한 식별자
 * @returns {Promise<string>} PNG Data URL
 */
async function captureWithHtml2canvas(cardElement, captureId) {
  /* position:fixed 오버레이 클래스 — clonedDoc 전체에서 숨길 대상 */
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
    onclone: (clonedDoc) => {
      clonedDoc.querySelectorAll(FIXED_HIDE).forEach((el) => {
        el.style.setProperty('display', 'none', 'important');
      });

      const cloned = clonedDoc.querySelector(`[data-capture-id="${captureId}"]`);
      if (!cloned) return;

      /* 대형 날짜 Safari 클리핑 방어 */
      const clonedDateEl = cloned.querySelector('.card-date');
      if (clonedDateEl) clonedDateEl.style.lineHeight = '1';

      /* Swiper transform 무력화 */
      let el = cloned.parentElement;
      while (el && el !== clonedDoc.body) {
        if (el.style && el.style.transform) el.style.transform = 'none';
        el = el.parentElement;
      }
      cloned.querySelectorAll('[style*="transform"]').forEach((child) => {
        child.style.transform = 'none';
      });

      /* 백화(CORS) 2차 방어 */
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

      /* 워터마크 주입 — 상단 아이콘 자리(공유/북마크 버튼 교체) */
      injectCaptureWatermark(cloned);
    },
  });

  return canvas.toDataURL('image/png');
}

/**
 * captureAndShareCard — `.history-card-front` 요소를 PNG로 캡처해 네이티브 공유 시트로 전달.
 *
 * 캡처 전략: foreignObject(modern-screenshot) 1차 + html2canvas 폴백.
 *   실제 브라우저 엔진이 렌더하므로 화면의 flex 레이아웃을 그대로(WYSIWYG)
 *   캡처한다. 픽셀 사이즈를 JS 로 강제 주입하지 않는다 — 디바이스별 폰트
 *   렌더링·Safe Area·OS 차이를 하드코딩 상수로는 따라갈 수 없기 때문.
 *
 * iOS CORS 차단 우회: 캡처 전 모든 <img>.src 를 fetch → Base64 Data URL 로 교체.
 * 외부 네트워크 없이 로컬 데이터만 그리므로 tainted canvas 오염 없음.
 *
 * @param {HTMLElement} cardElement  - 캡처 대상 (.history-card-front)
 * @param {object} [options]
 *   - title:  공유 시트 제목/subject (기본 'DayStory'). 공유 본문이 아니다.
 *   - date:   'YYYY-MM-DD'. 주어지면 /share?date= 딥링크를 만들어 url 로 첨부.
 *   - url:    딥링크를 직접 지정(있으면 date 보다 우선).
 *   - dialogTitle: Android 공유 시트 헤더
 *   - linkOnly: true 면 캡처/이미지 첨부를 생략하고 링크(url)만 공유한다
 *     (SNS 링크 미리보기로 카드 이미지+제목 노출, 서버 동적 OG). 딥링크가 없으면
 *     무시되고 캡처 경로로 폴백. 모든 플랫폼 공통(iOS/Android: 네이티브 공유 시트,
 *     웹: Web Share API → 미지원 시 클립보드 복사 폴백).
 *   - saveToGallery: true 면 공유 시트 대신 캡처 이미지를 기기 사진 보관함에
 *     직접 저장한다(네이티브 전용). 웹에서는 무시되고 일반 공유/다운로드 경로로 폴백.
 * @returns {Promise<{ok:boolean, withImage:boolean, reason?:string}>}
 */
export async function captureAndShareCard(cardElement, options = {}) {
  if (!cardElement || !(cardElement instanceof HTMLElement)) {
    return { ok: false, withImage: false, reason: 'no-element' };
  }

  const isNative = (typeof Capacitor !== 'undefined') && Capacitor.isNativePlatform?.();
  const title = options.title || 'DayStory';
  const dialogTitle = options.dialogTitle || t('share.card_share');

  /* 공유 딥링크(Universal Link) — options.url 우선, 없으면 options.date 로 빌드.
     미설치 수신자는 이 URL 의 /share fallback(Cloud Functions shareOg)이 스토어로 보낸다. */
  const shareUrl = options.url || (options.date ? buildShareDeepLink(options.date) : '');

  /* ── "링크만 공유" (공유 방법 선택 시트 → "링크") ──────────────────────────
     linkOnly + 딥링크가 있으면 캡처/이미지 첨부를 생략하고 링크만 보낸다.
     수신자는 SNS 링크 미리보기로 카드 이미지+제목(서버 동적 OG)을 본다.
     딥링크가 없으면 의미 있는 링크가 없으므로 아래 캡처 경로로 폴백한다.
     플랫폼 공통(iOS/Android: Capacitor Share, 웹: Web Share API → 실패 시
     클립보드 복사 폴백). */
  if (options.linkOnly && shareUrl) {
    try {
      /* title(EXTRA_SUBJECT)을 함께 보내면 일부 메시지 앱(문자/메시지 등)이
         "제목 - URL" 형태로 본문을 합성해 링크 미리보기가 지저분해진다.
         링크만 공유할 때는 title 을 생략해 순수 URL만 전달 → 깔끔한 미리보기. */
      await Share.share({ url: shareUrl, dialogTitle });
      return { ok: true, withImage: false, reason: 'link-only' };
    } catch (err) {
      const msg = (err && (err.message || err.code)) || '';
      if (/cancel|dismiss/i.test(String(msg))) {
        return { ok: false, withImage: false, reason: 'cancelled' };
      }
      /* 웹: Web Share API 미지원 브라우저는 Share.share 가 예외를 던진다 →
         클립보드 복사로 폴백(데스크톱 등 navigator.share 없는 환경). */
      if (!isNative && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast(t('share.link_copied'), 'success');
          return { ok: true, withImage: false, reason: 'link-copied' };
        } catch { /* 클립보드도 실패 → 아래 공통 실패 처리 */ }
      }
      console.error('링크 공유 실패:', msg);
      showToast(t('share.link_failed'), 'error');
      return { ok: false, withImage: false, reason: 'share-failed' };
    }
  }

  showToast(t('share.generating'), 'info', 30000);

  /* 폴백(html2canvas) onclone 에서 올바른 카드를 찾기 위한 임시 식별자 */
  const captureId = `_cap_${Date.now()}`;
  cardElement.dataset.captureId = captureId;

  const imgs = Array.from(cardElement.querySelectorAll('img'));

  let dataUrl = null;
  try {
    /* ── Step 1: new Image() + canvas 방식으로 Base64 강제 변환 ──
       crossOrigin = 'anonymous' 를 src 이전에 설정하는 것이 핵심.
       변환 실패 이미지는 원본 src 유지(엔진이 자체 fetch 로 2차 시도). */
    await Promise.all(
      imgs.map(async (img) => {
        const src = img.src || '';
        if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
        img.dataset.originalSrc = src;
        const b64 = await imageToBase64(src);
        if (b64) img.src = b64;
      })
    );

    /* ── Step 2: foreignObject(modern-screenshot) 1차, 실패 시 html2canvas 폴백 ── */
    try {
      dataUrl = await captureWithModernScreenshot(cardElement);
      if (!dataUrl || dataUrl.length < 32) throw new Error('empty-result');
    } catch (primaryErr) {
      console.warn(
        'modern-screenshot 캡처 실패 → html2canvas 폴백:',
        primaryErr?.message || primaryErr,
      );
      dataUrl = await captureWithHtml2canvas(cardElement, captureId);
    }
  } catch (err) {
    console.error('카드 캡처 실패:', err?.message || err);
    showToast(t('share.image_failed'), 'error');
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
    showToast(t('share.image_failed'), 'error');
    return { ok: false, withImage: false, reason: 'empty-image' };
  }

  /* 캡처 완료 — 공유 시트 열기 전에 로딩 인디케이터 제거 */
  dismissToast();

  /* 🐞 디버그 모드: 공유 대신 캡처 결과를 오버레이로 표시 (실기기 검증용) */
  if (DEBUG_CAPTURE_PREVIEW || options._debugPreview) {
    showDebugPreviewOverlay(dataUrl);
    return { ok: true, withImage: true, reason: 'debug-preview' };
  }

  /* ── "갤러리에 저장" (공유 방법 선택 시트 → "갤러리 저장") ──────────────────
     공유 시트를 거치지 않고 캡처 이미지를 사진 보관함에 직접 저장한다.
     네이티브 전용 — 웹에서는 아래 공유/다운로드 경로로 폴백. */
  if (options.saveToGallery && isNative) {
    try {
      await saveImageToGallery(dataUrl);
      showToast(t('share.save_success'), 'success');
      return { ok: true, withImage: true, reason: 'saved' };
    } catch (err) {
      const msg = (err && (err.message || err.code)) || '';
      if (/denied|permission|accessDenied/i.test(String(msg))) {
        showToast(t('share.save_denied'), 'error');
        return { ok: false, withImage: true, reason: 'save-denied' };
      }
      console.error('갤러리 저장 실패:', msg);
      showToast(t('share.save_failed'), 'error');
      return { ok: false, withImage: true, reason: 'save-failed' };
    }
  }

  const fileName = `daystory_card_${Date.now()}.png`;

  /* Native (Android/iOS): Filesystem.Cache 에 저장 후 Share.share */
  if (isNative) {
    try {
      const write = await Filesystem.writeFile({
        path: fileName,
        data: dataUrlToBase64(dataUrl),
        directory: Directory.Cache,
      });
      /* ⚠️ text(본문)·url(딥링크)은 의도적으로 넣지 않는다 — "카드 이미지" 선택 시
         이미지(files)만 공유한다(사용자 요청). 안드로이드에서 files 와 함께
         url(EXTRA_TEXT)이 실리면 인텐트 type 이 image/png 로 덮여도 EXTRA_TEXT 가
         남아 "갤러리/파일에 저장" 같은 순수 이미지 저장 타겟이 공유 시트에서
         빠지는 문제가 있었다. files 만 전달하면 EXTRA_TEXT 없는 순수 image/png
         공유가 되어 갤러리/파일 저장이 정상 노출된다. */
      const shareOptions = { title, files: [write.uri], dialogTitle };
      await Share.share(shareOptions);
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
      /* text(본문)는 의도적으로 제외 — 이미지/링크만 공유한다. */
      const payload = shareUrl
        ? { title, url: shareUrl, files: [file] }
        : { title, files: [file] };
      if (navigator.canShare(payload)) {
        await navigator.share(payload);
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
  label.style.cssText = 'color:#fff;font-size:13px;font-family:var(--font-ui);opacity:0.8';
  img.onload = () => {
    label.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
  };

  /* 닫기 버튼 */
  const btn = document.createElement('button');
  btn.textContent = t('common.close');
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
