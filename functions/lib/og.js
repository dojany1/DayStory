/* =====================================================================
   functions/lib/og.js — 동적 Open Graph 응답 순수 헬퍼 (CommonJS)
   =====================================================================
   /share 요청에 대해 카드별 OG 메타(썸네일·제목)를 담은 HTML 을 조립한다.
   카카오톡·페이스북 등 스크래퍼는 JS 를 실행하지 않으므로 OG 태그는 반드시
   서버 응답 HTML 안에 있어야 한다(클라이언트 주입 불가).

   동시에, 카카오톡·인스타 등 "인앱 브라우저" 는 Universal/App Link 를
   가로채지 않아 이 페이지가 그냥 열린다. 그래서 같은 HTML 에 스마트 폴백
   스크립트(설치 시 앱 열기 / 미설치 시 스토어)를 함께 담는다.
     · 봇    → <head> 의 OG 메타만 읽음
     · 사용자 → <script> 가 앱/스토어로 보냄

   순수 함수만 둔다(테스트 용이, Firestore/네트워크 의존 없음).
   ===================================================================== */

const SITE_NAME = 'DayStory';
const ORIGIN = 'https://dokhu-daystory.web.app';
const APP_STORE = 'https://apps.apple.com/app/id6769716464';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.daystory.app';
const WEB_HOME = `${ORIGIN}/`;
const ANDROID_PACKAGE = 'com.daystory.app';
const APPLE_APP_ID = '6769716464';
const DEFAULT_DESCRIPTION = '매일의 역사 한 조각을 카드로 만나는 큐레이션 서비스';
const DEFAULT_OG_IMAGE = `${ORIGIN}/daystory_icon_light.png`;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * formatKoreanDate — 'YYYY-MM-DD' → 'YYYY년 M월 D일'. 형식이 틀리면 '' 반환.
 */
