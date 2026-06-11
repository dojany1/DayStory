/* =====================================================================
   batchTranslate.spec.js
   ---------------------------------------------------------------------
   미번역 일괄 번역 오케스트레이터(src/js/services/batchTranslate.js) 검증.

   batchTranslate 는 Firebase/네트워크를 직접 import 하지 않고
   translate(번역)·save(저장) 함수를 "주입"받는 순수 오케스트레이터다.
   덕분에 jsdom/네트워크 없이 fake 함수만으로 다음을 검증할 수 있다:
     1) extractKoFields            — 한국어 원문 필드 추출(폴백/trim)
     2) buildI18nFromTranslations  — 번역 결과 → story.i18n 구조 변환
     3) runBatchTranslate          — 동시성 상한·부분 실패·요금 한도 중단·진행 보고
   ===================================================================== */
import { describe, expect, it } from 'vitest';
import {
  extractKoFields,
  buildI18nFromTranslations,
  runBatchTranslate,
} from '../src/js/services/batchTranslate.js';

/* 테스트용 미번역 스토리 N개 생성 (한국어 원문만 채움) */
const makeStories = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `t${i}`, body: `b${i}` }));

/* 항상 성공하는 fake 번역기 — en 한 언어만 채워 돌려준다 */
const okTranslate = async ({ fields }) => ({
  translations: { en: { title: fields.title, body: fields.body } },
  model: 'gemini-x',
  translatedAt: '2026-01-01T00:00:00Z',
});

/* ──────────────────────────────────────────────
   1) extractKoFields — 한국어 원문 필드 추출
   ────────────────────────────────────────────── */
describe('extractKoFields — 한국어 원문 필드 추출', () => {
  it('title 우선, 없으면 figure_name 으로 폴백하고 trim 한다', () => {
    expect(extractKoFields({ figure_name: '  뉴턴  ', body: 'b' }).title).toBe('뉴턴');
    expect(extractKoFields({ title: '제목', figure_name: '인물' }).title).toBe('제목');
  });

  it('editor_comment 우선, 없으면 editor.comment 로 폴백한다', () => {
    expect(extractKoFields({ editor: { comment: '코멘트' } }).editor_comment).toBe('코멘트');
    expect(extractKoFields({ editor_comment: 'top', editor: { comment: 'nested' } }).editor_comment).toBe('top');
  });

  it('country/body 를 trim 해서 포함한다', () => {
    const f = extractKoFields({ title: 't', body: '  본문 ', country: ' 영국 ' });
    expect(f.body).toBe('본문');
    expect(f.country).toBe('영국');
  });
});

/* ──────────────────────────────────────────────
   2) buildI18nFromTranslations — 번역 결과 → i18n 변환
   ────────────────────────────────────────────── */
describe('buildI18nFromTranslations — 번역 결과 → story.i18n 구조 변환', () => {
  const sample = {
    en: { title: 'Newton', body: 'Body', country: 'UK', editor_comment: 'C' },
    ja: { title: 'ニュートン', body: '本文' },
    es: {},
    zh: { title: '牛顿' },
  };

  it('내용이 있는 언어만 포함한다 (빈 객체 언어는 제외)', () => {
    const out = buildI18nFromTranslations(sample);
    expect(Object.keys(out).sort()).toEqual(['en', 'ja', 'zh']);
  });

  it('title 을 title·figure_name 양쪽에 채운다 (단건 저장과 동일 규약)', () => {
    const out = buildI18nFromTranslations(sample);
    expect(out.en.title).toBe('Newton');
    expect(out.en.figure_name).toBe('Newton');
  });

  it('비어 있는 필드는 제외한다', () => {
    const out = buildI18nFromTranslations(sample);
    expect(out.ja.country).toBeUndefined();
    expect(out.zh.body).toBeUndefined();
  });

  it('null/비객체 입력에는 빈 객체를 반환한다', () => {
    expect(buildI18nFromTranslations(null)).toEqual({});
    expect(buildI18nFromTranslations({ en: 'not-object' })).toEqual({});
  });
});

/* ──────────────────────────────────────────────
   3) runBatchTranslate — 배치 오케스트레이션
   ────────────────────────────────────────────── */
