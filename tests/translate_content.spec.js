/* =====================================================================
   translate_content.spec.js
   ---------------------------------------------------------------------
   자동 번역 Cloud Function(translateContent) 검증
   - 순수 헬퍼(functions/lib/translate.js): 프롬프트 구성 + 응답 파싱
     · 마크다운 코드블록(```json …```)에서 JSON 추출
     · 줄바꿈(\n) 보존
     · {en, ja, es, zh} 구조 반환
   - functions/index.js / package.json 정적 검증 (보안 게이트·SDK·모델)
   Vitest 는 functions/ 를 수집에서 제외하지만 import 는 가능.
   CJS(module.exports) interop 은 `mod.default ?? mod` 로 처리.
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (p) => resolve(process.cwd(), p);

async function loadLib() {
  const mod = await import('../functions/lib/translate.js');
  return mod.default ?? mod;
}

/* ──────────────────────────────────────────────
   1) 순수 헬퍼 — parseTranslationResponse
   ────────────────────────────────────────────── */
describe('parseTranslationResponse — 코드블록 JSON 추출 + 줄바꿈 보존', () => {
  const sample = (langs) => {
    const obj = {};
    for (const [l, body] of Object.entries(langs)) obj[l] = { title: `${l}-title`, body };
    return obj;
  };

  it('```json 펜스에서 JSON 을 추출해 {en,ja,es,zh} 를 반환한다', async () => {
    const { parseTranslationResponse } = await loadLib();
    const obj = sample({ en: 'A', ja: 'B', es: 'C', zh: 'D' });
    const raw = '```json\n' + JSON.stringify(obj) + '\n```';
    const out = parseTranslationResponse(raw);
    expect(Object.keys(out).sort()).toEqual(['en', 'es', 'ja', 'zh']);
    expect(out.en.title).toBe('en-title');
  });

  it('본문의 줄바꿈(\\n) 위치를 그대로 보존한다', async () => {
    const { parseTranslationResponse } = await loadLib();
    const body = 'First line\nSecond line\n\nFourth line';
    const raw = '```json\n' + JSON.stringify(sample({ en: body, ja: body, es: body, zh: body })) + '\n```';
    const out = parseTranslationResponse(raw);
    expect(out.en.body).toBe(body);
    expect(out.zh.body.split('\n').length).toBe(body.split('\n').length);
  });

  it('json 태그 없는 펜스(``` …```)와 펜스 없는 순수 JSON 도 처리한다', async () => {
    const { parseTranslationResponse } = await loadLib();
    const obj = sample({ en: 'A', ja: 'B', es: 'C', zh: 'D' });
    const noTag = '```\n' + JSON.stringify(obj) + '\n```';
    const noFence = JSON.stringify(obj);
    expect(parseTranslationResponse(noTag).es.title).toBe('es-title');
    expect(parseTranslationResponse(noFence).ja.title).toBe('ja-title');
  });

  it('JSON 이 아닌 응답이면 throw 한다', async () => {
    const { parseTranslationResponse } = await loadLib();
    expect(() => parseTranslationResponse('죄송합니다, 번역할 수 없습니다.')).toThrow();
  });
});

/* ──────────────────────────────────────────────
   2) 순수 헬퍼 — SYSTEM_PROMPT / TARGET_LANGS / buildUserPrompt
   ────────────────────────────────────────────── */
