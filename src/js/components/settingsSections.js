import { navigate } from '../router.js';
import { getState, setState } from '../state.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirmDialog.js';
import { bindNotificationSettingsSection, renderNotificationListItem } from './notificationSettingsSheet.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { renderPageHeader, bindPageHeaderBack } from './pageHeader.js';
import { auth } from '../firebase.js';
import { signOut, deleteUser } from 'firebase/auth';
import {
  purgeStorageUserData,
  purgeFirestoreUserData,
  reauthenticateUser,
} from '../services/userCleanup.js';
import { t, getCurrentLang, setLang } from '../i18n/index.js';
import { forceRoute } from '../router.js';
import pkg from '../../../package.json';

const AUTH_SESSION_KEY = 'daystory:auth-session-active';
const PRIVACY_URL = 'https://0729.notion.site/336c0180451480a4b0a8c60dba754daf?source=copy_link';
const CONTACT_URL = 'mailto:contact@daystory.app';

export function renderSettingsSections() {
  const user = getState('user');
  const profile = getState('profile');
  const currentTheme = getState('theme');
  const currentLang = getCurrentLang();
  const themeActiveIdx = Math.max(0, ['light', 'dark', 'system'].indexOf(currentTheme));

  return `
    ${profile && profile.role === 'editor' ? `
    <div class="settings-section">
      <div class="settings-section-title">관리자 도구</div>
      ${renderSettingsRow({
        id: 'setting-editor',
        title: t('settings.row_editor'),
        subtitle: t('settings.row_editor_subtitle'),
        icon: editIcon(),
      })}
    </div>
    ` : ''}

    <div class="settings-section">
      <div class="settings-section-title">앱 설정</div>
      <div class="theme-option-group" role="group" aria-label="${t('settings.section_display')}" data-active="${themeActiveIdx}">
        ${renderThemeOption('light', t('settings.theme_light'), currentTheme, sunIcon())}
        ${renderThemeOption('dark', t('settings.theme_dark'), currentTheme, moonIcon())}
        ${renderThemeOption('system', t('settings.theme_system'), currentTheme, systemIcon())}
        <span class="theme-option-thumb" aria-hidden="true"></span>
      </div>
      ${renderNotificationListItem()}
      ${renderViewModeListItem()}
    </div>

    <div class="settings-section">
      <div class="settings-section-title">지원</div>
      ${renderSettingsRow({
        id: 'setting-about',
        title: t('settings.row_about'),
        subtitle: t('settings.row_about_subtitle'),
        icon: bookIcon(),
      })}
      ${renderSettingsRow({
        id: 'setting-contact',
        title: '문의',
        icon: mailIcon(),
      })}
    </div>

    ${user && user.id !== 'guest' ? `
    <div class="settings-section">
      ${renderSettingsRow({
        id: 'setting-logout',
        title: t('settings.row_logout'),
        icon: logoutIcon(),
        titleClass: 'settings-row-danger',
        showChevron: false,
      })}
      ${renderSettingsRow({
        id: 'setting-withdraw',
        title: t('settings.row_withdraw'),
        icon: userXIcon(),
        titleClass: 'settings-row-danger',
        showChevron: false,
      })}
    </div>
    ` : ''}

    <div class="settings-privacy-link">
      <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">
        ${t('settings.privacy_link')}
      </a>
    </div>

    <div class="settings-version">
      DayStory v${pkg.version}
    </div>
    <div class="settings-version">
      2026 DOKHU Team
    </div>
  `;
}

export function bindSettingsSections(page) {
  bindNotificationSettingsSection(page);
  bindThemeOptions(page);
  bindViewModeItem(page);
  bindRow(page, '#setting-editor', () => navigate('/editor'));
  bindRow(page, '#setting-about', () => navigate('/about'));
  bindRow(page, '#setting-contact', () => showToast('준비중인 기능입니다. 업데이트를 기다려주세요!', 'info'));
  bindRow(page, '#setting-logout', handleLogout);
  bindRow(page, '#setting-withdraw', handleWithdraw);
}

function escapeText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function renderThemeOption(theme, label, currentTheme, icon) {
  return `
    <button type="button" class="theme-option ${currentTheme === theme ? 'active' : ''}" data-theme="${theme}" aria-pressed="${currentTheme === theme ? 'true' : 'false'}">
      ${icon}
      <span class="theme-option-label">${label}</span>
    </button>
  `;
}

