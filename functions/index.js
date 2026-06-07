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

const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const {
  SYSTEM_PROMPT,
  TARGET_LANGS,
  TRANSLATABLE_FIELDS,
  MODEL_CANDIDATES,
  buildUserPrompt,
  parseTranslationResponse,
  isTransientError,
  isQuotaError,
} = require('./lib/translate');

admin.initializeApp();

/* Gemini API 키 — Firebase Secret Manager 에 저장한다.
   설정: firebase functions:secrets:set GEMINI_API_KEY */
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

/* 재시도 백오프용 sleep */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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


/* =====================================================================
   translateContent — 관리자 전용 자동 번역 (Gemini)
   =====================================================================
   에디터에서 한국어 원문 카드 필드를 전달하면 en/ja/es/zh 4개 국어로
   동시에 번역해 돌려준다.
     - 보안: Admin Custom Claim(token.admin === true) 필수.
     - 모델: @google/genai SDK + gemini-3.1-pro-preview (폴백: gemini-2.5-flash)
     - 시스템 프롬프트(SYSTEM_PROMPT)가 줄바꿈(\n) 보존 + 코드블록 JSON 응답 강제.

   요청  data: { fields: { title?, body?, country?, editor_comment? } }
        (하위호환: { text: '<한국어 본문>' } 도 허용)
   응답  { translations: { en:{…}, ja:{…}, es:{…}, zh:{…} } }

   사전: firebase functions:secrets:set GEMINI_API_KEY
   배포: firebase deploy --only functions:translateContent
   ===================================================================== */
exports.translateContent = onCall(
  { region: 'asia-northeast3', secrets: [GEMINI_API_KEY], maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    /* 1) 인가 — Admin Custom Claim 확인 (storage.rules / syncAdminClaim 과 동일 기준) */
    if (request.auth?.token?.admin !== true) {
      throw new HttpsError('permission-denied', '관리자만 사용할 수 있는 기능입니다.');
    }

    /* 2) 입력 검증 — fields(객체) 우선, 하위호환으로 text(문자열)도 허용 */
    const data = request.data || {};
    const fields = data.fields && typeof data.fields === 'object'
      ? data.fields
      : (typeof data.text === 'string' ? { body: data.text } : {});
    const hasContent = TRANSLATABLE_FIELDS
      .some((k) => typeof fields[k] === 'string' && fields[k].trim());
    if (!hasContent) {
      throw new HttpsError('invalid-argument', '번역할 한국어 원문이 없습니다.');
    }

    /* 3) Gemini 호출 (모델 폴백 + 일시오류 재시도) + 응답 파싱 */
    try {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
      const genConfig = {
        contents: buildUserPrompt(fields),
        config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7 },
      };

      /* 모델 후보를 순회하며, 과부하(503)/한도(429)/내부오류(500) 같은 일시오류면
         짧게 백오프 후 재시도하고, 모델이 계속 막히면 다음 후보로 폴백한다. */
      let response = null;
      let lastErr = null;
      let usedModel = null; /* 실제 응답을 받은 모델 ID — 클라이언트 메타 표시용 */
      const ATTEMPTS_PER_MODEL = 2;
      for (const model of MODEL_CANDIDATES) {
        for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
          try {
            response = await ai.models.generateContent({ model, ...genConfig });
            lastErr = null;
            usedModel = model;
            break;
          } catch (err) {
            lastErr = err;
            if (!isTransientError(err)) throw err; /* 영구 오류(키/요청 오류 등)는 즉시 중단 */
            await sleep(500 * (attempt + 1)); /* 0.5s → 1.0s 백오프 */
          }
        }
        if (response) break;
      }

      if (!response) {
        /* 요금/지출 한도 초과(spend cap)는 재시도로 안 풀리므로 별도 코드·메시지로 안내 */
        if (isQuotaError(lastErr)) {
          console.error('translateContent 한도 초과(spend cap):', lastErr && lastErr.message);
          throw new HttpsError(
            'resource-exhausted',
            'AI 번역 사용량(요금) 한도를 초과했습니다. Google AI Studio 의 지출 한도를 확인·상향하거나 다음 달 리셋을 기다려주세요.'
          );
        }
        /* 그 외 모든 모델이 일시오류로 실패 → 사용자에게 재시도 안내 (internal 아님) */
        console.error('translateContent 일시오류(모든 모델 실패):', lastErr && lastErr.message);
        throw new HttpsError('unavailable', 'AI 번역 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.');
      }

      const raw = response && typeof response.text === 'string' ? response.text : '';
      const parsed = parseTranslationResponse(raw);

      /* 대상 언어(en/ja/es/zh) 객체만 추려 반환 */
      const translations = {};
      TARGET_LANGS.forEach((lang) => {
        if (parsed[lang] && typeof parsed[lang] === 'object') translations[lang] = parsed[lang];
      });
      /* model: 실제 번역에 사용된 Gemini 모델 ID, translatedAt: 서버 기준 적용 시각(ISO) */
      return { translations, model: usedModel, translatedAt: new Date().toISOString() };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('translateContent 실패:', err);
      throw new HttpsError('internal', '번역 처리 중 오류가 발생했습니다.');
    }
  }
);
