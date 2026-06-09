/* =====================================================================
   editor.js — 에디터 (콘텐츠 관리) 페이지
   =====================================================================
   에디터 권한을 가진 관리자가 역사 일화를 작성/편집/삭제하는 페이지입니다.
   
   기능:
     - 전체/발행됨/초안/예약 필터링
     - 새 일화 작성 (전체 화면 탭: renderEditorNew)
     - 기존 일화 편집/삭제
     - 발행, 초안 저장, 예약 발행
   
   권한:
     profiles 테이블의 role이 'editor'인 유저만 접근 가능합니다.
   ===================================================================== */

import { navigate, pushBeforeNavigate, setOnUnmount } from '../router.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/confirmDialog.js';
import { getState, setState } from '../state.js';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import {
  fetchAllStoriesEditor,
  createStory,
  updateStory,
  fetchStoryById,
  deleteStory,
} from '../services/stories.js';
import { uploadImage } from '../services/images.js';
import { pickFromCamera, pickFromGallery, CameraPermissionError } from '../services/camera.js';
import { translateContentApi } from '../services/translate.js';
import { auth } from '../services/firebase.js';
import { isFirebaseStorageUrl } from '../utils/storage.js';
import { getLocalToday } from '../utils/date.js';
import { EDITOR_DISPLAY_NAME } from '../utils/constants.js';
import { t, tList } from '../i18n/index.js';

import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

const CARD_IMAGE_CROP_ASPECT_RATIO = 4 / 5;

/* ─────────────────────────────────────────────
   다국어 번역 현황 (캘린더 날짜 색상 / 필터용 순수 함수)
   데이터 모델: 한국어는 story 최상위, en/ja/es/zh 는 story.i18n[lang]
   ───────────────────────────────────────────── */

/**
 * getTranslationStatus — 스토리의 5개 국어 번역 채움 여부를 판정한다.
 * title(또는 figure_name) 혹은 body 가 있으면 "채워짐"으로 본다.
 * @param {Object} story
 * @returns {{ko:boolean, en:boolean, ja:boolean, es:boolean, zh:boolean}}
 */
export function getTranslationStatus(story) {
  const has = (o) => !!(o && ((o.title || o.figure_name) || o.body));
  const i18n = (story && story.i18n) || {};
  return {
    ko: has(story),
    en: has(i18n.en),
    ja: has(i18n.ja),
    es: has(i18n.es),
    zh: has(i18n.zh),
  };
}

/**
 * isStoryUntranslated — en/ja/es/zh 중 하나라도 비어 있으면 true ("미번역" 필터용).
 * @param {Object} story
 * @returns {boolean}
 */
export function isStoryUntranslated(story) {
  const s = getTranslationStatus(story);
  return !(s.en && s.ja && s.es && s.zh);
}

/**
 * getEditorBucket — 콘텐츠 관리 목록 분류(발행/예약/초안/보관).
 * status 가 아니라 "지금 유저에게 노출 중인가"를 기준으로 발행/예약을 나눈다.
 * 유저 앱은 status==='published' && publish_date<=오늘 인 글만 노출하므로
 * (stories.js fetchStories), 발행 처리됐어도 날짜가 미래면 "업로드 예약" 상태다.
 *   - draft      : 작성 중 (업로드 예약 아님)
 *   - archived   : 보관됨
 *   - scheduled  : 업로드 예약 — status==='scheduled' 거나, 발행글인데 날짜가 미래
 *   - published  : 이미 노출 중 — 발행글이면서 날짜가 오늘이거나 과거
 * @param {Object} story
 * @param {string} today 'YYYY-MM-DD' (로컬 기준, getLocalToday())
 * @returns {'published'|'scheduled'|'draft'|'archived'}
 */
export function getEditorBucket(story, today) {
  if (!story) return 'published';
  if (story.status === 'draft') return 'draft';
  if (story.status === 'archived') return 'archived';
  const pd = typeof story.publish_date === 'string' ? story.publish_date : '';
  const isFuture = /^\d{4}-\d{2}-\d{2}$/.test(pd) && pd > today;
  if (story.status === 'scheduled' || isFuture) return 'scheduled';
  return 'published';
}


/* ─────────────────────────────────────────────
   섹션 1: 에디터 페이지 렌더링 (목록)
   ───────────────────────────────────────────── */

