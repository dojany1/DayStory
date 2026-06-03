/* =====================================================================
   mystory.js — 나의 일화 (일반 사용자 전용)
   =====================================================================
   사용자가 자신의 이야기를 확인하고 추가/수정하는 페이지입니다.
   홈 화면의 일화 카드와 디자인 일관성을 유지하기 위해 원본 카드 뷰를 사용합니다.

   좌우 스와이프는 Swiper.js 11 기반으로 통합되었습니다 (2026-05-24).
   ===================================================================== */

import { navigate, getParams } from '../router.js';
import { getState } from '../state.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/confirmDialog.js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { fetchMyStories, createMyStory, updateMyStory, fetchMyStoryById, deleteMyStory } from '../services/mystories.js';
import { escapeHtml } from '../utils/sanitize.js';
import { isFirebaseStorageUrl } from '../utils/storage.js';
import { auth, storage } from '../firebase.js';
import { ref as fsRef, getBlob } from 'firebase/storage';
import { shareStory, captureAndShareCard } from '../services/sharing.js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { syncDiaryStateFromList } from '../services/widget.js';
import { uploadImage } from '../services/images.js';
import { pickImage, CameraPermissionError } from '../services/camera.js';

import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { renderPageHeader, bindPageHeaderBack } from '../components/pageHeader.js';

import { buildCardDeck } from '../components/cardDeck/cardDeckController.js';
import {
  cardShell, cardFront, cardFrontTop, cardImageWrap, cardBack, emptyCardFace, cardActionButton,
  bindCardBase, parseIsoDate, formatMonthNameDate, bodyToHtml, SHARE_ICON_SVG,
} from '../components/cardDeck/cardFace.js';

const CARD_IMAGE_CROP_ASPECT_RATIO = 4 / 5;

function getMyStoryAuthorNickname(story = {}) {
  const profile = getState('profile') || {};
  const user = getState('user') || {};
  const emailName = typeof user.email === 'string' ? user.email.split('@')[0] : '';
  const candidates = [
    story.author_nickname,
    story.authorNickname,
    story.author?.nickname,
    story.author?.displayName,
    profile.nickname,
    user.displayName,
    emailName,
  ];
  const nickname = candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);
  return nickname || '사용자';
}

/* ─────────────────────────────────────────────
   섹션 1: 나의 일화 목록 페이지 (싱글 카드 + 휠 피커 + Swiper)
   ───────────────────────────────────────────── */
export function renderMyStory() {
  return buildCardDeck({
    idPrefix: 'mystory',
    pageClass: 'mystory-page',
    headerHtml: '',
    enterDir: 'from-right',
    calMode: 'mine',
    lastDateKey: 'lastMyStoryDate',

    loadData: async () => {
      const user = getState('user');
      /* Firebase Auth 실제 UID 우선 (Firestore 보안 규칙 request.auth.uid 일치) */
      const uid = auth?.currentUser?.uid || user?.id;
      const allStories = await fetchMyStories(uid);
      void syncDiaryStateFromList(allStories);
      const params = getParams();
      return {
        stories: allStories,
        /* 마지막 방문 날짜 > URL date > (없으면 컨트롤러가 오늘로 fallback) */
        initialDate: getState('lastMyStoryDate') || params.date || null,
        calStores: { historyStories: [], myStories: allStories },
        bookmarkedIds: [],
      };
    },

    renderSlideHTML: (raw, iso) => buildMyStorySlideHTML(raw, iso),
    bindCard: (flip, raw, iso) => bindMyStoryCardEvents(flip, raw, iso),

    errorHtml: () => '<div class="empty-state"><div class="empty-state-title">오류가 발생했습니다</div></div>',
  });
}


/* ─────────────────────────────────────────────
   섹션 1-2: 슬라이드 HTML 빌더 (Swiper Virtual용)
   ───────────────────────────────────────────── */

