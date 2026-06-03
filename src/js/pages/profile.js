/* =====================================================================
   profile.js — 프로필 페이지 (탭: 프로필)
   =====================================================================
   하단 네비게이션의 "프로필" 탭이 가리키는 페이지입니다.
   사용자 정보 카드만 표시하며, 우상단 설정 버튼으로 /settings로 이동합니다.
   설정 섹션은 /settings 페이지(settings.js)에서 담당합니다.
   ===================================================================== */

import { navigate } from '../router.js';
import { renderPageHeader } from '../components/pageHeader.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getState, setState } from '../state.js';
import { auth, db, storage } from '../firebase.js';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { showToast } from '../components/toast.js';
import { pickFromCamera, pickFromGallery, CameraPermissionError } from '../services/camera.js';
import { renderArchiveSection, initArchiveSection } from './bookmarks.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';


/* ─────────────────────────────────────────────
   섹션 1: 페이지 렌더링
   ───────────────────────────────────────────── */

export function renderProfile() {
  const page = document.createElement('div');
  page.className = 'settings-page page';

  const user = getState('user');
  const profile = getState('profile');

  const isAdmin = getState('isAdmin');

  const adminBtn = isAdmin
    ? '<button type="button" id="goto-editor-btn" class="page-header-back" aria-label="콘텐츠 관리">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z"/>'
      + '<path d="M14.487 7.858A1 1 0 0 1 14 7V2"/>'
      + '<path d="M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516"/>'
      + '<path d="M8 18h1"/>'
      + '</svg></button>'
    : '';

  const gearBtn = '<button type="button" id="goto-settings-btn" class="page-header-back" aria-label="설정">'
    + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>'
    + '<circle cx="12" cy="12" r="3"/>'
    + '</svg></button>';

  const rightAction = isAdmin
    ? `<div class="page-header-actions" style="display:flex;align-items:center;">${adminBtn}${gearBtn}</div>`
    : gearBtn;

  const profileHeader = renderPageHeader({ title: '마이 페이지', icon: 'none', rightAction });

  page.innerHTML = `
    ${profileHeader}

    <!-- 사용자 정보 카드 (로그인 강제 이후 user 는 항상 존재) -->
    <div class="settings-user-info">
      ${user ? `
        <div class="settings-user-row">
          <div class="profile-avatar-wrap">
            ${(() => {
              /* legacy WebP 포함 photoURL 을 그대로 사용한다.
                 이전엔 isWebpUrl 차단으로 기존 유저 아바타가 fallback 으로 보이는 버그 발생.
                 디코드 실패 시 onerror 핸들러가 img 를 숨기고 옆 SVG 를 노출한다. */
              const rawUrl = (profile && profile.photoURL) || user.photoURL || '';
              const fallbackSvg = `<svg class="profile-avatar-fallback" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"${rawUrl ? ' style="display:none"' : ''}><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`;
              const imgOnError = "this.style.display='none';this.nextElementSibling.style.display='block';";
              return rawUrl
                ? `<img src="${escapeHtml(rawUrl)}" alt="" onerror="${imgOnError}" />${fallbackSvg}`
                : fallbackSvg;
            })()}
          </div>
          <div class="settings-user-meta">
            <div class="settings-user-name">
              ${(profile && profile.nickname) || user.displayName || (user.email ? user.email.split('@')[0] : '사용자')}
              ${isAdmin ? '<span class="settings-user-badge">관리자</span>' : ''}
            </div>
            <div class="settings-user-email">${user.email || '이메일 정보 없음'}</div>
          </div>
          <button id="profile-edit-btn" class="profile-edit-btn" aria-label="프로필 편집">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
      ` : ''}
    </div>

    ${renderArchiveSection()}
  `;

  /* 페이지 고유 동작: 프로필 편집, 설정 이동 */
  setTimeout(() => {
    page.querySelector('#profile-edit-btn')?.addEventListener('click', () => openProfileEditModal());
    page.querySelector('#goto-settings-btn')?.addEventListener('click', () => navigate('/settings'));
    page.querySelector('#goto-editor-btn')?.addEventListener('click', () => navigate('/editor'));
  }, 0);

  initArchiveSection(page, { myStoryClickMode: 'popup' });

  return page;
}


