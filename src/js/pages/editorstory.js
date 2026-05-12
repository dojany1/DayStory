/* =====================================================================
   editorstory.js — 에디터 일화 페이지 (메인 화면)
   =====================================================================
   상단 월/일 휠로 날짜를 선택해 해당 날짜의 카드를 표시합니다.
   - 첫 진입 시 카드가 위에서 슬라이딩하며 등장
   - 오늘 카드를 처음 클릭(=뒤집기) 하면 자동으로 "수집"되며 축하 애니메이션 재생
   - 좌우 스와이프로 날짜 이동은 비활성 (휠로만 변경)

     마지막 수정 날짜 : 2026-05-11 01:30
   ===================================================================== */

import { fetchStories, fetchTodayStory } from '../services/stories.js';
import { toggleBookmark, getBookmarkedStoryIds } from '../services/bookmarks.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/sanitize.js';
import { shareStory } from '../services/sharing.js';
import { getState } from '../state.js';
import { navigate } from '../router.js';
import { markLetterRead } from '../services/widget.js';
import { CARD_PLACEHOLDER_IMAGE, getStoryImageSources, preloadStoryImages } from '../utils/imageLoading.js';
import { localizedStory } from '../utils/storyI18n.js';
import { t } from '../i18n/index.js';
import { collect, isCollected, canCollect, bulkCollect } from '../services/collection.js';

const FLIP_DURATION_MS = 400;


/* ─────────────────────────────────────────────
   섹션 1: 페이지 렌더링
   ───────────────────────────────────────────── */

