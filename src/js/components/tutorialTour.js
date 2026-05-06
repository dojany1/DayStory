/* =====================================================================
   tutorialTour.js — 포커싱 말풍선 튜토리얼 시스템
   =====================================================================
   UI 요소를 하나씩 포커싱하며 말풍선으로 설명하고,
   이전/다음 버튼으로 유저가 자유롭게 탐색할 수 있는 튜토리얼입니다.
   ===================================================================== */

import { showToast } from './toast.js';

const TOUR_ACTIVE_KEY  = 'daystory:tutorial-tour-active';
const TOUR_STEP_KEY    = 'daystory:tutorial-tour-step';
const TOUR_DONE_KEY    = 'daystory:tutorial-done';
const MAX_TARGET_WAIT  = 20;
const TARGET_POLL_MS   = 100;
const TARGET_PADDING   = 8;

/* ─────────────────────────────────────────────
   스텝 정의
   ───────────────────────────────────────────── */
export const TUTORIAL_TOUR_STEPS = [
  {
    route: '/editorstory',
    selector: '.daily-letter-gate, .flip-container',
    title: '오늘의 카드',
    body: '매일 한 장의 역사 카드가 도착합니다.\n카드를 탭하면 뒷면에서 자세한 이야기를 읽을 수 있어요.',
  },
  {
    route: '/editorstory',
    selector: '#editorstory-calendar .wheel-item.active',
    title: '날짜 이동',
    body: '월과 날짜를 좌우로 움직이면\n다른 날의 카드를 빠르게 찾아볼 수 있습니다.',
  },
  {
    route: '/calendar',
    selector: '.calendar-toggle-btn.active, .calendar-toggle-btn',
    title: '캘린더 전환',
    body: '역사 일화와 나의 일화를 토글로 전환하고,\n날짜를 눌러 해당 날의 카드를 확인하세요.',
  },
  {
    route: '/mystory',
    selector: '.mystory-write-btn, .flip-container',
    title: '나의 일화',
    body: '비어있는 날에는 작성 버튼이 나타나고,\n쓴 날에는 내 카드가 보입니다.\n카드를 탭하면 뒷면을 볼 수 있어요.',
  },
  {
    route: '/bookmarks',
    selector: '#collection-search-input, .profile-collection-search',
    title: '보관함 & 검색',
    body: '카드 앞면의 보관함 버튼으로 저장한 카드를 모아봅니다.\n인물이나 사건 이름으로 검색할 수도 있어요.',
  },
  {
    route: '/profile',
    selector: '.theme-option-group',
    title: '디스플레이',
    body: '라이트, 다크, 시스템 중에서\n원하는 테마를 선택할 수 있습니다.',
  },
  {
    route: '/profile',
    selector: '#setting-notifications',
    title: '알림 설정',
    body: '오늘의 역사 카드 알림과\n나의 일화 작성 알림 시간을 설정합니다.',
  },
  {
    route: '/profile',
    selector: '#setting-tutorial',
    title: '튜토리얼 다시 보기',
    body: '이 안내는 언제든\n여기에서 다시 시작할 수 있습니다.',
  },
];
const STEPS = TUTORIAL_TOUR_STEPS;

let overlay = null;
let pollTimer = null;
let resizeHandler = null;

/* ─────────────────────────────────────────────
   공개 API
   ───────────────────────────────────────────── */

/** 튜토리얼 시작 (설정에서 호출) */
export function startTutorialTour(navigateFn) {
  sessionStorage.setItem(TOUR_ACTIVE_KEY, 'true');
  sessionStorage.setItem(TOUR_STEP_KEY, '0');
  cleanup();
  navigateFn(STEPS[0].route);
}

/** 라우터가 페이지 전환 후 호출 */
export function renderTutorialTourForRoute(path, navigateFn) {
  clearPoll();
  if (!isActive()) return;

  const idx = currentIdx();
  const step = STEPS[idx];
  if (!step) { endTour(); return; }
  if (step.route !== path) { cleanup(); return; }

  /* 페이지 렌더링 완료 대기 후 타겟 탐색 (깜박임 방지) */
  waitForTarget(step, idx, navigateFn, 0);
}

/** 튜토리얼 종료 */
export function endTutorialTour() { endTour(); }

