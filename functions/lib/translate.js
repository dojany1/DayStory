/* =====================================================================
   functions/lib/translate.js — translateContent 순수 헬퍼 (테스트 대상)
   =====================================================================
   firebase/genai 등 런타임 의존성이 없는 순수 함수만 모아 단위 테스트가
   가능하도록 분리한다. (tests/translate_content.spec.js 가 import)
   - SYSTEM_PROMPT       : Gemini 시스템 프롬프트(로컬라이징 지침)
   - TARGET_LANGS        : 번역 대상 언어 코드
   - buildUserPrompt()   : 한국어 원문 필드 → 사용자 프롬프트 문자열
   - parseTranslationResponse() : 모델 응답(마크다운 코드블록)에서 JSON 추출
   ===================================================================== */

/* 한국어(ko) 원문을 번역할 대상 언어 */
const TARGET_LANGS = ['en', 'ja', 'es', 'zh'];

/* 번역 가능한 카드 필드 (에디터 입력 키와 1:1) */
const TRANSLATABLE_FIELDS = ['title', 'body', 'country', 'editor_comment'];

/* Gemini 시스템 프롬프트 — 사용자 지정 지침을 그대로 포함한다.
   줄바꿈(\n) 보존과 마크다운 코드블록 JSON 응답이 핵심 요구사항. */
const SYSTEM_PROMPT = [
  '너는 한국의 역사 일화를 다국어(영어, 일본어, 스페인어, 중국어 간체)로 번역하는 전문 로컬라이징 번역가야.',
  '원문이 전달하고자 하는 바와 맥락을 정확하게 파악하고, 각 언어권의 사용자가 읽었을 때 가장 자연스럽게 이해할 수 있도록 맞춤형으로 로컬라이징해 줘.',
  '가장 중요한 것은 원문의 줄바꿈(\\n) 위치를 절대로 훼손하지 말고 번역본에서도 똑같이 유지해야 해.',
  '응답은 반드시 마크다운 코드블록(```json ... ```) 안에 JSON으로만 반환해. 코드블록 밖에는 어떤 설명도 덧붙이지 마.',
  '출력 형식: {"en": {필드}, "ja": {필드}, "es": {필드}, "zh": {필드}} — 각 언어 객체는 입력으로 받은 필드 키(title, body, country, editor_comment 중 존재하는 것)를 그대로 사용해.',
].join('\n');

/**
 * buildUserPrompt — 한국어 원문 필드를 모델 사용자 프롬프트로 직렬화한다.
 * 비어있지 않은 필드만 포함한다.
 * @param {{title?:string, body?:string, country?:string, editor_comment?:string}} fields
 * @returns {string}
 */
function buildUserPrompt(fields) {
  const clean = {};
  TRANSLATABLE_FIELDS.forEach((k) => {
    const v = fields && typeof fields[k] === 'string' ? fields[k].trim() : '';
    if (v) clean[k] = v;
  });
  return [
    '다음 한국어 역사 일화 카드의 필드를 번역해 줘.',
    '입력(JSON):',
    JSON.stringify(clean, null, 2),
    '',
    `대상 언어: ${TARGET_LANGS.join(', ')}`,
    '각 대상 언어에 대해 위 입력과 동일한 키를 가진 객체를 만들고,',
    '{"en": {…}, "ja": {…}, "es": {…}, "zh": {…}} 형식의 JSON 하나로만 응답해.',
  ].join('\n');
}

/**
 * parseTranslationResponse — 모델 응답에서 번역 JSON 을 추출/파싱한다.
 * - 마크다운 코드블록(```json … ``` 또는 ``` … ```)을 우선 추출
 * - 코드블록이 없으면 첫 '{' ~ 마지막 '}' 구간을 JSON 으로 간주
 * - 줄바꿈(\n)은 JSON.parse 가 그대로 복원하므로 보존된다
 * @param {string} raw - 모델 원문 응답
 * @returns {Object} { en?:{}, ja?:{}, es?:{}, zh?:{} }
 * @throws JSON 을 찾거나 파싱하지 못하면 throw
 */
function parseTranslationResponse(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('번역 응답이 비어 있습니다.');
  }
  let text = raw.trim();

  /* 1) 마크다운 코드블록 추출 (json 태그 유무 모두 허용) */
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  /* 2) 코드블록이 없으면 첫 { ~ 마지막 } 추출 (프롤로그/에필로그 제거) */
  if (!text.startsWith('{')) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) {
      throw new Error('번역 응답에서 JSON 객체를 찾지 못했습니다.');
    }
    text = text.slice(first, last + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`번역 응답 JSON 파싱 실패: ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('번역 응답이 JSON 객체가 아닙니다.');
  }
  return parsed;
}

/* 우선순위 모델 — 앞 모델이 과부하(503)면 다음 모델로 폴백한다.
   gemini-3.1-pro-preview(최고 품질) → gemini-2.5-flash(안정적·여유 용량). */
const MODEL_CANDIDATES = ['gemini-3.1-pro-preview', 'gemini-2.5-flash'];

/**
 * isTransientError — Gemini API 의 일시적 오류(재시도/모델 폴백 대상) 여부.
 * 503 UNAVAILABLE("high demand"), 429 RESOURCE_EXHAUSTED, 500 INTERNAL 등.
 * @param {*} err - @google/genai ApiError 또는 일반 Error
 * @returns {boolean}
 */
function isTransientError(err) {
  if (!err) return false;
  const status = Number(err.status != null ? err.status : err.code);
  if ([429, 500, 503].includes(status)) return true;
  const msg = String(err.message || '');
  return /\b(429|500|503)\b/.test(msg)
    || /UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|overloaded|high demand|try again later/i.test(msg);
}

/**
 * isQuotaError — 재시도해도 풀리지 않는 "요금/지출 한도 초과"(spend cap) 오류인지.
 * 일반 일시오류(503 과부하/RPM 레이트리밋)와 달리, 한도가 리셋·상향될 때까지 계속 429 가 난다.
 * 관측 메시지: "Your project has exceeded its monthly spending cap..."
 * @param {*} err
 * @returns {boolean}
 */
function isQuotaError(err) {
  const msg = String((err && err.message) || '');
  return /spending cap|spend cap|exceeded its monthly|billing/i.test(msg);
}

module.exports = {
  TARGET_LANGS,
  TRANSLATABLE_FIELDS,
  SYSTEM_PROMPT,
  MODEL_CANDIDATES,
  buildUserPrompt,
  parseTranslationResponse,
  isTransientError,
  isQuotaError,
};