describe('runBatchTranslate — 배치 오케스트레이션', () => {
  it('모든 글을 번역·저장하고 성공 집계를 반환한다', async () => {
    const saved = [];
    const res = await runBatchTranslate({
      stories: makeStories(3),
      translate: okTranslate,
      save: async (id, data) => { saved.push({ id, data }); },
      concurrency: 2,
    });
    expect(res.success).toBe(3);
    expect(res.failed).toBe(0);
    expect(saved).toHaveLength(3);
    /* 저장 페이로드에 i18n + translation_meta 가 실린다 */
    expect(saved[0].data.i18n.en.title).toBe('t0');
    expect(saved[0].data.translation_meta.model).toBe('gemini-x');
    expect(saved[0].data.translation_meta.translatedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('동시 실행 수가 concurrency 를 넘지 않는다', async () => {
    let active = 0;
    let maxActive = 0;
    const translate = async ({ fields }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return { translations: { en: { title: fields.title } }, model: 'm' };
    };
    await runBatchTranslate({
      stories: makeStories(6), translate, save: async () => {}, concurrency: 2,
    });
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(maxActive).toBeGreaterThan(1); /* 실제로 병렬 처리됨을 확인 */
  });

  it('일부 글이 실패해도 나머지는 계속 처리한다', async () => {
    let call = 0;
    const translate = async ({ fields }) => {
      call += 1;
      if (call === 2) throw new Error('boom');
      return { translations: { en: { title: fields.title } }, model: 'm' };
    };
    const res = await runBatchTranslate({
      stories: makeStories(3), translate, save: async () => {}, concurrency: 1,
    });
    expect(res.success).toBe(2);
    expect(res.failed).toBe(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].id).toBe('s1');
  });

  it('요금 한도(resource-exhausted) 발생 시 즉시 중단하고 남은 글을 처리하지 않는다', async () => {
    const saved = [];
    const translate = async () => {
      const err = new Error('quota');
      err.code = 'functions/resource-exhausted';
      throw err;
    };
    const res = await runBatchTranslate({
      stories: makeStories(5),
      translate,
      save: async (id) => saved.push(id),
      concurrency: 1,
    });
    expect(res.quotaHit).toBe(true);
    expect(saved).toHaveLength(0);
    expect(res.success).toBe(0);
    /* 5건 전부 호출하지 않고 한도 감지 직후 중단 */
    expect(res.failed).toBeLessThan(5);
  });

  it('shouldStop 이 true 가 되면 남은 글을 건너뛰고 stopped 를 반환한다', async () => {
    let processed = 0;
    let stop = false;
    const res = await runBatchTranslate({
      stories: makeStories(5),
      translate: async ({ fields }) => {
        processed += 1;
        if (processed >= 2) stop = true;
        return { translations: { en: { title: fields.title } }, model: 'm' };
      },
      save: async () => {},
      concurrency: 1,
      shouldStop: () => stop,
    });
    expect(res.stopped).toBe(true);
    expect(processed).toBeLessThan(5);
  });

  it('onProgress 로 진행 상황(done/total/success/failed)을 보고한다', async () => {
    const progress = [];
    await runBatchTranslate({
      stories: makeStories(3),
      translate: okTranslate,
      save: async () => {},
      concurrency: 1,
      onProgress: (p) => progress.push({ ...p }),
    });
    expect(progress).toHaveLength(3);
    expect(progress[2]).toMatchObject({ done: 3, total: 3, success: 3 });
  });

  it('번역 결과가 비어 있으면 저장하지 않고 실패로 집계한다', async () => {
    const saved = [];
    const res = await runBatchTranslate({
      stories: makeStories(2),
      translate: async () => ({ translations: {}, model: 'm' }),
      save: async (id) => saved.push(id),
      concurrency: 1,
    });
    expect(saved).toHaveLength(0);
    expect(res.failed).toBe(2);
    expect(res.success).toBe(0);
  });

  it('빈 목록을 받으면 아무 것도 호출하지 않고 0 집계를 반환한다', async () => {
    let calls = 0;
    const res = await runBatchTranslate({
      stories: [],
      translate: async () => { calls += 1; return { translations: {} }; },
      save: async () => { calls += 1; },
      concurrency: 2,
    });
    expect(calls).toBe(0);
    expect(res).toMatchObject({ total: 0, success: 0, failed: 0 });
  });
});
