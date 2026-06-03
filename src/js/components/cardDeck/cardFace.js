/* =====================================================================
   cardFace.js — 카드 앞/뒷면 공통 마크업 빌더 + 공통 인터랙션 (3단계 리팩토링)
   =====================================================================
   editorstory(역사 카드) · mystory(나의 일화) · calendar 팝업이 동일하게 쓰던
   .flip-container / .flipper / .history-card-front / .history-card-back 구조와
   press 피드백·이미지 fade·flip 토글 로직을 한곳으로 모은다.

   순수 모듈: DOM/문자열만 다루며 service·state·router 에 의존하지 않는다.
   페이지별 차이(액션 버튼·메타·back 푸터·empty 추가요소)는 인자로 주입한다.
   ===================================================================== */

import { escapeHtml } from '../../utils/sanitize.js';

/* ── 공통 상수 ── */
export const FALLBACK_IMG = '/assets/editor_profile.png';
/* iOS WKWebView WebP 디코드 실패 시 fallback PNG 로 swap (onerror=null 로 무한루프 차단) */
export const IMG_ONERROR = `this.onerror=null;this.src='${FALLBACK_IMG}';this.classList.add('img-fallback');`;
export const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/* 휠/뷰 토글 아이콘 (달력 ↔ 카드) — 두 페이지 공통 */
export const ICON_CALENDAR = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7v10"/><path d="M6 5v14"/><rect width="12" height="18" x="10" y="3" rx="2"/></svg>`;
export const ICON_CARD = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`;

/* 공유 아이콘 SVG (역사/나의 일화 동일) */
export const SHARE_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
</svg>`;

/* ── 날짜/본문 헬퍼 ── */
export function parseIsoDate(iso) {
  const [yStr, mStr, dStr] = String(iso).split('-');
  const dateObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
  return {
    dateObj,
    year: dateObj.getFullYear(),
    monthIndex: dateObj.getMonth(),
    month: dateObj.getMonth() + 1,
    day: dateObj.getDate(),
  };
}

/* 'JAN 1, 2026' 형식 (빈 카드 날짜 표기) */
export function formatMonthNameDate(iso) {
  const { monthIndex, day, year } = parseIsoDate(iso);
  return `${MONTH_NAMES[monthIndex]} ${day}, ${year}`;
}