/* ─────────────────────────────────────────────
   상태 관리
   ───────────────────────────────────────────── */

function isActive()   { return sessionStorage.getItem(TOUR_ACTIVE_KEY) === 'true'; }
function currentIdx()  {
  const v = parseInt(sessionStorage.getItem(TOUR_STEP_KEY) || '0', 10);
  return Number.isNaN(v) ? 0 : Math.max(0, Math.min(v, STEPS.length - 1));
}
function setStep(i)   { sessionStorage.setItem(TOUR_STEP_KEY, String(i)); }
function endTour() {
  sessionStorage.removeItem(TOUR_ACTIVE_KEY);
  sessionStorage.removeItem(TOUR_STEP_KEY);
  localStorage.setItem(TOUR_DONE_KEY, 'true');
  cleanup();
}

/* ─────────────────────────────────────────────
   타겟 대기
   ───────────────────────────────────────────── */

function waitForTarget(step, idx, navigateFn, attempt) {
  const target = findTarget(step.selector);
  if (target && isVisible(target)) {
    showStep(step, idx, target, navigateFn);
    return;
  }
  if (attempt >= MAX_TARGET_WAIT) {
    /* 타겟을 찾지 못하면 자동으로 다음 스텝으로 건너뜀 */
    const fallbackTarget = document.querySelector('#page-container .page')
      || document.querySelector('#page-container')
      || document.body;
    showStep(step, idx, fallbackTarget, navigateFn);
    return;
  }
  pollTimer = setTimeout(() => waitForTarget(step, idx, navigateFn, attempt + 1), TARGET_POLL_MS);
}

function findTarget(selector) {
  /* 쉼표로 구분된 여러 셀렉터 중 첫 번째 매칭 */
  const selectors = selector.split(',').map(s => s.trim());
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch { /* 잘못된 셀렉터 무시 */ }
  }
  return null;
}

function isVisible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

/* ─────────────────────────────────────────────
   UI 렌더링
   ───────────────────────────────────────────── */

function showStep(step, idx, target, navigateFn) {
  cleanup();

  /* 타겟 스크롤 */
  target.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'instant' });

  /* 오버레이 */
  overlay = document.createElement('div');
  overlay.className = 'tour-overlay tutorial-tour-layer';
  overlay.setAttribute('aria-hidden', 'false');

  /* 스포트라이트 구멍 */
  const hole = document.createElement('div');
  hole.className = 'tour-hole tutorial-tour-spotlight';
  hole.dataset.targetSelector = step.selector;

  /* 말풍선 */
  const bubble = document.createElement('div');
  bubble.className = 'tour-bubble tutorial-tour-bubble';
  bubble.setAttribute('role', 'dialog');
  bubble.setAttribute('aria-modal', 'true');

  const isFirst = idx === 0;
  const isLast  = idx === STEPS.length - 1;

  bubble.innerHTML = `
    <div class="tour-bubble-progress tutorial-tour-progress">${idx + 1} / ${STEPS.length}</div>
    <div class="tour-bubble-title tutorial-tour-title">${step.title}</div>
    <div class="tour-bubble-body tutorial-tour-body">${step.body.replace(/\n/g, '<br>')}</div>
    <div class="tour-bubble-actions">
      <button type="button" class="tour-btn-prev tutorial-tour-prev" ${isFirst ? 'style="visibility:hidden"' : ''}>이전으로</button>
      <button type="button" class="tour-btn-next tutorial-tour-next">${isLast ? '완료' : '다음'}</button>
    </div>
  `;

  overlay.appendChild(hole);
  overlay.appendChild(bubble);
  document.body.appendChild(overlay);

  /* 포지셔닝 */
  const position = () => positionUI(target, hole, bubble);
  position();

  resizeHandler = position;
  window.addEventListener('resize', resizeHandler, { passive: true });
  window.addEventListener('scroll', resizeHandler, { passive: true, capture: true });

  /* 등장 애니메이션 */
  const activeOverlay = overlay;
  requestAnimationFrame(() => activeOverlay?.classList.add('visible'));

  /* 오버레이 배경 클릭 방지 */
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) e.stopPropagation();
  });
  overlay.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.tour-bubble')) e.preventDefault();
  }, { passive: false });

  /* 이전 버튼 */
  bubble.querySelector('.tour-btn-prev')?.addEventListener('click', () => {
    if (isFirst) return;
    const prevIdx = idx - 1;
    const prevStep = STEPS[prevIdx];
    setStep(prevIdx);
    cleanup();
    if (prevStep.route !== step.route) {
      navigateFn(prevStep.route);
    } else {
      waitForTarget(prevStep, prevIdx, navigateFn, 0);
    }
  });

  /* 다음/완료 버튼 */
  let advanced = false;
  bubble.querySelector('.tour-btn-next')?.addEventListener('click', () => {
    if (advanced) return;
    advanced = true;
    if (isLast) {
      endTour();
      showToast('튜토리얼을 완료했습니다!', 'success');
      return;
    }
    const nextIdx = idx + 1;
    const nextStep = STEPS[nextIdx];
    setStep(nextIdx);
    cleanup();
    if (nextStep.route !== step.route) {
      navigateFn(nextStep.route);
    } else {
      waitForTarget(nextStep, nextIdx, navigateFn, 0);
    }
  });

  /* 다음 버튼에 포커스 */
  requestAnimationFrame(() => {
    bubble.querySelector('.tour-btn-next')?.focus({ preventScroll: true });
  });
}

