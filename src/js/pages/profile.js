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
import { auth, db, storage } from '../services/firebase.js';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { showToast } from '../components/toast.js';
import { pickFromCamera, pickFromGallery, CameraPermissionError } from '../services/camera.js';
import { renderArchiveSection, initArchiveSection } from './bookmarks.js';
import { getCurrentLang, t } from '../i18n/index.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { dismissWelcomeBadge } from '../components/navBadge.js';
import { hasSeen, markSeen, ONBOARDING_FLAGS } from '../services/onboarding.js';
import { saveAvatarToCache, loadAvatarFromCache, clearAvatarCache } from '../utils/avatarCache.js';
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

  /* 아바타 URL — 오프라인이면 localStorage 캐시를 우선 사용 */
  const uid = user?.id || '';
  const rawUrl = (profile && profile.photoURL) || user?.photoURL || '';
  const cachedUrl = uid ? loadAvatarFromCache(uid) : null;
  const effectiveUrl = (!navigator.onLine && cachedUrl) ? cachedUrl : rawUrl;

  const isAdmin = getState('isAdmin');

  const adminBtn = isAdmin
    ? `<button type="button" id="goto-editor-btn" class="page-header-back" aria-label="${t('editor.content_mgmt')}">`
      + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z"/>'
      + '<path d="M14.487 7.858A1 1 0 0 1 14 7V2"/>'
      + '<path d="M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516"/>'
      + '<path d="M8 18h1"/>'
      + '</svg></button>'
    : '';

  const gearBtn = `<button type="button" id="goto-settings-btn" class="page-header-back" aria-label="${t('nav.settings')}">`
    + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>'
    + '<circle cx="12" cy="12" r="3"/>'
    + '</svg></button>';

  const rightAction = isAdmin
    ? `<div class="page-header-actions" style="display:flex;align-items:center;">${adminBtn}${gearBtn}</div>`
    : gearBtn;

  const profileHeader = renderPageHeader({ title: t('profile.title'), icon: 'none', rightAction });

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
                 오프라인 시: effectiveUrl = localStorage 캐시 data URL.
                 onerror / load 핸들러는 renderProfile() setTimeout 블록에서 등록한다. */
              const fallbackSvg = `<svg class="profile-avatar-fallback" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"${effectiveUrl ? ' style="display:none"' : ''}><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`;
              return effectiveUrl
                ? `<img src="${escapeHtml(effectiveUrl)}" alt="" />${fallbackSvg}`
                : fallbackSvg;
            })()}
          </div>
          <div class="settings-user-meta">
            <div class="settings-user-name">
              ${(profile && profile.nickname) || user.displayName || (user.email ? user.email.split('@')[0] : t('common.default_user'))}
              ${isAdmin ? `<span class="settings-user-badge">${t('profile.admin_badge')}</span>` : ''}
            </div>
            <div class="settings-user-email">${user.email || t('profile.no_email')}</div>
          </div>
          <button id="profile-edit-btn" class="profile-edit-btn" aria-label="${t('profile.edit_title')}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
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

    /* 아바타 이미지 오프라인 캐시 핸들러 */
    if (uid) {
      const avatarImg = page.querySelector('.profile-avatar-wrap img');
      if (avatarImg) {
        /* 네트워크 로드 실패 시 → 캐시 시도 → 없으면 SVG 폴백 */
        avatarImg.addEventListener('error', () => {
          const cached = loadAvatarFromCache(uid);
          if (cached && avatarImg.src !== cached) {
            avatarImg.src = cached;
          } else {
            avatarImg.style.display = 'none';
            const fallback = avatarImg.nextElementSibling;
            if (fallback) fallback.style.display = 'block';
          }
        });
        /* Firebase URL 로드 성공 시 → 캐시 갱신 (오프라인 대비) */
        if (rawUrl && !effectiveUrl.startsWith('data:')) {
          avatarImg.addEventListener('load', () => {
            void saveAvatarToCache(uid, rawUrl);
          }, { once: true });
        }
      }
    }
  }, 0);

  initArchiveSection(page, { myStoryClickMode: 'popup' });

  /* 보관함(프로필) 방문 = 웰컴 카드 도착 확인.
     배지가 대기 중이었다면 최초 1회 축하 피드백을 보이고, 'N' 배지를 해제한다. */
  const welcomeWasPending = hasSeen(ONBOARDING_FLAGS.WELCOME_BADGE);
  dismissWelcomeBadge();
  if (welcomeWasPending && !hasSeen(ONBOARDING_FLAGS.TIP_WELCOME_CARD)) {
    markSeen(ONBOARDING_FLAGS.TIP_WELCOME_CARD);
    /* 보관함이 렌더된 직후 축하 토스트 (라우터 마운트 타이밍과 분리) */
    setTimeout(() => showToast(t('onboarding.welcome_tip'), 'success'), 400);
  }

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
      badge.textContent = t('profile.admin_badge');
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
  const modalUid = user.id;
  const modalCached = loadAvatarFromCache(modalUid);
  /* 오프라인이면 편집 모달 미리보기도 캐시 URL 사용 */
  const effectiveCurrentPhoto = (!navigator.onLine && modalCached) ? modalCached : currentPhoto;
  const currentNickname = profile.nickname || user.displayName || (user.email ? user.email.split('@')[0] : '');

  const overlay = document.createElement('div');
  overlay.className = 'profile-edit-overlay';

  overlay.innerHTML = `
    <div class="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
      <div class="profile-edit-header">
        <span class="profile-edit-title" id="profile-edit-title">${t('profile.modal_title')}</span>
        <button class="profile-edit-close" id="profile-edit-close" aria-label="${t('common.close')}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="profile-edit-body">
        <div class="profile-edit-avatar-section">
          <div class="profile-edit-avatar-wrap">
            <div class="profile-edit-avatar" id="profile-edit-avatar">
              ${effectiveCurrentPhoto
                ? `<img src="${effectiveCurrentPhoto}" />`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
              }
            </div>
            <button type="button" class="profile-edit-photo-icon" id="profile-edit-photo-btn" aria-label="${t('profile.change_photo')}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path fill="currentColor" stroke="none" d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <circle cx="19" cy="5" r="1.6" fill="var(--color-bg-primary)"/>
                <path stroke="var(--color-bg-primary)" stroke-width="1.5" d="m15 5 4 4"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="profile-edit-field">
          <label class="profile-edit-label" for="profile-nickname-input">${t('profile.nickname')}</label>
          <input type="text" class="profile-edit-input" id="profile-nickname-input"
                 value="${escapeHtml(currentNickname)}" maxlength="20" placeholder="${t('profile.nickname_placeholder')}" />
          <div class="profile-edit-hint">${t('profile.max_hint')}</div>
          <button class="profile-logout-btn" id="profile-logout-btn" type="button">${t('settings.row_logout')}</button>
        </div>
      </div>

      <div class="profile-edit-actions">
        <button class="profile-edit-cancel" id="profile-edit-cancel" type="button">${t('common.cancel')}</button>
        <button class="profile-edit-save" id="profile-edit-save" type="button">${t('common.save')}</button>
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
  overlay.querySelector('#profile-logout-btn').addEventListener('click', async () => {
    /* 로그아웃 시 아바타 캐시 삭제 */
    clearAvatarCache(modalUid);
    closeModal();
    try {
      if (auth) {
        const { signOut } = await import('firebase/auth');
        await Promise.race([signOut(auth), new Promise(r => setTimeout(r, 2000))]);
      }
    } catch (err) {
      console.warn('로그아웃 오류 (무시됨):', err);
    }
    setState('user', null);
    setState('profile', null);
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = 'none';
    window.location.hash = '#/login';
    showToast(t('toast.logged_out'), 'success');
  });
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
      showToast(err?.message || t('common.photo_load_failed'), 'error');
    }
  }
  overlay.querySelector('#profile-edit-photo-btn')?.addEventListener('click', () => handleProfilePhotoPick('gallery'));

  overlay.querySelector('#profile-edit-save').addEventListener('click', async () => {
    const saveBtn = overlay.querySelector('#profile-edit-save');
    const nickname = overlay.querySelector('#profile-nickname-input').value.trim();

    if (!nickname) {
      showToast(t('profile.toast_need_nickname'), 'warning');
      return;
    }

    saveBtn.textContent = t('profile.saving');
    saveBtn.disabled = true;

    try {
      const uid = auth?.currentUser?.uid || user.id;
      const profileRef = doc(db, 'profiles', uid);
      /* 프로필 업데이트 시 현재 언어 설정도 함께 영구 저장 (기기 변경 후 동기화용) */
      const updateData = { nickname, languagePreference: getCurrentLang() };

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

      showToast(t('profile.toast_updated'), 'success');
      closeModal();
    } catch (err) {
      console.error('프로필 저장 실패:', err);
      showToast(t('profile.toast_save_failed'), 'error');
      saveBtn.textContent = t('common.save');
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
      <button type="button" class="crop-modal-back-btn" id="btn-profile-crop-back" aria-label="${t('common.back')}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
      ${t('profile.crop_title')}
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
        ${t('editor.rotate')}
      </button>
      <button type="button" class="btn-crop-confirm" id="btn-profile-crop-confirm">${t('common.confirm')}</button>
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
    showToast(t('editor.image_load_failed'), 'error');
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
    btn.textContent = t('common.processing');
    btn.disabled = true;

    if (!cropper) return;

    cropper.getCroppedCanvas({
      maxWidth: 512,
      maxHeight: 512,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    }).toBlob((blob) => {
      if (!blob) {
        showToast(t('editor.crop_error'), 'error');
        btn.textContent = t('common.confirm');
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