/* 본문 문자열 → <p> 단락 (개행 보존, XSS 이스케이프) */
export function bodyToHtml(body) {
  return String(body || '')
    .split(/\n|\\n/)
    .map((p) => (p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br></p>'))
    .join('');
}

/* ── 마크업 빌더 ── */

/* 카드 외피: flip-container > flipper > (front)(back?) */
export function cardShell({ frontHtml, backHtml = '', flipperClass = '' } = {}) {
  return `
    <div class="flip-container">
      <div class="flipper${flipperClass ? ` ${flipperClass}` : ''}">
        ${frontHtml}
        ${backHtml}
      </div>
    </div>
  `;
}

/* 앞면 상단 (연도/날짜 + 액션 + 메타) */
export function cardFrontTop({ yearHtml = '', yearClass = '', dateLabel = '', actionsHtml = '', metaHtml = '' } = {}) {
  return `
          <div class="history-card-top">
            <div class="card-top-left">
              <div class="card-year${yearClass ? ` ${yearClass}` : ''}">${yearHtml}</div>
              <div class="card-date">${dateLabel}</div>
            </div>
            <div class="card-top-right">
              <div class="card-actions">
                ${actionsHtml}
              </div>
              <div class="card-meta">${metaHtml}</div>
            </div>
          </div>`;
}

/* 앞면 이미지 영역 */
export function cardImageWrap({ src, alt = '', title = '' } = {}) {
  return `
          <div class="history-card-image-wrap">
            <img src="${escapeHtml(src || FALLBACK_IMG)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" width="320" height="400" draggable="false" onerror="${IMG_ONERROR}" />
            <div class="card-image-title">${escapeHtml(title)}</div>
          </div>`;
}

/* 앞면 전체 (history-card-front) */
export function cardFront({ topHtml = '', imageHtml = '', extraClass = '' } = {}) {
  return `
        <div class="front history-card-front${extraClass ? ` ${extraClass}` : ''}">
          ${topHtml}
          ${imageHtml}
        </div>`;
}

/* 뒷면 (제목/본문/푸터) */
export function cardBack({ title = '', bodyHtml = '', footerHtml = '' } = {}) {
  return `
        <div class="back history-card-back">
          <div class="back-title">${escapeHtml(title)}</div>
          <hr class="back-divider" />
          <div class="back-body">${bodyHtml}</div>
          <div class="back-footer">
            ${footerHtml}
          </div>
        </div>`;
}

/* 빈 날짜 카드 (기록 없음). extraHtml 로 '쓰기' 버튼 등 주입 */
export function emptyCardFace({ day, title = '', dateStr = '', extraHtml = '', flipperClass = '' } = {}) {
  return cardShell({
    flipperClass,
    frontHtml: `
        <div class="front history-card-front empty-story-card">
          <div class="empty-story-day-circle">${day}</div>
          <div class="empty-story-title">${title}</div>
          <div class="empty-story-date">${dateStr}</div>
          ${extraHtml}
        </div>`,
  });
}

/* 카드 상단 액션 버튼 (공유/보관/수정 등 공통 골격) */
export function cardActionButton({ ariaLabel, svg, extraClass = '', dataId } = {}) {
  const cls = `card-action-btn${extraClass ? ` ${extraClass}` : ''}`;
  const data = dataId != null ? ` data-id="${escapeHtml(String(dataId))}"` : '';
  return `<button class="${cls}"${data} aria-label="${escapeHtml(ariaLabel || '')}">${svg}</button>`;
}

/* ── 공통 인터랙션 ──
   press 꾹누름 피드백 + 이미지 fade-in + flip 토글.
   페이지별 분기는 ignoreSelectors / onBeforeFlip(false 반환 시 flip 취소) / onAfterFlip 으로 주입.
   호출 측에서 flipContainer.dataset.bound 중복 가드를 관리한다. */
export function bindCardBase(flipContainer, { story, ignoreSelectors = [], onBeforeFlip, onAfterFlip, flipDurationMs = 400 } = {}) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return null;

  /* 꾹 누름: 터치 시작 즉시 active, 60ms 후 is-pressing, 떼거나 움직이면 즉시 해제 */
  let pressTimer = null;
  const isIgnoredTarget = (target) => ignoreSelectors.some((sel) => target?.closest?.(sel));
  const startPress = (e) => {
    if (isIgnoredTarget(e.target)) return;
    flipper.classList.add('active');
    pressTimer = setTimeout(() => flipper.classList.add('is-pressing'), 60);
  };
  const endPress = () => {
    clearTimeout(pressTimer);
    flipper.classList.remove('active', 'is-pressing');
  };
  flipper.addEventListener('touchstart', startPress, { passive: true });
  flipper.addEventListener('touchmove', endPress, { passive: true });
  flipper.addEventListener('touchend', endPress, { passive: true });
  flipper.addEventListener('touchcancel', endPress, { passive: true });

  /* 이미지 fade-in */
  flipContainer.querySelectorAll('.history-card-image-wrap img').forEach((img) => {
    img.classList.add('card-img-fade');
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('img-loaded');
    } else {
      img.addEventListener('load', () => img.classList.add('img-loaded'), { once: true });
      img.addEventListener('error', () => img.classList.add('img-loaded'), { once: true });
    }
  });

  /* 카드 클릭 → 플립 (Swiper preventClicks 가 스와이프 직후 click 자동 차단) */
  flipper.addEventListener('click', (e) => {
    if (!story) return;
    if (ignoreSelectors.some((sel) => e.target.closest(sel))) return;
    if (flipper.classList.contains('is-flipping')) return;
    if (typeof onBeforeFlip === 'function' && onBeforeFlip(e) === false) return;
    flipper.classList.add('is-flipping');
    flipper.classList.toggle('flipped');
    if (typeof onAfterFlip === 'function') onAfterFlip(e);
    setTimeout(() => flipper.classList.remove('is-flipping'), flipDurationMs);
  });

  return flipper;
}
