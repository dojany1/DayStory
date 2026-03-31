/* =====================================================================
   editor.js — 에디터 (콘텐츠 관리) 페이지
   =====================================================================
   에디터 권한을 가진 관리자가 역사 일화를 작성/편집/삭제하는 페이지입니다.
   
   기능:
     - 전체/발행됨/초안/예약 필터링
     - 새 일화 작성 (모달 폼)
     - 기존 일화 편집/삭제
     - 발행, 초안 저장, 예약 발행
   
   권한:
     profiles 테이블의 role이 'editor'인 유저만 접근 가능합니다.
   ===================================================================== */

import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { getState } from '../state.js';
import {
  fetchAllStoriesEditor,
  createStory,
  updateStory,
  deleteStory,
  publishStory
} from '../services/stories.js';


/* ─────────────────────────────────────────────
   섹션 1: 에디터 페이지 렌더링
   ───────────────────────────────────────────── */

/**
 * renderEditor — 에디터 페이지를 생성합니다
 * @returns {HTMLElement} 에디터 페이지 DOM 요소
 */
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

  /* ---- 페이지 HTML 구조 생성 ---- */
  page.innerHTML = `
    <!-- 헤더: 제목 + 새 일화 버튼 -->
    <div class="page-header">
      <h1 class="page-header-title">콘텐츠 관리</h1>
      <button class="btn btn-primary" id="editor-new" style="padding:var(--space-2) var(--space-4);font-size:var(--text-sm);">
        + 새 일화
      </button>
    </div>

    <!-- 통계 카드: 전체/발행/초안/예약 개수 -->
    <div class="editor-stats" id="editor-stats">
      <div class="editor-stat"><span class="editor-stat-value" id="stat-total">-</span><span class="editor-stat-label">전체</span></div>
      <div class="editor-stat"><span class="editor-stat-value" id="stat-published">-</span><span class="editor-stat-label">발행됨</span></div>
      <div class="editor-stat"><span class="editor-stat-value" id="stat-draft">-</span><span class="editor-stat-label">초안</span></div>
      <div class="editor-stat"><span class="editor-stat-value" id="stat-scheduled">-</span><span class="editor-stat-label">예약</span></div>
    </div>

    <!-- 필터 탭: 전체/발행됨/초안/예약 -->
    <div class="editor-filter-bar">
      <button class="editor-filter active" data-filter="all">전체</button>
      <button class="editor-filter" data-filter="published">발행됨</button>
      <button class="editor-filter" data-filter="draft">초안</button>
      <button class="editor-filter" data-filter="scheduled">예약</button>
    </div>

    <!-- 일화 목록 -->
    <div id="editor-list" class="editor-list">
      <div style="display:flex;justify-content:center;padding:var(--space-8);">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- ===== 일화 작성/수정 모달 ===== -->
    <div class="modal-overlay" id="story-modal" style="display:none;">
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="modal-title">새 일화 작성</h2>
          <button class="btn-icon" id="modal-close">✕</button>
        </div>
        <form id="story-form" class="story-form">
          <!-- 인물/사건명 -->
          <div class="input-group">
            <label class="input-label">인물/사건명 *</label>
            <input class="input-field" id="sf-figure" placeholder="예: Isaac Newton" required />
          </div>
          <!-- 제목 -->
          <div class="input-group">
            <label class="input-label">제목 *</label>
            <input class="input-field" id="sf-title" placeholder="카드 제목" required />
          </div>
          <!-- 요약 -->
          <div class="input-group">
            <label class="input-label">요약</label>
            <input class="input-field" id="sf-summary" placeholder="한 줄 요약" />
          </div>
          <!-- 본문 -->
          <div class="input-group">
            <label class="input-label">본문 *</label>
            <textarea class="report-textarea" id="sf-body" placeholder="역사 일화 본문을 입력하세요..." style="min-height:150px;" required></textarea>
          </div>
          <!-- 역사적 날짜 / 연도 (2열 그리드) -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
            <div class="input-group">
              <label class="input-label">역사적 날짜</label>
              <input class="input-field" id="sf-hist-date" placeholder="예: 1666년" />
            </div>
            <div class="input-group">
              <label class="input-label">연도 (숫자)</label>
              <input class="input-field" type="number" id="sf-hist-year" placeholder="1666" />
            </div>
          </div>
          <!-- 국가 / 발행일 (2열 그리드) -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
            <div class="input-group">
              <label class="input-label">국가</label>
              <input class="input-field" id="sf-country" placeholder="영국" />
            </div>
            <div class="input-group">
              <label class="input-label">발행일 *</label>
              <input class="input-field" type="date" id="sf-publish-date" required />
            </div>
          </div>
          <!-- 이미지 URL -->
          <div class="input-group">
            <label class="input-label">이미지 URL</label>
            <input class="input-field" id="sf-image" placeholder="/images/example.png" />
          </div>
          <!-- 카드 번호 -->
          <div class="input-group">
            <label class="input-label">카드 번호</label>
            <input class="input-field" id="sf-card-count" placeholder="21st" />
          </div>
          <!-- 액션 버튼들 -->
          <div style="display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-4);">
            <button type="submit" class="btn btn-primary btn-full">발행하기</button>
            <div style="display:flex;gap:var(--space-3);">
              <button type="button" class="btn btn-secondary btn-full" id="sf-save-draft">초안 저장</button>
              <button type="button" class="btn btn-full" id="sf-schedule" style="background:var(--color-info);color:#fff;">예약 발행</button>
            </div>
          </div>
        </form>
        
        <!-- 실시간 미리보기 영억 -->
        <hr style="margin:2rem 0; border:none; border-top:1px solid var(--color-border);"/>
        <h3 style="margin-bottom:var(--space-3); font-size:var(--text-lg);">📱 실시간 미리보기 (컬렉션 카드)</h3>
        <div id="editor-preview-area" style="width: 200px; margin: 0 auto;"></div>
        
      </div>
    </div>
  `;


  /* ─────────────────────────────────────────────
     섹션 2: 내부 상태 변수
     ───────────────────────────────────────────── */

  let allStories = [];       /* 전체 스토리 목록 */
  let currentFilter = 'all'; /* 현재 선택된 필터 */
  let editingId = null;      /* 수정 중인 스토리 ID (null이면 새로 작성) */


  /* ─────────────────────────────────────────────
     섹션 3: 내부 함수들
     ───────────────────────────────────────────── */

  /**
   * loadStories — 서버에서 전체 스토리를 가져와 목록을 갱신합니다
   */
  async function loadStories() {
    allStories = await fetchAllStoriesEditor();
    updateStats();
    renderList();
  }

  /**
   * updateStats — 통계 카드의 숫자를 업데이트합니다
   */
  function updateStats() {
    const el = (id) => document.getElementById(id);
    el('stat-total').textContent = allStories.length;
    el('stat-published').textContent = allStories.filter(s => s.status === 'published').length;
    el('stat-draft').textContent = allStories.filter(s => s.status === 'draft').length;
    el('stat-scheduled').textContent = allStories.filter(s => s.status === 'scheduled').length;
  }

  /**
   * renderList — 현재 필터에 맞는 일화 목록을 화면에 표시합니다
   */
  function renderList() {
    const listEl = document.getElementById('editor-list');
    const filtered = currentFilter === 'all'
      ? allStories
      : allStories.filter(s => s.status === currentFilter);

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6);">
          <div class="empty-state-title">아직 콘텐츠가 없습니다</div>
        </div>
      `;
      return;
    }

    /* 각 일화를 리스트 아이템으로 렌더링 */
    listEl.innerHTML = filtered.map(story => {
      const d = new Date(story.publish_date);
      const dateStr = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;

      /* 상태에 따른 배지 색상 */
      const statusBadge = {
        published: '<span class="badge badge-accent">발행됨</span>',
        draft: '<span class="badge" style="background:var(--color-text-tertiary);color:#fff;">초안</span>',
        scheduled: '<span class="badge" style="background:var(--color-info);color:#fff;">예약</span>',
        archived: '<span class="badge" style="background:var(--color-bg-secondary);">보관</span>',
      }[story.status] || '';

      return `
        <div class="editor-item" data-id="${story.id}">
          <div class="editor-item-thumb">
            ${story.image_url
              ? `<img src="${story.image_url}" alt="" />`
              : '<div style="width:100%;height:100%;background:var(--color-bg-secondary);display:flex;align-items:center;justify-content:center;">📷</div>'}
          </div>
          <div class="editor-item-info">
            <div class="editor-item-meta">${dateStr} · ${story.country || '-'} ${statusBadge}</div>
            <div class="editor-item-title">${story.figure_name || story.title}</div>
          </div>
          <div class="editor-item-actions">
            <button class="btn-icon editor-edit-btn" data-id="${story.id}" title="편집">✏️</button>
            <button class="btn-icon editor-delete-btn" data-id="${story.id}" title="삭제">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    /* 편집 버튼 클릭 이벤트 */
    listEl.querySelectorAll('.editor-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();  /* 부모 요소의 클릭 이벤트 방지 */
        openEditModal(btn.dataset.id);
      });
    });

    /* 삭제 버튼 클릭 이벤트 */
    listEl.querySelectorAll('.editor-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('이 일화를 삭제하시겠습니까?')) {
          try {
            await deleteStory(btn.dataset.id);
            showToast('삭제 완료', 'success');
            loadStories();  /* 전제 목록 새로고침 */
          } catch (err) {
            showToast('삭제 실패: ' + err.message, 'error');
          }
        }
      });
    });
  }

  /**
   * openEditModal — 기존 일화를 수정하는 모달을 엽니다
   * @param {string} id - 수정할 스토리 ID
   */
  function openEditModal(id) {
    editingId = id;
    const story = allStories.find(s => s.id === id);
    if (!story) return;

    /* 모달 제목 변경 및 폼 필드 채우기 */
    document.getElementById('modal-title').textContent = '일화 수정';
    document.getElementById('sf-figure').value = story.figure_name || '';
    document.getElementById('sf-title').value = story.title || '';
    document.getElementById('sf-summary').value = story.summary || '';
    document.getElementById('sf-body').value = story.body || '';
    document.getElementById('sf-hist-date').value = story.historical_date || '';
    document.getElementById('sf-hist-year').value = story.historical_year || '';
    document.getElementById('sf-country').value = story.country || '';
    document.getElementById('sf-publish-date').value = story.publish_date || '';
    document.getElementById('sf-image').value = story.image_url || '';
    document.getElementById('sf-card-count').value = story.card_count || '';
    document.getElementById('story-modal').style.display = 'flex';
  }

  /**
   * openNewModal — 새 일화를 작성하는 모달을 엽니다
   */
  function openNewModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = '새 일화 작성';
    document.getElementById('story-form').reset();
    document.getElementById('story-modal').style.display = 'flex';
    // 모달 여는 즉시 미리보기 업데이트
    setTimeout(updatePreview, 50);
  }

  /**
   * closeModal — 모달을 닫습니다
   */
  function closeModal() {
    document.getElementById('story-modal').style.display = 'none';
  }

  /**
   * getFormData — 폼의 입력값을 객체로 수집합니다
   * @returns {Object} 스토리 데이터 객체
   */
  function getFormData() {
    return {
      figure_name: document.getElementById('sf-figure').value.trim(),
      title: document.getElementById('sf-title').value.trim(),
      summary: document.getElementById('sf-summary').value.trim(),
      body: document.getElementById('sf-body').value.trim(),
      historical_date: document.getElementById('sf-hist-date').value.trim(),
      historical_year: parseInt(document.getElementById('sf-hist-year').value) || null,
      country: document.getElementById('sf-country').value.trim(),
      publish_date: document.getElementById('sf-publish-date').value,
      image_url: document.getElementById('sf-image').value.trim(),
      card_count: document.getElementById('sf-card-count').value.trim(),
    };
  }


  /* ─────────────────────────────────────────────
     섹션 4: 이벤트 리스너 연결
     ───────────────────────────────────────────── */

  setTimeout(() => {
    /* 새 일화 버튼 */
    document.getElementById('editor-new')?.addEventListener('click', openNewModal);
    /* 모달 닫기 */
    document.getElementById('modal-close')?.addEventListener('click', closeModal);

    /* 필터 탭 클릭 */
    page.querySelectorAll('.editor-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('.editor-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderList();
      });
    });

    /* 초안 저장 버튼 */
    document.getElementById('sf-save-draft')?.addEventListener('click', async () => {
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
        closeModal();
        loadStories();
      } catch (err) {
        showToast('저장 실패: ' + err.message, 'error');
      }
    });

    /* 발행하기 (폼 제출) */
    document.getElementById('story-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
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
        closeModal();
        loadStories();
      } catch (err) {
        showToast('발행 실패: ' + err.message, 'error');
      }
    });

    /* 예약 발행 버튼 */
    document.getElementById('sf-schedule')?.addEventListener('click', async () => {
      const data = getFormData();

      /* 발행일 유효성 검사 */
      if (!data.publish_date) {
        showToast('예약 발행일을 선택해주세요', 'error');
        return;
      }
      const publishDate = new Date(data.publish_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (publishDate <= today) {
        showToast('예약 발행일은 미래 날짜여야 합니다', 'error');
        return;
      }

      data.status = 'scheduled';
      try {
        if (editingId) {
          await updateStory(editingId, data);
        } else {
          await createStory(data);
        }
        showToast(`${data.publish_date}에 발행 예약됨`, 'success');
        closeModal();
        loadStories();
      } catch (err) {
        showToast('예약 실패: ' + err.message, 'error');
      }
    });

    /* 모달 바깥 영역 클릭 시 닫기 */
    document.getElementById('story-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'story-modal') closeModal();
    });

    /* 초기 데이터 로딩 */
    loadStories();

    /* 실시간 미리보기 기능 추가 */
    function updatePreview() {
      const previewArea = page.querySelector('#editor-preview-area');
      if (!previewArea) return;

      const escapeHTML = str => (str || '').replace(/[&<>'"]/g, 
        tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));

      const figureName = escapeHTML(page.querySelector('#sf-figure').value || '인물명');
      const histYear = escapeHTML(page.querySelector('#sf-hist-year').value || '1911');
      const country = escapeHTML(page.querySelector('#sf-country').value || '영국');
      let pubDateStr = page.querySelector('#sf-publish-date').value;
      if (!pubDateStr) pubDateStr = new Date().toISOString().split('T')[0];
      const pubDate = new Date(pubDateStr);
      const month = pubDate.getMonth() + 1;
      const day = pubDate.getDate();
      const displayYear = new Date().getFullYear();
      const cardCount = escapeHTML(page.querySelector('#sf-card-count').value || '15th');
      const imageUrl = escapeHTML(page.querySelector('#sf-image').value || 'https://via.placeholder.com/300x400?text=Image');

      previewArea.innerHTML = `
        <div class="history-card-mini" style="margin:0; box-shadow:0 10px 20px rgba(0,0,0,0.15);">
          <div style="padding: 1rem 1rem 0.5rem; display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="card-top-left">
              <div class="card-year" style="font-size:1.1rem; line-height:1; color:#000;">${histYear}</div>
              <div class="card-date" style="font-size:2.8rem; line-height:0.9; margin-top:4px; color:#000;">${month}. ${day}</div>
            </div>
            <div class="card-top-right" style="text-align:right;">
              <div class="card-meta" style="font-size:0.55rem; margin-top:2px; color:var(--color-text-secondary);">
                ${cardCount} ${country}<br>
                ${displayYear} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}
              </div>
            </div>
          </div>
          <div class="history-card-image-wrap" style="margin: 0 0.75rem 0.75rem; border-radius:4px; overflow:hidden; position:relative; aspect-ratio:3/4;">
            <img src="${imageUrl}" alt="preview image" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.src='https://via.placeholder.com/300x400?text=No+Image'"/>
            <div style="position:absolute; bottom:0; left:0; right:0; padding:2rem 0.75rem 0.75rem; background:linear-gradient(transparent, rgba(0,0,0,0.7)); color:white; font-size:0.8rem; font-weight:600;">
              ${figureName}
            </div>
          </div>
        </div>
      `;
    }

    // 폼 변경 시 실시간 미리보기 연동
    const formEl = page.querySelector('#story-form');
    if(formEl) formEl.addEventListener('input', updatePreview);

  }, 0);

  return page;
}
