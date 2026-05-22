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

import { navigate, setBeforeNavigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/confirmDialog.js';
import { getState } from '../state.js';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import {
  fetchAllStoriesEditor,
  createStory,
  updateStory,
  fetchStoryById
} from '../services/stories.js';
import { uploadImage } from '../services/images.js';
import { pickFromCamera, pickFromGallery, CameraPermissionError } from '../services/camera.js';
import { auth } from '../firebase.js';

import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

const CARD_IMAGE_CROP_ASPECT_RATIO = 4 / 5;


/* ─────────────────────────────────────────────
   섹션 1: 에디터 페이지 렌더링 (목록)
   ───────────────────────────────────────────── */

export function renderEditor() {
  const page = document.createElement('div');
  page.className = 'editor-page page';

  /* ---- 권한 체크: 에디터가 아니면 접근 차단 ---- */
  const profile = getState('profile');
  if (!profile || profile.role !== 'editor') {
    page.innerHTML = `
      <div class="page-header"><h1 class="page-header-title">에디터</h1></div>
      <div class="empty-state">
        <div class="empty-state-title">에디터 권한이 필요합니다</div>
        <div class="empty-state-desc">관리자에게 에디터 권한을 요청하세요</div>
      </div>
    `;
    return page;
  }

  page.innerHTML = `
    <div class="editor-calendar-header calendar-header">
      <div class="editor-calendar-title-row">
        <button class="page-header-back" id="editor-back" aria-label="뒤로가기">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <h1 class="calendar-title">콘텐츠 관리</h1>
      </div>
    </div>

    <div class="editor-stats" id="editor-stats">
      <button type="button" class="editor-stat active" data-filter="all"><span class="editor-stat-label">전체</span><span class="editor-stat-value" id="stat-total">-</span></button>
      <button type="button" class="editor-stat" data-filter="published"><span class="editor-stat-label">발행</span><span class="editor-stat-value" id="stat-published">-</span></button>
      <button type="button" class="editor-stat" data-filter="scheduled"><span class="editor-stat-label">예약</span><span class="editor-stat-value" id="stat-scheduled">-</span></button>
      <button type="button" class="editor-stat" data-filter="draft"><span class="editor-stat-label">초안</span><span class="editor-stat-value" id="stat-draft">-</span></button>
    </div>

    <div class="calendar-month-nav editor-month-nav">
      <button type="button" class="calendar-month-arrow" id="editor-prev-month" aria-label="이전 달">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="calendar-month-label" id="editor-month-label">-</div>
      <button type="button" class="calendar-month-arrow" id="editor-next-month" aria-label="다음 달">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>

    <div class="calendar-weekdays editor-calendar-weekdays" aria-hidden="true">
      <div class="calendar-weekday sun">일</div>
      <div class="calendar-weekday">월</div>
      <div class="calendar-weekday">화</div>
      <div class="calendar-weekday">수</div>
      <div class="calendar-weekday">목</div>
      <div class="calendar-weekday">금</div>
      <div class="calendar-weekday sat">토</div>
    </div>

    <div id="editor-calendar-grid" class="editor-calendar-grid calendar-grid">
      <div class="calendar-grid-loading"><div class="loading-spinner"></div></div>
    </div>
  `;

  let allStories = [];
  let currentFilter = 'all';
  const now = new Date();
  let visibleYear = now.getFullYear();
  let visibleMonth = now.getMonth();
  async function loadStories() {
    allStories = await fetchAllStoriesEditor();
    const initial = getLatestStoryDate(allStories);
    if (initial) {
      visibleYear = initial.year;
      visibleMonth = initial.monthIndex;
    }
    updateStats();
    renderCalendar();
  }

  function updateStats() {
    const el = (id) => document.getElementById(id);
    if(!el('stat-total')) return;
    el('stat-total').textContent = allStories.length;
    el('stat-published').textContent = allStories.filter(s => s.status === 'published').length;
    el('stat-draft').textContent = allStories.filter(s => s.status === 'draft').length;
    el('stat-scheduled').textContent = allStories.filter(s => s.status === 'scheduled').length;
  }

  function renderCalendar() {
    const gridEl = page.querySelector('#editor-calendar-grid');
    const labelEl = page.querySelector('#editor-month-label');
    if (!gridEl || !labelEl) return;

    labelEl.textContent = `${visibleYear}년 ${visibleMonth + 1}월`;

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

      cells.push(`
        <div class="editor-calendar-cell cal-cell${weekdayClass}${storyClass}" data-date="${isoDate}" role="button" tabindex="0">
          <div class="cal-cell-day">${day}</div>
          <div class="editor-calendar-stories">
            ${stories.map(renderCalendarStory).join('')}
          </div>
        </div>
      `);
    }

    gridEl.innerHTML = cells.join('');

    gridEl.querySelectorAll('.editor-calendar-cell[data-date]').forEach((cell) => {
      const openNewStory = () => navigate(`/editor/new?date=${cell.dataset.date}`);
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
        navigate(`/editor/new?edit=${storyEl.dataset.id}`);
      });
    });
  }

  function getStoriesForDate(isoDate) {
    return allStories
      .filter((story) => story.publish_date === isoDate)
      .filter((story) => currentFilter === 'all' || story.status === currentFilter);
  }

  function renderCalendarStory(story) {
    const title = escapeHtml(story.title || story.figure_name || '제목 없음');
    const country = escapeHtml(story.country || '');
    const imageUrl = sanitizeUrl(story.image_url || '');
    const imageAttrs = imageUrl ? `src="${escapeHtml(imageUrl)}"` : '';
    const badge = getStatusBadge(story.status);

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
      published: ['badge-accent', '발행됨'],
      draft: ['badge-draft', '초안'],
      scheduled: ['badge-scheduled', '예약'],
      archived: ['badge-archived', '보관'],
    };
    const [className, label] = statusMap[status] || ['', status || '상태 없음'];
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
      renderCalendar();
    });

    document.getElementById('editor-next-month')?.addEventListener('click', () => {
      visibleMonth += 1;
      if (visibleMonth > 11) {
        visibleMonth = 0;
        visibleYear += 1;
      }
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

  const profile = getState('profile');
  if (!profile || profile.role !== 'editor') {
    page.innerHTML = `
      <div class="page-header"><h1 class="page-header-title">권한 없음</h1></div>
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
      <h1 class="page-header-title" style="flex:1; text-align:center;">${editingId ? '일화 수정' : '새 일화 작성'}</h1>
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
      <div class="editor-lang-tabs" role="tablist" aria-label="언어">
        <button type="button" class="editor-lang-tab active" data-lang="ko" role="tab" aria-selected="true">한국어</button>
        <button type="button" class="editor-lang-tab" data-lang="en" role="tab" aria-selected="false">English</button>
        <button type="button" class="editor-lang-tab" data-lang="ja" role="tab" aria-selected="false">日本語</button>
      </div>
      <div class="editor-lang-hint">한국어는 필수, 영어/일본어는 비우면 카드에서 한국어로 자동 표시됩니다.</div>

      <form id="story-form" class="story-form">
        <!-- 1. 제목 (가로 단독) -->
        <div class="input-group">
          <label class="input-label">제목 (인물/사건명) *</label>
          <input class="input-field" id="sf-title" placeholder="예: Isaac Newton" required />
        </div>

        <!-- 2. 역사적 연도 / 발행일 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="input-group">
            <label class="input-label">역사적 연도</label>
            <input class="input-field" type="number" id="sf-hist-year" placeholder="1666" />
          </div>
          <div class="input-group">
            <label class="input-label">발행일 *</label>
            <input class="input-field" type="date" id="sf-publish-date" required />
          </div>
        </div>

        <!-- 3. 국가 -->
        <div class="input-group">
          <label class="input-label">국가</label>
          <input class="input-field" id="sf-country" placeholder="영국" />
        </div>

        <!-- 4. 본문 -->
        <div class="input-group">
          <label class="input-label">본문 *</label>
          <textarea class="input-field" id="sf-body" placeholder="역사 일화 본문을 입력하세요..." style="min-height:200px; resize:vertical; line-height:1.6; font-family:var(--font-body);" required></textarea>
        </div>

        <!-- 4-1. 에디터 한마디 -->
        <div class="input-group">
          <label class="input-label">에디터 한마디</label>
          <textarea class="input-field" id="sf-editor-comment" placeholder="카드 뒷면에 표시될 에디터의 코멘트" rows="3" style="resize:vertical; line-height:1.6; font-family:var(--font-body);"></textarea>
        </div>

        <!-- 5. 이미지 업로드/URL -->
        <div class="input-group">
          <label class="input-label">이미지 업로드 및 URL</label>
          <div style="display:flex; gap:var(--space-2); align-items:center;">
            <input class="input-field" id="sf-image" placeholder="URL 직접 입력 또는 사진 선택" style="flex:1;" />
            <input type="hidden" id="sf-image-thumb" />
            <button type="button" id="sf-image-edit-btn" class="btn btn-secondary" style="display:none; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">편집</button>
            <button type="button" id="sf-image-gallery-btn" class="btn btn-secondary" style="cursor:pointer; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">보관함</button>
            <button type="button" id="sf-image-camera-btn" class="btn btn-secondary" style="cursor:pointer; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">촬영</button>
          </div>
          <div id="sf-image-status" style="font-size:var(--text-xs); color:var(--color-primary); margin-top:var(--space-1); display:none;">사진을 업로드하는 중입니다... ⏳</div>
        </div>

        <!-- 6. 이미지 출처 및 라이선스 -->
        <div class="input-group">
          <label class="input-label">이미지 출처 및 라이선스</label>
          <input class="input-field" id="sf-image-source" placeholder="예: Unsplash (CC0), Wikimedia Commons" />
        </div>

        <div style="display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-6);margin-bottom:var(--space-10);">
          <button type="submit" class="btn btn-primary btn-full" style="font-size:var(--text-md); padding:var(--space-4);">발행하기</button>
          <div style="display:flex;gap:var(--space-3);">
            <button type="button" class="btn btn-secondary btn-full" id="sf-save-draft">초안 저장</button>
            <button type="button" class="btn btn-full" id="sf-schedule" style="background:var(--color-info);color:#fff;border:none;">예약 발행</button>
          </div>
        </div>
      </form>
    </div>
  `;

  let unsavedChanges = false;
  let saving = false; // 방어 로직 우회용
  
  // 브라우저 닫기/새로고침 방지 (PC 웹)
  const blockClose = (e) => {
    if (unsavedChanges && !saving) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', blockClose);

  // 라우터 이동 방지 (SPA) & 하드웨어 뒤로가기
  setBeforeNavigate(async (targetPath) => {
    if (!saving && unsavedChanges) {
      const confirmLeave = await showConfirm({
        title: '저장되지 않은 정보가 있습니다',
        message: '정말 나가시겠습니까?',
        confirmText: '나가기',
        cancelText: '계속 작성',
        danger: true,
      });
      if (!confirmLeave) return false;
    }
    // 페이지 벗어날 때 리스너 제거
    window.removeEventListener('beforeunload', blockClose);
    setBeforeNavigate(null); // 훅 초기화
    return true;
  });

  /* ── 언어별 텍스트 필드 보관소 (탭 전환 시 swap) ────────────────
     title/body/country/editor_comment 는 언어별로 보관, 나머지는 공통 */
  const LOCALIZABLE_INPUT_IDS = ['sf-title', 'sf-body', 'sf-country', 'sf-editor-comment'];
  const formState = {
    ko: { 'sf-title': '', 'sf-body': '', 'sf-country': '', 'sf-editor-comment': '' },
    en: { 'sf-title': '', 'sf-body': '', 'sf-country': '', 'sf-editor-comment': '' },
    ja: { 'sf-title': '', 'sf-body': '', 'sf-country': '', 'sf-editor-comment': '' },
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
        ['en', 'ja'].forEach((lang) => {
          const tr = (story.i18n && story.i18n[lang]) || {};
          formState[lang]['sf-title'] = tr.title || tr.figure_name || '';
          formState[lang]['sf-body'] = tr.body || '';
          formState[lang]['sf-country'] = tr.country || '';
          formState[lang]['sf-editor-comment'] = tr.editor_comment || '';
        });
        applyLangValues('ko');
        hasLoadedData = true;
      }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(prefillDate || '')) {
      document.getElementById('sf-publish-date').value = prefillDate;
    }

    bindLangTabs();
    
    // 뒤로가기
    document.getElementById('editor-new-back')?.addEventListener('click', () => {
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
        const isFirebaseUrl = imageSrc.includes('firebasestorage.googleapis.com')
                           || imageSrc.includes('.firebasestorage.app');
        if (!isFirebaseUrl) {
          showToast('외부 이미지는 편집할 수 없습니다.\n[사진 추가]로 새 이미지를 업로드해주세요.', 'error');
          return;
        }
        try {
          const res = await fetch(imageSrc);
          if (!res.ok) throw new Error('이미지 다운로드 실패');
          const blob = await res.blob();
          localSrc = URL.createObjectURL(blob);
        } catch (err) {
          console.error('이미지 fetch 실패:', err);
          showToast('이미지를 불러올 수 없습니다. 다시 시도해주세요.', 'error');
          return;
        }
      }

      const overlay = document.createElement('div');
      overlay.className = 'crop-modal-overlay';
      
      overlay.innerHTML = `
        <div class="crop-modal-header">
          <button type="button" class="crop-modal-back-btn" id="btn-crop-back" aria-label="닫기">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          카드 이미지 편집
        </div>
        <div class="crop-modal-body">
          <img id="cropper-image" src="${localSrc}" decoding="async" style="max-width: 100%; display: block;" />
        </div>
        <div class="crop-modal-footer">
          <button type="button" class="btn-rotate" id="btn-crop-rotate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.53-11.23l5.67 5.66" />
            </svg>
            회전
          </button>
          <button type="button" class="btn-crop-confirm" id="btn-crop-confirm">다음</button>
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
        showToast('이미지를 불러올 수 없어 편집이 제한됩니다.', 'error');
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
        btn.textContent = '처리 중...';
        btn.disabled = true;

        if(!cropper) return;

        cropper.getCroppedCanvas({
          maxWidth: 1200,
          maxHeight: 1500,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        }).toBlob(async (blob) => {
          if (!blob) {
            showToast('크롭 오류가 발생했습니다.', 'error');
            btn.textContent = '다음';
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
        STATUS_EL.textContent = '사진을 업로드하는 중입니다... ⏳';
        
        blob.name = fallbackName;
        const uploadUid = auth?.currentUser?.uid || getState('user')?.id;
        if (!uploadUid) {
          STATUS_EL.style.color = 'var(--color-error)';
          STATUS_EL.textContent = '로그인이 필요합니다.';
          return;
        }
        const { image_url } = await uploadImage(blob, { uid: uploadUid, folder: 'editor_images' });
        const image_thumb_url = '';

        const imageInput = document.getElementById('sf-image');
        const thumbInput = document.getElementById('sf-image-thumb');
        if (imageInput) imageInput.value = image_url;
        if (thumbInput) thumbInput.value = image_thumb_url;
        updateImageEditBtn();
        STATUS_EL.textContent = '업로드 완료! ✅';
        STATUS_EL.style.color = 'var(--color-info)';
        unsavedChanges = true;
      } catch (err) {
        console.error('이미지 업로드 오류:', err);
        STATUS_EL.style.color = 'var(--color-error)';
        STATUS_EL.textContent = '업로드 실패: ' + err.message;
        showToast('이미지 업로드 실패: ' + err.message, 'error');
      } finally {
        setTimeout(() => {
          if (STATUS_EL && STATUS_EL.textContent.includes('완료')) {
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
        showToast(err?.message || '사진을 불러올 수 없습니다.', 'error');
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

    /* 예약 발행 버튼 활성/비활성 상태 관리 */
    const scheduleBtn = document.getElementById('sf-schedule');
    const publishDateInput = document.getElementById('sf-publish-date');

    function updateScheduleBtn() {
      if (!scheduleBtn || !publishDateInput) return;
      const dateVal = publishDateInput.value;
      if (!dateVal) {
        scheduleBtn.disabled = true;
        scheduleBtn.style.opacity = '0.4';
        scheduleBtn.title = '발행일을 먼저 선택하세요';
        return;
      }
      const selected = new Date(dateVal + 'T00:00:00'); // 로컬 시간 기준으로 파싱
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFuture = selected > today;
      scheduleBtn.disabled = !isFuture;
      scheduleBtn.style.opacity = isFuture ? '1' : '0.4';
      scheduleBtn.title = isFuture ? '' : '예약 발행일은 미래 날짜여야 합니다';
    }

    /* 초기 상태 + 날짜 변경 시 업데이트 */
    updateScheduleBtn();
    publishDateInput?.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected) {
        const conflict = allStories.find(s => s.publish_date === selected && String(s.id) !== String(editingId));
        if (conflict) {
          showToast('이미 등록된 일화가 있는 날짜입니다.', 'error');
          e.target.value = '';
          unsavedChanges = true;
          updatePreview();
        }
      }
      updateScheduleBtn();
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
        displayName: u?.displayName || stateProfile.displayName || (stateUser?.email ? stateUser.email.split('@')[0] : 'DayStory'),
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
      const i18n = {};
      if (Object.keys(enTr).length) i18n.en = enTr;
      if (Object.keys(jaTr).length) i18n.ja = jaTr;

      const data = {
        figure_name: titleKo,
        title: titleKo,
        summary: '',
        body: (ko['sf-body'] || '').trim(),
        historical_date: histYear ? `${histYear}년` : '',
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
      return data;
    }

    document.getElementById('sf-save-draft')?.addEventListener('click', async () => {
      saving = true;
      const data = getFormData();
      data.status = 'draft';
      try {
        if (editingId) {
          await updateStory(editingId, data);
          showToast('초안 저장 완료', 'success');
        } else {
          await createStory(data);
          showToast('초안 생성 완료', 'success');
        }
        history.back();
      } catch (err) {
        saving = false;
        showToast('저장 실패: ' + err.message, 'error');
      }
    });

    formEl?.addEventListener('submit', async (e) => {
      e.preventDefault();
      saving = true;
      const data = getFormData();
      data.status = 'published';
      data.published_at = new Date().toISOString();
      try {
        if (editingId) {
          await updateStory(editingId, data);
          showToast('수정 및 발행 완료', 'success');
        } else {
          await createStory(data);
          showToast('새 일화 발행 완료!', 'success');
        }
        history.back();
      } catch (err) {
        saving = false;
        showToast('발행 실패: ' + err.message, 'error');
      }
    });

    document.getElementById('sf-schedule')?.addEventListener('click', async () => {
      const data = getFormData();
      if (!data.publish_date) {
        showToast('예약 발행일을 선택해주세요', 'error');
        return;
      }

      /* 예약 날짜를 YYYY-MM-DD 형식으로 정규화 (시간 정보 제거) */
      data.publish_date = data.publish_date.split('T')[0];
      /* 원래 예약일을 별도 필드에 기록 (추후 추적용) */
      data.scheduled_date = data.publish_date;

      saving = true;
      data.status = 'scheduled';
      try {
        if (editingId) {
          await updateStory(editingId, data);
        } else {
          await createStory(data);
        }
        showToast(`${data.publish_date}에 발행 예약됨`, 'success');
        history.back();
      } catch (err) {
        saving = false;
        showToast('예약 실패: ' + err.message, 'error');
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

    const figureName = escapeHTML(figureNameRaw || '제목 없음');
    const bodyText = (bodyRaw || '본문이 표시됩니다...').split(/\n|\\n/).map(p => p.trim() ? `<p>${escapeHTML(p)}</p>` : '<p><br></p>').join('');
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
                    <button class="card-action-btn" aria-label="공유" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </button>
                    <button class="card-action-btn" aria-label="보관함" disabled>
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
                ${bodyText || '<p>본문이 표시됩니다...</p>'}
              </div>
              <div class="back-footer">
                <button class="back-editor-btn" type="button" title="에디터 한마디" style="${editorComment && editorComment.trim() !== '' ? '' : 'visibility: hidden; pointer-events: none;'}">
                  <img src="${escapeHTML(editorPhotoURL)}" alt="editor" class="back-editor-avatar" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
                  <span class="back-editor-avatar-fallback" style="display:none">✍️</span>
                </button>
                <div class="back-date-actions">
                  <div class="back-date">${histYear}년 ${month}월 ${day}일</div>
                  <button class="card-detail-shortcut-btn" type="button" aria-label="상세 보기" title="상세 보기" disabled>상세 보기</button>
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
        const comment = document.getElementById('sf-editor-comment')?.value.trim() || '에디터 코멘트가 없습니다.';
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
