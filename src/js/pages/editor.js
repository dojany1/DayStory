/* ============================================
   DayStory — Editor Management Page
   ============================================ */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { getState } from '../state.js';
import { fetchAllStoriesEditor, createStory, updateStory, deleteStory, publishStory } from '../services/stories.js';

export function renderEditor() {
  const page = document.createElement('div');
  page.className = 'editor-page page';

  const profile = getState('profile');
  if (!profile || profile.role !== 'editor') {
    page.innerHTML = `
      <div class="page-header"><h1 class="page-header-title">에디터</h1></div>
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <div class="empty-state-title">에디터 권한이 필요합니다</div>
        <div class="empty-state-desc">관리자에게 에디터 권한을 요청하세요</div>
      </div>
    `;
    return page;
  }

  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-header-title">콘텐츠 관리</h1>
      <button class="btn btn-primary" id="editor-new" style="padding:var(--space-2) var(--space-4);font-size:var(--text-sm);">
        + 새 일화
      </button>
    </div>

    <div class="editor-stats" id="editor-stats">
      <div class="editor-stat"><span class="editor-stat-value" id="stat-total">-</span><span class="editor-stat-label">전체</span></div>
      <div class="editor-stat"><span class="editor-stat-value" id="stat-published">-</span><span class="editor-stat-label">발행됨</span></div>
      <div class="editor-stat"><span class="editor-stat-value" id="stat-draft">-</span><span class="editor-stat-label">초안</span></div>
      <div class="editor-stat"><span class="editor-stat-value" id="stat-scheduled">-</span><span class="editor-stat-label">예약</span></div>
    </div>

    <div class="editor-filter-bar">
      <button class="editor-filter active" data-filter="all">전체</button>
      <button class="editor-filter" data-filter="published">발행됨</button>
      <button class="editor-filter" data-filter="draft">초안</button>
      <button class="editor-filter" data-filter="scheduled">예약</button>
    </div>

    <div id="editor-list" class="editor-list">
      <div style="display:flex;justify-content:center;padding:var(--space-8);"><div class="loading-spinner"></div></div>
    </div>

    <!-- Story Form Modal -->
    <div class="modal-overlay" id="story-modal" style="display:none;">
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="modal-title">새 일화 작성</h2>
          <button class="btn-icon" id="modal-close">✕</button>
        </div>
        <form id="story-form" class="story-form">
          <div class="input-group">
            <label class="input-label">인물/사건명 *</label>
            <input class="input-field" id="sf-figure" placeholder="예: Isaac Newton" required />
          </div>
          <div class="input-group">
            <label class="input-label">제목 *</label>
            <input class="input-field" id="sf-title" placeholder="카드 제목" required />
          </div>
          <div class="input-group">
            <label class="input-label">요약</label>
            <input class="input-field" id="sf-summary" placeholder="한 줄 요약" />
          </div>
          <div class="input-group">
            <label class="input-label">본문 *</label>
            <textarea class="report-textarea" id="sf-body" placeholder="역사 일화 본문을 입력하세요..." style="min-height:150px;" required></textarea>
          </div>
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
          <div class="input-group">
            <label class="input-label">이미지 URL</label>
            <input class="input-field" id="sf-image" placeholder="/images/example.png" />
          </div>
          <div class="input-group">
            <label class="input-label">카드 번호</label>
            <input class="input-field" id="sf-card-count" placeholder="21st" />
          </div>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4);">
            <button type="button" class="btn btn-secondary btn-full" id="sf-save-draft">초안 저장</button>
            <button type="submit" class="btn btn-primary btn-full">발행하기</button>
          </div>
        </form>
      </div>
    </div>
  `;

  let allStories = [];
  let currentFilter = 'all';
  let editingId = null;

  async function loadStories() {
    allStories = await fetchAllStoriesEditor();
    updateStats();
    renderList();
  }

  function updateStats() {
    const el = (id) => document.getElementById(id);
    el('stat-total').textContent = allStories.length;
    el('stat-published').textContent = allStories.filter(s => s.status === 'published').length;
    el('stat-draft').textContent = allStories.filter(s => s.status === 'draft').length;
    el('stat-scheduled').textContent = allStories.filter(s => s.status === 'scheduled').length;
  }

  function renderList() {
    const listEl = document.getElementById('editor-list');
    const filtered = currentFilter === 'all' ? allStories : allStories.filter(s => s.status === currentFilter);

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:var(--space-6);"><div class="empty-state-icon">📝</div><div class="empty-state-title">아직 콘텐츠가 없습니다</div></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(s => {
      const d = new Date(s.publish_date);
      const dateStr = `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
      const statusBadge = {
        published: '<span class="badge badge-accent">발행됨</span>',
        draft: '<span class="badge" style="background:var(--color-text-tertiary);color:#fff;">초안</span>',
        scheduled: '<span class="badge" style="background:var(--color-info);color:#fff;">예약</span>',
        archived: '<span class="badge" style="background:var(--color-bg-secondary);">보관</span>',
      }[s.status] || '';

      return `
        <div class="editor-item" data-id="${s.id}">
          <div class="editor-item-thumb">
            ${s.image_url ? `<img src="${s.image_url}" alt="" />` : '<div style="width:100%;height:100%;background:var(--color-bg-secondary);display:flex;align-items:center;justify-content:center;">📷</div>'}
          </div>
          <div class="editor-item-info">
            <div class="editor-item-meta">${dateStr} · ${s.country || '-'} ${statusBadge}</div>
            <div class="editor-item-title">${s.figure_name || s.title}</div>
          </div>
          <div class="editor-item-actions">
            <button class="btn-icon editor-edit-btn" data-id="${s.id}" title="편집">✏️</button>
            <button class="btn-icon editor-delete-btn" data-id="${s.id}" title="삭제">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    /* Bind actions */
    listEl.querySelectorAll('.editor-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(btn.dataset.id);
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

  function openEditModal(id) {
    editingId = id;
    const modal = document.getElementById('story-modal');
    const story = allStories.find(s => s.id === id);
    if (!story) return;

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
    modal.style.display = 'flex';
  }

  function openNewModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = '새 일화 작성';
    document.getElementById('story-form').reset();
    document.getElementById('story-modal').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('story-modal').style.display = 'none';
  }

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

  setTimeout(() => {
    document.getElementById('editor-new')?.addEventListener('click', openNewModal);
    document.getElementById('modal-close')?.addEventListener('click', closeModal);

    /* Filter tabs */
    page.querySelectorAll('.editor-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('.editor-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderList();
      });
    });

    /* Save draft */
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

    /* Publish */
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

    /* Close modal on overlay click */
    document.getElementById('story-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'story-modal') closeModal();
    });

    loadStories();
  }, 0);

  return page;
}
