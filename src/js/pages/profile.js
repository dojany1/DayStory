/* =====================================================================
   profile.js — 설정 페이지 (탭: 설정)
   =====================================================================
   하단 네비게이션의 "설정" 탭이 가리키는 페이지입니다.
   사용자 정보 카드(이 페이지 고유) + 공유 설정 섹션(알림·테마·에디터·계정·앱 정보).
   설정 섹션은 src/js/components/settingsSections.js 의 renderSettingsSections() /
   bindSettingsSections() 를 그대로 사용해 다른 진입점과 통일.
   북마크/검색은 별도의 보관함(/bookmarks) 페이지가 담당.
   ===================================================================== */

import { navigate } from '../router.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getState, setState } from '../state.js';
import { auth, db, storage } from '../firebase.js';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { showToast } from '../components/toast.js';
import { renderSettingsSections, bindSettingsSections } from '../components/settingsSections.js';
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

  page.innerHTML = `
    <div class="page-header page-header-centered">
      <h1 class="page-header-title">설정</h1>
    </div>

    <!-- 사용자 정보 카드 (이 페이지 전용) -->
    <div class="settings-user-info">
      ${user && user.id !== 'guest' ? `
        <div class="settings-user-row">
          <div class="profile-avatar-wrap">
            ${(profile && profile.photoURL) || user.photoURL
              ? `<img src="${(profile && profile.photoURL) || user.photoURL}" alt="" />`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
            }
          </div>
          <div class="settings-user-meta">
            <div class="settings-user-name">
              ${(profile && profile.nickname) || user.displayName || (user.email ? user.email.split('@')[0] : '사용자')}
              ${profile && profile.role === 'editor' ? '<span class="settings-user-badge">관리자</span>' : ''}
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
      ` : `
        <div class="settings-user-row">
          <div class="profile-avatar-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <div class="settings-user-meta">
            <div class="settings-user-name">게스트 모드</div>
            <div class="settings-user-email">로그인하고 기록을 저장하세요</div>
          </div>
        </div>
        <button id="goto-login-btn" class="btn btn-primary settings-user-cta">
          로그인 / 회원가입 하러 가기
        </button>
      `}
    </div>

    ${renderSettingsSections()}
  `;

  /* 공유 설정 섹션 바인딩(알림/위젯/테마/에디터/계정/라이선스) */
  bindSettingsSections(page);

  /* 페이지 고유 동작: 프로필 편집, 로그인 이동 */
  setTimeout(() => {
    page.querySelector('#goto-login-btn')?.addEventListener('click', () => navigate('/login'));
    page.querySelector('#profile-edit-btn')?.addEventListener('click', () => openProfileEditModal());
  }, 0);

  return page;
}


/* ─────────────────────────────────────────────
   섹션 2: 프로필 편집 모달 (페이지 고유)
   ───────────────────────────────────────────── */

function openProfileEditModal() {
  const user = getState('user');
  const profile = getState('profile') || {};
  if (!user || user.id === 'guest') return;

  if (document.querySelector('.profile-edit-overlay')) return;

  const currentPhoto = profile.photoURL || user.photoURL || '';
  const currentNickname = profile.nickname || user.displayName || (user.email ? user.email.split('@')[0] : '');

  const overlay = document.createElement('div');
  overlay.className = 'profile-edit-overlay';

  overlay.innerHTML = `
    <div class="profile-edit-modal">
      <div class="profile-edit-header">
        <button class="profile-edit-close" id="profile-edit-close" aria-label="닫기">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <span class="profile-edit-title">프로필 편집</span>
        <button class="profile-edit-save" id="profile-edit-save">저장</button>
      </div>

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

  let croppedBlob = null;

  const closeModal = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.querySelector('#profile-edit-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const photoBtn = overlay.querySelector('#profile-edit-photo-btn');
  const fileInput = overlay.querySelector('#profile-photo-input');
  photoBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      openCropperForProfile(ev.target.result, (blob) => {
        croppedBlob = blob;
        const avatarEl = overlay.querySelector('#profile-edit-avatar');
        const previewUrl = URL.createObjectURL(blob);
        avatarEl.innerHTML = `<img src="${previewUrl}" />`;
      });
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

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
        const storageRef = ref(storage, `users/${uid}/diary/profile_avatar_${timestamp}.webp`);
        await uploadBytes(storageRef, croppedBlob);
        const downloadURL = await getDownloadURL(storageRef);
        updateData.photoURL = downloadURL;
      }

      await setDoc(profileRef, updateData, { merge: true });

      const newProfile = { ...profile, ...updateData };
      setState('profile', newProfile);

      const updatedUser = { ...user };
      updatedUser.displayName = nickname;
      if (updateData.photoURL) updatedUser.photoURL = updateData.photoURL;
      setState('user', updatedUser);

      showToast('프로필이 수정되었습니다.', 'success');
      closeModal();
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
   섹션 3: 프로필 이미지 크롭 모달 (페이지 고유)
   ───────────────────────────────────────────── */

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