export function renderEditor() {
  const page = document.createElement('div');
  page.className = 'editor-page page';

  /* ---- 권한 체크: 에디터가 아니면 접근 차단 ---- */
  if (!getState('isAdmin')) {
    page.innerHTML = `
      <div class="page-header"><h1 class="page-header-title">${t('editor.title')}</h1></div>
      <div class="empty-state">
        <div class="empty-state-title">${t('editor.need_permission_title')}</div>
        <div class="empty-state-desc">${t('editor.need_permission_desc')}</div>
      </div>
    `;
    return page;
  }

  page.innerHTML = `
    <div class="editor-calendar-header calendar-header">
      <div class="editor-calendar-title-row">
        <button class="page-header-back" id="editor-back" aria-label="${t('common.back')}">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <h1 class="calendar-title">${t('editor.content_mgmt')}</h1>
      </div>
    </div>

    <div class="editor-stats" id="editor-stats">
      <button type="button" class="editor-stat active" data-filter="all"><span class="editor-stat-label">${t('editor.filter_all')}</span><span class="editor-stat-value" id="stat-total">-</span></button>
      <button type="button" class="editor-stat" data-filter="published"><span class="editor-stat-label">${t('editor.filter_published')}</span><span class="editor-stat-value" id="stat-published">-</span></button>
      <button type="button" class="editor-stat" data-filter="scheduled"><span class="editor-stat-label">${t('editor.filter_scheduled')}</span><span class="editor-stat-value" id="stat-scheduled">-</span></button>
      <button type="button" class="editor-stat" data-filter="draft"><span class="editor-stat-label">${t('editor.filter_draft')}</span><span class="editor-stat-value" id="stat-draft">-</span></button>
      <button type="button" class="editor-stat" data-filter="untranslated"><span class="editor-stat-label">${t('editor.filter_untranslated')}</span><span class="editor-stat-value" id="stat-untranslated">-</span></button>
    </div>

    <div class="calendar-month-nav editor-month-nav">
      <button type="button" class="calendar-month-arrow" id="editor-prev-month" aria-label="${t('common.prev_month')}">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="calendar-month-label" id="editor-month-label">-</div>
      <button type="button" class="calendar-month-arrow" id="editor-next-month" aria-label="${t('common.next_month')}">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>

    <div class="calendar-weekdays editor-calendar-weekdays" aria-hidden="true">
      ${tList('date.weekdays').map((w, i) => `<div class="calendar-weekday${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}">${w}</div>`).join('')}
    </div>

    <div id="editor-calendar-grid" class="editor-calendar-grid calendar-grid">
      <div class="calendar-grid-loading"><div class="loading-spinner"></div></div>
    </div>
  `;

  let allStories = [];
  let currentFilter = 'all';
  const today = getLocalToday();
  const now = new Date();
  let visibleYear = now.getFullYear();
  let visibleMonth = now.getMonth();
  async function loadStories() {
    allStories = await fetchAllStoriesEditor();
    /* 마지막으로 보던/수정한 달로 복귀 (수정→뒤로 시 최신 달로 점프하는 불편 해소).
       저장된 값이 없을 때만 최신 글 날짜로 초기화. */
    const saved = getState('editorCalendarDate');
    if (typeof saved === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
      const [y, m] = saved.split('-').map(Number);
      visibleYear = y;
      visibleMonth = m - 1;
    } else {
      const initial = getLatestStoryDate(allStories);
      if (initial) {
        visibleYear = initial.year;
        visibleMonth = initial.monthIndex;
      }
    }
    updateStats();
    renderCalendar();
  }

  function updateStats() {
    const el = (id) => document.getElementById(id);
    if(!el('stat-total')) return;
    el('stat-total').textContent = allStories.length;
    el('stat-published').textContent = allStories.filter(s => getEditorBucket(s, today) === 'published').length;
    el('stat-draft').textContent = allStories.filter(s => getEditorBucket(s, today) === 'draft').length;
    el('stat-scheduled').textContent = allStories.filter(s => getEditorBucket(s, today) === 'scheduled').length;
    if (el('stat-untranslated')) el('stat-untranslated').textContent = allStories.filter(isStoryUntranslated).length;
  }

  function renderCalendar() {
    const gridEl = page.querySelector('#editor-calendar-grid');
    const labelEl = page.querySelector('#editor-month-label');
    if (!gridEl || !labelEl) return;

    labelEl.textContent = t('date.year_month', { y: visibleYear, m: visibleMonth + 1 });

    const firstDay = new Date(visibleYear, visibleMonth, 1).getDay();
    const lastDate = new Date(visibleYear, visibleMonth + 1, 0).getDate();
    const cells = [];
    const visibleMonthStories = allStories.filter((story) => {
      const [storyYear, storyMonth] = String(story?.publish_date || '').split('-').map(Number);
      return storyYear === visibleYear && storyMonth === visibleMonth + 1;
    });

    for (let i = 0; i < firstDay; i += 1) {
      cells.push('<div class="editor-calendar-cell editor-calendar-cell-blank cal-cell cal-cell-blank" aria-hidden="true"></div>');
    }

    for (let day = 1; day <= lastDate; day += 1) {
      const isoDate = formatIsoDate(visibleYear, visibleMonth, day);
      const stories = getStoriesForDate(isoDate);
      const weekday = new Date(visibleYear, visibleMonth, day).getDay();
      const weekdayClass = weekday === 0 ? ' sun' : weekday === 6 ? ' sat' : '';
      const storyClass = stories.length ? ' editor-calendar-cell-has-story' : ' editor-calendar-cell-empty';
      const todayClass = isoDate === today ? ' cal-cell-today' : '';
      /* 해당 날짜의 모든 글이 5개 국어 번역 완료면 날짜 텍스트를 초록색으로 표시.
         현재 필터(발행/예약/초안 등)와 무관하게 그 날짜 전체 글 기준으로 판정한다. */
      const dateStories = allStories.filter((s) => s.publish_date === isoDate);
      const allTranslated = dateStories.length > 0 && dateStories.every((s) => !isStoryUntranslated(s));
      const dayClass = allTranslated ? ' cal-cell-day-translated' : '';

      cells.push(`
        <div class="editor-calendar-cell cal-cell${weekdayClass}${storyClass}${todayClass}" data-date="${isoDate}" role="button" tabindex="0">
          <div class="cal-cell-day${dayClass}">${day}</div>
          <div class="editor-calendar-stories">
            ${stories.map(renderCalendarStory).join('')}
          </div>
        </div>
      `);
    }

    gridEl.innerHTML = cells.join('');

    gridEl.querySelectorAll('.editor-calendar-cell[data-date]').forEach((cell) => {
      const openNewStory = () => {
        setState('editorCalendarDate', cell.dataset.date); /* 복귀 시 이 날짜의 달로 */
        navigate(`/editor/new?date=${cell.dataset.date}`);
      };
      cell.addEventListener('click', (event) => {
        if (event.target.closest('.editor-calendar-story')) return;
        openNewStory();
      });
      cell.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openNewStory();
        }
      });
    });

    gridEl.querySelectorAll('.editor-calendar-story').forEach((storyEl) => {
      storyEl.addEventListener('click', (event) => {
        event.stopPropagation();
        /* 수정 후 돌아올 때 그 글의 날짜가 있는 달로 복귀하도록 기억 */
        const cellDate = storyEl.closest('.editor-calendar-cell[data-date]')?.dataset.date;
        if (cellDate) setState('editorCalendarDate', cellDate);
        navigate(`/editor/new?edit=${storyEl.dataset.id}`);
      });
    });
  }

  function getStoriesForDate(isoDate) {
    return allStories
      .filter((story) => story.publish_date === isoDate)
      .filter((story) => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'untranslated') return isStoryUntranslated(story);
        /* 발행/예약/초안 — status 가 아니라 노출 시점 기준 분류(getEditorBucket) */
        return getEditorBucket(story, today) === currentFilter;
      });
  }

  function renderCalendarStory(story) {
    const title = escapeHtml(story.title || story.figure_name || t('common.no_title'));
    const country = escapeHtml(story.country || '');
    const imageUrl = sanitizeUrl(story.image_url || '');
    const imageAttrs = imageUrl ? `src="${escapeHtml(imageUrl)}"` : '';
    /* 배지도 필터와 동일한 분류 기준 — 미래 발행글은 "예약"으로 표시 */
    const badge = getStatusBadge(getEditorBucket(story, today));

    return `
      <button type="button" class="editor-calendar-story" data-id="${escapeHtml(story.id)}">
        <span class="editor-calendar-thumb">
          <img ${imageAttrs} alt="" loading="lazy" decoding="async" />
        </span>
        <span class="editor-calendar-story-title">${title}</span>
        <span class="editor-calendar-story-meta">${country}</span>
        ${badge}
        <span class="editor-calendar-actions" aria-hidden="true"></span>
      </button>
    `;
  }

  function getStatusBadge(status) {
    const statusMap = {
      published: ['badge-accent', t('editor.status_published')],
      draft: ['badge-draft', t('editor.status_draft')],
      scheduled: ['badge-scheduled', t('editor.status_scheduled')],
      archived: ['badge-archived', t('editor.status_archived')],
    };
    const [className, label] = statusMap[status] || ['', status || t('editor.status_none')];
    return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
  }

  function getLatestStoryDate(stories) {
    const latest = [...stories]
      .filter((story) => isIsoDate(story.publish_date))
      .sort((a, b) => b.publish_date.localeCompare(a.publish_date))[0];
    if (!latest) return null;
    const [year, month] = latest.publish_date.split('-').map(Number);
    return { year, monthIndex: month - 1 };
  }

  function formatIsoDate(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function isIsoDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  setTimeout(() => {
    document.getElementById('editor-back')?.addEventListener('click', () => {
      history.back();
    });

    /* ---- 통계 카드 클릭 시 필터 적용 ---- */
    page.querySelectorAll('.editor-stat').forEach(stat => {
      stat.addEventListener('click', () => {
        page.querySelectorAll('.editor-stat').forEach(s => s.classList.remove('active'));
        stat.classList.add('active');
        currentFilter = stat.dataset.filter;
        renderCalendar();
      });
    });

    document.getElementById('editor-prev-month')?.addEventListener('click', () => {
      visibleMonth -= 1;
      if (visibleMonth < 0) {
        visibleMonth = 11;
        visibleYear -= 1;
      }
      setState('editorCalendarDate', formatIsoDate(visibleYear, visibleMonth, 1));
      renderCalendar();
    });

    document.getElementById('editor-next-month')?.addEventListener('click', () => {
      visibleMonth += 1;
      if (visibleMonth > 11) {
        visibleMonth = 0;
        visibleYear += 1;
      }
      setState('editorCalendarDate', formatIsoDate(visibleYear, visibleMonth, 1));
      renderCalendar();
    });

    loadStories();
  }, 0);

  return page;
}