/**
 * syncProfileDom — 저장 성공 직후 현재 화면의 .settings-user-info 를 직접 업데이트.
 * 라우터 same-path no-op 우회용 Optimistic UI 패치.
 * @param {{ nickname: string, photoURL?: string, isEditor?: boolean }} next
 */
function syncProfileDom(next) {
  const root = document.querySelector('.settings-user-info');
  if (!root) return;

  /* 닉네임 — textContent 로 안전하게 갱신 후 admin 배지 복원 */
  const nameEl = root.querySelector('.settings-user-name');
  if (nameEl) {
    nameEl.textContent = next.nickname;
    if (next.isEditor) {
      const badge = document.createElement('span');
      badge.className = 'settings-user-badge';
      badge.textContent = '관리자';
      nameEl.appendChild(badge);
    }
  }

  /* 아바타 — photoURL 이 새로 들어왔을 때만 갱신 */
  if (!next.photoURL) return;
  const wrap = root.querySelector('.profile-avatar-wrap');
  if (!wrap) return;

  let img = wrap.querySelector('img');
  if (img) {
    img.src = next.photoURL;
    img.style.display = '';
  } else {
    img = document.createElement('img');
    img.alt = '';
    img.src = next.photoURL;
    img.onerror = function () {
      this.style.display = 'none';
      const sib = this.nextElementSibling;
      if (sib) sib.style.display = 'block';
    };
    wrap.insertBefore(img, wrap.firstChild);
  }
  const fallback = wrap.querySelector('svg');
  if (fallback) {
    fallback.classList.add('profile-avatar-fallback');
    fallback.style.display = 'none';
  }
}


/* ─────────────────────────────────────────────
   섹션 2: 프로필 편집 모달 (페이지 고유)
   ───────────────────────────────────────────── */

