/* =====================================================================
   deepLink.js — 공유 딥링크 URL 빌드/파싱 (순수 유틸, 사이드이펙트 없음)
   =====================================================================
   DayStory 공유 링크는 Universal Links(iOS) / App Links(Android) 로 동작한다.

     https://dokhu-daystory.web.app/share?date=YYYY-MM-DD   → 해당 날짜 카드
     https://dokhu-daystory.web.app/share/<storyId>         → 특정 카드(레거시 OG)
     https://dokhu-daystory.web.app/share                   → 앱 홈

   ⚠️ Firebase Dynamic Links 는 서비스 종료 예정이므로 사용하지 않는다.
   앱이 설치된 기기는 OS 가 위 URL 을 가로채 앱으로 전달하고
   (@capacitor/app 의 appUrlOpen), 미설치 기기는 /share fallback HTML 이
   User-Agent 를 보고 App Store / Play Store 로 리다이렉트한다.

   이 모듈은 DOM/네이티브 의존이 없는 순수 함수만 둔다(테스트 용이).
   ===================================================================== */

/** 공유 링크 호스트(Firebase Hosting). 도메인 변경 시 이 한 곳만 수정. */
export const SHARE_APP_DOMAIN = 'dokhu-daystory.web.app';
export const SHARE_APP_ORIGIN = `https://${SHARE_APP_DOMAIN}`;

/** YYYY-MM-DD 형식 검증 (휠/딥링크 모두 이 포맷을 사용) */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * buildShareDeepLink — 날짜 기반 공유 URL 을 생성합니다.
 * @param {string} [date] - 'YYYY-MM-DD'. 없거나 형식이 틀리면 bare /share 폴백.
 * @returns {string}
 */
export function buildShareDeepLink(date) {
  if (date && ISO_DATE_RE.test(date)) {
    return `${SHARE_APP_ORIGIN}/share?date=${encodeURIComponent(date)}`;
  }
  return `${SHARE_APP_ORIGIN}/share`;
}

/**
 * parseShareDeepLink — 외부에서 들어온 URL 이 DayStory 공유 링크인지 판별하고
 * 라우팅에 필요한 정보를 추출합니다.
 *
 * 두 가지 입력 형태를 모두 받는다:
 *   · Universal Link / App Link : https://dokhu-daystory.web.app/share[...]
 *   · 커스텀 스킴(daystory://share[...]) : 카카오톡 등 인앱 브라우저가
 *     UL/App Link 를 가로채지 않을 때 /share fallback 페이지가 intent://·
 *     커스텀 스킴으로 앱을 직접 여는 경로. 그때 앱이 받는 URL 이 이 형태다.
 *
 * `daystory://letter` 등 share 가 아닌 위젯 스킴은 null 을 반환해
 * 호출부(routeWidgetDeepLink)의 위젯 분기가 처리하도록 둔다.
 *
 * @param {string} url - appUrlOpen / getLaunchUrl 로 받은 원본 URL
 * @returns {{type:'date', date:string}
 *          | {type:'card', id:string}
 *          | {type:'home'}
 *          | null}  공유 링크가 아니면 null (호출부가 다른 스킴을 시도하도록).
 */
export function parseShareDeepLink(url) {
  if (!url || typeof url !== 'string') return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  /* /share 이후의 경로 조각(예: '<id>')과 공유 링크 여부를 두 스킴에서 통일 추출 */
  let rest;
  if (parsed.protocol === 'daystory:') {
    /* daystory://share , daystory://share/<id> , daystory://share?date=... */
    if (parsed.hostname !== 'share') return null;
    rest = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  } else {
    if (parsed.hostname !== SHARE_APP_DOMAIN) return null;
    /* 트레일링 슬래시 정규화: '/share/' → '/share' */
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/share' && !path.startsWith('/share/')) return null;
    rest = path.startsWith('/share/') ? path.slice('/share/'.length) : '';
  }

  /* date 쿼리가 최우선 (날짜 카드 딥링크) */
  const date = parsed.searchParams.get('date');
  if (date && ISO_DATE_RE.test(date)) {
    return { type: 'date', date };
  }

  /* /share/<id> — 레거시 카드 공유(OG) 경로 */
  if (rest) {
    const id = decodeURIComponent(rest.split('/')[0] || '');
    if (id) return { type: 'card', id };
  }

  return { type: 'home' };
}
