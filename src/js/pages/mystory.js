/* =====================================================================
   mystory.js — 나의 일화 (일반 사용자 전용)
   =====================================================================
   사용자가 자신의 이야기를 확인하고 추가/수정하는 페이지입니다.
   홈 화면의 일화 카드와 디자인 일관성을 유지하기 위해 원본 카드 뷰를 사용합니다.

   좌우 스와이프는 Swiper.js 11 기반으로 통합되었습니다 (2026-05-24).
   ===================================================================== */

import { navigate, getParams, getPreviousRoute, setBackInterceptor, setOnUnmount } from '../router.js';
import { getState } from '../state.js';
import { showToast } from '../components/toast.js';
import { notifyStorySaved } from '../services/adPlacement.js';
import { showConfirm } from '../components/confirmDialog.js';
import { showShareChoice } from '../components/shareChoiceSheet.js';
import { Capacitor } from '@capacitor/core';
import { fetchMyStories, createMyStory, updateMyStory, fetchMyStoryById, deleteMyStory } from '../services/mystories.js';
import { escapeHtml } from '../utils/sanitize.js';
import { isFirebaseStorageUrl } from '../utils/storage.js';
import { auth, storage } from '../services/firebase.js';
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
import { t } from '../i18n/index.js';
import {
  cardShell, cardFront, cardFrontTop, cardImageWrap, cardBack, emptyCardFace, cardActionButton,
  bindCardBase, parseIsoDate, formatMonthNameDate, bodyToHtml, SHARE_ICON_SVG,
} from '../components/cardDeck/cardFace.js';
import { afterPageEnter } from '../utils/pageLifecycle.js';
import { showIntroSheet } from '../components/introSheet.js';
import { hasSeen, ONBOARDING_FLAGS } from '../services/onboarding.js';
import { getCurrentPath } from '../router.js';
import { getLocalToday } from '../utils/date.js';

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
  return nickname || t('common.default_user');
}

/* ─────────────────────────────────────────────
   섹션 1: 나의 일화 목록 페이지 (싱글 카드 + 휠 피커 + Swiper)
   ───────────────────────────────────────────── */