function renderLangOption(lang, label, currentLang) {
  return `
    <button type="button" class="theme-option lang-option ${currentLang === lang ? 'active' : ''}" data-lang="${lang}" aria-pressed="${currentLang === lang ? 'true' : 'false'}">
      <span class="theme-option-label">${label}</span>
    </button>
  `;
}

function renderViewOption(view, label, currentView) {
  return `
    <button type="button" class="theme-option view-option ${currentView === view ? 'active' : ''}" data-view="${view}" aria-pressed="${currentView === view ? 'true' : 'false'}">
      <span class="theme-option-label">${label}</span>
    </button>
  `;
}

function renderSettingsRow({ id, title, subtitle = '', icon, titleClass = '', showChevron = true }) {
  return `
    <div class="list-item" id="${id}" role="button" tabindex="0">
      <div class="list-item-icon">${icon}</div>
      <div class="list-item-content">
        <div class="list-item-title ${titleClass}">${title}</div>
        ${subtitle ? `<div class="list-item-subtitle">${subtitle}</div>` : ''}
      </div>
      <div class="list-item-action">
        ${showChevron ? chevronIcon() : ''}
      </div>
    </div>
  `;
}

function bindThemeOptions(page) {
  page.querySelectorAll('.theme-option[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedTheme = btn.dataset.theme;
      setState('theme', selectedTheme);
      const group = btn.closest('.theme-option-group');
      const btns = [...group.querySelectorAll('.theme-option[data-theme]')];
      btns.forEach((option) => {
        option.classList.remove('active');
        option.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      group.dataset.active = btns.indexOf(btn);
    });
  });
}

function bindLangOptions(page) {
  page.querySelectorAll('.lang-option[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.closest('.theme-option-group--disabled')) return;
      const selectedLang = btn.dataset.lang;
      if (getCurrentLang() === selectedLang) return;
      const group = btn.closest('.theme-option-group');
      const btns = [...group.querySelectorAll('.lang-option[data-lang]')];
      group.dataset.active = btns.indexOf(btn);
      setLang(selectedLang);
      /* setLang → state 발행 → i18n init이 등록한 forceRoute() 자동 호출됨 → 페이지 재렌더 */
      showToast(t('settings.lang_changed'), 'success');
    });
  });
}

function renderViewModeListItem() {
  const defaultView = localStorage.getItem('ds_default_view') || 'card';
  const subtitle = defaultView === 'calendar' ? t('settings.view_calendar') : t('settings.view_card');
  return `
    <div class="list-item" id="setting-view-mode" role="button" tabindex="0">
      <div class="list-item-icon">${layoutIcon()}</div>
      <div class="list-item-content">
        <div class="list-item-title">${t('settings.section_view_mode')}</div>
        <div class="list-item-subtitle" id="view-mode-summary">${subtitle}</div>
      </div>
      <div class="list-item-action">${chevronIcon()}</div>
    </div>
  `;
}

function bindViewModeItem(page) {
  const item = page.querySelector('#setting-view-mode');
  if (!item) return;
  const open = () => openViewModeSheet(() => updateViewModeSummary(page));
  item.addEventListener('click', open);
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
}

function openViewModeSheet(onChange = () => {}) {
  if (document.querySelector('.view-mode-settings-overlay')) return;

  const defaultView = localStorage.getItem('ds_default_view') || 'card';
  const viewActiveIdx = defaultView === 'calendar' ? 1 : 0;

  const overlay = document.createElement('div');
  overlay.className = 'notification-settings-overlay view-mode-settings-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="notification-settings-sheet">
      ${renderPageHeader({ title: t('settings.section_view_mode'), icon: 'close', backLabel: '닫기' })}
      <div class="notification-settings-list" role="radiogroup">
        <button type="button" class="list-item view-mode-option ${defaultView === 'card' ? 'active' : ''}" data-view="card" role="radio" aria-checked="${defaultView === 'card'}">
          <div class="list-item-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7v10"/><path d="M6 5v14"/><rect width="12" height="18" x="10" y="3" rx="2"/></svg>
          </div>
          <div class="list-item-content">
            <div class="list-item-title">${t('settings.view_card_action')}</div>
          </div>
          <div class="list-item-action">
            <svg class="view-mode-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </button>
        <button type="button" class="list-item view-mode-option ${defaultView === 'calendar' ? 'active' : ''}" data-view="calendar" role="radio" aria-checked="${defaultView === 'calendar'}">
          <div class="list-item-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
          </div>
          <div class="list-item-content">
            <div class="list-item-title">${t('settings.view_calendar_action')}</div>
          </div>
          <div class="list-item-action">
            <svg class="view-mode-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </button>
      </div>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);
  lockScroll();
  requestAnimationFrame(() => overlay.classList.add('visible'));

  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    unlockScroll();
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 450);
  };
  bindPageHeaderBack(overlay, close);

  overlay.querySelectorAll('.view-mode-option[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const selected = btn.dataset.view;
      if (localStorage.getItem('ds_default_view') === selected) return;
      localStorage.setItem('ds_default_view', selected);
      overlay.querySelectorAll('.view-mode-option').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      updateViewModeSummary(document);
      onChange();
    });
  });
}