describe('SYSTEM_PROMPT / TARGET_LANGS / buildUserPrompt', () => {
  it('TARGET_LANGS 가 [en, ja, es, zh] 이다', async () => {
    const { TARGET_LANGS } = await loadLib();
    expect(TARGET_LANGS).toEqual(['en', 'ja', 'es', 'zh']);
  });

  it('SYSTEM_PROMPT 에 핵심 지시 문구가 포함된다', async () => {
    const { SYSTEM_PROMPT } = await loadLib();
    expect(SYSTEM_PROMPT).toContain('로컬라이징');
    expect(SYSTEM_PROMPT).toContain('줄바꿈');
    expect(SYSTEM_PROMPT).toContain('마크다운 코드블록');
    /* 4개 언어가 시스템 프롬프트에 명시 */
    ['영어', '일본어', '스페인어', '중국어'].forEach((w) => expect(SYSTEM_PROMPT).toContain(w));
  });

  it('buildUserPrompt 가 입력 ko 필드 값을 포함한다', async () => {
    const { buildUserPrompt } = await loadLib();
    const prompt = buildUserPrompt({ title: '뉴턴', body: '사과나무 아래에서\n사과가 떨어졌다' });
    expect(prompt).toContain('뉴턴');
    expect(prompt).toContain('사과가 떨어졌다');
  });
});

/* ──────────────────────────────────────────────
   2-b) 재시도/폴백 — isTransientError / MODEL_CANDIDATES
   ────────────────────────────────────────────── */
describe('isTransientError / MODEL_CANDIDATES — 과부하 재시도·폴백', () => {
  it('503 UNAVAILABLE·429·500 은 일시 오류로 판정한다', async () => {
    const { isTransientError } = await loadLib();
    expect(isTransientError({ status: 503, message: 'UNAVAILABLE' })).toBe(true);
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ status: 500 })).toBe(true);
    expect(isTransientError(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'))).toBe(true);
    expect(isTransientError(new Error('This model is currently experiencing high demand'))).toBe(true);
  });

  it('영구 오류(400/권한/키)는 일시 오류가 아니다', async () => {
    const { isTransientError } = await loadLib();
    expect(isTransientError({ status: 400, message: 'invalid argument' })).toBe(false);
    expect(isTransientError(new Error('API key not valid'))).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });

  it('MODEL_CANDIDATES 는 폴백용으로 2개 이상이고 gemini-2.5-flash 를 우선한다', async () => {
    const { MODEL_CANDIDATES } = await loadLib();
    expect(Array.isArray(MODEL_CANDIDATES)).toBe(true);
    expect(MODEL_CANDIDATES.length).toBeGreaterThanOrEqual(2);
    expect(MODEL_CANDIDATES[0]).toBe('gemini-2.5-flash');
  });
});

/* ──────────────────────────────────────────────
   3) functions/index.js / package.json 정적 검증
   ────────────────────────────────────────────── */
describe('translateContent 함수 — 보안/SDK/모델 정적 검증', () => {
  const fn = () => readFileSync(root('functions/index.js'), 'utf8');

  it('translateContent 를 onCall 로 export 한다', () => {
    const s = fn();
    expect(s).toMatch(/exports\.translateContent\s*=\s*onCall/);
  });

  it('GEMINI_API_KEY 를 Secret Manager(defineSecret)로 불러오고 secrets 에 바인딩한다', () => {
    const s = fn();
    expect(s).toMatch(/defineSecret\(\s*['"]GEMINI_API_KEY['"]\s*\)/);
    expect(s).toMatch(/secrets:\s*\[/);
  });

  it('관리자 Claim(token.admin)으로 인가를 확인한다', () => {
    expect(fn()).toMatch(/token\.admin/);
  });

  it('@google/genai SDK·asia-northeast3 리전·모델 폴백(MODEL_CANDIDATES)을 사용한다', () => {
    const s = fn();
    expect(s).toMatch(/@google\/genai/);
    expect(s).toMatch(/asia-northeast3/);
    expect(s).toMatch(/MODEL_CANDIDATES/);
    /* 실제 모델 식별자는 lib/translate.js 에 정의 (2.5-flash → 2.0-flash 폴백) */
    const lib = readFileSync(root('functions/lib/translate.js'), 'utf8');
    expect(lib).toMatch(/gemini-2\.5-flash/);
    expect(lib).toMatch(/gemini-2\.0-flash/);
  });

  it('functions/package.json 의존성에 @google/genai 가 있다', () => {
    const pkg = JSON.parse(readFileSync(root('functions/package.json'), 'utf8'));
    expect(pkg.dependencies['@google/genai']).toBeTruthy();
  });
});