export function renderMyStory() {
  const prev = getPreviousRoute();
  console.log('[mystory] renderMyStory called, previousRoute =', prev);
  /* 기록이 0개인 신규 사용자면 오늘 빈 카드의 글쓰기 CTA 를 강화(Pulse·안내문)한다.
     loadData 에서 채워지고 renderSlideHTML 클로저가 최신값을 본다 (데이터 상태로만 게이트). */
  let isFirstTimeEmpty = false;

  const page = buildCardDeck({
    idPrefix: 'mystory',
    pageClass: 'mystory-page',
    headerHtml: '',
    calendarTitle: t('calendar.page_title_mine'),
    enterDir: ['/settings', '/profile'].includes(prev) ? 'from-left' : 'from-right',
    calMode: 'mine',
    lastDateKey: 'lastMyStoryDate',

    loadData: async () => {
      const user = getState('user');
      /* Firebase Auth 실제 UID 우선 (Firestore 보안 규칙 request.auth.uid 일치) */
      const uid = auth?.currentUser?.uid || user?.id;
      const allStories = await fetchMyStories(uid);
      isFirstTimeEmpty = Array.isArray(allStories) && allStories.length === 0;
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

    renderSlideHTML: (raw, iso) => buildMyStorySlideHTML(raw, iso, isFirstTimeEmpty),
    bindCard: (flip, raw, iso) => bindMyStoryCardEvents(flip, raw, iso),

    errorHtml: () => `<div class="empty-state"><div class="empty-state-title">${t('common.error_occurred')}</div></div>`,
  });

  /* 진입 애니메이션 종료 후 최초 1회 인트로 모달. 닫으면 뒤의 강화된 빈 카드가 드러난다. */
  afterPageEnter(page, () => runMyStoryOnboarding());
  return page;
}

/* '나의 일화' 탭 최초 진입 인트로 모달 (논블로킹). */
function runMyStoryOnboarding() {
  if (getCurrentPath() !== '/mystory') return;          /* 빠른 탭 왕복 방어 (QA Q1) */
  if (hasSeen(ONBOARDING_FLAGS.INTRO_MYSTORY)) return;
  showIntroSheet({
    flag: ONBOARDING_FLAGS.INTRO_MYSTORY,
    icon: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><circle cx="12" cy="8" r="2"/><path d="M15 13a3 3 0 1 0-6 0"/></svg>',
    title: t('onboarding.mystory_title'),
    lines: [t('onboarding.mystory_line1'), t('onboarding.mystory_line2')],
  });
}


/* ─────────────────────────────────────────────
   섹션 1-2: 슬라이드 HTML 빌더 (Swiper Virtual용)
   ───────────────────────────────────────────── */

function buildMyStorySlideHTML(story, isoDateStr, firstTimeEmpty = false) {
  const { month, day, year: displayYear } = parseIsoDate(isoDateStr);

  if (!story) {
    /* 신규 사용자(기록 0개)의 '오늘' 빈 카드에서만 글쓰기 CTA 를 강화한다 (B안). */
    const showHint = firstTimeEmpty && isoDateStr === getLocalToday();
    return emptyCardFace({
      day,
      title: t('mystory.empty_day'),
      dateStr: formatMonthNameDate(isoDateStr),
      extraHtml: `
            ${showHint ? `<p class="mystory-empty-hint">${t('onboarding.mystory_empty_hint')}</p>` : ''}
            <button class="btn btn-primary mystory-write-btn${showHint ? ' is-pulsing' : ''}" data-date="${isoDateStr}">
              + ${t('mystory.write')}
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

  const actionsHtml = `${cardActionButton({ ariaLabel: t('detail.share_button'), svg: SHARE_ICON_SVG, extraClass: 'share-my-story-btn', dataId: story.id })}
                ${cardActionButton({ ariaLabel: t('common.modify'), svg: editSvg, extraClass: 'edit-my-story-btn', dataId: story.id })}`;

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
    footerHtml: `<div class="back-date">${t('date.full', { y: storyYear, m: storyMonth, d: storyDay })}</div>`,
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
      showToast(t('mystory.toast_need_login'), 'error');
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
      const choice = await showShareChoice({ showSave: Capacitor.isNativePlatform(), showLink: false });
      if (!choice) return; /* 취소 */

      shareBtn.disabled = true;
      try {
        /* 공유 본문 텍스트는 넣지 않는다 — 이미지+링크만 공유(사용자 요청).
           "갤러리 저장" 선택 시 공유 대신 사진 보관함에 저장. */
        const res = await captureAndShareCard(cardEl, {
          title: story.title || 'DayStory',
          date: story.publish_date,
          dialogTitle: t('mystory.share'),
          linkOnly: choice === 'link',
          saveToGallery: choice === 'save',
        });
        /* 갤러리 저장은 실패해도 공유 시트로 폴백하지 않는다. */
        if (choice !== 'save' && !res.ok && res.reason !== 'cancelled') {
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
  const prevRoute = getPreviousRoute();

  /* ---- 로그인/비회원 체크 (라우터 가드에서 이미 막혀야 하지만 안전망) ---- */
  const userObj = getState('user') || {};
  const uid = auth?.currentUser?.uid || userObj.id;
  if (!uid) {
    page.innerHTML = `
      ${renderPageHeader({ title: t('editor.no_permission'), backLabel: t('common.back') })}
      <div class="empty-state" style="padding-top: 100px;">
        <div class="empty-state-title">${t('mystory.need_login_title')}</div>
        <div class="empty-state-desc">${t('mystory.need_login_desc')}</div>
        <button class="btn btn-primary" style="margin-top: 16px;" id="ms-no-auth-back">${t('mystory.no_auth_back')}</button>
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
    ${renderPageHeader({ title: editingId ? t('mystory.edit') : t('mystory.write'), backLabel: t('common.back') })}

    <div class="editor-form-section section mystory-form-section">
      <form id="mystory-form" class="story-form">
        <!-- 1. 날짜 -->
        <div class="input-group">
          <label class="input-label">${t('mystory.label_date')} *</label>
          <input class="input-field" type="date" id="ms-date" required style="text-align:left; -webkit-appearance:none; appearance:none;" />
        </div>
        <!-- 2. 카드 이미지 -->
        <div class="input-group">
          <input type="hidden" id="ms-image" />
          <input type="hidden" id="ms-image-thumb" />
          <div id="ms-image-upload-area" class="ms-image-upload-area" role="button" tabindex="0" aria-label="${t('mystory.upload_image')}">
            <div id="ms-image-placeholder" class="ms-image-upload-placeholder">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/>
                <line x1="16" x2="22" y1="5" y2="5"/>
                <line x1="19" x2="19" y1="2" y2="8"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span>${t('mystory.upload_image')}</span>
            </div>
            <img id="ms-image-preview" class="ms-image-upload-preview" style="display:none;" alt="${t('mystory.image_preview_alt')}" />
          </div>
        </div>
        <!-- 3. 단일 제목 -->
        <div class="input-group">
          <label class="input-label">${t('mystory.label_title')}</label>
          <input class="input-field" id="ms-title" />
        </div>
        <!-- 4. 본문 -->
        <div class="input-group">
          <label class="input-label">${t('mystory.label_body')}</label>
          <textarea class="input-field" id="ms-body" style="min-height:250px; resize:vertical; line-height:1.6; font-family:var(--font-body);"></textarea>
        </div>
        ${editingId ? `
          <!-- 편집 모드: 폼 하단 우측에 삭제 버튼 배치 -->
          <div class="mystory-form-inline-actions">
            <button type="button" class="btn btn-secondary mystory-form-delete-btn" id="delete-my-story-edit">${t('common.delete')}</button>
          </div>
        ` : ''}
      </form>
    </div>

    <!-- 화면 하단 floating 액션 영역 (저장 버튼) -->
    <div class="mystory-form-actions">
      <button type="submit" form="mystory-form" id="ms-save-btn" class="btn btn-primary btn-full">${t('mystory.save_btn')}</button>
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
          title: t('mystory.leave_title'),
          message: t('mystory.leave_message'),
          confirmText: t('editor.leave_confirm'),
          cancelText: t('common.cancel'),
        });
        if (!confirmed) return;
      }
      history.back();
    }

    bindPageHeaderBack(page, handleBack);

    if (Capacitor.isNativePlatform()) {
      /* 하드웨어 뒤로가기(Android): 자체 backButton 리스너를 등록하면 main.js 전역 핸들러와
         중복 발화해 뒤로가기가 한 번에 안 먹었다. 대신 라우터 인터셉터로 등록해 전역 핸들러가
         기본 네비게이션 대신 handleBack(미저장 변경 확인 → history.back)을 쓰도록 위임한다. */
      setBackInterceptor(handleBack);
      setOnUnmount(() => setBackInterceptor(null));
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
          showToast(t('common.date_exists'), 'error');
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
        title: t('mystory.delete_title'),
        message: t('mystory.delete_message'),
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        danger: true,
      });
      if (!confirmed) return;

      try {
        await deleteMyStory(editingId);
        void syncDiaryStateFromList(allStories.filter((story) => String(story.id) !== String(editingId)));
        showToast(t('mystory.toast_deleted'), 'success');
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
        showToast(t('mystory.toast_delete_error'), 'error');
      }
    });

    const formEl = document.getElementById('mystory-form');

    async function openCropModal(imageSrc, isCrossOrigin = false, callbackBlobFile) {
      let localSrc = imageSrc;
      if (isCrossOrigin) {
        if (!isFirebaseStorageUrl(imageSrc)) {
          showToast(t('editor.crop_external_error'), 'error');
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
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          ${t('editor.crop_title')}
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
            ${t('editor.rotate')}
          </button>
          <button type="button" class="btn-crop-confirm" id="btn-crop-confirm">${t('common.done')}</button>
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
        showToast(t('editor.crop_edit_limited'), 'error');
        if (isCrossOrigin && localSrc.startsWith('blob:')) URL.revokeObjectURL(localSrc);
        unlockScroll();
        overlay.remove();
      };

      overlay.querySelector('#btn-crop-rotate').addEventListener('click', () => {
        if(cropper) cropper.rotate(90);
      });

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
            btn.textContent = t('common.done');
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
      btn.innerHTML = `${ICON_SPINNER}${t('mystory.uploading_btn')}`;
    }

    function setSaveBtnDone() {
      const btn = document.getElementById('ms-save-btn');
      if (!btn) return;
      btn.disabled = false;
      btn.style.opacity = '';
      btn.innerHTML = `${ICON_CHECK}${t('mystory.upload_done_btn')}`;
      setTimeout(() => {
        if (btn) btn.innerHTML = t('mystory.save_btn');
      }, 2000);
    }

    function setSaveBtnReady() {
      const btn = document.getElementById('ms-save-btn');
      if (!btn) return;
      btn.disabled = false;
      btn.style.opacity = '';
      btn.innerHTML = t('mystory.save_btn');
    }

    async function processUploadBlob(blob, fallbackName) {
      const IMAGE_FIELD = document.getElementById('ms-image');
      if (!IMAGE_FIELD) return;

      try {
        setSaveBtnUploading();
        if (!uid) {
          showToast(t('editor.upload_need_login'), 'error');
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
        showToast(t('mystory.toast_image_save_failed'), 'error');
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
        showToast(err?.message || t('common.photo_load_failed'), 'error');
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
        showToast(t('mystory.toast_wait_upload'), 'warning');
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

      if (!data.publish_date) return showToast(t('mystory.toast_need_date'), 'warning');
      if (!data.image_url) return showToast(t('mystory.toast_need_image'), 'warning');

      try {
        if (editingId) {
          await updateMyStory(editingId, data);
          showToast(t('mystory.toast_updated'), 'success');
        } else {
          await createMyStory(data);
          showToast(t('mystory.toast_created'), 'success');
        }
        const nextStories = editingId
          ? [...allStories.filter((story) => String(story.id) !== String(editingId)), { ...data, id: editingId }]
          : [...allStories, data];
        void syncDiaryStateFromList(nextStories);

        /* 전면 광고는 화면 전환이 끝난 뒤에 시도한다. 저장 성공 토스트를 덮으면
           사용자가 저장 실패로 오인한다. 정책(첫 저장 제외/쿨다운/세션 상한)과
           미로드 시 즉시 포기(onlyIfReady)는 adPlacement 가 담당하므로
           여기서는 fire-and-forget 으로 알리기만 한다. */
        setTimeout(() => { void notifyStorySaved(); }, 1200);

        if (prevRoute === '/mystory') {
          navigate('/mystory', { date: data.publish_date });
        } else {
          /* /profile(설정), /editorstory 등에서 진입한 경우 원래 페이지로 복귀.
             history 가 비어있는 외부 진입 케이스를 위해 일정 시간 내
             hashchange 가 없으면 /mystory 로 fallback. */
          const beforeHash = window.location.hash;
          const fallbackTimer = setTimeout(() => {
            if (window.location.hash === beforeHash) {
              navigate('/mystory', { date: data.publish_date });
            }
          }, 300);
          window.addEventListener('hashchange', () => clearTimeout(fallbackTimer), { once: true });
          history.back();
        }
      } catch (err) {
        showToast(t('mystory.toast_save_error'), 'error');
      }
    });

  }, 0);

  return page;
}
