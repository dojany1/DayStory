import { describe, expect, it } from 'vitest';

/* =====================================================================
   functions/lib/og.js — 동적 Open Graph 순수 헬퍼 계약 테스트 (TDD)
   ---------------------------------------------------------------------
   카카오톡/SNS 링크 미리보기를 위해 /share 응답 HTML 에 카드별 OG 메타를
   서버에서 주입한다. 그 조립에 쓰는 순수 함수들의 계약을 고정한다.

     · buildOgTitle(date, title)  — 'DayStory - {날짜} {제목}' 형식
     · detectShareTarget(path, q) — 요청을 date/id/home 으로 분류
     · renderSharePage(...)       — OG 메타 + 스마트 폴백 스크립트 HTML
   ===================================================================== */

import {
  buildOgTitle,
  detectShareTarget,
  renderSharePage,
} from '../functions/lib/og.js';

describe('buildOgTitle — OG 제목 포맷', () => {
  it('날짜+제목을 "DayStory - {YYYY년 M월 D일} {제목}" 으로 만든다', () => {
    expect(buildOgTitle('2026-06-15', '우주로 간 원숭이')).toBe(
      'DayStory - 2026년 6월 15일 우주로 간 원숭이',
    );
  });

  it('제목만 있으면 "DayStory - {제목}"', () => {
    expect(buildOgTitle('', '우주로 간 원숭이')).toBe('DayStory - 우주로 간 원숭이');
    expect(buildOgTitle(null, '우주로 간 원숭이')).toBe('DayStory - 우주로 간 원숭이');
  });

  it('날짜만 있으면 "DayStory - {날짜}"', () => {
    expect(buildOgTitle('2026-06-15', '')).toBe('DayStory - 2026년 6월 15일');
  });

  it('둘 다 없거나 날짜 형식이 틀리면 정보 누락분만 빠진다', () => {
    expect(buildOgTitle('', '')).toBe('DayStory');
    expect(buildOgTitle('2026.06.15', '제목')).toBe('DayStory - 제목');
    expect(buildOgTitle('2026.06.15', '')).toBe('DayStory');
  });
});

describe('detectShareTarget — 요청 분류', () => {
  it('?date= 쿼리는 date 타입', () => {
    expect(detectShareTarget('/share', { date: '2026-06-15' })).toEqual({
      kind: 'date',
      date: '2026-06-15',
    });
  });

  it('잘못된 date 쿼리는 home 으로', () => {
    expect(detectShareTarget('/share', { date: '2026.06.15' })).toEqual({ kind: 'home' });
  });

  it('/share/<id> 경로는 id 타입', () => {
    expect(detectShareTarget('/share/abc123', {})).toEqual({ kind: 'id', id: 'abc123' });
  });

  it('/share/<ISO날짜> 경로는 date 타입으로 본다', () => {
    expect(detectShareTarget('/share/2026-06-15', {})).toEqual({
      kind: 'date',
      date: '2026-06-15',
    });
  });

  it('bare /share 는 home', () => {
    expect(detectShareTarget('/share', {})).toEqual({ kind: 'home' });
    expect(detectShareTarget('/share/', {})).toEqual({ kind: 'home' });
  });

  it('date 쿼리가 경로 id 보다 우선한다', () => {
    expect(detectShareTarget('/share/abc123', { date: '2026-06-15' })).toEqual({
      kind: 'date',
      date: '2026-06-15',
    });
  });
});

describe('renderSharePage — OG 메타 + 스마트 폴백 HTML', () => {
  const html = renderSharePage({
    title: 'DayStory - 2026년 6월 15일 우주로 간 원숭이',
    description: '원숭이가 우주로 간 이야기',
    image: 'https://example.com/card.jpg',
    url: 'https://dokhu-daystory.web.app/share?date=2026-06-15',
  });

  it('카드별 OG 메타(title/image/url)를 포함한다', () => {
    expect(html).toContain('property="og:title" content="DayStory - 2026년 6월 15일 우주로 간 원숭이"');
    expect(html).toContain('property="og:image" content="https://example.com/card.jpg"');
    expect(html).toContain('property="og:url" content="https://dokhu-daystory.web.app/share?date=2026-06-15"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('HTML 특수문자를 이스케이프한다(XSS 방어)', () => {
    const evil = renderSharePage({
      title: '<script>alert(1)</script>',
      description: 'd',
      image: 'https://e.com/i.jpg',
      url: 'https://e.com/share',
    });
    expect(evil).not.toContain('<script>alert(1)</script>');
    expect(evil).toContain('&lt;script&gt;');
  });

  it('인앱 브라우저용 스마트 폴백 스크립트(intent/kakaotalk/커스텀스킴)를 포함한다', () => {
    expect(html).toContain('intent://');
    expect(html).toContain('kakaotalk://web/openExternal');
    expect(html).toContain('daystory://');
  });

  it('description 의 줄바꿈을 공백으로 치환해 meta 태그가 한 줄을 유지한다', () => {
    const multiline = renderSharePage({
      title: 'DayStory - 2026년 6월 15일 국왕의 굴욕',
      description: '1215년 6월 15일\n영국 왕 존이 귀족들과 협약을 맺었다.\n이것이 마그나 카르타다.',
      image: 'https://example.com/card.jpg',
      url: 'https://dokhu-daystory.web.app/share?date=2026-06-15',
    });
    // 줄바꿈이 들어간 meta 태그는 일부 SNS 스크래퍼(iMessage 등)가
    // OG 파싱에 실패해 미리보기 전체가 사라지는 원인이 된다.
    expect(html).not.toMatch(/content="[^"]*\n/);
    expect(multiline).not.toMatch(/content="[^"]*\n/);
    expect(multiline).toContain(
      'property="og:description" content="1215년 6월 15일 영국 왕 존이 귀족들과 협약을 맺었다. 이것이 마그나 카르타다."',
    );
  });
});
