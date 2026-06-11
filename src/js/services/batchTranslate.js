/* =====================================================================
   batchTranslate.js — 미번역 스토리 "일괄" 자동 번역 오케스트레이터
   =====================================================================
   에디터(콘텐츠 관리)에서 미번역 글을 하나씩 열어 번역·저장하던 동선을
   여러 건 한 번에 처리하기 위한 서비스. 기존 단건 번역 흐름
   (translateContentApi + updateStory)을 그대로 재사용한다.

   설계 원칙:
     - 이 모듈은 Firebase/네트워크를 직접 import 하지 않는다.
       번역기(translate)·저장기(save)를 "주입"받아 순회만 담당 →
       호출부가 translateContentApi / updateStory 를 연결한다(서비스 레이어 규칙 유지).
       그래서 테스트에서 fake 함수만으로 동시성·부분실패·중단을 검증할 수 있다.
     - 번역 결과를 story.i18n 구조로 변환하는 규약은 단건 저장(editor.js getFormData)과
       동일하게 맞춘다(title → title·figure_name 양쪽 채움 등). 데이터 일관성 보장.

   CLAUDE.md 아키텍처 규칙: Firestore/Functions 접근은 service 레이어 경유.
   ===================================================================== */

/* 번역 대상이 되는 4개 언어 (한국어는 원문이라 제외) */
const TARGET_LANGS = ['en', 'ja', 'es', 'zh'];

/**
 * extractKoFields — 스토리에서 번역할 한국어 원문 필드를 뽑아낸다.
 * 한국어 데이터 모델: title/body/country 는 story 최상위, editor 코멘트는
 * editor_comment(신규) 또는 editor.comment(구버전)에 있을 수 있다.
 * @param {Object} story
 * @returns {{title:string, body:string, country:string, editor_comment:string}}
 */
export function extractKoFields(story) {
  const s = story || {};
  return {
    title: (s.title || s.figure_name || '').trim(),
    body: (s.body || '').trim(),
    country: (s.country || '').trim(),
    editor_comment: (s.editor_comment || (s.editor && s.editor.comment) || '').trim(),
  };
}

/**
 * hasKoSource — 번역할 한국어 원문(제목 또는 본문)이 있는지.
 * 원문이 없는 글은 번역해도 결과가 없으므로 배치 대상에서 제외하는 데 쓴다.
 * @param {Object} story
 * @returns {boolean}
 */
export function hasKoSource(story) {
  const f = extractKoFields(story);
  return !!(f.title || f.body);
}

/**
 * buildI18nFromTranslations — Cloud Function 번역 결과를 story.i18n 구조로 변환.
 * 입력  { en:{title,body,country,editor_comment}, ja:{…}, … }
 * 출력  { en:{title,figure_name,body,country,editor_comment}, … } (값 있는 것만)
 * 단건 저장(getFormData)과 동일하게 title 은 title·figure_name 양쪽에 채운다.
 * @param {Object} translations
 * @returns {Object} i18n (내용이 있는 언어만 키로 포함)
 */
export function buildI18nFromTranslations(translations) {
  const out = {};
  if (!translations || typeof translations !== 'object') return out;

  TARGET_LANGS.forEach((lang) => {
    const tr = translations[lang];
    if (!tr || typeof tr !== 'object') return;

    const entry = {};
    const title = (tr.title || tr.figure_name || '').trim();
    const body = (tr.body || '').trim();
    const country = (tr.country || '').trim();
    const comment = (tr.editor_comment || '').trim();

    if (title) { entry.title = title; entry.figure_name = title; }
    if (body) entry.body = body;
    if (country) entry.country = country;
    if (comment) entry.editor_comment = comment;

    if (Object.keys(entry).length) out[lang] = entry;
  });

  return out;
}

/**
 * runBatchTranslate — 미번역 스토리 목록을 동시성 제한 하에 번역·저장한다.
 *
 * 각 글: extractKoFields → translate({fields}) → buildI18nFromTranslations → save(id, data)
 * 한 건의 실패는 격리되어 나머지 처리를 막지 않는다(부분 성공 보존).
 * 요금 한도(functions/resource-exhausted)는 재시도로 풀리지 않으므로 즉시 전체 중단한다.
 *
 * @param {Object}   opts
 * @param {Array}    opts.stories       대상 스토리 배열 (이미 "미번역 + 원문 있음"으로 선별된 것)
 * @param {Function} opts.translate     async ({fields}) => { translations, model, translatedAt }
 * @param {Function} opts.save          async (id, data) => void  (보통 updateStory)
 * @param {number}   [opts.concurrency=2]  동시 처리 수 (Cloud Function maxInstances=5 고려)
 * @param {Function} [opts.onProgress]  ({done,total,success,failed}) => void  매 건 완료 시 호출
 * @param {Function} [opts.shouldStop]  () => boolean  true 면 남은 글을 건너뜀(페이지 이탈 등)
 * @returns {Promise<{total,done,success,failed,errors,stopped,quotaHit}>}
 */
export async function runBatchTranslate(opts) {
  const {
    stories = [],
    translate,
    save,
    concurrency = 2,
    onProgress,
    shouldStop,
  } = opts || {};

  const total = stories.length;
  const queue = stories.slice();
  const errors = [];
  let done = 0;
  let success = 0;
  let failed = 0;
  let stopped = false;
  let quotaHit = false;

  async function worker() {
    /* 큐가 빌 때까지 한 건씩 꺼내 처리. stopped/quotaHit 이면 즉시 빠진다. */
    while (queue.length > 0) {
      if (stopped || quotaHit) return;
      if (typeof shouldStop === 'function' && shouldStop()) {
        stopped = true;
        return;
      }

      const story = queue.shift();
      if (!story) return;

      try {
        const fields = extractKoFields(story);
        const result = await translate({ fields });
        const i18n = buildI18nFromTranslations(result && result.translations);

        if (Object.keys(i18n).length > 0) {
          const data = { i18n };
          /* 자동 번역 메타 — 재진입 시 단건 에디터가 모델/시각 서브라벨을 복원하는 데 사용 */
          if (result && result.model) {
            data.translation_meta = {
              model: result.model,
              translatedAt: result.translatedAt || new Date().toISOString(),
            };
          }
          await save(story.id, data);
          success += 1;
        } else {
          /* 한국어 원문은 있었으나 번역 결과가 비어 돌아온 경우 */
          failed += 1;
          errors.push({ id: story.id, reason: 'empty' });
        }
      } catch (err) {
        failed += 1;
        errors.push({ id: story.id, reason: (err && (err.code || err.message)) || 'error' });
        /* 요금/지출 한도 초과는 계속 호출해도 실패하므로 전체 중단 신호 */
        if (err && err.code === 'functions/resource-exhausted') quotaHit = true;
      } finally {
        done += 1;
        if (typeof onProgress === 'function') {
          onProgress({ done, total, success, failed });
        }
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency || 1, total || 1));
  const workers = [];
  for (let i = 0; i < workerCount; i += 1) workers.push(worker());
  await Promise.all(workers);

  return { total, done, success, failed, errors, stopped, quotaHit };
}
