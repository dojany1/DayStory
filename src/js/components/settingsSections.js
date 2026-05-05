import { navigate } from '../router.js';
import { getState, setState } from '../state.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirmDialog.js';
import { bindNotificationSettingsSection, renderNotificationSettingsSection } from './notificationSettingsSheet.js';
import { startTutorialTour } from './tutorialTour.js';
import { auth, db } from '../firebase.js';
import { signOut, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import pkg from '../../../package.json';

const AUTH_SESSION_KEY = 'daystory:auth-session-active';

export function renderSettingsSections() {
  const user = getState('user');
  const profile = getState('profile');
  const currentTheme = getState('theme');

  return `
    ${renderNotificationSettingsSection()}

    <div class="settings-section">
      <div class="settings-section-title">디스플레이</div>
      <div class="theme-option-group" role="group" aria-label="테마 선택">
        ${renderThemeOption('light', '라이트', currentTheme, sunIcon())}
        ${renderThemeOption('dark', '다크', currentTheme, moonIcon())}
        ${renderThemeOption('system', '시스템', currentTheme, systemIcon())}
      </div>
    </div>

    ${profile && profile.role === 'editor' ? `
    <div class="settings-section">
      <div class="settings-section-title">에디터 도구</div>
      ${renderSettingsRow({
        id: 'setting-editor',
        title: '콘텐츠 관리',
        subtitle: '일화 작성/편집/발행',
        icon: editIcon(),
      })}
    </div>
    ` : ''}

    ${user && user.id !== 'guest' ? `
    <div class="settings-section">
      <div class="settings-section-title">계정</div>
      ${renderSettingsRow({
        id: 'setting-logout',
        title: '로그아웃',
        icon: logoutIcon(),
        titleClass: 'settings-row-danger',
        showChevron: false,
      })}
      ${renderSettingsRow({
        id: 'setting-withdraw',
        title: '회원 탈퇴',
        icon: userXIcon(),
        titleClass: 'settings-row-muted',
        showChevron: false,
      })}
    </div>
    ` : ''}

    <div class="settings-section">
      <div class="settings-section-title">앱 정보</div>
      ${renderSettingsRow({
        id: 'setting-tutorial',
        title: '튜토리얼 다시 보기',
        icon: helpIcon(),
      })}
    </div>

    <div class="settings-privacy-link">
      <a href="https://0729.notion.site/336c0180451480a4b0a8c60dba754daf?source=copy_link" target="_blank" rel="noopener noreferrer">
        개인정보처리방침
      </a>
    </div>

    <div class="settings-version">
      DayStory v${pkg.version}
    </div>
  `;
}

export function bindSettingsSections(page) {
  bindNotificationSettingsSection(page);
  bindThemeOptions(page);
  bindRow(page, '#setting-editor', () => navigate('/editor'));
  bindRow(page, '#setting-tutorial', () => {
    startTutorialTour(navigate);
    showToast('페이지별 안내가 다시 표시됩니다', 'success');
  });
  bindRow(page, '#setting-logout', handleLogout);
  bindRow(page, '#setting-withdraw', handleWithdraw);
}

function renderThemeOption(theme, label, currentTheme, icon) {
  return `
    <button type="button" class="theme-option ${currentTheme === theme ? 'active' : ''}" data-theme="${theme}" aria-pressed="${currentTheme === theme ? 'true' : 'false'}">
      ${icon}
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
  page.querySelectorAll('.theme-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedTheme = btn.dataset.theme;
      setState('theme', selectedTheme);
      page.querySelectorAll('.theme-option').forEach((option) => {
        option.classList.remove('active');
        option.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      showToast(`테마: ${themeLabel(selectedTheme)}`, 'success');
    });
  });
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
  showToast('로그아웃 되었습니다', 'success');
}

async function handleWithdraw() {
  if (!auth || !auth.currentUser) return;

  const isConfirmed = await showConfirm({
    title: '회원 탈퇴',
    message: '정말로 회원을 탈퇴하시겠습니까?\n모든 정보(보관함, 설정 등)가 즉시 삭제되며 복구할 수 없습니다.',
    confirmText: '탈퇴',
    cancelText: '취소',
    danger: true,
  });
  if (!isConfirmed) return;

  try {
    const user = auth.currentUser;
    const uid = user.uid;

    if (db) {
      try {
        await deleteDoc(doc(db, 'profiles', uid));
        const bookmarksQuery = query(collection(db, 'bookmarks'), where('user_id', '==', uid));
        const snapshot = await getDocs(bookmarksQuery);
        snapshot.forEach((entry) => deleteDoc(entry.ref));
      } catch (dbErr) {
        console.warn('DB 데이터 삭제 실패 (일부 무시됨):', dbErr);
      }
    }

    await deleteUser(user);
    localStorage.removeItem(AUTH_SESSION_KEY);
    showToast('회원 탈퇴가 완료되었습니다.', 'success');
    setState('user', null);
    setState('profile', null);
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = 'flex';
    navigate('/editorstory');
  } catch (err) {
    console.error('회원 탈퇴 실패:', err);
    if (err.code === 'auth/requires-recent-login' || err.code === 'auth/user-token-expired') {
      showToast('보안 정책에 따라 다시 로그인한 뒤 탈퇴하실 수 있습니다.', 'error');
      localStorage.removeItem(AUTH_SESSION_KEY);
      setState('user', null);
      const nav = document.getElementById('bottom-nav');
      if (nav) nav.style.display = 'none';
      navigate('/login');
      return;
    }

    showToast(err.message || '회원 탈퇴 처리 중 오류가 발생했습니다.', 'error');
  }
}

function themeLabel(theme) {
  return { system: '시스템 설정', light: '라이트', dark: '다크' }[theme];
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

function helpIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
}

function imageIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
}