export function renderEditorStory() {
  const page = document.createElement('div');
  page.className = 'editorstory-page page';

  page.innerHTML = `
    <div class="editorstory-header">
      <h1 class="editorstory-title"></h1>
    </div>

    <div class="wheel-pickers-container" style="margin-top: 10px;">
      <div class="wheel-picker-wrapper">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="editorstory-month-scroll"></div>
      </div>
      <div class="wheel-picker-wrapper">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="editorstory-calendar"></div>
      </div>
    </div>

    <div class="editorstory-card-area" id="editorstory-card-area">
      <div style="display:flex;justify-content:center;padding:var(--space-8);width:100%;">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;

  loadEditorStoryData(page);
  return page;
}


/* ─────────────────────────────────────────────
   섹션 2: 데이터 로딩 + 휠 초기화
   ───────────────────────────────────────────── */

async function loadEditorStoryData(page) {
  try {
    const [allStories, todayStory, bookmarkedIds] = await Promise.all([
      fetchStories(),
      fetchTodayStory(),
      getBookmarkedStoryIds(),
    ]);

    const today = new Date(todayStory.publish_date + 'T00:00:00');
    const historyStories = allStories || [];
    preloadStoryImages([todayStory, ...historyStories], { limit: 8, variant: 'thumb', fallback: false });

    bulkCollect([todayStory, ...historyStories].map((s) => s?.id).filter(Boolean));

    const monthEl = page.querySelector('#editorstory-month-scroll');
    const dayEl = page.querySelector('#editorstory-calendar');
    const cardArea = page.querySelector('#editorstory-card-area');

    /* 월(1~12) / 일(1~31) 휠 렌더링 */
    if (monthEl) {
      monthEl.innerHTML = Array.from({ length: 12 }, (_, i) =>
        `<div class="wheel-item" data-month="${i + 1}">${i + 1}</div>`
      ).join('');
    }
    if (dayEl) {
      dayEl.innerHTML = Array.from({ length: 31 }, (_, i) =>
        `<div class="wheel-item" data-day="${i + 1}">${i + 1}</div>`
      ).join('');
    }

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    let latestDate = today;
    let isInitial = true;  /* 첫 렌더 — 슬라이드다운 애니메이션 적용 */

    function applyDisabledState() {
      monthEl.querySelectorAll('.wheel-item').forEach((el) => {
        const m = parseInt(el.dataset.month, 10);
        el.classList.toggle('disabled', m > currentMonth);
      });
      const activeMonthEl = monthEl.querySelector('.wheel-item.active') || getCenterItem(monthEl);
      if (!activeMonthEl) return;
      const selectedMonth = parseInt(activeMonthEl.dataset.month, 10);
      const daysInMonth = new Date(currentYear, selectedMonth, 0).getDate();

      dayEl.querySelectorAll('.wheel-item').forEach((el) => {
        const d = parseInt(el.dataset.day, 10);
        let disabled = false;
        if (selectedMonth > currentMonth) disabled = true;
        else if (d > daysInMonth) disabled = true;
        else if (selectedMonth === currentMonth && d > currentDay) disabled = true;
        el.classList.toggle('disabled', disabled);
      });
    }

    function getCenterItem(scrollArea) {
      const boxCenter = scrollArea.getBoundingClientRect().left + scrollArea.offsetWidth / 2;
      let closest = null;
      let minDist = Infinity;
      scrollArea.querySelectorAll('.wheel-item:not(.disabled)').forEach((el) => {
        const c = el.getBoundingClientRect().left + el.offsetWidth / 2;
        const d = Math.abs(boxCenter - c);
        if (d < minDist) { minDist = d; closest = el; }
      });
      return closest;
    }

    function updateSelection(forceInstant = false) {
      applyDisabledState();
      let activeMonth, activeDay;
      if (forceInstant) {
        activeMonth = monthEl.querySelector('.wheel-item.active');
        activeDay = dayEl.querySelector('.wheel-item.active');
      } else {
        activeMonth = getCenterItem(monthEl);
        activeDay = getCenterItem(dayEl);
        if (activeMonth) {
          monthEl.querySelectorAll('.wheel-item').forEach((el) => el.classList.remove('active'));
          activeMonth.classList.add('active');
        }
        if (activeDay) {
          dayEl.querySelectorAll('.wheel-item').forEach((el) => el.classList.remove('active'));
          activeDay.classList.add('active');
        }
      }
      if (!activeMonth || !activeDay) return;

      const mNum = String(activeMonth.dataset.month).padStart(2, '0');
      const dNum = String(activeDay.dataset.day).padStart(2, '0');
      const isoDate = `${currentYear}-${mNum}-${dNum}`;
      const newDate = new Date(isoDate + 'T00:00:00');

      /* 같은 날짜면 재렌더 안 함 */
      if (latestDate && latestDate.getTime() === newDate.getTime() && !isInitial) return;

      /* 존재하지 않는 날짜(예: 2월 30일) 무시 */
      if (String(newDate.getMonth() + 1).padStart(2, '0') !== mNum) return;

      latestDate = newDate;
      const story = historyStories.find((s) => s.publish_date === isoDate)
        || (todayStory.publish_date === isoDate ? todayStory : null);
      preloadStoryImages([story], { limit: 1, variant: 'thumb', fallback: false });
      renderCard(cardArea, story, newDate, bookmarkedIds, isInitial);
      isInitial = false;
    }

    /* 스크롤 디바운스 */
    let scrollTimeout;
    const onScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => updateSelection(false), 150);
    };
    monthEl.addEventListener('scroll', onScrollEnd, { passive: true });
    dayEl.addEventListener('scroll', onScrollEnd, { passive: true });

    /* 휠 아이템 클릭 */
    const onItemClick = (container, item) => {
      if (item.classList.contains('disabled')) return;
      container.querySelectorAll('.wheel-item').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
      clearTimeout(scrollTimeout);
      updateSelection(true);
      const target = item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
      container.scrollTo({ left: target, behavior: 'smooth' });
    };
    monthEl.querySelectorAll('.wheel-item').forEach((item) =>
      item.addEventListener('click', () => onItemClick(monthEl, item))
    );
    dayEl.querySelectorAll('.wheel-item').forEach((item) =>
      item.addEventListener('click', () => onItemClick(dayEl, item))
    );

    /* 초기 위치: 오늘 날짜 */
    setTimeout(() => {
      const targetMonth = monthEl.querySelector(`.wheel-item[data-month="${currentMonth}"]`);
      const targetDay = dayEl.querySelector(`.wheel-item[data-day="${currentDay}"]`);
      if (targetMonth) {
        monthEl.scrollLeft = targetMonth.offsetLeft - monthEl.offsetWidth / 2 + targetMonth.offsetWidth / 2;
        targetMonth.classList.add('active');
      }
      if (targetDay) {
        dayEl.scrollLeft = targetDay.offsetLeft - dayEl.offsetWidth / 2 + targetDay.offsetWidth / 2;
        targetDay.classList.add('active');
      }
      void markLetterRead();
      updateSelection(true);
    }, 0);

  } catch (err) {
    console.error('에디터 일화 데이터 로딩 실패:', err);
    page.innerHTML = `
      <div class="editorstory-header"><h1 class="editorstory-title">Day Story</h1></div>
      <div class="empty-state">
        <div class="empty-state-title">${t('common.load_failed_title')}</div>
        <div class="empty-state-desc" style="color:var(--danger-color);margin-bottom:var(--space-2)">
          ${escapeHtml(err.message || t('common.unknown_error'))}
        </div>
        <div class="empty-state-desc">${t('common.load_failed_desc')}</div>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top:var(--space-4)">
          ${t('common.refresh')}
        </button>
      </div>
    `;
  }
}


/* ─────────────────────────────────────────────
   섹션 3: 카드 렌더링
   ───────────────────────────────────────────── */

function renderCard(cardArea, story, dateObj, bookmarkedIds, useSlideIn) {
  if (!cardArea) return;

  /* 현재 언어로 변환 */
  story = story ? localizedStory(story) : null;

  const pubDate = story ? new Date(story.publish_date + 'T00:00:00') : dateObj;
  const month = pubDate.getMonth() + 1;
  const day = pubDate.getDate();
  const displayYear = dateObj.getFullYear();

  const newCard = document.createElement('div');
  newCard.className = 'flip-container' + (useSlideIn ? ' card-slide-in' : '');

  if (!story) {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const formattedDate = `${monthNames[pubDate.getMonth()]} ${day}, ${displayYear}`;
    newCard.innerHTML = `
      <div class="flipper">
        <div class="front history-card-front empty-story-card">
          <div class="empty-story-day-circle">${day}</div>
          <div class="empty-story-title">${t('home.empty_card_title')}</div>
          <div class="empty-story-date">${formattedDate}</div>
        </div>
      </div>
    `;
  } else {
    const imageSources = getStoryImageSources(story, 'thumb');
    const imageUrl = imageSources.primary;
    const fallbackAttr = imageSources.fallback
      ? ` data-fallback-src="${escapeHtml(imageSources.fallback)}"`
      : '';
    const imageAttrs = imageUrl
      ? `src="${escapeHtml(imageUrl)}"${fallbackAttr}`
      : `src="${escapeHtml(CARD_PLACEHOLDER_IMAGE)}"`;

    newCard.innerHTML = `
      <div class="flipper">
        <div class="front history-card-front">
          <div class="history-card-top">
            <div class="card-top-left">
              <div class="card-year">${escapeHtml(story.historical_year)}</div>
              <div class="card-date">${month}. ${day}</div>
            </div>
            <div class="card-top-right">
              <div class="card-actions">
                <button class="card-action-btn" aria-label="공유">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
                <button class="card-action-btn" aria-label="보관함">
                  <svg viewBox="0 0 24 24" fill="${story && bookmarkedIds.includes(story.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
              </div>
              <div class="card-meta">
                ${escapeHtml(story.card_count || '')} ${escapeHtml(story.country)}<br>
                ${displayYear} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}
              </div>
            </div>
          </div>
          <div class="history-card-image-wrap">
            <img ${imageAttrs} alt="${escapeHtml(story.figure_name)}" loading="eager" decoding="async" width="320" height="400" draggable="false" onerror="if(this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;delete this.dataset.fallbackSrc}else{this.src='${CARD_PLACEHOLDER_IMAGE}'}" />
            <div class="card-image-title">${escapeHtml(story.figure_name)}</div>
          </div>
        </div>
        <div class="back history-card-back">
          <div class="back-title">${escapeHtml(story.figure_name)}</div>
          <hr class="back-divider" />
          <div class="back-body">
            ${(story.body || '').split(/\n|\\n/).map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br></p>').join('')}
          </div>
          <div class="back-footer">
            <button class="back-editor-btn" type="button" title="에디터 한마디" data-story-id="${escapeHtml(story.id)}" data-comment="${escapeHtml(story.editor_comment || '')}" data-editor-name="${escapeHtml((story.editor && story.editor.displayName) || 'DayStory')}" style="${story.editor_comment && story.editor_comment.trim() !== '' ? '' : 'visibility: hidden; pointer-events: none;'}">
              ${story.editor && story.editor.photoURL
                ? `<img src="${escapeHtml(story.editor.photoURL)}" alt="editor" class="back-editor-avatar" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="back-editor-avatar-fallback" style="display:none">✍️</span>`
                : '<span class="back-editor-avatar-fallback">✍️</span>'}
            </button>
            <div class="back-date-actions">
              <div class="back-date">${escapeHtml(story.historical_year)}년 ${month}월 ${day}일</div>
              <button class="card-detail-shortcut-btn" type="button" aria-label="${t('home.detail_button')}" title="${t('home.detail_button')}">${t('home.detail_button')}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  cardArea.innerHTML = '';
  cardArea.appendChild(newCard);
  bindCardEvents(newCard, story, bookmarkedIds);
}


