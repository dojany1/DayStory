/* =====================================================================
   profile.js — 프로필 (북마크 컬렉션) 페이지
   =====================================================================
   사용자가 북마크(찜)한 역사 카드들을 모아보는 페이지입니다.
   
   기능:
     1) 북마크한 카드들을 2열 그리드로 표시
     2) 검색창에 검색어를 입력하면 실시간으로 필터링
     3) 카드를 클릭하면 상세 페이지로 이동
     4) 데이터 로딩 실패 시 에러 화면과 재시도 버튼 표시
     5) 로그인 사용자: 프로필 이미지/닉네임 편집
   ===================================================================== */

import { navigate } from '../router.js';
import { getBookmarkedStories } from '../services/bookmarks.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getState, setState } from '../state.js';
import { auth, db, storage } from '../firebase.js';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { showToast } from '../components/toast.js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

/* ─────────────────────────────────────────────
   섹션 1: 프로필 페이지 렌더링
   ───────────────────────────────────────────── */

/**
 * renderProfile — 사용자 프로필 페이지를 생성하고 반환합니다
 * @returns {HTMLElement} 프로필 페이지 DOM 요소
 */
export function renderProfile() {
  const page = document.createElement('div');
  page.className = 'archive-page page';

  /* 현재 설정값 가져오기 */
  const user = getState('user');
  const profile = getState('profile');

  page.innerHTML = `
    <!-- 페이지 헤더: 제목 및 톱니바퀴 -->
    <div class="page-header" style="align-items:center; display:flex; justify-content:space-between;">
      <h1 class="page-header-title" style="margin:0; font-size:1.5rem; font-weight:700;">내 프로필</h1>
      <div style="display:flex; align-items:center; gap:12px;">
        ${profile && profile.role === 'editor' ? `
        <button class="settings-editor-btn btn btn-primary" aria-label="콘텐츠 관리" style="width: 32px; height: 32px; padding: 0; border-radius: 50%; box-shadow: var(--shadow-sm); flex-shrink: 0; min-width: 0;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        ` : ''}
        <button class="settings-gear-btn" aria-label="설정" style="width:32px; height:32px; padding:0; background:none; border:none; color:var(--color-text-primary); cursor:pointer; display:flex; align-items:center; justify-content:center;">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- ===== 로그인 사용자 정보 섹션 ===== -->
    <div class="settings-user-info" style="margin-top: var(--space-2); margin-bottom: var(--space-2); padding: var(--space-3); background: var(--color-bg-secondary); border-radius: var(--radius-lg);">
      ${user && user.id !== 'guest' ? `
        <div style="display:flex; align-items:center; gap: var(--space-4);">
          <div class="profile-avatar-wrap" style="width:50px; height:50px; background:var(--color-bg-primary); border-radius:50%; display:flex; justify-content:center; align-items:center; overflow:hidden; flex-shrink:0;">
            ${(profile && profile.photoURL) || user.photoURL ? `<img src="${(profile && profile.photoURL) || user.photoURL}" style="width:100%; height:100%; object-fit:cover;" />` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px; color:var(--color-text-tertiary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:var(--text-lg); font-weight:600; color:var(--color-text-primary); display:flex; align-items:center; gap:8px;">
              ${(profile && profile.nickname) || user.displayName || (user.email ? user.email.split('@')[0] : '사용자')}
              ${profile && profile.role === 'editor' ? '<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: var(--color-accent); color: var(--color-text-tertiary); margin-left: var(--space-1);">관리자</span>' : ''}
            </div>
            <div style="font-size:var(--text-sm); color:var(--color-text-tertiary);">
              ${user.email || '이메일 정보 없음'}
            </div>
          </div>
          <!-- 프로필 편집 버튼 -->
          <button id="profile-edit-btn" class="profile-edit-btn" aria-label="프로필 편집">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
      ` : `
        <div style="display:flex; align-items:center; gap: var(--space-4); margin-bottom: var(--space-4);">
          <div style="width:50px; height:50px; background:var(--color-bg-primary); border-radius:50%; display:flex; justify-content:center; align-items:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px; color:var(--color-text-tertiary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <div>
            <div style="font-size:var(--text-lg); font-weight:600; color:var(--color-text-primary);">
              게스트 모드
            </div>
            <div style="font-size:var(--text-sm); color:var(--color-text-tertiary);">
              로그인하고 기록을 저장하세요
            </div>
          </div>
        </div>
        <button id="goto-login-btn" class="btn btn-primary" style="width:100%; padding: 8px 16px; font-size: var(--text-sm);">
          로그인 / 회원가입 하러 가기
        </button>
      `}
    </div>
    
    <!-- 북마크된 카드 검색창 -->
    <div class="profile-collection-toolbar">
      <div class="search-bar profile-collection-search" id="collection-search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="collection-search-input" placeholder="검색..." autocomplete="off" />
      </div>
    </div>

    <!-- 카드 그리드 영역 (로딩 중에는 스피너 표시) -->
    <div id="archive-content" style="display:flex;justify-content:center;padding: 0 var(--space-4) var(--space-8) var(--space-4);">
      <div class="loading-spinner"></div>
    </div>
  `;

  /* 이벤트 연결: 페이지가 렌더링된 후(DOM에 추가된 후) 요소들에 리스너를 붙임 */
  setTimeout(() => {
    const gearBtn = page.querySelector('.settings-gear-btn');
    if (gearBtn) gearBtn.addEventListener('click', () => navigate('/settings'));

    const editorBtn = page.querySelector('.settings-editor-btn');
    if (editorBtn) editorBtn.addEventListener('click', () => navigate('/editor'));

    const loginBtn = page.querySelector('#goto-login-btn');
    if (loginBtn) loginBtn.addEventListener('click', () => navigate('/login'));

    /* ---- 프로필 편집 버튼 ---- */
    const editBtn = page.querySelector('#profile-edit-btn');
    if (editBtn) editBtn.addEventListener('click', () => openProfileEditModal());
  }, 0);

  /* 데이터 로딩 시작 */
  loadCollection(page);

  return page;
}


/* ─────────────────────────────────────────────
   섹션 2: 북마크 데이터 로딩
   ───────────────────────────────────────────── */

/**
 * loadCollection — 서버에서 북마크 데이터를 가져와 화면에 표시합니다
 * @param {HTMLElement} page - renderArchive()에서 만든 페이지 요소
 * 
 * 동작 순서:
 *   1) 북마크된 스토리 목록을 서버에서 가져옴 (5초 타임아웃)
 *   2) 카드 수를 배지에 표시
 *   3) 카드 그리드를 렌더링
 *   4) 검색 기능 연결 (로컬 필터링)
 */
async function loadCollection(page) {
  const contentEl = page.querySelector('#archive-content') || document.getElementById('archive-content');
  const countEl = page.querySelector('#archive-count');

  try {
    /*
     * Promise.race()를 사용한 타임아웃 처리:
     * - 5초 안에 데이터가 오면 정상 처리
     * - 5초가 지나면 타임아웃 에러 발생 → catch 블록으로 이동
     * 이렇게 하면 서버가 느려도 무한 로딩을 방지할 수 있습니다.
     */
    const stories = await getBookmarkedStories();

    const allBookmarks = stories || [];

    /* 카드의 날짜(publish_date) 기준으로 최신순(내림차순) 정렬 */
    allBookmarks.sort((a, b) => {
      const dateA = new Date(a.publish_date).getTime() || 0;
      const dateB = new Date(b.publish_date).getTime() || 0;
      return dateB - dateA;
    });

    /**
     * renderStories — 스토리 배열을 받아 카드 그리드를 그립니다 (내부 함수)
     * @param {Array} list - 표시할 스토리 배열
     */
    const renderStories = (list) => {
      /* 표시할 카드가 없는 경우 */
      if (!list.length) {
        contentEl.className = '';
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">보관된 카드가 없습니다.</div>
          </div>
        `;
        return;
      }

      /* 2열 그리드로 미니 카드들을 표시 */
      contentEl.className = 'archive-grid';
      contentEl.style.display = ''; // 로딩용 인라인 스타일 제거
      contentEl.style.padding = ''; // 로딩용 인라인 패딩 제거
      contentEl.innerHTML = list.map(story => renderMiniCard(story)).join('');

      /* 각 카드에 클릭 → 상세 페이지 이동 이벤트 연결 */
      contentEl.querySelectorAll('.history-card-mini').forEach(card => {
        card.addEventListener('click', () => {
          navigate('/detail/' + card.dataset.storyId);
        });
      });
    };

    /* 전체 북마크 표시 */
    renderStories(allBookmarks);

    /* ---- 검색 기능 (로컬 필터링) ---- */
    const searchInput = page.querySelector('#collection-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();

        if (!query) {
          /* 검색어가 비어있으면 전체 표시 */
          renderStories(allBookmarks);
        } else {
          /* 인물 이름, 국가, 요약에서 검색어 포함 여부 확인 */
          const filtered = allBookmarks.filter(story =>
            (story.figure_name || '').toLowerCase().includes(query) ||
            (story.country || '').toLowerCase().includes(query) ||
            (story.summary || '').toLowerCase().includes(query)
          );
          renderStories(filtered);
        }
      });
    }

  } catch (err) {
    /* 데이터 로딩 실패 또는 타임아웃 */
    console.error('컬렉션 로딩 실패:', err);
    if (countEl) countEl.textContent = '오류 발생';

    contentEl.className = '';
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">데이터를 불러오지 못했습니다</div>
        <div class="empty-state-desc">네트워크 상태를 확인해주세요</div>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top:var(--space-4)">
          다시 시도
        </button>
      </div>
    `;
  }
}


/* ─────────────────────────────────────────────
   섹션 3: 미니 카드 HTML 생성
   ───────────────────────────────────────────── */

/**
 * renderMiniCard — 하나의 스토리 데이터로 미니 카드 HTML을 생성합니다
 * @param {Object} story - 스토리 데이터 객체
 * @returns {string} 미니 카드 HTML 문자열
 * 
 * 미니 카드 구조:
 *   ┌───────────┐
 *   │  [이미지]  │
 *   │           │
 *   │ 3.30      │
 *   │ 뉴턴      │
 *   └───────────┘
 */
function renderMiniCard(story) {
  const pubDate = new Date(story.publish_date);
  const month = pubDate.getMonth() + 1;
  const day = pubDate.getDate();
  const displayYear = new Date().getFullYear();

  return `
    <div class="history-card-mini" data-story-id="${escapeHtml(story.id)}">
      <div class="mini-card-top">
        <div class="mini-top-left">
          <div class="mini-year">${escapeHtml(story.historical_year)}</div>
          <div class="mini-date">${month}. ${day < 10 ? '0' + day : day}</div>
        </div>
        <div class="mini-top-right">
          ${escapeHtml(story.card_count || '')} ${escapeHtml(story.country)}<br>
          ${displayYear} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}
        </div>
      </div>
      <div class="mini-card-image-wrap">
        <img src="${escapeHtml(story.image_url)}" alt="${escapeHtml(story.figure_name)}" loading="lazy" />
        <div class="mini-card-overlay">
          ${escapeHtml(story.figure_name)}
        </div>
      </div>
    </div>
  `;
}


/* ─────────────────────────────────────────────
   섹션 4: 프로필 편집 모달
   ─────────────────────────────────────────────
   로그인한 사용자가 프로필 이미지와 닉네임을 변경할 수 있는 모달입니다.
   이미지 선택 시 Cropper.js로 1:1 비율 자르기를 수행한 뒤
   Firebase Storage에 업로드하고, 닉네임과 함께 Firestore profiles 문서를 업데이트합니다.
*/

function openProfileEditModal() {
  const user = getState('user');
  const profile = getState('profile') || {};
  if (!user || user.id === 'guest') return;

  /* 이미 열려있는 모달 방지 */
  if (document.querySelector('.profile-edit-overlay')) return;

  const currentPhoto = profile.photoURL || user.photoURL || '';
  const currentNickname = profile.nickname || user.displayName || (user.email ? user.email.split('@')[0] : '');

  /* ---- 모달 오버레이 생성 ---- */
  const overlay = document.createElement('div');
  overlay.className = 'profile-edit-overlay';

  overlay.innerHTML = `
    <div class="profile-edit-modal">
      <!-- 모달 헤더 -->
      <div class="profile-edit-header">
        <button class="profile-edit-close" id="profile-edit-close" aria-label="닫기">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <span class="profile-edit-title">프로필 편집</span>
        <button class="profile-edit-save" id="profile-edit-save">저장</button>
      </div>

      <!-- 프로필 이미지 편집 -->
      <div class="profile-edit-avatar-section">
        <div class="profile-edit-avatar" id="profile-edit-avatar">
          ${currentPhoto
            ? `<img src="${currentPhoto}" />`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
          }
        </div>
        <button class="profile-edit-photo-btn" id="profile-edit-photo-btn">사진 변경</button>
        <input type="file" id="profile-photo-input" accept="image/*" style="display:none;" />
      </div>

      <!-- 닉네임 입력 -->
      <div class="profile-edit-field">
        <label class="profile-edit-label" for="profile-nickname-input">닉네임</label>
        <input type="text" class="profile-edit-input" id="profile-nickname-input"
               value="${escapeHtml(currentNickname)}" maxlength="20" placeholder="닉네임을 입력하세요" />
        <div class="profile-edit-hint">최대 20자</div>
      </div>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  /* ---- 크롭된 Blob 임시 저장소 ---- */
  let croppedBlob = null;

  /* ---- 닫기 ---- */
  const closeModal = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.querySelector('#profile-edit-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  /* ---- 사진 변경 버튼 → 파일 선택 ---- */
  const photoBtn = overlay.querySelector('#profile-edit-photo-btn');
  const fileInput = overlay.querySelector('#profile-photo-input');
  photoBtn.addEventListener('click', () => fileInput.click());

  /* ---- 파일 선택 시 → Cropper 모달 띄우기 ---- */
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      openCropperForProfile(ev.target.result, (blob) => {
        croppedBlob = blob;
        /* 미리보기 업데이트 */
        const avatarEl = overlay.querySelector('#profile-edit-avatar');
        const previewUrl = URL.createObjectURL(blob);
        avatarEl.innerHTML = `<img src="${previewUrl}" />`;
      });
    };
    reader.readAsDataURL(file);
    fileInput.value = ''; // 같은 파일 재선택 허용
  });

  /* ---- 저장 ---- */
  overlay.querySelector('#profile-edit-save').addEventListener('click', async () => {
    const saveBtn = overlay.querySelector('#profile-edit-save');
    const nickname = overlay.querySelector('#profile-nickname-input').value.trim();

    if (!nickname) {
      showToast('닉네임을 입력해주세요.', 'warning');
      return;
    }

    saveBtn.textContent = '저장 중...';
    saveBtn.disabled = true;

    try {
      const uid = auth?.currentUser?.uid || user.id;
      const profileRef = doc(db, 'profiles', uid);
      const updateData = { nickname };

      /* 새 프로필 이미지가 있으면 Storage에 업로드 */
      if (croppedBlob) {
        const timestamp = Date.now();
        const storageRef = ref(storage, `users/${uid}/diary/profile_avatar_${timestamp}.webp`);
        await uploadBytes(storageRef, croppedBlob);
        const downloadURL = await getDownloadURL(storageRef);
        updateData.photoURL = downloadURL;
      }

      /* Firestore 프로필 문서 업데이트 (병합) */
      await setDoc(profileRef, updateData, { merge: true });

      /* 로컬 상태 업데이트 */
      const newProfile = { ...profile, ...updateData };
      setState('profile', newProfile);

      /* user 상태에도 displayName/photoURL 반영 */
      const updatedUser = { ...user };
      updatedUser.displayName = nickname;
      if (updateData.photoURL) updatedUser.photoURL = updateData.photoURL;
      setState('user', updatedUser);

      showToast('프로필이 수정되었습니다.', 'success');
      closeModal();

      /* 페이지 새로고침으로 반영 */
      navigate('/profile');
    } catch (err) {
      console.error('프로필 저장 실패:', err);
      showToast('프로필 저장에 실패했습니다.', 'error');
      saveBtn.textContent = '저장';
      saveBtn.disabled = false;
    }
  });
}


