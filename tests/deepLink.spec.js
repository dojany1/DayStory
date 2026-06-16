import { describe, expect, it } from 'vitest';

import {
  SHARE_APP_DOMAIN,
  SHARE_APP_ORIGIN,
  buildShareDeepLink,
  parseShareDeepLink,
} from '../src/js/utils/deepLink.js';

describe('deepLink — 공유 딥링크 빌더', () => {
  it('유효한 ISO 날짜로 /share?date= URL을 만든다', () => {
    expect(buildShareDeepLink('2026-06-12')).toBe(
      `${SHARE_APP_ORIGIN}/share?date=2026-06-12`,
    );
  });

  it('날짜가 없거나 형식이 틀리면 bare /share 로 폴백한다', () => {
    expect(buildShareDeepLink()).toBe(`${SHARE_APP_ORIGIN}/share`);
    expect(buildShareDeepLink('')).toBe(`${SHARE_APP_ORIGIN}/share`);
    expect(buildShareDeepLink('2026/06/12')).toBe(`${SHARE_APP_ORIGIN}/share`);
    expect(buildShareDeepLink('not-a-date')).toBe(`${SHARE_APP_ORIGIN}/share`);
  });
});

describe('deepLink — 공유 딥링크 파서', () => {
  it('?date= 쿼리를 date 타입으로 파싱한다', () => {
    expect(parseShareDeepLink(`https://${SHARE_APP_DOMAIN}/share?date=2026-06-12`)).toEqual({
      type: 'date',
      date: '2026-06-12',
    });
  });

  it('잘못된 형식의 date 는 date 타입으로 보지 않고 home 으로 처리한다', () => {
    expect(parseShareDeepLink(`https://${SHARE_APP_DOMAIN}/share?date=2026.06.12`)).toEqual({
      type: 'home',
    });
  });

  it('/share/<id> 경로는 card 타입으로 파싱한다', () => {
    expect(parseShareDeepLink(`https://${SHARE_APP_DOMAIN}/share/abc123`)).toEqual({
      type: 'card',
      id: 'abc123',
    });
  });

  it('date 쿼리가 /share/<id> 보다 우선한다', () => {
    expect(
      parseShareDeepLink(`https://${SHARE_APP_DOMAIN}/share/abc123?date=2026-06-12`),
    ).toEqual({ type: 'date', date: '2026-06-12' });
  });

  it('bare /share 는 home 타입으로 파싱한다 (트레일링 슬래시 포함)', () => {
    expect(parseShareDeepLink(`https://${SHARE_APP_DOMAIN}/share`)).toEqual({ type: 'home' });
    expect(parseShareDeepLink(`https://${SHARE_APP_DOMAIN}/share/`)).toEqual({ type: 'home' });
  });

  it('도메인이 다르거나 /share 경로가 아니면 null 을 반환한다', () => {
    expect(parseShareDeepLink('https://example.com/share?date=2026-06-12')).toBeNull();
    expect(parseShareDeepLink(`https://${SHARE_APP_DOMAIN}/editorstory`)).toBeNull();
    expect(parseShareDeepLink(`https://${SHARE_APP_DOMAIN}/shared/abc`)).toBeNull();
  });

  it('share 가 아닌 위젯 커스텀 스킴(daystory://letter 등)·잘못된 입력은 null 을 반환한다', () => {
    expect(parseShareDeepLink('daystory://letter')).toBeNull();
    expect(parseShareDeepLink('daystory://diary/new')).toBeNull();
    expect(parseShareDeepLink('')).toBeNull();
    expect(parseShareDeepLink(null)).toBeNull();
    expect(parseShareDeepLink('not a url')).toBeNull();
  });
});

describe('deepLink — 커스텀 스킴(daystory://share) 파서 (카카오톡 인앱→앱 직접 실행)', () => {
  it('daystory://share?date= 를 date 타입으로 파싱한다', () => {
    expect(parseShareDeepLink('daystory://share?date=2026-06-15')).toEqual({
      type: 'date',
      date: '2026-06-15',
    });
  });

  it('daystory://share/<id> 를 card 타입으로 파싱한다', () => {
    expect(parseShareDeepLink('daystory://share/abc123')).toEqual({
      type: 'card',
      id: 'abc123',
    });
  });

  it('daystory://share (bare) 는 home 타입으로 파싱한다', () => {
    expect(parseShareDeepLink('daystory://share')).toEqual({ type: 'home' });
    expect(parseShareDeepLink('daystory://share/')).toEqual({ type: 'home' });
  });

  it('커스텀 스킴에서도 date 쿼리가 /share/<id> 보다 우선한다', () => {
    expect(parseShareDeepLink('daystory://share/abc123?date=2026-06-15')).toEqual({
      type: 'date',
      date: '2026-06-15',
    });
  });

  it('커스텀 스킴의 잘못된 date 는 home 으로 처리한다', () => {
    expect(parseShareDeepLink('daystory://share?date=2026.06.15')).toEqual({ type: 'home' });
  });
});