/* ─────────────────────────────────────────────
   섹션 2: 새 일화 작성 전체 화면 (renderEditorNew)
   ───────────────────────────────────────────── */

export function renderEditorNew() {
  const page = document.createElement('div');
  page.className = 'editor-new-page page';

  if (!getState('isAdmin')) {
    page.innerHTML = `
      <div class="page-header"><h1 class="page-header-title">${t('editor.no_permission')}</h1></div>
    `;
    return page;
  }

  const hash = window.location.hash;
  let editingId = null;
  let prefillDate = null;
  if(hash.includes('?')) {
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    editingId = urlParams.get('edit');
    prefillDate = urlParams.get('date');
  }

  page.innerHTML = `
    <!-- 상단 헤더 -->
    <div class="editor-new-header">
      <button class="page-header-back" id="editor-new-back">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
      </button>
      <h1 class="page-header-title" style="flex:1; text-align:center;">${editingId ? t('editor.edit_story') : t('editor.new_story')}</h1>
      <div style="width:36px;"></div> <!-- 중앙 정렬 맞춤용 -->
    </div>

    <!-- 미리보기 -->
    <div class="editor-preview-section">
      <div class="preview-scale-wrapper" id="editor-preview-area">
        <!-- 스켈레톤 상태나 카드가 렌더링 될 영역 -->
      </div>
      <div style="text-align:center; margin-top:var(--space-3); font-size:var(--text-xs); color:var(--color-text-tertiary);"></div>
    </div>

    <!-- 입력 폼 -->
    <div class="editor-form-section section">
      <!-- 언어 탭: 한국어(필수) / English / 日本語 -->
      <div class="editor-lang-tabs" role="tablist" aria-label="${t('settings.section_language')}">
        <button type="button" class="editor-lang-tab active" data-lang="ko" role="tab" aria-selected="true">한국어</button>
        <button type="button" class="editor-lang-tab" data-lang="en" role="tab" aria-selected="false">English</button>
        <button type="button" class="editor-lang-tab" data-lang="ja" role="tab" aria-selected="false">日本語</button>
        <button type="button" class="editor-lang-tab" data-lang="es" role="tab" aria-selected="false">Español</button>
        <button type="button" class="editor-lang-tab" data-lang="zh" role="tab" aria-selected="false">中文</button>
      </div>
      <div class="editor-lang-hint">${t('editor.lang_hint')}</div>
      <button type="button" id="sf-auto-translate" class="btn btn-secondary" style="width:100%; margin:0 0 6px; padding:var(--space-3); font-size:var(--text-sm);">${t('editor.auto_translate_btn')}</button>
      <div class="translate-meta" id="sf-translate-meta" style="display:none; flex-direction:column; align-items:center; gap:1px; margin:0 0 var(--space-3); font-size:11px; line-height:1.4; opacity:0.7; text-align:center;"></div>

      <form id="story-form" class="story-form">
        <!-- 1. 발행일 -->
        <div class="input-group">
          <label class="input-label">${t('editor.form_publish_date')} *</label>
          <input class="input-field" type="date" id="sf-publish-date" required />
        </div>

        <!-- 2. 제목 (가로 단독) -->
        <div class="input-group">
          <label class="input-label">${t('editor.form_title')} *</label>
          <input class="input-field" id="sf-title" placeholder="${t('editor.title_placeholder')}" required />
        </div>

        <!-- 3. 역사적 연도 / 국가 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="input-group">
            <label class="input-label">${t('editor.form_hist_year')}</label>
            <input class="input-field" type="number" id="sf-hist-year" placeholder="1666" />
          </div>
          <div class="input-group">
            <label class="input-label">${t('editor.form_country')}</label>
            <input class="input-field" id="sf-country" placeholder="${t('editor.country_placeholder')}" />
          </div>
        </div>

        <!-- 4. 본문 -->
        <div class="input-group">
          <label class="input-label">${t('editor.form_body')} *</label>
          <textarea class="input-field" id="sf-body" placeholder="${t('editor.body_placeholder')}" style="min-height:200px; resize:vertical; line-height:1.6; font-family:var(--font-body);" required></textarea>
        </div>

        <!-- 4-1. 에디터 한마디 -->
        <div class="input-group">
          <label class="input-label">${t('editor.form_editor_comment')}</label>
          <textarea class="input-field" id="sf-editor-comment" placeholder="${t('editor.comment_placeholder')}" rows="3" style="resize:vertical; line-height:1.6; font-family:var(--font-body); min-height:200px;"></textarea>
        </div>

        <!-- 5. 이미지 업로드/URL -->
        <div class="input-group">
          <label class="input-label">${t('editor.form_image')}</label>
          <input class="input-field" id="sf-image" placeholder="${t('editor.image_placeholder')}" />
          <input type="hidden" id="sf-image-thumb" />
          <div style="display:flex; gap:var(--space-2); margin-top:var(--space-2);">
            <button type="button" id="sf-image-edit-btn" class="btn btn-secondary" style="display:none; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">${t('common.edit')}</button>
            <button type="button" id="sf-image-gallery-btn" class="btn btn-secondary" style="cursor:pointer; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">${t('nav.bookmarks')}</button>
            <button type="button" id="sf-image-camera-btn" class="btn btn-secondary" style="cursor:pointer; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">${t('editor.btn_camera')}</button>
          </div>
          <div id="sf-image-status" style="font-size:var(--text-xs); color:var(--color-primary); margin-top:var(--space-1); display:none;">${t('editor.uploading')}</div>
        </div>

        <!-- 6. 이미지 출처 및 라이선스 -->
        <div class="input-group">
          <label class="input-label">${t('editor.form_image_source')}</label>
          <input class="input-field" id="sf-image-source" placeholder="${t('editor.image_source_placeholder')}" />
        </div>

      </form>

      ${editingId ? `
      <div class="mystory-form-inline-actions" style="margin-top:var(--space-6);">
        <button type="button" class="btn btn-secondary mystory-form-delete-btn" id="sf-delete-story">${t('common.delete')}</button>
      </div>` : ''}
    </div>

    <!-- 화면 하단 floating 액션 영역 (발행/임시저장) — .mystory-form-actions 와 동일 패턴.
         form 밖이라 발행 버튼은 form="story-form" 으로 제출 폼을 명시한다.
         미래 날짜 선택 후 발행하면 자동으로 예약 발행 처리됨. -->
    <div class="editor-form-actions">
      <div class="editor-form-actions-row">
        <button type="button" class="btn btn-secondary btn-full" id="sf-save-draft">${t('editor.btn_save_draft')}</button>
      </div>
      <button type="submit" form="story-form" id="sf-publish" class="btn btn-primary btn-full" style="font-size:var(--text-md); padding:var(--space-4);">${t('editor.btn_publish')}</button>
    </div>
  `;

  let unsavedChanges = false;
  let saving = false; // 방어 로직 우회용
  /* 자동 번역 메타: { model, translatedAt(ISO) } — 번역이 적용된 글에 한해 버튼 하단 서브라벨로 표시 */
  let translationMeta = null;

  /* 미저장(새로 작성/수정) 변경이 있으면 경고 모달을 띄우고 "떠나도 되는지" 여부를 반환한다.
     상단 뒤로가기 버튼과 라우터 이동 가드가 함께 쓰는 단일 진입점(중복 모달·로직 방지). */
  async function confirmLeaveIfDirty() {
    if (saving || !unsavedChanges) return true;
    const confirmLeave = await showConfirm({
      title: t('editor.leave_title'),
      message: t('editor.leave_message'),
      confirmText: t('editor.leave_confirm'),
      cancelText: t('editor.leave_cancel'),
      danger: true,
    });
    return confirmLeave === true;
  }

  // 브라우저 닫기/새로고침 방지 (PC 웹)
  const blockClose = (e) => {
    if (unsavedChanges && !saving) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', blockClose);

  // 라우터 이동 방지 (SPA) & 하드웨어 뒤로가기.
  // audit 4-1: 전역 단일 가드(setBeforeNavigate)를 덮어쓰지 않고 스택에 push 한다.
  // (이전에는 떠날 때 setBeforeNavigate(null) 로 main.js 의 인증/네비 가드까지 지워버려,
  //  에디터를 한 번 방문하면 앱 전역 가드가 리로드 전까지 비활성화되는 버그가 있었다.)
  const removeNavGuard = pushBeforeNavigate(() => confirmLeaveIfDirty());

  // 페이지를 떠날 때 정리 — 전역 인증/네비 가드는 그대로 유지된다.
  setOnUnmount(() => {
    window.removeEventListener('beforeunload', blockClose);
    removeNavGuard();
  });

  /* ── 언어별 텍스트 필드 보관소 (탭 전환 시 swap) ────────────────
     title/body/country/editor_comment 는 언어별로 보관, 나머지는 공통 */
  const LOCALIZABLE_INPUT_IDS = ['sf-title', 'sf-body', 'sf-country', 'sf-editor-comment'];
  const formState = {
    ko: { 'sf-title': '', 'sf-body': '', 'sf-country': '', 'sf-editor-comment': '' },
    en: { 'sf-title': '', 'sf-body': '', 'sf-country': '', 'sf-editor-comment': '' },
    ja: { 'sf-title': '', 'sf-body': '', 'sf-country': '', 'sf-editor-comment': '' },
    es: { 'sf-title': '', 'sf-body': '', 'sf-country': '', 'sf-editor-comment': '' },
    zh: { 'sf-title': '', 'sf-body': '', 'sf-country': '', 'sf-editor-comment': '' },
  };
  let activeLang = 'ko';
  function captureCurrentLangValues() {
    LOCALIZABLE_INPUT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) formState[activeLang][id] = el.value;
    });
  }
  function applyLangValues(lang) {
    LOCALIZABLE_INPUT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = formState[lang][id] || '';
    });
  }
  function bindLangTabs() {
    document.querySelectorAll('.editor-lang-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.lang;
        if (next === activeLang) return;
        captureCurrentLangValues();
        activeLang = next;
        applyLangValues(activeLang);
        document.querySelectorAll('.editor-lang-tab').forEach((b) => {
          const on = b.dataset.lang === activeLang;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        updatePreview(true);
      });
    });
  }

  /* translationMeta.translatedAt(ISO) → 'YYYY-MM-DD HH:mm' 로컬 시각 표기 */
  function formatTranslatedAt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /* 번역 버튼 하단 서브라벨: 번역이 적용된 글에 한해 사용 모델 ID + 적용 시각을 표시.
     translationMeta 가 없으면(미번역) 숨긴다. */
  function renderTranslateMeta() {
    const metaEl = document.getElementById('sf-translate-meta');
    if (!metaEl) return;
    if (!translationMeta || !translationMeta.model) {
      metaEl.style.display = 'none';
      metaEl.textContent = '';
      return;
    }
    const timeStr = formatTranslatedAt(translationMeta.translatedAt);
    const lines = [escapeHtml(t('editor.translate_meta_model', { model: translationMeta.model }))];
    if (timeStr) lines.push(escapeHtml(t('editor.translate_meta_time', { time: timeStr })));
    metaEl.innerHTML = lines.map((l) => `<span>${l}</span>`).join('');
    metaEl.style.display = 'flex';
  }

  /* ── 자동 번역: 한국어 원문 → en/ja/es/zh (Cloud Function translateContent) ──
     관리자 인가는 서버에서 검증한다. 결과를 formState 에 채우고 현재 탭을 갱신. */
  function bindAutoTranslate() {
    const btn = document.getElementById('sf-auto-translate');
    if (!btn) return;
    const KEYMAP = {
      'sf-title': 'title',
      'sf-body': 'body',
      'sf-country': 'country',
      'sf-editor-comment': 'editor_comment',
    };
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      captureCurrentLangValues(); /* 보고 있던 탭 입력을 먼저 flush */
      const ko = formState.ko;
      const fields = {
        title: (ko['sf-title'] || '').trim(),
        body: (ko['sf-body'] || '').trim(),
        country: (ko['sf-country'] || '').trim(),
        editor_comment: (ko['sf-editor-comment'] || '').trim(),
      };
      if (!fields.title && !fields.body) {
        showToast(t('editor.translate_need_input'), 'warning');
        return;
      }

      const originalLabel = btn.textContent;
      btn.disabled = true;
      /* "번역 중…" 텍스트 + 회전 로딩 스피너 (모래시계 대신 로딩 중임을 명확히 표시) */
      btn.innerHTML = `<span class="btn-translating">${escapeHtml(t('editor.translating'))}<span class="btn-spinner" aria-hidden="true"></span></span>`;
      try {
        const { translations, model, translatedAt } = await translateContentApi({ fields });
        let filled = 0;
        ['en', 'ja', 'es', 'zh'].forEach((lang) => {
          const tr = translations && translations[lang];
          if (!tr || typeof tr !== 'object') return;
          Object.entries(KEYMAP).forEach(([inputId, field]) => {
            const v = typeof tr[field] === 'string' ? tr[field] : '';
            if (v) { formState[lang][inputId] = v; filled += 1; }
          });
        });
        applyLangValues(activeLang); /* 현재 보이는 탭 즉시 반영 */
        updatePreview(true);
        unsavedChanges = true;
        if (filled && model) {
          /* 번역이 실제 적용된 경우에만 메타 갱신 (서버 시각이 없으면 클라 시각으로 폴백) */
          translationMeta = { model, translatedAt: translatedAt || new Date().toISOString() };
          renderTranslateMeta();
        }
        showToast(filled ? t('editor.translate_done') : t('editor.translate_empty'), filled ? 'success' : 'warning');
      } catch (err) {
        console.error('자동 번역 실패:', err);
        let msg;
        if (err?.code === 'functions/permission-denied') msg = t('editor.translate_err_permission');
        else if (err?.code === 'functions/resource-exhausted') msg = t('editor.translate_err_quota');
        else if (err?.code === 'functions/unavailable') msg = t('editor.translate_err_unavailable');
        else msg = err?.message || t('editor.translate_err_generic');
        showToast(msg, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }

  setTimeout(async () => {
    let hasLoadedData = false;
    let allStories = [];
    try {
      allStories = await fetchAllStoriesEditor();
    } catch(e) { }

    // 데이터 로드
    if (editingId) {
      const story = await fetchStoryById(editingId);
      if (story) {
        document.getElementById('sf-hist-year').value = story.historical_year || '';
        document.getElementById('sf-publish-date').value = story.publish_date || '';
        document.getElementById('sf-image').value = story.image_url || '';
        document.getElementById('sf-image-thumb').value = story.image_thumb_url || '';
        document.getElementById('sf-image-source').value = story.image_source || '';

        /* 한국어는 최상위, 영/일은 i18n 객체에서 추출 */
        formState.ko['sf-title'] = story.title || story.figure_name || '';
        formState.ko['sf-body'] = story.body || '';
        formState.ko['sf-country'] = story.country || '';
        formState.ko['sf-editor-comment'] = story.editor_comment || (story.editor && story.editor.comment) || '';
        ['en', 'ja', 'es', 'zh'].forEach((lang) => {
          const tr = (story.i18n && story.i18n[lang]) || {};
          formState[lang]['sf-title'] = tr.title || tr.figure_name || '';
          formState[lang]['sf-body'] = tr.body || '';
          formState[lang]['sf-country'] = tr.country || '';
          formState[lang]['sf-editor-comment'] = tr.editor_comment || '';
        });
        /* 이전에 자동 번역이 적용된 글이면 버튼 하단 서브라벨로 모델/시각을 복원 표시 */
        if (story.translation_meta && story.translation_meta.model) {
          translationMeta = {
            model: story.translation_meta.model,
            translatedAt: story.translation_meta.translatedAt || story.translation_meta.translated_at || '',
          };
        }
        applyLangValues('ko');
        hasLoadedData = true;
      }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(prefillDate || '')) {
      document.getElementById('sf-publish-date').value = prefillDate;
    }

    bindLangTabs();
    bindAutoTranslate();
    renderTranslateMeta(); /* 로드된 글의 번역 메타(있으면) 서브라벨 표시 */

    // 뒤로가기 — 미저장 변경이 있으면 경고 모달을 먼저 띄우고, 확인해야만 떠난다.
    // (history.back() 만 호출하면 딥링크/새로고침 진입 시 hashchange 가드가 안 걸려 경고 없이 빠져나간다.)
    document.getElementById('editor-new-back')?.addEventListener('click', async () => {
      if (!(await confirmLeaveIfDirty())) return; // 취소 → 머무름
      unsavedChanges = false; // 확인됨 → 네비 가드가 모달을 다시 띄우지 않도록 플래그 해제
      history.back();
    });

    // 입력 감지
    // 이미지 [편집] 버튼 가시성 제어 함수
    function updateImageEditBtn() {
      const url = document.getElementById('sf-image')?.value.trim();
      const btn = document.getElementById('sf-image-edit-btn');
      if (btn) btn.style.display = url ? 'inline-block' : 'none';
    }

    const formEl = document.getElementById('story-form');
    if (formEl) {
      formEl.addEventListener('input', () => {
        unsavedChanges = true;
        updatePreview();
        updateImageEditBtn();
      });
    }

    // 초기 렌더링
    updatePreview(hasLoadedData);
    updateImageEditBtn();

    /** 공통: 이미지 편집기(Cropper) 모달 띄우기 함수 */
    async function openCropModal(imageSrc, isCrossOrigin = false, callbackBlobFile) {
      /* 외부 URL인 경우, fetch로 이미지를 다운로드해서 로컬 Blob URL로 변환합니다.
         Firebase Storage URL만 지원하며, 외부 이미지(Pinterest 등)는 CORS 제한으로 편집 불가. */
      let localSrc = imageSrc;
      if (isCrossOrigin) {
        if (!isFirebaseStorageUrl(imageSrc)) {
          showToast(t('editor.crop_external_error'), 'error');
          return;
        }
        try {
          const res = await fetch(imageSrc);
          if (!res.ok) throw new Error('이미지 다운로드 실패');
          const blob = await res.blob();
          localSrc = URL.createObjectURL(blob);
        } catch (err) {
          console.error('이미지 fetch 실패:', err);
          showToast(t('editor.image_load_failed'), 'error');
          return;
        }
      }

      const overlay = document.createElement('div');
      overlay.className = 'crop-modal-overlay';
      
      overlay.innerHTML = `
        <div class="crop-modal-header">
          <button type="button" class="crop-modal-back-btn" id="btn-crop-back" aria-label="${t('common.close')}">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          ${t('editor.crop_title')}
        </div>
        <div class="crop-modal-body">
          <img id="cropper-image" src="${localSrc}" decoding="async" style="max-width: 100%; display: block;" />
        </div>
        <div class="crop-modal-footer">
          <button type="button" class="btn-rotate" id="btn-crop-rotate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6"/>
              <path d="M21 13a9 9 0 1 1-2.63-6.36L21 9"/>
            </svg>
            ${t('editor.rotate')}
          </button>
          <button type="button" class="btn-crop-confirm" id="btn-crop-confirm">${t('common.next')}</button>
        </div>
      `;
      const wrapper = document.querySelector('.mobile-wrapper') || document.body;
      wrapper.appendChild(overlay);
      lockScroll();

      const cancelCrop = () => {
        overlay.style.opacity = '0';
        unlockScroll();
        setTimeout(() => {
          if (cropper) cropper.destroy();
          if (isCrossOrigin && localSrc.startsWith('blob:')) URL.revokeObjectURL(localSrc);
          overlay.remove();
        }, 300);
      };
      overlay.querySelector('#btn-crop-back').addEventListener('click', cancelCrop);

      // 페이드인 효과
      setTimeout(() => overlay.style.opacity = '1', 10);

      const image = overlay.querySelector('#cropper-image');
      let cropper;

      image.onload = () => {
        cropper = new Cropper(image, {
          aspectRatio: CARD_IMAGE_CROP_ASPECT_RATIO, 
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.9,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
        });
      };

      image.onerror = () => {
        showToast(t('editor.crop_edit_limited'), 'error');
        if (isCrossOrigin && localSrc.startsWith('blob:')) URL.revokeObjectURL(localSrc);
        unlockScroll();
        overlay.remove();
      };

      // 회전 기능
      overlay.querySelector('#btn-crop-rotate').addEventListener('click', () => {
        if(cropper) cropper.rotate(90);
      });

      // 자르기 완료 (다음) 버튼
      overlay.querySelector('#btn-crop-confirm').addEventListener('click', () => {
        const btn = overlay.querySelector('#btn-crop-confirm');
        btn.textContent = t('common.processing');
        btn.disabled = true;

        if(!cropper) return;

        cropper.getCroppedCanvas({
          maxWidth: 1200,
          maxHeight: 1500,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        }).toBlob(async (blob) => {
          if (!blob) {
            showToast(t('editor.crop_error'), 'error');
            btn.textContent = t('common.next');
            btn.disabled = false;
            return;
          }

          // 모달 닫기
          overlay.style.opacity = '0';
          unlockScroll();
          setTimeout(() => {
            cropper.destroy();
            if (isCrossOrigin && localSrc.startsWith('blob:')) URL.revokeObjectURL(localSrc);
            overlay.remove();
          }, 300);

          callbackBlobFile(blob);
        }, 'image/jpeg', 0.85); // 고화질 셋팅
      });
    }

    /* 공통 업로드 함수 (Cropper Blob 데이터를 Firebase 로 올림) */
    async function processUploadBlob(blob, fallbackName) {
      const STATUS_EL = document.getElementById('sf-image-status');
      const IMAGE_FIELD = document.getElementById('sf-image');
      if (!STATUS_EL || !IMAGE_FIELD) return;

      try {
        STATUS_EL.style.display = 'block';
        STATUS_EL.style.color = 'var(--color-primary)';
        STATUS_EL.dataset.done = '';
        STATUS_EL.textContent = t('editor.uploading');

        blob.name = fallbackName;
        const uploadUid = auth?.currentUser?.uid || getState('user')?.id;
        if (!uploadUid) {
          STATUS_EL.style.color = 'var(--color-error)';
          STATUS_EL.textContent = t('editor.upload_need_login');
          return;
        }
        const { image_url } = await uploadImage(blob, { uid: uploadUid, folder: 'editor_images' });
        const image_thumb_url = '';

        const imageInput = document.getElementById('sf-image');
        const thumbInput = document.getElementById('sf-image-thumb');
        if (imageInput) imageInput.value = image_url;
        if (thumbInput) thumbInput.value = image_thumb_url;
        updateImageEditBtn();
        STATUS_EL.textContent = t('editor.upload_done');
        STATUS_EL.dataset.done = '1';
        STATUS_EL.style.color = 'var(--color-info)';
        unsavedChanges = true;
      } catch (err) {
        console.error('이미지 업로드 오류:', err);
        STATUS_EL.style.color = 'var(--color-error)';
        STATUS_EL.textContent = t('editor.status_upload_failed', { msg: err.message });
        showToast(t('editor.toast_upload_failed', { msg: err.message }), 'error');
      } finally {
        setTimeout(() => {
          if (STATUS_EL && STATUS_EL.dataset.done === '1') {
            STATUS_EL.style.display = 'none';
          }
        }, 3000);
      }
    }

    /* 갤러리 / 카메라 — @capacitor/camera 네이티브, 웹은 file input 폴백 */
    async function handleEditorImagePick(source) {
      try {
        const result = source === 'camera' ? await pickFromCamera() : await pickFromGallery();
        if (!result) return;
        openCropModal(result.dataUrl, false, (blob) => {
          processUploadBlob(blob, source === 'camera' ? 'camera_image.jpeg' : 'gallery_image.jpeg');
        });
      } catch (err) {
        if (err instanceof CameraPermissionError) {
          showToast(err.message, 'warning');
          return;
        }
        showToast(err?.message || t('common.photo_load_failed'), 'error');
      }
    }
    document.getElementById('sf-image-gallery-btn')?.addEventListener('click', () => handleEditorImagePick('gallery'));
    document.getElementById('sf-image-camera-btn')?.addEventListener('click', () => handleEditorImagePick('camera'));

    /* 할당 된 이미지 [편집] 버튼 연동 */
    document.getElementById('sf-image-edit-btn')?.addEventListener('click', async () => {
      const url = document.getElementById('sf-image')?.value.trim();
      if (!url) return;
      openCropModal(url, true, (blob) => {
        processUploadBlob(blob, 'edited_image.jpeg');
      });
    });

    /* 발행일 중복 검사 */
    const publishDateInput = document.getElementById('sf-publish-date');
    publishDateInput?.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected) {
        const conflict = allStories.find(s => s.publish_date === selected && String(s.id) !== String(editingId));
        if (conflict) {
          showToast(t('common.date_exists'), 'error');
          e.target.value = '';
          unsavedChanges = true;
          updatePreview();
        }
      }
    });

    /* 저장 로직 */
    function getFormData() {
      /* 현재 활성 탭 값을 formState에 흡수 */
      captureCurrentLangValues();

      const histYear = parseInt(document.getElementById('sf-hist-year').value) || null;
      const u = auth?.currentUser;
      const stateUser = getState('user');
      const stateProfile = getState('profile') || {};

      const editorInfo = {
        uid: u?.uid || stateUser?.id || 'dokhubooks_uid',
        email: u?.email || stateUser?.email || 'dokhubooks@gmail.com',
        displayName: EDITOR_DISPLAY_NAME,
        photoURL: stateProfile.photoURL || u?.photoURL || ''
      };

      const ko = formState.ko;
      const titleKo = (ko['sf-title'] || '').trim();

      /* 영/일 번역: 비어있지 않은 필드만 i18n.* 에 포함 */
      const buildTranslation = (lang) => {
        const src = formState[lang];
        const out = {};
        const keymap = {
          'sf-title': ['title', 'figure_name'],
          'sf-body': ['body'],
          'sf-country': ['country'],
          'sf-editor-comment': ['editor_comment'],
        };
        Object.entries(keymap).forEach(([inputId, fields]) => {
          const v = (src[inputId] || '').trim();
          if (v) fields.forEach((f) => { out[f] = v; });
        });
        return out;
      };
      const enTr = buildTranslation('en');
      const jaTr = buildTranslation('ja');
      const esTr = buildTranslation('es');
      const zhTr = buildTranslation('zh');
      const i18n = {};
      if (Object.keys(enTr).length) i18n.en = enTr;
      if (Object.keys(jaTr).length) i18n.ja = jaTr;
      if (Object.keys(esTr).length) i18n.es = esTr;
      if (Object.keys(zhTr).length) i18n.zh = zhTr;

      const data = {
        figure_name: titleKo,
        title: titleKo,
        summary: '',
        body: (ko['sf-body'] || '').trim(),
        historical_date: histYear ? t('date.year_only', { y: histYear }) : '',
        historical_year: histYear,
        country: (ko['sf-country'] || '').trim(),
        publish_date: document.getElementById('sf-publish-date').value,
        image_url: document.getElementById('sf-image').value.trim(),
        image_thumb_url: document.getElementById('sf-image-thumb')?.value.trim() || '',
        image_source: document.getElementById('sf-image-source').value.trim(),
        card_count: '',
        editor: editorInfo,
        editor_comment: (ko['sf-editor-comment'] || '').trim(),
      };
      if (Object.keys(i18n).length) data.i18n = i18n;
      /* 자동 번역 메타(사용 모델/적용 시각) 보존 — 재진입 시 서브라벨 복원용 */
      if (translationMeta && translationMeta.model) {
        data.translation_meta = {
          model: translationMeta.model,
          translatedAt: translationMeta.translatedAt || '',
        };
      }
      return data;
    }

    document.getElementById('sf-save-draft')?.addEventListener('click', async () => {
      saving = true;
      const btn = document.getElementById('sf-save-draft');
      const originalText = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = t('editor.saving'); }
      const data = getFormData();
      data.status = 'draft';
      try {
        if (editingId) {
          await updateStory(editingId, data);
          showToast(t('editor.saved_draft'), 'success');
        } else {
          await createStory(data);
          showToast(t('editor.draft_created'), 'success');
        }
        history.back();
      } catch (err) {
        saving = false;
        if (btn) { btn.disabled = false; btn.textContent = originalText; }
        showToast(`${t('editor.save_failed')}: ${err.message}`, 'error');
      }
    });

    formEl?.addEventListener('submit', async (e) => {
      e.preventDefault();
      saving = true;
      const submitBtn = document.getElementById('sf-publish'); // 발행 버튼은 form 밖(하단 고정 바)에 있어 id 로 조회
      const originalText = submitBtn?.textContent;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('editor.saving'); }
      const data = getFormData();
      data.status = 'published';
      data.published_at = new Date().toISOString();
      try {
        if (editingId) {
          await updateStory(editingId, data);
          showToast(t('editor.saved_update'), 'success');
        } else {
          await createStory(data);
          showToast(t('editor.saved_publish'), 'success');
        }
        history.back();
      } catch (err) {
        saving = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        showToast(`${t('editor.publish_failed')}: ${err.message}`, 'error');
      }
    });

    /* 삭제 버튼 — editingId 일 때만 DOM 에 존재함 */
    document.getElementById('sf-delete-story')?.addEventListener('click', async () => {
      const confirmed = await showConfirm({
        title: t('mystory.delete_title'),
        message: t('mystory.delete_message'),
        confirmText: t('common.delete'),
        danger: true,
      });
      if (!confirmed) return;

      try {
        await deleteStory(editingId);
        showToast(t('mystory.toast_deleted'), 'success');
        history.back();
      } catch (err) {
        showToast(`${t('mystory.toast_delete_error')}: ${err.message}`, 'error');
      }
    });

  }, 0);

  function updatePreview(hasForcedData = false) {
    const previewArea = page.querySelector('#editor-preview-area');
    if (!previewArea) return;

    const figureNameRaw = document.getElementById('sf-title')?.value.trim();
    const bodyRaw = document.getElementById('sf-body')?.value.trim();
    const imgRaw = document.getElementById('sf-image')?.value.trim();

    /* 데이터가 전혀 없을 때 스켈레톤 표시 */
    if (!hasForcedData && !figureNameRaw && !bodyRaw && !imgRaw) {
      previewArea.innerHTML = `<div style="width:360px; max-width:100%; zoom:0.7;"><div class="skeleton-card"></div></div>`;
      return;
    }

    const escapeHTML = str => (str || '').replace(/[&<>'"]/g,
      tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));

    const figureName = escapeHTML(figureNameRaw || t('common.no_title'));
    const bodyText = (bodyRaw || t('editor.preview_body')).split(/\n|\\n/).map(p => p.trim() ? `<p>${escapeHTML(p)}</p>` : '<p><br></p>').join('');
    const histYear = escapeHTML(document.getElementById('sf-hist-year')?.value || '???');
    const country = escapeHTML(document.getElementById('sf-country')?.value || '');

    let pubDateStr = document.getElementById('sf-publish-date')?.value;
    if (!pubDateStr) pubDateStr = new Date().toISOString().split('T')[0];
    const pubDate = new Date(pubDateStr);
    const month = pubDate.getMonth() + 1;
    const day = pubDate.getDate();
    const displayYear = new Date().getFullYear();
    const imageUrl = imgRaw || '';

    /* 에디터 프로필 정보 (미리보기용) */
    const u = auth?.currentUser;
    const stateProfile = getState('profile') || {};
    const editorPhotoURL = stateProfile.photoURL || u?.photoURL || '';
    const editorComment = escapeHTML(document.getElementById('sf-editor-comment')?.value.trim() || '');

    /* 에디터 일화 카드(editorstory.js)와 완전히 동일한 HTML 구조 */
    previewArea.innerHTML = `
        <div class="flip-container">
          <div class="flipper" id="preview-flipper">
            <div class="front history-card-front">
              <div class="history-card-top">
                <div class="card-top-left">
                  <div class="card-year">${histYear}</div>
                  <div class="card-date">${month}. ${day}</div>
                </div>
                <div class="card-top-right">
                  <div class="card-actions">
                    <!-- 미리보기용 비활성 액션 버튼 -->
                    <button class="card-action-btn" aria-label="${t('detail.share_button')}" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </button>
                    <button class="card-action-btn" aria-label="${t('detail.bookmark_button')}" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    </button>
                  </div>
                  <div class="card-meta">
                    ${country}<br>
                    ${displayYear} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}
                  </div>
                </div>
              </div>
              <div class="history-card-image-wrap">
                <img src="${escapeHTML(imageUrl)}" alt="${figureName}" loading="eager" decoding="async" fetchpriority="high" width="1200" height="1500" onerror="this.style.display='none'" draggable="false" />
                <div class="card-image-title">${figureName}</div>
              </div>
            </div>
            <div class="back history-card-back">
              <div class="back-title">${figureName}</div>
              <hr class="back-divider" />
              <div class="back-body">
                ${bodyText || `<p>${t('editor.preview_body')}</p>`}
              </div>
              <div class="back-footer">
                <button class="back-editor-btn" type="button" title="${t('editor.form_editor_comment')}" style="${editorComment && editorComment.trim() !== '' ? '' : 'visibility: hidden; pointer-events: none;'}">
                  <img src="/assets/editor_profile.png" alt="editor" class="back-editor-avatar" loading="lazy" decoding="async" />
                </button>
                <div class="back-date-actions">
                  <div class="back-date">${t('date.full', { y: histYear, m: month, d: day })}</div>
                  <button class="card-detail-shortcut-btn" type="button" aria-label="${t('home.detail_button')}" title="${t('home.detail_button')}" disabled>${t('home.detail_button')}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
    `;

    /* 카드 터치 시 플립 */
    const flipper = previewArea.querySelector('#preview-flipper');
    if (flipper) {
      flipper.addEventListener('click', (e) => {
        if (e.target.closest('.back-editor-btn') || e.target.closest('.card-detail-shortcut-btn')) return;
        /* 말풍선이 떠 있는 상태에서 바깥 클릭은 말풍선만 닫고 플립은 건너뜀 */
        const openBubble = previewArea.querySelector('.editor-comment-bubble');
        if (openBubble && !openBubble.contains(e.target)) {
          openBubble.remove();
          return;
        }
        flipper.classList.toggle('flipped');
      });
    }

    /* 에디터 한마디 버튼 클릭 시 코멘트 표시 */
    const editorBtn = previewArea.querySelector('.back-editor-btn');
    if (editorBtn) {
      let lastEditorTouchAt = 0;
      let editorBubbleTimer = null;
      let removeOutsideBubbleListeners = null;
      const removeEditorBubble = () => {
        const bubble = previewArea.querySelector('.editor-comment-bubble');
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
          const bubble = previewArea.querySelector('.editor-comment-bubble');
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
        if (e) {
          e.stopPropagation();
          if (e.type === 'touchend') {
            lastEditorTouchAt = Date.now();
            e.preventDefault();
          }
          if (e.type === 'click' && Date.now() - lastEditorTouchAt < 650) return;
        }
        const comment = document.getElementById('sf-editor-comment')?.value.trim() || t('editor.comment_empty');
        /* 이미 말풍선이 떠 있으면 다시 누른 것은 닫기 동작 (바깥 클릭과 동일) */
        const existing = previewArea.querySelector('.editor-comment-bubble');
        if (existing) {
          removeEditorBubble();
          return;
        }
        const bubble = document.createElement('div');
        bubble.className = 'editor-comment-bubble';
        bubble.textContent = comment;
        editorBtn.parentElement.appendChild(bubble);
        bindOutsideBubbleDismiss();
        editorBubbleTimer = setTimeout(() => {
          removeEditorBubble();
        }, 3000);
      };
      
      editorBtn.addEventListener('click', showBubble);
      editorBtn.addEventListener('touchend', showBubble);
    }
  }

  return page;
}
