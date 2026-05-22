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
