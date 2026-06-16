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

/* 동적 OG 조립 순수 헬퍼 (lib/og.js) — 계약 테스트는 tests/og.spec.js */
const {
  ORIGIN,
  DEFAULT_DESCRIPTION,
  buildOgTitle,
  pickImage,
  detectShareTarget,
  renderSharePage,
} = require('./lib/og');

/**
 * findStoryByDate — publish_date 가 일치하는 발행 스토리 1건을 찾는다.
 * 단일 등식 쿼리(복합 인덱스 불필요) 후 status 는 코드에서 필터한다.
 */
async function findStoryByDate(date) {
  const snap = await admin.firestore()
    .collection('stories')
    .where('publish_date', '==', date)
    .limit(5)
    .get();
  if (snap.empty) return null;
  const docs = snap.docs.map((d) => d.data());
  return docs.find((s) => s.status === 'published') || docs[0] || null;
}

/**
 * shareOg — /share, /share?date=YYYY-MM-DD, /share/<id|날짜> 요청 처리.
 *
 * 봇(카카오 스크래퍼 등)·사용자 모두에게 "카드별 OG 메타 + 스마트 폴백
 * 스크립트" 가 담긴 동일 HTML 을 응답한다.
 *   · 봇    → <head> OG 메타로 링크 미리보기(썸네일=카드 이미지,
 *             제목='DayStory - 날짜 제목')를 그린다.
 *   · 사용자 → <script> 가 설치 시 앱 열기(intent://·커스텀 스킴),
 *             미설치 시 스토어로 보낸다(인앱 브라우저 대응).
 *
 * 조회 실패·데이터 없음이어도 기본 OG + 폴백으로 안전 동작한다
 * (앱 열기 흐름이 절대 깨지지 않도록 best-effort).
 */
exports.shareOg = onRequest(
  /* invoker: 'public' — Hosting rewrite 가 이 함수(Cloud Run)를 비인증으로
     호출할 수 있도록 allUsers 에게 run.invoker 를 부여한다. 없으면 카카오
     스크래퍼·사용자 모두 403(Forbidden)을 받아 OG 썸네일이 안 뜨고
     링크 클릭이 막힌다. */
  { region: 'asia-northeast3', cors: false, maxInstances: 5, invoker: 'public' },
  async (req, res) => {
    const target = detectShareTarget(req.path, req.query);

    let story = null;
    let canonical = `${ORIGIN}/share`;
    let dateForTitle = '';

    try {
      if (target.kind === 'date') {
        canonical = `${ORIGIN}/share?date=${encodeURIComponent(target.date)}`;
        dateForTitle = target.date;
        story = await findStoryByDate(target.date);
      } else if (target.kind === 'id') {
        canonical = `${ORIGIN}/share/${encodeURIComponent(target.id)}`;
        const snap = await admin.firestore().collection('stories').doc(target.id).get();
        if (snap.exists) {
          story = snap.data();
          if (story && story.publish_date) dateForTitle = story.publish_date;
        }
      }
    } catch (err) {
      console.warn('shareOg 스토리 조회 실패:', err.message);
    }

    const cardTitle = story ? (story.figure_name || story.title || '') : '';
    const title = buildOgTitle(dateForTitle, cardTitle);
    const description = (story && (story.summary || story.body)) || DEFAULT_DESCRIPTION;
    const image = pickImage(story);

    /* 봇 OG 캐시를 주기적으로 갱신할 수 있도록 짧게 캐시 */
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderSharePage({
      title,
      description: String(description).slice(0, 200),
      image,
      url: canonical,
    }));
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