function updateViewModeSummary(container) {
  const el = container.querySelector('#view-mode-summary');
  if (!el) return;
  const defaultView = localStorage.getItem('ds_default_view') || 'card';
  el.textContent = defaultView === 'calendar' ? t('settings.view_calendar') : t('settings.view_card');
}

function bindRow(page, selector, handler) {
  const row = page.querySelector(selector);
  if (!row) return;

  row.addEventListener('click', handler);
  row.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handler(event);
  });
}

async function handleLogout() {
  try {
    if (auth) {
      await Promise.race([
        signOut(auth),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);
    }
  } catch (err) {
    console.warn('로그아웃 오류 (무시됨):', err);
  }

  localStorage.removeItem(AUTH_SESSION_KEY);
  setState('user', null);
  setState('profile', null);

  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = 'none';
  window.location.hash = '#/login';
  showToast(t('toast.logged_out'), 'success');
}

async function handleWithdraw() {
  if (!auth || !auth.currentUser) return;

  const isConfirmed = await showConfirm({
    title: '회원 탈퇴',
    message: '정말로 회원을 탈퇴하시겠습니까?\n계정과 모든 데이터(일화, 보관함, 업로드 사진 등)가 영구적으로 삭제되며 복구할 수 없습니다.',
    confirmText: '탈퇴',
    cancelText: '취소',
    danger: true,
    holdDuration: 5000,
    holdMessage: (secondsLeft) => secondsLeft > 0
      ? `탈퇴까지 ${secondsLeft}초간 누르고 계세요...`
      : '탈퇴를 진행합니다...',
  });
  if (!isConfirmed) return;

  try {
    await _doWithdraw(auth.currentUser);
  } catch (err) {
    if (err?.code === 'auth/requires-recent-login' || err?.code === 'auth/user-token-expired') {
      const ok = await reauthenticateUser(auth.currentUser);
      if (ok) {
        try {
          await _doWithdraw(auth.currentUser);
          return;
        } catch (retryErr) {
          console.error('재인증 후 탈퇴 재시도 실패:', retryErr);
        }
      }
      showToast('보안 정책에 따라 다시 로그인한 뒤 탈퇴하실 수 있습니다.', 'error');
      localStorage.removeItem(AUTH_SESSION_KEY);
      setState('user', null);
      const nav = document.getElementById('bottom-nav');
      if (nav) nav.style.display = 'none';
      navigate('/login');
      return;
    }
    console.error('회원 탈퇴 실패:', err);
    showToast(err?.message || '회원 탈퇴 처리 중 오류가 발생했습니다.', 'error');
  }
}

/* Storage → Firestore → deleteUser 순서로 진행 (역순이면 권한 상실로 Storage 청소 실패) */
async function _doWithdraw(user) {
  const uid = user.uid;
  await purgeStorageUserData(uid);
  await purgeFirestoreUserData(uid);
  await deleteUser(user);
  localStorage.removeItem(AUTH_SESSION_KEY);
  setState('user', null);
  setState('profile', null);
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = 'none';
  showToast(t('toast.withdraw_done'), 'success');
  navigate('/login');
}

function themeLabel(theme) {
  return {
    system: t('settings.theme_system'),
    light: t('settings.theme_light'),
    dark: t('settings.theme_dark'),
  }[theme];
}

function chevronIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="9 18 15 12 9 6"/></svg>';
}

function sunIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
}

function moonIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

function systemIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
}

function editIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
}

function logoutIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
}

function userXIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>';
}

function imageIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
}

function shieldIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
}

function bookIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
}

function mailIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';
}

function layoutIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1"/><path d="M5 12s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5"/></svg>';
}
