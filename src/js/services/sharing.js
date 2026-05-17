/* =====================================================================
   sharing.js — SNS 공유 통합 헬퍼
   =====================================================================
   카드 공유 시 이미지를 직접 첨부하여 카카오톡/SMS/메시지에서
   미리보기가 이쁘게 보이도록 합니다. 트위터/페이스북 피드 미리보기는
   Cloud Functions(/share/:id) 의 동적 Open Graph HTML이 담당합니다.

   - shareStory(story, options) : 통합 공유 함수
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