/* ─────────────────────────────────────────────
   섹션 4: 카드 이벤트 (플립 + 자동 수집 + 액션)
   ───────────────────────────────────────────── */

function bindCardEvents(flipContainer, story, bookmarkedIds) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  const detailBtn = flipContainer.querySelector('.card-detail-shortcut-btn');
  const shareBtn = flipContainer.querySelector('.card-action-btn[aria-label="공유"]');
  const bookmarkBtn = flipContainer.querySelector('.card-action-btn[aria-label="보관함"]');

  if (detailBtn && story) {
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate(`/detail/${story.id}`);
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const user = getState('user');
      if (user && user.id === 'guest') {
        showToast(t('toast.login_required'), 'info');
        navigate('/login');
        return;
      }
      await shareStory(story, { kind: 'history' });
    });
  }

  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const user = getState('user');
      if (user && user.id === 'guest') {
        showToast(t('toast.login_required'), 'info');
        navigate('/login');
        return;
      }
      const res = await toggleBookmark(story.id);
      if (res.error) {
        showToast(res.error, 'error');
        return;
      }
      showToast(res.bookmarked ? t('toast.bookmark_added') : t('toast.bookmark_removed'), 'success');
      bookmarkBtn.querySelector('svg').style.fill = res.bookmarked ? 'currentColor' : 'none';
      if (res.bookmarked && !bookmarkedIds.includes(story.id)) {
        bookmarkedIds.push(story.id);
      } else if (!res.bookmarked) {
        const idx = bookmarkedIds.indexOf(story.id);
        if (idx > -1) bookmarkedIds.splice(idx, 1);
      }
    });
  }

  /* 카드 클릭 → 자동 수집 (오늘 카드 + 미수집 시) + 플립 */
  flipper.addEventListener('click', (e) => {
    if (!story) return;
    if (e.target.closest('.card-action-btn')) return;
    if (e.target.closest('.back-editor-btn')) return;
    if (e.target.closest('.card-detail-shortcut-btn')) return;
    if (flipper.classList.contains('is-flipping')) return;

    /* 말풍선이 떠 있으면 그것만 닫음 */
    const openBubble = flipContainer.querySelector('.editor-comment-bubble');
    if (openBubble && !openBubble.contains(e.target)) {
      openBubble.remove();
      return;
    }

    /* 자동 수집:
       - 오늘 카드 + 미수집 → 토스트로 안내
       - 풀액세스(어드민/구독자)가 지난 카드를 클릭 → 무음으로 영구 수집 (해지 후에도 보관) */
    if (story.id && story.publish_date && !isCollected(story.id)) {
      if (canCollect(story.publish_date)) {
        const result = collect(story.id, story.publish_date);
        if (result.ok && !result.alreadyCollected) {
          showToast(t('calendar.collect_success_text'), 'success');
        }
      } else {
        collect(story.id, story.publish_date, { bypass: true });
      }
    }

    flipper.classList.add('is-flipping');
    flipper.classList.toggle('flipped');
    document.dispatchEvent(new CustomEvent('ds:card-flipped'));
    setTimeout(() => flipper.classList.remove('is-flipping'), FLIP_DURATION_MS);
  });

  /* 에디터 한마디 말풍선 */
  const editorBtn = flipContainer.querySelector('.back-editor-btn');
  if (editorBtn) {
    let editorBubbleTimer = null;
    let removeOutsideBubbleListeners = null;

    const removeEditorBubble = () => {
      const bubble = flipContainer.querySelector('.editor-comment-bubble');
      if (bubble) bubble.remove();
      if (editorBubbleTimer) clearTimeout(editorBubbleTimer);
      editorBubbleTimer = null;
      if (removeOutsideBubbleListeners) {
        removeOutsideBubbleListeners();
        removeOutsideBubbleListeners = null;
      }
    };

    const bindOutsideBubbleDismiss = () => {
      if (removeOutsideBubbleListeners) removeOutsideBubbleListeners();
      const handleOutsideBubbleInput = (event) => {
        const bubble = flipContainer.querySelector('.editor-comment-bubble');
        if (!bubble) {
          if (removeOutsideBubbleListeners) {
            removeOutsideBubbleListeners();
            removeOutsideBubbleListeners = null;
          }
          return;
        }
        const target = event.target;
        if (editorBtn.contains(target) || bubble.contains(target)) return;
        removeEditorBubble();
      };
      document.addEventListener('click', handleOutsideBubbleInput);
      document.addEventListener('touchstart', handleOutsideBubbleInput, { passive: true });
      removeOutsideBubbleListeners = () => {
        document.removeEventListener('click', handleOutsideBubbleInput);
        document.removeEventListener('touchstart', handleOutsideBubbleInput);
      };
    };

    const showBubble = (e) => {
      if (e) e.stopPropagation();
      const existing = flipContainer.querySelector('.editor-comment-bubble');
      if (existing) {
        removeEditorBubble();
        return;
      }
      const comment = editorBtn.dataset.comment;
      const editorName = editorBtn.dataset.editorName || 'DayStory';
      if (!comment) return;
      const bubble = document.createElement('div');
      bubble.className = 'editor-comment-bubble';
      const nameEl = document.createElement('span');
      nameEl.className = 'editor-comment-name';
      nameEl.textContent = editorName;
      bubble.appendChild(nameEl);
      bubble.appendChild(document.createTextNode(comment));
      editorBtn.parentElement.appendChild(bubble);
      bindOutsideBubbleDismiss();
      editorBubbleTimer = setTimeout(removeEditorBubble, 4000);
    };

    editorBtn.addEventListener('click', showBubble);
  }
}
