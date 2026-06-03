/* =====================================================================
   functions/index.js — DayStory 동적 Open Graph 응답
   =====================================================================
   봇(facebookexternalhit, Twitterbot, KakaoTalk-scrap, Slackbot 등)이
   /share/:id 를 요청하면 카드 정보를 담은 OG 메타 HTML을 응답합니다.
   일반 사용자(브라우저)는 SPA index.html 로 폴백합니다.

   배포:
     firebase deploy --only functions

   firebase.json rewrites:
     "/share/**" → 이 함수
   ===================================================================== */

const { onRequest, onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

const APP_URL = 'https://daystory.app';
const SITE_NAME = 'DayStory';
const DEFAULT_DESCRIPTION = '매일의 역사 한 조각을 카드로 만나는 큐레이션 서비스';
const DEFAULT_OG_IMAGE = `${APP_URL}/images/og-default.png`;

const BOT_PATTERN = /facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|kakaotalk-scrap|KAKAOTALK|Daum|Naver|Yeti|Googlebot|Pinterest|Embedly|redditbot|vkShare|Applebot/i;

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pickImage(story) {
  if (!story) return DEFAULT_OG_IMAGE;
  // Firestore stories 스키마: image_url(풀사이즈), image_thumb_url(썸네일).
  // SNS 미리보기는 큰 이미지가 좋으므로 image_url 우선.
  const url = story.image_url || story.image_thumb_url;
  return (typeof url === 'string' && url.startsWith('http')) ? url : DEFAULT_OG_IMAGE;
}

function renderOgHtml({ title, description, image, url }) {
  const T = escapeHtml(title);
  const D = escapeHtml(description);
  const I = escapeHtml(image);
  const U = escapeHtml(url);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
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
<meta http-equiv="refresh" content="0; url=${U}" />
</head>
<body>
<p><a href="${U}">${T}</a></p>
</body>
</html>`;
}

/**
 * shareOg — /share/:id 요청 처리
 *
 * 호출 흐름:
 *   봇 → 동적 OG HTML 응답
 *   일반 사용자 → SPA로 (firebase.json 의 별도 rewrite 또는 redirect)
 *
 * 단, Hosting rewrite로 모든 /share/** 가 이 함수로 들어오므로
 * 일반 사용자에게는 같은 페이지에 SPA index.html을 보내야 합니다.
 * 이 구현은 두 경우 모두 처리: 봇 → OG, 사용자 → SPA shell + JS가 라우팅.
 */
exports.shareOg = onRequest(
  { region: 'asia-northeast3', cors: false, maxInstances: 5 },
  async (req, res) => {
    const ua = req.headers['user-agent'] || '';
    const isBot = BOT_PATTERN.test(ua);

    // /share/<id> 또는 /detail/<id>
    const match = req.path.match(/\/(share|detail)\/([^/?#]+)/);
    const storyId = match ? decodeURIComponent(match[2]) : null;
    const url = storyId ? `${APP_URL}/share/${encodeURIComponent(storyId)}` : APP_URL;

    let story = null;
    if (storyId) {
      try {
        const snap = await admin.firestore().collection('stories').doc(storyId).get();
        if (snap.exists) story = snap.data();
      } catch (err) {
        console.warn('Firestore 조회 실패:', err.message);
      }
    }

    const title = story
      ? `${story.figure_name || story.title || SITE_NAME} — ${SITE_NAME}`
      : SITE_NAME;
    const description = (story && (story.summary || story.body)) || DEFAULT_DESCRIPTION;
    const image = pickImage(story);

    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');

    if (isBot) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(renderOgHtml({
        title,
        description: String(description).slice(0, 200),
        image,
        url,
      }));
    }

    // 사용자: SPA로. firebase.json rewrites 가 이 함수보다 우선 처리하지 않으므로
    // 동일 도메인의 index.html 을 그대로 보냅니다.
    // (공유 URL 클릭 → /share/:id → 함수 → /#/detail/:id 로 클라이언트 라우팅)
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!doctype html>
<html lang="ko"><head>
<meta charset="UTF-8" />
<meta http-equiv="refresh" content="0; url=${APP_URL}/#/detail/${encodeURIComponent(storyId || '')}" />
<title>${escapeHtml(title)}</title>
</head><body>
<script>location.replace(${JSON.stringify(`${APP_URL}/#/detail/${storyId || ''}`)});</script>
<p><a href="${APP_URL}/#/detail/${escapeHtml(storyId || '')}">계속하기</a></p>
</body></html>`);
  }
);


/* =====================================================================
   syncAdminClaim — 어드민 권한(Custom Claims) 부여/회수 (audit 2-3)
   =====================================================================
   클라이언트에 하드코딩돼 있던 ADMIN_EMAILS 를 서버 전용으로 옮긴다.
   호출자(로그인 사용자)의 이메일이 allowlist 에 있으면:
     - Custom Claim  admin: true        → storage.rules / 클라이언트가 사용
     - profiles/{uid}.role = 'editor'   → 기존 배포된 firestore.rules 호환
   allowlist 에서 빠졌는데 클레임이 남아 있으면 회수한다.

   클라이언트(src/js/services/admin.js)는 로그인 직후 1회 호출하고,
   부여되면 ID 토큰을 강제 갱신해 즉시 반영한다.

   배포: firebase deploy --only functions
   ===================================================================== */
const ADMIN_EMAILS = [
  'daystory@test.com',
  'dokhubooks@gmail.com',
  'ldj729@gmail.com',
];

exports.syncAdminClaim = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const authCtx = request.auth;
    if (!authCtx) return { admin: false };

    const uid = authCtx.uid;
    const email = String(authCtx.token.email || '').toLowerCase();
    const shouldBeAdmin = ADMIN_EMAILS.includes(email);
    const alreadyAdmin = authCtx.token.admin === true;

    try {
      if (shouldBeAdmin && !alreadyAdmin) {
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        await admin.firestore().doc(`profiles/${uid}`).set({ role: 'editor' }, { merge: true });
      } else if (!shouldBeAdmin && alreadyAdmin) {
        // allowlist 에서 제거됨 → 강등
        await admin.auth().setCustomUserClaims(uid, { admin: false });
        await admin.firestore().doc(`profiles/${uid}`)
          .set({ role: admin.firestore.FieldValue.delete() }, { merge: true });
      }
    } catch (err) {
      console.error('syncAdminClaim 실패:', err);
      return { admin: alreadyAdmin };
    }

    return { admin: shouldBeAdmin };
  }
);
