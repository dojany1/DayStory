// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { showIntroSheet } from '../src/js/components/introSheet.js';
import { showCardFlipCoach } from '../src/js/components/coachMark.js';
import { refreshWelcomeBadge, dismissWelcomeBadge } from '../src/js/components/navBadge.js';
import {
  ONBOARDING_FLAGS,
  hasSeen,
  markSeen,
  resetOnboarding,
  _resetMemoryCache,
} from '../src/js/services/onboarding.js';

describe('introSheet — 탭 진입 인트로 바텀시트', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetMemoryCache();
    document.body.innerHTML = '<div class="mobile-wrapper"></div>';
  });
  afterEach(() => {
    document.querySelectorAll('.intro-sheet-overlay').forEach((el) => el.remove());
    localStorage.clear();
    _resetMemoryCache();
  });

  it('제목/본문/CTA 를 렌더하고 .mobile-wrapper 에 마운트한다', () => {
    showIntroSheet({
      flag: ONBOARDING_FLAGS.INTRO_EDITOR,
      title: '오늘, 역사 속에서',
      lines: ['첫 줄', '둘째 줄'],
    });
    const overlay = document.querySelector('.mobile-wrapper .intro-sheet-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.intro-sheet-title').textContent).toBe('오늘, 역사 속에서');
    expect(overlay.querySelectorAll('.intro-sheet-line').length).toBe(2);
    expect(overlay.querySelector('.intro-sheet-cta')).not.toBeNull();
  });

  it('이미 떠 있으면 중복 마운트하지 않는다 (탭 연타 방어)', () => {
    showIntroSheet({ flag: ONBOARDING_FLAGS.INTRO_EDITOR, title: 'A' });
    const second = showIntroSheet({ flag: ONBOARDING_FLAGS.INTRO_EDITOR, title: 'B' });
    expect(second).toBeNull();
    expect(document.querySelectorAll('.intro-sheet-overlay').length).toBe(1);
  });

  it('CTA 클릭 시 markSeen 되어 다시 노출되지 않도록 기록된다', () => {
    showIntroSheet({ flag: ONBOARDING_FLAGS.INTRO_MYSTORY, title: 'A' });
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_MYSTORY)).toBe(false);
    document.querySelector('.intro-sheet-cta').click();
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_MYSTORY)).toBe(true);
  });

  it('backdrop(오버레이 자기 자신) 클릭으로 닫힌다 (visible 해제 + markSeen)', () => {
    showIntroSheet({ flag: ONBOARDING_FLAGS.INTRO_EDITOR, title: 'A' });
    const overlay = document.querySelector('.intro-sheet-overlay');
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true })); /* target === overlay → close() */
    expect(overlay.classList.contains('visible')).toBe(false);
    expect(hasSeen(ONBOARDING_FLAGS.INTRO_EDITOR)).toBe(true);
  });
});

describe('coachMark — 카드 뒤집기 Pulse/툴팁', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetMemoryCache();
    document.body.innerHTML = '<div id="card-area"></div>';
  });
  afterEach(() => {
    localStorage.clear();
    _resetMemoryCache();
  });

  it('컨테이너에 Pulse+툴팁을 붙이고 pointer-events:none 으로 카드 탭을 가로채지 않는다', () => {
    const container = document.getElementById('card-area');
    showCardFlipCoach({ container, flag: ONBOARDING_FLAGS.TIP_CARD_FLIP, text: '탭해서 뒤집어보세요' });
    const mark = container.querySelector('.coach-mark');
    expect(mark).not.toBeNull();
    expect(mark.querySelector('.coach-pulse')).not.toBeNull();
    expect(mark.querySelector('.coach-tooltip').textContent).toBe('탭해서 뒤집어보세요');
    /* 인라인이 아닌 CSS 규칙으로 pointer-events:none 을 보장하지만,
       장식 마크에 aria-hidden 이 설정돼 접근성 트리에서 빠지는지 확인 */
    expect(mark.getAttribute('aria-hidden')).toBe('true');
  });

  it('ds:card-flipped 이벤트로 영구 소멸하고 markSeen 된다', () => {
    const container = document.getElementById('card-area');
    showCardFlipCoach({ container, flag: ONBOARDING_FLAGS.TIP_CARD_FLIP, text: 'x' });
    expect(hasSeen(ONBOARDING_FLAGS.TIP_CARD_FLIP)).toBe(false);
    document.dispatchEvent(new CustomEvent('ds:card-flipped'));
    expect(hasSeen(ONBOARDING_FLAGS.TIP_CARD_FLIP)).toBe(true);
  });

  it('중복 호출 시 코치마크를 두 개 만들지 않는다', () => {
    const container = document.getElementById('card-area');
    showCardFlipCoach({ container, flag: ONBOARDING_FLAGS.TIP_CARD_FLIP, text: 'x' });
    showCardFlipCoach({ container, flag: ONBOARDING_FLAGS.TIP_CARD_FLIP, text: 'y' });
    expect(container.querySelectorAll('.coach-mark').length).toBe(1);
  });
});

describe('navBadge — 프로필 탭 웰컴 배지', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetMemoryCache();
    document.body.innerHTML = '<button id="nav-profile" class="nav-item"></button>';
  });
  afterEach(() => {
    localStorage.clear();
    _resetMemoryCache();
  });

  it('배지 대기 상태면 프로필 탭에 N 배지를 띄운다', () => {
    markSeen(ONBOARDING_FLAGS.WELCOME_BADGE);
    refreshWelcomeBadge();
    const badge = document.querySelector('#nav-profile .nav-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('N');
  });

  it('대기 상태가 아니면 배지를 만들지 않는다', () => {
    refreshWelcomeBadge();
    expect(document.querySelector('#nav-profile .nav-badge')).toBeNull();
  });

  it('refreshWelcomeBadge 는 멱등하다 (배지 1개 유지)', () => {
    markSeen(ONBOARDING_FLAGS.WELCOME_BADGE);
    refreshWelcomeBadge();
    refreshWelcomeBadge();
    expect(document.querySelectorAll('#nav-profile .nav-badge').length).toBe(1);
  });

  it('dismissWelcomeBadge 가 배지를 제거하고 상태를 해제한다', () => {
    markSeen(ONBOARDING_FLAGS.WELCOME_BADGE);
    refreshWelcomeBadge();
    dismissWelcomeBadge();
    expect(document.querySelector('#nav-profile .nav-badge')).toBeNull();
    expect(hasSeen(ONBOARDING_FLAGS.WELCOME_BADGE)).toBe(false);
  });
});