function buildMyStorySlideHTML(story, isoDateStr) {
  const { month, day, year: displayYear } = parseIsoDate(isoDateStr);

  if (!story) {
    return emptyCardFace({
      day,
      title: '이 날의 기록이 없습니다.',
      dateStr: formatMonthNameDate(isoDateStr),
      extraHtml: `<button class="btn btn-primary mystory-write-btn" data-date="${isoDateStr}">
              + 나의 일화 쓰기
            </button>`,
      flipperClass: 'mystory-flipper',
    });
  }

  const [storyYearRaw, storyMonthRaw, storyDayRaw] = String(story.publish_date || isoDateStr).split('-');
  const storyYear = parseInt(storyYearRaw, 10) || displayYear;
  const storyMonth = parseInt(storyMonthRaw, 10) || month;
  const storyDay = parseInt(storyDayRaw, 10) || day;
  const authorNickname = getMyStoryAuthorNickname(story);

  const editSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                    <path d="m15 5 4 4"/>
                  </svg>`;

  const actionsHtml = `${cardActionButton({ ariaLabel: '공유', svg: SHARE_ICON_SVG, extraClass: 'share-my-story-btn', dataId: story.id })}
                ${cardActionButton({ ariaLabel: '수정', svg: editSvg, extraClass: 'edit-my-story-btn', dataId: story.id })}`;

  const frontHtml = cardFront({
    topHtml: cardFrontTop({
      yearHtml: String(storyYear),
      yearClass: 'mystory-card-year',
      dateLabel: `${storyMonth}. ${storyDay}`,
      actionsHtml,
      metaHtml: escapeHtml(authorNickname),
    }),
    /* story.image_url 을 그대로 부여(legacy .webp 포함); cardImageWrap 이 fallback/onerror 처리 */
    imageHtml: cardImageWrap({ src: story.image_url, alt: story.title, title: story.title }),
  });

  const backHtml = cardBack({
    title: story.title,
    bodyHtml: bodyToHtml(story.body),
    footerHtml: `<div class="back-date">${storyYear}년 ${storyMonth}월 ${storyDay}일</div>`,
  });

  return cardShell({ frontHtml, backHtml, flipperClass: 'mystory-flipper' });
}


/* ─────────────────────────────────────────────
   섹션 1-3: 카드 이벤트 (플립 + 액션 버튼)
   ───────────────────────────────────────────── */

function bindMyStoryCardEvents(flipContainer, story, isoDateStr) {
  if (flipContainer.dataset.bound === '1') return;

  /* 공통: press 피드백 + 이미지 fade + flip 토글 (버튼 클릭은 flip 무시) */
  const flipper = bindCardBase(flipContainer, {
    story,
    ignoreSelectors: ['button'],
    flipDurationMs: 400,
  });
  if (!flipper) return;
  flipContainer.dataset.bound = '1';

  /* 상단 액션 버튼 (mystory 전용) */
  const writeBtn = flipContainer.querySelector('.mystory-write-btn');
  const shareBtn = flipContainer.querySelector('.share-my-story-btn');
  const editBtn = flipContainer.querySelector('.edit-my-story-btn');

  const checkAuth = () => {
    const userObj = getState('user') || {};
    const uid = auth?.currentUser?.uid || userObj.id;
    if (!uid) {
      showToast('로그인이 필요한 서비스입니다.', 'error');
      location.hash = '#/login';
      return false;
    }
    return true;
  };

  if (writeBtn) {
    writeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!checkAuth()) return;
      navigate('/mystory/new?date=' + writeBtn.dataset.date);
    });
  }

  if (shareBtn && story) {
    shareBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!checkAuth()) return;
      const cardEl = flipContainer.querySelector('.history-card-front');
      if (!cardEl) {
        await shareStory(story, { kind: 'mystory', includeImage: false });
        return;
      }
      shareBtn.disabled = true;
      try {
        const res = await captureAndShareCard(cardEl, {
          title: story.title || 'DayStory',
          text: `[DayStory] ${story.title || ''}`.trim(),
          dialogTitle: '나의 일화 공유',
        });
        if (!res.ok && res.reason !== 'cancelled') {
          await shareStory(story, { kind: 'mystory', includeImage: false });
        }
      } finally {
        shareBtn.disabled = false;
      }
    });
  }

  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!checkAuth()) return;
      navigate('/mystory/new?edit=' + editBtn.dataset.id);
    });
  }
}


/* ─────────────────────────────────────────────
   섹션 2: 나의 일화 폼 (렌더링 & 제출)
   ───────────────────────────────────────────── */
export function renderMyStoryNew() {
  const page = document.createElement('div');
  page.className = 'mystory-new-page page';

  /* ---- 로그인/비회원 체크 (라우터 가드에서 이미 막혀야 하지만 안전망) ---- */
  const userObj = getState('user') || {};
  const uid = auth?.currentUser?.uid || userObj.id;
  if (!uid) {
    page.innerHTML = `
      ${renderPageHeader({ title: '권한 없음', backLabel: '뒤로' })}
      <div class="empty-state" style="padding-top: 100px;">
        <div class="empty-state-title">로그인이 필요합니다</div>
        <div class="empty-state-desc">나의 일화를 작성하려면 로그인해주세요.</div>
        <button class="btn btn-primary" style="margin-top: 16px;" id="ms-no-auth-back">뒤로 가기</button>
      </div>
    `;
    setTimeout(() => {
      bindPageHeaderBack(page, () => history.back());
      document.getElementById('ms-no-auth-back')?.addEventListener('click', () => history.back());
    }, 0);
    return page;
  }

  const user = userObj;
  const params = getParams();
  let editingId = params.edit || null;
  let defaultDate = params.date || new Date().toISOString().split('T')[0];
  let originalSnapshot = null;

  page.innerHTML = `
    ${renderPageHeader({ title: editingId ? '나의 일화 수정' : '나의 일화 쓰기', backLabel: '뒤로' })}

    <div class="editor-form-section section mystory-form-section">
      <form id="mystory-form" class="story-form">
        <!-- 1. 날짜 -->
        <div class="input-group">
          <label class="input-label">날짜 *</label>
          <input class="input-field" type="date" id="ms-date" required style="text-align:left; -webkit-appearance:none; appearance:none;" />
        </div>
        <!-- 2. 카드 이미지 -->
        <div class="input-group">
          <input type="hidden" id="ms-image" />
          <input type="hidden" id="ms-image-thumb" />
          <div id="ms-image-upload-area" class="ms-image-upload-area" role="button" tabindex="0" aria-label="카드 이미지 업로드">
            <div id="ms-image-placeholder" class="ms-image-upload-placeholder">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/>
                <line x1="16" x2="22" y1="5" y2="5"/>
                <line x1="19" x2="19" y1="2" y2="8"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span>카드 이미지 업로드</span>
            </div>
            <img id="ms-image-preview" class="ms-image-upload-preview" style="display:none;" alt="카드 이미지 미리보기" />
          </div>
        </div>
        <!-- 3. 단일 제목 -->
        <div class="input-group">
          <label class="input-label">제목</label>
          <input class="input-field" id="ms-title" />
        </div>
        <!-- 4. 본문 -->
        <div class="input-group">
          <label class="input-label">본문</label>
          <textarea class="input-field" id="ms-body" style="min-height:250px; resize:vertical; line-height:1.6; font-family:var(--font-body);"></textarea>
        </div>
        ${editingId ? `
          <!-- 편집 모드: 폼 하단 우측에 삭제 버튼 배치 -->
          <div class="mystory-form-inline-actions">
            <button type="button" class="btn btn-secondary mystory-form-delete-btn" id="delete-my-story-edit">삭제</button>
          </div>
        ` : ''}
      </form>
    </div>

    <!-- 화면 하단 floating 액션 영역 (저장 버튼) -->
    <div class="mystory-form-actions">
      <button type="submit" form="mystory-form" id="ms-save-btn" class="btn btn-primary btn-full">저장하기</button>
    </div>
  `;

  setTimeout(async () => {
    function hasUnsavedChanges() {
      if (editingId) {
        if (!originalSnapshot) return false;
        return (
          (document.getElementById('ms-title')?.value ?? '') !== originalSnapshot.title ||
          (document.getElementById('ms-body')?.value ?? '') !== originalSnapshot.body ||
          (document.getElementById('ms-date')?.value ?? '') !== originalSnapshot.date ||
          (document.getElementById('ms-image')?.value ?? '') !== originalSnapshot.image_url
        );
      }
      return !!(
        document.getElementById('ms-title')?.value.trim() ||
        document.getElementById('ms-body')?.value.trim() ||
        document.getElementById('ms-image')?.value
      );
    }

    async function handleBack() {
      if (hasUnsavedChanges()) {
        const confirmed = await showConfirm({
          title: '저장하지 않고 나가기',
          message: '작성 중인 내용이 저장되지 않습니다.\n나가시겠습니까?',
          confirmText: '나가기',
          cancelText: '취소',
        });
        if (!confirmed) return;
      }
      history.back();
    }

    bindPageHeaderBack(page, handleBack);

    if (Capacitor.isNativePlatform()) {
      const backListener = await CapApp.addListener('backButton', handleBack);
      window.addEventListener('hashchange', () => backListener.remove(), { once: true });
    }
    let dateInput = document.getElementById('ms-date');
    if (dateInput) dateInput.value = defaultDate;

    let allStories = [];
    try {
      allStories = await fetchMyStories(uid);
    } catch(e) {}

    dateInput?.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected) {
        const conflict = allStories.find(s => s.publish_date === selected && String(s.id) !== String(editingId));
        if (conflict) {
          showToast('이미 등록된 일화가 있는 날짜입니다.', 'error');
          e.target.value = '';
        }
      }
    });

    if (editingId) {
      const story = await fetchMyStoryById(editingId, user.id);
      if (story) {
        document.getElementById('ms-title').value = story.title || '';
        document.getElementById('ms-date').value = story.publish_date || defaultDate;
        document.getElementById('ms-body').value = story.body || '';
        document.getElementById('ms-image').value = story.image_url || '';
        document.getElementById('ms-image-thumb').value = story.image_thumb_url || '';
        updateImagePreview(story.image_url || '');
        originalSnapshot = {
          title: story.title || '',
          body: story.body || '',
          date: story.publish_date || defaultDate,
          image_url: story.image_url || '',
        };
      }
    }

    document.getElementById('delete-my-story-edit')?.addEventListener('click', async () => {
      if (!editingId) return;
      const confirmed = await showConfirm({
        title: '일화 삭제',
        message: '이 일화를 삭제하시겠습니까?\n삭제한 일화는 복구할 수 없습니다.',
        confirmText: '삭제',
        cancelText: '취소',
        danger: true,
      });
      if (!confirmed) return;

      try {
        await deleteMyStory(editingId);
        void syncDiaryStateFromList(allStories.filter((story) => String(story.id) !== String(editingId)));
        showToast('일화가 삭제되었습니다.', 'success');
        /* 진입 경로(/mystory, /profile, /editorstory 등)로 자연스럽게 복귀.
           PageHeader 뒤로가기 버튼과 동일한 history.back() 패턴을 사용한다.
           history 가 비어있는 외부 진입(직접 URL, 알림 등) 케이스를 위해
           일정 시간 내 hashchange 가 없으면 /mystory 로 fallback. */
        const beforeHash = window.location.hash;
        const fallbackTimer = setTimeout(() => {
          if (window.location.hash === beforeHash) {
            navigate('/mystory');
          }
        }, 300);
        window.addEventListener('hashchange', () => clearTimeout(fallbackTimer), { once: true });
        history.back();
      } catch (err) {
        showToast('삭제 중 오류가 발생했습니다.', 'error');
      }
    });

    const formEl = document.getElementById('mystory-form');

    async function openCropModal(imageSrc, isCrossOrigin = false, callbackBlobFile) {
      let localSrc = imageSrc;
      if (isCrossOrigin) {
        if (!isFirebaseStorageUrl(imageSrc)) {
          showToast('외부 이미지는 편집할 수 없습니다.\n[사진 추가]로 새 이미지를 업로드해주세요.', 'error');
          return;
        }
        try {
          /* fetch() 대신 Firebase Storage SDK 사용 — CORS 없이 SDK가 직접 다운로드 */
          const url = new URL(imageSrc);
          const encodedPath = url.pathname.split('/o/')[1] || '';
          const storagePath = decodeURIComponent(encodedPath.split('?')[0]);
          const blob = await getBlob(fsRef(storage, storagePath));
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
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          카드 이미지 편집
        </div>
        <div class="crop-modal-body">
          <img id="cropper-image" src="${localSrc}" style="max-width: 100%; display: block;" />
        </div>
        <div class="crop-modal-footer">
          <button type="button" class="btn-rotate" id="btn-crop-rotate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6"/>
              <path d="M21 13a9 9 0 1 1-2.63-6.36L21 9"/>
            </svg>
            회전
          </button>
          <button type="button" class="btn-crop-confirm" id="btn-crop-confirm">완료</button>
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

      overlay.querySelector('#btn-crop-rotate').addEventListener('click', () => {
        if(cropper) cropper.rotate(90);
      });

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

          overlay.style.opacity = '0';
          unlockScroll();
          setTimeout(() => {
            cropper.destroy();
            if (isCrossOrigin && localSrc.startsWith('blob:')) URL.revokeObjectURL(localSrc);
            overlay.remove();
          }, 300);

          callbackBlobFile(blob);
        }, 'image/jpeg', 0.85);
      });
    }

    const ICON_SPINNER = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:ms-spin 1s linear infinite;flex-shrink:0;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    const ICON_CHECK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20 6 9 17l-5-5"/></svg>`;

    function setSaveBtnUploading() {
      const btn = document.getElementById('ms-save-btn');
      if (!btn) return;
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.innerHTML = `${ICON_SPINNER}업로드 중...`;
    }

    function setSaveBtnDone() {
      const btn = document.getElementById('ms-save-btn');
      if (!btn) return;
      btn.disabled = false;
      btn.style.opacity = '';
      btn.innerHTML = `${ICON_CHECK}업로드 완료!`;
      setTimeout(() => {
        if (btn) btn.innerHTML = '저장하기';
      }, 2000);
    }

    function setSaveBtnReady() {
      const btn = document.getElementById('ms-save-btn');
      if (!btn) return;
      btn.disabled = false;
      btn.style.opacity = '';
      btn.innerHTML = '저장하기';
    }

    async function processUploadBlob(blob, fallbackName) {
      const IMAGE_FIELD = document.getElementById('ms-image');
      if (!IMAGE_FIELD) return;

      try {
        setSaveBtnUploading();
        if (!uid) {
          showToast('로그인이 필요합니다.', 'error');
          return;
        }
        blob.name = fallbackName;
        const { image_url } = await uploadImage(blob, { uid, folder: 'diary' });

        const imageInput = document.getElementById('ms-image');
        const thumbInput = document.getElementById('ms-image-thumb');
        if (imageInput) imageInput.value = image_url;
        if (thumbInput) thumbInput.value = '';
        setSaveBtnDone();
        updateImagePreview(image_url);
      } catch (error) {
        console.error('이미지 업로드 오류:', error);
        setSaveBtnReady();
        showToast('이미지 저장에 실패했습니다.', 'error');
      }
    }

    function updateImagePreview(url) {
      const placeholder = document.getElementById('ms-image-placeholder');
      const preview = document.getElementById('ms-image-preview');
      if (!placeholder || !preview) return;
      if (url) {
        placeholder.style.display = 'none';
        preview.src = url;
        preview.style.display = 'block';
      } else {
        placeholder.style.display = '';
        preview.src = '';
        preview.style.display = 'none';
      }
    }

    /* 사진 추가 — 단일 업로드 영역 클릭 → Prompt (네이티브: 카메라/갤러리 선택, 웹: 갤러리) */
    async function handleImagePick() {
      try {
        const result = await pickImage();
        if (!result) return;
        openCropModal(result.dataUrl, false, (blob) => {
          processUploadBlob(blob, 'image.jpeg');
        });
      } catch (err) {
        if (err instanceof CameraPermissionError) {
          showToast(err.message, 'warning');
          return;
        }
        showToast(err?.message || '사진을 불러올 수 없습니다.', 'error');
      }
    }
    const uploadArea = document.getElementById('ms-image-upload-area');
    uploadArea?.addEventListener('click', handleImagePick);
    uploadArea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleImagePick(); }
    });

    document.getElementById('mystory-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      /* 이미지 업로드 중이면 저장 차단 (버튼 disabled 상태로 판단) */
      const saveBtnEl = document.getElementById('ms-save-btn');
      if (saveBtnEl?.disabled) {
        showToast('사진 업로드가 완료될 때까지 기다려주세요', 'warning');
        return;
      }

      const data = {
        uid: uid,
        title: document.getElementById('ms-title').value.trim(),
        publish_date: document.getElementById('ms-date').value,
        body: document.getElementById('ms-body').value.trim(),
        image_url: document.getElementById('ms-image').value.trim(),
        image_thumb_url: document.getElementById('ms-image-thumb')?.value.trim() || '',
        author_nickname: getMyStoryAuthorNickname()
      };

      if (!data.publish_date) return showToast('날짜를 입력해주세요', 'warning');
      if (!data.image_url) return showToast('카드 이미지를 추가해주세요', 'warning');

      try {
        if (editingId) {
          await updateMyStory(editingId, data);
          showToast('일화가 수정되었습니다', 'success');
        } else {
          await createMyStory(data);
          showToast('새 일화가 작성되었습니다', 'success');
        }
        const nextStories = editingId
          ? [...allStories.filter((story) => String(story.id) !== String(editingId)), { ...data, id: editingId }]
          : [...allStories, data];
        void syncDiaryStateFromList(nextStories);
        navigate('/mystory', { date: data.publish_date });
      } catch (err) {
        showToast('저장 중 오류 발생', 'error');
      }
    });

  }, 0);

  return page;
}