/* ─────────────────────────────────────────────
   섹션 5: 프로필 이미지 크롭 모달
   ─────────────────────────────────────────────
   1:1 비율 원형 프로필에 사용할 이미지를 자르는 Cropper 모달입니다.
*/
function openCropperForProfile(imageSrc, onConfirm) {
  const cropOverlay = document.createElement('div');
  cropOverlay.className = 'crop-modal-overlay';

  cropOverlay.innerHTML = `
    <div class="crop-modal-header">프로필 사진 자르기</div>
    <div class="crop-modal-body">
      <img id="profile-cropper-image" src="${imageSrc}" style="max-width: 100%; display: block;" />
    </div>
    <div class="crop-modal-footer">
      <button type="button" class="btn-rotate" id="btn-profile-crop-rotate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.53-11.23l5.67 5.66" />
        </svg>
        회전
      </button>
      <button type="button" class="btn-crop-confirm" id="btn-profile-crop-confirm">확인</button>
    </div>
  `;
  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(cropOverlay);
  setTimeout(() => cropOverlay.style.opacity = '1', 10);

  const image = cropOverlay.querySelector('#profile-cropper-image');
  let cropper;

  image.onload = () => {
    cropper = new Cropper(image, {
      aspectRatio: 1,          /* 프로필 이미지는 정사각형(1:1) */
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.9,
      restore: false,
      guides: false,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  };

  image.onerror = () => {
    showToast('이미지를 불러올 수 없습니다.', 'error');
    cropOverlay.remove();
  };

  cropOverlay.querySelector('#btn-profile-crop-rotate').addEventListener('click', () => {
    if (cropper) cropper.rotate(90);
  });

  cropOverlay.querySelector('#btn-profile-crop-confirm').addEventListener('click', () => {
    const btn = cropOverlay.querySelector('#btn-profile-crop-confirm');
    btn.textContent = '처리 중...';
    btn.disabled = true;

    if (!cropper) return;

    cropper.getCroppedCanvas({
      maxWidth: 512,
      maxHeight: 512,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    }).toBlob((blob) => {
      if (!blob) {
        showToast('크롭 오류가 발생했습니다.', 'error');
        btn.textContent = '확인';
        btn.disabled = false;
        return;
      }

      onConfirm(blob);
      cropper.destroy();
      cropOverlay.style.opacity = '0';
      setTimeout(() => cropOverlay.remove(), 300);
    }, 'image/webp', 0.85);
  });
}
