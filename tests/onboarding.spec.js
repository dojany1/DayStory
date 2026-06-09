// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ONBOARDING_FLAGS,
  hasSeen,
  markSeen,
  clearFlag,
  resetOnboarding,
  _resetMemoryCache,
} from '../src/js/services/onboarding.js';

const LS_KEY = 'ds_onboarding';

describe('onboarding 상태 매니저 — 튜토리얼 플래그 관리', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetMemoryCache(); /* 인메모리 미러도 리셋해 localStorage 재하이드레이트 */
  });

  afterEach(() => {
    localStorage.clear();
    _resetMemoryCache();
  });

  it('신규 사용자는 모든 플래그가 미확인(false)이다', () => {
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_EDITOR)).toBe(false);
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_MYSTORY)).toBe(false);
    expect(hasSeen(ONBOARDING_FLAGS.TIP_CARD_FLIP)).toBe(false);
  });

  it('markSeen 후 hasSeen 이 true 가 되고 localStorage 단일 객체에 누적된다', () => {
    markSeen(ONBOARDING_FLAGS.INTRO_EDITOR);
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_EDITOR)).toBe(true);

    markSeen(ONBOARDING_FLAGS.TIP_CARD_FLIP);
    const stored = JSON.parse(localStorage.getItem(LS_KEY));
    expect(stored).toEqual({ introEditor: true, tipCardFlip: true });
  });

  it('탭별 플래그가 서로 독립적으로 관리된다', () => {
    markSeen(ONBOARDING_FLAGS.INTRO_EDITOR);
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_EDITOR)).toBe(true);
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_MYSTORY)).toBe(false);
  });

  it('markSeen 은 멱등하다 (중복 호출해도 한 번만 기록)', () => {
    markSeen(ONBOARDING_FLAGS.INTRO_EDITOR);
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    markSeen(ONBOARDING_FLAGS.INTRO_EDITOR); /* 이미 true → 쓰기 스킵 */
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });

  it('clearFlag 로 배지 대기 상태를 해제할 수 있다', () => {
    markSeen(ONBOARDING_FLAGS.WELCOME_BADGE);
    expect(hasSeen(ONBOARDING_FLAGS.WELCOME_BADGE)).toBe(true);
    clearFlag(ONBOARDING_FLAGS.WELCOME_BADGE);
    expect(hasSeen(ONBOARDING_FLAGS.WELCOME_BADGE)).toBe(false);
    expect(LS_KEY in localStorage ? JSON.parse(localStorage.getItem(LS_KEY)) : {}).not.toHaveProperty('welcomeBadgePending');
  });

  it('resetOnboarding 이 모든 플래그를 초기화한다', () => {
    markSeen(ONBOARDING_FLAGS.INTRO_EDITOR);
    markSeen(ONBOARDING_FLAGS.INTRO_MYSTORY);
    resetOnboarding();
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_EDITOR)).toBe(false);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('손상된 JSON 이 저장돼 있어도 throw 없이 빈 상태로 폴백한다', () => {
    localStorage.setItem(LS_KEY, '{broken json');
    _resetMemoryCache();
    expect(() => hasSeen(ONBOARDING_FLAGS.INTRO_EDITOR)).not.toThrow();
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_EDITOR)).toBe(false);
  });

  it('localStorage 차단(setItem throw) 환경에서도 인메모리 미러로 세션 내 일관성을 유지한다', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded / blocked');
    });
    expect(() => markSeen(ONBOARDING_FLAGS.INTRO_EDITOR)).not.toThrow();
    /* localStorage 쓰기는 실패했지만 인메모리로 같은 세션에서 true 유지 → 모달 도배 방지 */
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_EDITOR)).toBe(true);
    setSpy.mockRestore();
  });
});
