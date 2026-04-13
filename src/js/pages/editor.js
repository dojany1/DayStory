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
import { getState } from '../state.js';
import {
  fetchAllStoriesEditor,
  createStory,
  updateStory,
  deleteStory,
  publishStory,
  uploadImage,
  fetchStoryById
} from '../services/stories.js';
import { auth } from '../firebase.js';


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
  `;

  let allStories = [];
  let currentFilter = 'all';

  async function loadStories() {
    allStories = await fetchAllStoriesEditor();
    updateStats();
    renderList();
  }

  function updateStats() {
    const el = (id) => document.getElementById(id);
    if(!el('stat-total')) return;
    el('stat-total').textContent = allStories.length;
    el('stat-published').textContent = allStories.filter(s => s.status === 'published').length;
    el('stat-draft').textContent = allStories.filter(s => s.status === 'draft').length;
    el('stat-scheduled').textContent = allStories.filter(s => s.status === 'scheduled').length;
  }

  function renderList() {
    const listEl = document.getElementById('editor-list');
    if(!listEl) return;
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

    listEl.innerHTML = filtered.map(story => {
      const d = new Date(story.publish_date);
      const dateStr = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;

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
            <div class="editor-item-title">${story.title || story.figure_name}</div>
          </div>
          <div class="editor-item-actions">
            <button class="btn-icon editor-edit-btn" data-id="${story.id}" title="편집">✏️</button>
            <button class="btn-icon editor-delete-btn" data-id="${story.id}" title="삭제">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.editor-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(`/editor/new?edit=${btn.dataset.id}`);
      });
    });

    listEl.querySelectorAll('.editor-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('이 일화를 삭제하시겠습니까?')) {
          try {
            await deleteStory(btn.dataset.id);
            showToast('삭제 완료', 'success');
            loadStories();
          } catch (err) {
            showToast('삭제 실패: ' + err.message, 'error');
          }
        }
      });
    });
  }

  setTimeout(() => {
    document.getElementById('editor-new')?.addEventListener('click', () => {
      navigate('/editor/new');
    });

    page.querySelectorAll('.editor-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('.editor-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderList();
      });
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
  if(hash.includes('?')) {
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    editingId = urlParams.get('edit');
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
          <input class="input-field" id="sf-editor-comment" placeholder="카드 뒷면에 표시될 에디터의 코멘트" />
        </div>

        <!-- 5. 이미지 업로드/URL -->
        <div class="input-group">
          <label class="input-label">이미지 업로드 및 URL</label>
          <div style="display:flex; gap:var(--space-2); align-items:center;">
            <input class="input-field" id="sf-image" placeholder="URL 직접 입력 또는 사진 선택" style="flex:1;" />
            <label for="sf-image-file" class="btn btn-secondary" style="cursor:pointer; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">
              사진 추가
            </label>
            <input type="file" id="sf-image-file" accept="image/*" style="display:none;" />
          </div>
          <div id="sf-image-status" style="font-size:var(--text-xs); color:var(--color-primary); margin-top:var(--space-1); display:none;">사진을 업로드하는 중입니다... ⏳</div>
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
  setBeforeNavigate((targetPath) => {
    if (!saving && unsavedChanges) {
      const confirmLeave = window.confirm("저장되지 않은 정보가 있습니다. 정말 나가시겠습니까?");
      if (!confirmLeave) return false;
    }
    // 페이지 벗어날 때 리스너 제거
    window.removeEventListener('beforeunload', blockClose);
    setBeforeNavigate(null); // 훅 초기화
    return true;
  });

  setTimeout(async () => {
    let hasLoadedData = false;
    
    // 데이터 로드
    if (editingId) {
      const story = await fetchStoryById(editingId);
      if (story) {
        document.getElementById('sf-hist-year').value = story.historical_year || '';
        document.getElementById('sf-publish-date').value = story.publish_date || '';
        document.getElementById('sf-title').value = story.title || story.figure_name || '';
        document.getElementById('sf-country').value = story.country || '';
        document.getElementById('sf-body').value = story.body || '';
        document.getElementById('sf-image').value = story.image_url || '';
        document.getElementById('sf-editor-comment').value = story.editor_comment || (story.editor && story.editor.comment) || '';
        hasLoadedData = true;
      }
    }
    
    // 뒤로가기
    document.getElementById('editor-new-back')?.addEventListener('click', () => {
      history.back();
    });

    // 입력 감지
    const formEl = document.getElementById('story-form');
    if (formEl) {
      formEl.addEventListener('input', () => {
        unsavedChanges = true;
        updatePreview();
      });
    }

    // 초기 스켈레톤 렌더링 또는 데이터 렌더링
    updatePreview(hasLoadedData);

    /* 갤러리 이미지 업로드 (Firebase Storage) */
    document.getElementById('sf-image-file')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const STATUS_EL = document.getElementById('sf-image-status');
      const IMAGE_FIELD = document.getElementById('sf-image');
      if (!STATUS_EL || !IMAGE_FIELD) return;

      try {
        STATUS_EL.style.display = 'block';
        STATUS_EL.style.color = 'var(--color-primary)';
        STATUS_EL.textContent = '사진을 업로드하는 중입니다... ⏳';

        const url = await uploadImage(file);
        
        IMAGE_FIELD.value = url;
        STATUS_EL.textContent = '업로드 완료! ✅';
        STATUS_EL.style.color = 'var(--color-info)';
        
        unsavedChanges = true;
        IMAGE_FIELD.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (err) {
        console.error('이미지 업로드 오류:', err);
        STATUS_EL.style.color = 'var(--color-error)';
        STATUS_EL.textContent = '업로드 실패: ' + err.message;
        showToast('이미지 업로드 실패: ' + err.message, 'error');
      } finally {
        e.target.value = '';
        setTimeout(() => { 
          if (STATUS_EL && STATUS_EL.textContent.includes('완료')) {
            STATUS_EL.style.display = 'none';
          }
        }, 3000);
      }
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
    publishDateInput?.addEventListener('change', updateScheduleBtn);

    /* 저장 로직 */
    function getFormData() {
      const titleStr = document.getElementById('sf-title').value.trim();
      const histYear = parseInt(document.getElementById('sf-hist-year').value) || null;
      
      /* 현재 사용자의 계정 정보 가져오기 (Firebase Auth 중심, 없으면 State 폴백) */
      const u = auth?.currentUser;
      const stateUser = getState('user');
      const stateProfile = getState('profile') || {};
      
      let editorInfo = {
        uid: u?.uid || stateUser?.id || 'dokhubooks_uid',
        email: u?.email || stateUser?.email || 'dokhubooks@gmail.com',
        displayName: u?.displayName || stateProfile.displayName || (stateUser?.email ? stateUser.email.split('@')[0] : 'DayStory'),
        photoURL: u?.photoURL || stateProfile.photoURL || ''
      };

      return {
        figure_name: titleStr,
        title: titleStr,
        summary: '',
        body: document.getElementById('sf-body').value.trim(),
        historical_date: histYear ? `${histYear}년` : '',
        historical_year: histYear,
        country: document.getElementById('sf-country').value.trim(),
        publish_date: document.getElementById('sf-publish-date').value,
        image_url: document.getElementById('sf-image').value.trim(),
        card_count: '',
        editor: editorInfo,      /* 에디터 자동 할당 */
        editor_comment: document.getElementById('sf-editor-comment').value.trim(),
      };
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
      previewArea.innerHTML = `<div class="skeleton-card"></div>`;
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
    const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect fill='%23e0e0e0' width='300' height='400'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='40'%3E%F0%9F%93%B7%3C/text%3E%3Ctext x='50%25' y='58%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='14' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";
    const imageUrl = imgRaw || PLACEHOLDER_IMG;

    /* 에디터 프로필 정보 (미리보기용) */
    const u = auth?.currentUser;
    const stateProfile = getState('profile') || {};
    const editorPhotoURL = u?.photoURL || stateProfile.photoURL || '';
    const editorComment = escapeHTML(document.getElementById('sf-editor-comment')?.value.trim() || '');

    /* 홈 카드(home.js 379~423줄)와 완전히 동일한 HTML 구조 */
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
                <div class="card-meta">
                  ${country}<br>
                  ${displayYear} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}
                </div>
              </div>
            </div>
            <div class="history-card-image-wrap">
              <img src="${escapeHTML(imageUrl)}" alt="${figureName}" onerror="this.style.display='none'" />
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
              <button class="back-editor-btn" type="button" title="에디터 한마디">
                <img src="${escapeHTML(editorPhotoURL)}" alt="editor" class="back-editor-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
                <span class="back-editor-avatar-fallback" style="display:none">✍️</span>
              </button>
              <div class="back-date">${histYear}년 ${month}월 ${day}일</div>
            </div>
          </div>
        </div>
      </div>
    `;

    /* 카드 터치 시 플립 */
    const flipper = previewArea.querySelector('#preview-flipper');
    if (flipper) {
      flipper.addEventListener('click', (e) => {
        if (e.target.closest('.back-editor-btn')) return;
        flipper.classList.toggle('flipped');
      });
    }

    /* 에디터 한마디 버튼 클릭 시 코멘트 표시 */
    const editorBtn = previewArea.querySelector('.back-editor-btn');
    if (editorBtn) {
      editorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const comment = document.getElementById('sf-editor-comment')?.value.trim() || '에디터 코멘트가 없습니다.';
        const existing = previewArea.querySelector('.editor-comment-bubble');
        if (existing) { existing.remove(); return; }
        const bubble = document.createElement('div');
        bubble.className = 'editor-comment-bubble';
        bubble.textContent = comment;
        editorBtn.parentElement.appendChild(bubble);
        setTimeout(() => bubble.remove(), 3000);
      });
    }
  }

  return page;
}