/* ─────────────────────────────────────────────
   포지셔닝
   ───────────────────────────────────────────── */

function positionUI(target, hole, bubble) {
  const rect = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  /* 스포트라이트 구멍 */
  const hLeft   = Math.max(0, rect.left - TARGET_PADDING);
  const hTop    = Math.max(0, rect.top - TARGET_PADDING);
  const hWidth  = Math.min(vw - hLeft, rect.width + TARGET_PADDING * 2);
  const hHeight = Math.min(vh - hTop, rect.height + TARGET_PADDING * 2);

  hole.style.left   = `${hLeft}px`;
  hole.style.top    = `${hTop}px`;
  hole.style.width  = `${Math.max(40, hWidth)}px`;
  hole.style.height = `${Math.max(32, hHeight)}px`;

  /* 말풍선 위치 계산 — 좁은 모바일에서도 잘리지 않도록 높이를 가용 공간에 맞춤 */
  const bubbleW = Math.min(300, vw - 24);
  const gap = 12;
  const targetBottom = hTop + hHeight;
  const spaceBelow = vh - targetBottom - gap - gap;  /* 아래 여백도 gap 만큼 확보 */
  const spaceAbove = hTop - gap - gap;

  /* 측정 높이 */
  bubble.style.maxHeight = '';
  bubble.style.width = `${bubbleW}px`;
  const measured = bubble.getBoundingClientRect();
  const bNaturalH = measured.height || 160;

  /* 더 큰 공간 쪽에 배치, 그 공간보다 풍선이 크면 max-height로 제한 */
  const placeBelow = spaceBelow >= spaceAbove;
  const availableH = Math.max(120, placeBelow ? spaceBelow : spaceAbove);
  const bH = Math.min(bNaturalH, availableH);
  bubble.style.maxHeight = `${availableH}px`;

  const bTop = placeBelow
    ? Math.min(targetBottom + gap, vh - bH - gap)
    : Math.max(gap, hTop - bH - gap);

  const targetCenter = hLeft + hWidth / 2;
  const bLeft = Math.min(
    Math.max(12, targetCenter - bubbleW / 2),
    vw - bubbleW - 12
  );

  bubble.style.left  = `${bLeft}px`;
  bubble.style.top   = `${bTop}px`;
  bubble.dataset.placement = placeBelow ? 'below' : 'above';

  /* 말풍선 꼬리(arrow) 위치 */
  const arrowLeft = Math.min(Math.max(16, targetCenter - bLeft), bubbleW - 16);
  bubble.style.setProperty('--arrow-left', `${arrowLeft}px`);
}

/* ─────────────────────────────────────────────
   정리
   ───────────────────────────────────────────── */

function cleanup() {
  clearPoll();
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    window.removeEventListener('scroll', resizeHandler, true);
    resizeHandler = null;
  }
  overlay?.remove();
  overlay = null;
}

function clearPoll() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}