function openProfileEditModal() {
  const user = getState('user');
  const profile = getState('profile') || {};
  if (!user || !user.id) return;

  if (document.querySelector('.profile-edit-overlay')) return;

  const currentPhoto = profile.photoURL || user.photoURL || '';
  const currentNickname = profile.nickname || user.displayName || (user.email ? user.email.split('@')[0] : '');

  const overlay = document.createElement('div');
  overlay.className = 'profile-edit-overlay';

  overlay.innerHTML = `
    <div class="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
      <div class="profile-edit-header">
        <span class="profile-edit-title" id="profile-edit-title">프로필 편집</span>
        <button class="profile-edit-close" id="profile-edit-close" aria-label="닫기">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="profile-edit-body">
        <div class="profile-edit-avatar-section">
          <div class="profile-edit-avatar-wrap">
            <div class="profile-edit-avatar" id="profile-edit-avatar">
              ${currentPhoto
                ? `<img src="${currentPhoto}" />`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
              }
            </div>
            <button type="button" class="profile-edit-photo-icon" id="profile-edit-photo-btn" aria-label="프로필 사진 변경">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="profile-edit-field">
          <label class="profile-edit-label" for="profile-nickname-input">닉네임</label>
          <input type="text" class="profile-edit-input" id="profile-nickname-input"
                 value="${escapeHtml(currentNickname)}" maxlength="20" placeholder="닉네임을 입력하세요" />
          <div class="profile-edit-hint">최대 20자</div>
        </div>
      </div>

      <div class="profile-edit-actions">
        <button class="profile-edit-cancel" id="profile-edit-cancel" type="button">취소</button>
        <button class="profile-edit-save" id="profile-edit-save" type="button">저장</button>
      </div>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);
  lockScroll();
  requestAnimationFrame(() => overlay.classList.add('visible'));

  overlay.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.profile-edit-modal')) {
      e.preventDefault();
    }
  }, { passive: false });
  /* 휠 스크롤도 모달 외부에서는 차단 */
  overlay.addEventListener('wheel', (e) => {
    if (!e.target.closest('.profile-edit-modal')) {
      e.preventDefault();
    }
  }, { passive: false });

  let croppedBlob = null;

  const closeModal = () => {
    overlay.classList.remove('visible');
    document.removeEventListener('keydown', onKey);
    unlockScroll();
    setTimeout(() => overlay.remove(), 200);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('#profile-edit-close').addEventListener('click', closeModal);
  overlay.querySelector('#profile-edit-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  async function handleProfilePhotoPick(source) {
    try {
      const result = source === 'camera' ? await pickFromCamera() : await pickFromGallery();
      if (!result) return;
      openCropperForProfile(result.dataUrl, (blob) => {
        croppedBlob = blob;
        const avatarEl = overlay.querySelector('#profile-edit-avatar');
        const previewUrl = URL.createObjectURL(blob);
        avatarEl.innerHTML = `<img src="${previewUrl}" />`;
      });
    } catch (err) {
      if (err instanceof CameraPermissionError) {
        showToast(err.message, 'warning');
        return;
      }
      showToast(err?.message || '사진을 불러올 수 없습니다.', 'error');
    }
  }
  overlay.querySelector('#profile-edit-photo-btn')?.addEventListener('click', () => handleProfilePhotoPick('gallery'));

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

      if (croppedBlob) {
        const timestamp = Date.now();
        /* JPEG 사용: iOS WKWebView 의 WebP 디코더가 canvas-toBlob 결과를
           처리 못해 WebContent process 가 crash 하는 사례 발견. */
        const storageRef = ref(storage, `users/${uid}/diary/profile_avatar_${timestamp}.jpg`);
        await uploadBytes(storageRef, croppedBlob, { contentType: 'image/jpeg' });
        const downloadURL = await getDownloadURL(storageRef);
        updateData.photoURL = downloadURL;
      }

      await setDoc(profileRef, updateData, { merge: true });

      /* 전역 state 동기화 — 다른 페이지에서도 최신 값 사용. */
      const newProfile = { ...profile, ...updateData };
      setState('profile', newProfile);

      const updatedUser = { ...user };
      updatedUser.displayName = nickname;
      if (updateData.photoURL) updatedUser.photoURL = updateData.photoURL;
      setState('user', updatedUser);

      /* Optimistic UI — 현재 보이는 .settings-user-info 의 닉네임/아바타를 즉시 갱신.
         같은 경로(/profile) 로 navigate 해도 router 가 no-op 처리해 재렌더되지 않으므로
         DOM 을 직접 패치한다. */
      syncProfileDom({ nickname, photoURL: updateData.photoURL, isEditor: getState('isAdmin') });

      showToast('프로필이 수정되었습니다.', 'success');
      closeModal();
    } catch (err) {
      console.error('프로필 저장 실패:', err);
      showToast('프로필 저장에 실패했습니다.', 'error');
      saveBtn.textContent = '저장';
      saveBtn.disabled = false;
    }
  });
}


/* ─────────────────────────────────────────────
   섹션 3: 프로필 이미지 크롭 모달 (페이지 고유)
   ───────────────────────────────────────────── */

function openCropperForProfile(imageSrc, onConfirm) {
  const cropOverlay = document.createElement('div');
  cropOverlay.className = 'crop-modal-overlay';

  cropOverlay.innerHTML = `
    <div class="crop-modal-header">
      <button type="button" class="crop-modal-back-btn" id="btn-profile-crop-back" aria-label="뒤로가기">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
      프로필 사진 자르기
    </div>
    <div class="crop-modal-body">
      <img id="profile-cropper-image" src="${imageSrc}" style="max-width: 100%; display: block;" />
    </div>
    <div class="crop-modal-footer">
      <button type="button" class="btn-rotate" id="btn-profile-crop-rotate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"/>
          <path d="M21 13a9 9 0 1 1-2.63-6.36L21 9"/>
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
      aspectRatio: 1,
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

  const cancelCrop = () => {
    cropOverlay.style.opacity = '0';
    setTimeout(() => {
      if (cropper) cropper.destroy();
      cropOverlay.remove();
    }, 300);
  };
  cropOverlay.querySelector('#btn-profile-crop-back').addEventListener('click', cancelCrop);

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
    }, 'image/jpeg', 0.85);
  });
}