function formatKoreanDate(dateStr) {
  if (!dateStr || !ISO_DATE_RE.test(dateStr)) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

/**
 * buildOgTitle — OG 제목을 'DayStory - {날짜} {제목}' 형식으로 만든다.
 * 날짜/제목 중 없는 부분은 자연스럽게 생략한다.
 * @param {string} dateStr - 'YYYY-MM-DD' (없거나 형식 틀리면 무시)
 * @param {string} cardTitle - 카드 제목(figure_name 또는 title)
 * @returns {string}
 */
function buildOgTitle(dateStr, cardTitle) {
  const datePart = formatKoreanDate(dateStr);
  const titlePart = (cardTitle || '').toString().trim();
  const tail = [datePart, titlePart].filter(Boolean).join(' ');
  return tail ? `${SITE_NAME} - ${tail}` : SITE_NAME;
}

/**
 * pickImage — 스토리에서 OG 썸네일 URL 을 고른다.
 * SNS 미리보기는 큰 이미지가 좋으므로 image_url(풀사이즈) 우선, 없으면 썸네일.
 * 공개 http(s) URL 이 아니면 기본 이미지로 폴백.
 */
function pickImage(story) {
  if (!story) return DEFAULT_OG_IMAGE;
  const url = story.image_url || story.image_thumb_url;
  return (typeof url === 'string' && url.startsWith('http')) ? url : DEFAULT_OG_IMAGE;
}

/**
 * detectShareTarget — 요청 path/query 를 date/id/home 으로 분류한다.
 *   · ?date=YYYY-MM-DD          → { kind:'date', date }  (최우선)
 *   · /share/<YYYY-MM-DD>       → { kind:'date', date }
 *   · /share/<id>               → { kind:'id', id }
 *   · /share (bare)             → { kind:'home' }
 *
 * @param {string} path  - req.path (예: '/share', '/share/abc')
 * @param {object} query - req.query (예: { date:'2026-06-15' })
 * @returns {{kind:'date',date:string}|{kind:'id',id:string}|{kind:'home'}}
 */
function detectShareTarget(path, query) {
  const q = query || {};
  if (typeof q.date === 'string' && ISO_DATE_RE.test(q.date)) {
    return { kind: 'date', date: q.date };
  }

  const m = String(path || '').match(/\/(?:share|detail)\/([^/?#]+)/);
  if (m) {
    const seg = decodeURIComponent(m[1] || '');
    if (ISO_DATE_RE.test(seg)) return { kind: 'date', date: seg };
    if (seg) return { kind: 'id', id: seg };
  }

  return { kind: 'home' };
}

/**
 * renderSharePage — OG 메타 + 스마트 폴백 스크립트를 담은 완전한 HTML 을 만든다.
 *
 * @param {object} opts
 *   - title:       OG/문서 제목 (예: 'DayStory - 2026년 6월 15일 우주로 간 원숭이')
 *   - description: OG 설명
 *   - image:       OG 썸네일 URL (카드 이미지)
 *   - url:         canonical/og:url
 * @returns {string} HTML 문자열
 */
function renderSharePage({ title, description, image, url }) {
  /* 줄바꿈을 포함한 content="..." 속성은 일부 SNS 스크래퍼(iMessage 등)가
     OG 파싱에 실패해 미리보기 전체가 사라지는 원인이 된다 — 한 줄로 접는다. */
  const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const T = escapeHtml(oneLine(title) || SITE_NAME);
  const D = escapeHtml(oneLine(description || DEFAULT_DESCRIPTION).slice(0, 200));
  const I = escapeHtml(image || DEFAULT_OG_IMAGE);
  const U = escapeHtml(url || `${ORIGIN}/share`);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex" />
<title>${T}</title>
<meta name="description" content="${D}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${T}" />
<meta property="og:description" content="${D}" />
<meta property="og:image" content="${I}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${U}" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${T}" />
<meta name="twitter:description" content="${D}" />
<meta name="twitter:image" content="${I}" />
<link rel="canonical" href="${U}" />
<meta name="apple-itunes-app" content="app-id=${APPLE_APP_ID}" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    background: #f6f5f1; color: #1a1a1a; text-align: center;
  }
  @media (prefers-color-scheme: dark) { body { background: #14110e; color: #f3f1ec; } }
  main { max-width: 360px; }
  .logo { width: 84px; height: 84px; border-radius: 20px; margin-bottom: 20px; }
  h1 { font-size: 22px; margin: 0 0 8px; letter-spacing: -0.02em; }
  p { font-size: 15px; opacity: 0.7; margin: 0 0 28px; line-height: 1.5; }
  .btn-row { display: flex; flex-direction: column; gap: 12px; align-items: center; }
  .app-btn, .store-btn { display: inline-block; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-size: 16px; font-weight: 700; min-width: 220px; }
  .app-btn { background: #1a1a1a; color: #fff; }
  .store-btn { background: transparent; color: inherit; opacity: 0.7; padding: 8px 28px; font-size: 14px; }
  @media (prefers-color-scheme: dark) { .app-btn { background: #f3f1ec; color: #14110e; } }
</style>
</head>
<body>
<main>
  <img class="logo" src="/daystory_icon_light.png" alt="DayStory" />
  <h1>DayStory</h1>
  <p>앱으로 이동하고 있어요…<br />열리지 않으면 아래 버튼을 눌러주세요.</p>
  <div class="btn-row">
    <a id="appLink" class="app-btn" href="#">앱에서 열기</a>
    <a id="storeLink" class="store-btn" href="${escapeHtml(WEB_HOME)}">스토어에서 받기</a>
  </div>
</main>
<script>
  (function () {
    var APP_STORE = ${JSON.stringify(APP_STORE)};
    var PLAY_STORE = ${JSON.stringify(PLAY_STORE)};
    var WEB_HOME = ${JSON.stringify(WEB_HOME)};
    var ANDROID_PACKAGE = ${JSON.stringify(ANDROID_PACKAGE)};

    var ua = navigator.userAgent || navigator.vendor || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroid = /android/i.test(ua);
    var isKakao = /KAKAOTALK/i.test(ua);

    var currentUrl = location.href;
    var relPath = location.pathname.replace(/^\\/+/, '') + location.search;
    var schemeUrl = 'daystory://' + relPath;

    var appBtn = document.getElementById('appLink');
    var storeBtn = document.getElementById('storeLink');

    function storeTarget() { return isIOS ? APP_STORE : (isAndroid ? PLAY_STORE : WEB_HOME); }
    function goStore() { window.location.replace(storeTarget()); }
    if (storeBtn) storeBtn.href = storeTarget();

    if (!isIOS && !isAndroid) {
      if (appBtn) appBtn.href = WEB_HOME;
      return;
    }

    if (isAndroid) {
      var intentUrl = 'intent://' + relPath +
        '#Intent;scheme=daystory;package=' + ANDROID_PACKAGE +
        ';S.browser_fallback_url=' + encodeURIComponent(PLAY_STORE) + ';end';
      if (appBtn) appBtn.href = intentUrl;
      window.location.replace(intentUrl);
      setTimeout(goStore, 2500);
      return;
    }

    if (isIOS) {
      if (isKakao) {
        if (appBtn) appBtn.href = schemeUrl;
        window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(currentUrl);
        return;
      }
      if (appBtn) appBtn.href = schemeUrl;
      var left = false;
      function markLeft() { left = true; }
      document.addEventListener('visibilitychange', function () { if (document.hidden) markLeft(); });
      window.addEventListener('pagehide', markLeft);
      window.location.href = schemeUrl;
      setTimeout(function () { if (!left && !document.hidden) goStore(); }, 1600);
      return;
    }
  })();
</script>
</body>
</html>`;
}

module.exports = {
  SITE_NAME,
  ORIGIN,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  escapeHtml,
  formatKoreanDate,
  buildOgTitle,
  pickImage,
  detectShareTarget,
  renderSharePage,
};
