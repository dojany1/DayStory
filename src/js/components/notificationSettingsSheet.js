import {
  getNotificationSettings,
  updateNotificationSetting,
} from '../services/notifications.js';
import { getState, setState } from '../state.js';
import { showToast } from './toast.js';
import { renderWidgetThemeOption } from './widgetThemePreview.js';

const NOTIFICATION_LABELS = {
  diary: {
    title: '일기 알림',
    subtitle: '나의 일기 쓰기',
  },
  editor: {
    title: '에디터 알림',
    subtitle: '오늘의 일화 확인',
  },
};

const PERIODS = [
  { value: 'AM', label: '오전' },
  { value: 'PM', label: '오후' },
];

export function renderNotificationSettingsSection() {
  return `
    <div class="settings-section notification-settings-section">
      <div class="settings-section-title">알림</div>
      <div class="list-item" id="setting-notifications" role="button" tabindex="0">
        <div class="list-item-icon notification-settings-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>
        <div class="list-item-content">
          <div class="list-item-title">알림</div>
          <div class="list-item-subtitle notification-settings-summary">${notificationSummary()}</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
      <div class="list-item" id="setting-widget-theme" role="button" tabindex="0">
        <div class="list-item-icon widget-theme-settings-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="16" height="16" rx="4"></rect>
            <path d="M8 9h4"></path>
            <path d="M8 13h8"></path>
            <path d="M8 17h5"></path>
          </svg>
        </div>
        <div class="list-item-content">
          <div class="list-item-title">홈 화면 위젯</div>
          <div class="list-item-subtitle widget-theme-settings-summary">${widgetThemeSummary()}</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>
  `;
}

export function bindNotificationSettingsSection(page) {
  const item = page.querySelector('#setting-notifications');
  if (item) {
    const openSheet = () => openNotificationSettingsSheet(() => updateNotificationSummary(page));
    item.addEventListener('click', openSheet);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openSheet();
      }
    });
  }

  const widgetItem = page.querySelector('#setting-widget-theme');
  if (widgetItem) {
    const openWidgetSheet = () => openWidgetThemeSettingsSheet((theme) => updateWidgetThemeSummary(page, theme));
    widgetItem.addEventListener('click', openWidgetSheet);
    widgetItem.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWidgetSheet();
      }
    });
  }
}

export function openNotificationSettingsSheet(onChange = () => {}) {
  const existing = document.querySelector('.notification-settings-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay notification-settings-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet notification-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="notification-settings-title">
      <div class="modal-handle"></div>
      <div class="notification-settings-header">
        <h2 id="notification-settings-title">알림</h2>
        <button type="button" class="notification-settings-close" aria-label="닫기">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="notification-settings-list">
        ${renderNotificationRow('diary')}
        ${renderNotificationRow('editor')}
      </div>
      <button type="button" class="btn btn-primary btn-full notification-settings-done">완료</button>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);

  /* DOM 삽입 후 다음 프레임에서 .open 추가 */
  requestAnimationFrame(() => overlay.classList.add('open'));

  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    /* 안전망: transition 미발생 시 400ms 후 제거 */
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 400);
  };
  bindSheetDragDismiss(overlay, close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('.notification-settings-close')?.addEventListener('click', close);
  overlay.querySelector('.notification-settings-done')?.addEventListener('click', close);

  overlay.querySelectorAll('[data-notification-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', async () => {
      const type = toggle.dataset.notificationToggle;
      const current = getNotificationSettings()[type];
      toggle.setAttribute('aria-busy', 'true');
      toggle.disabled = true;

      const nextSettings = await updateNotificationSetting(type, { enabled: !current.enabled });
      updateRow(overlay, type, nextSettings[type]);
      updateNotificationSummary(document);
      onChange();

      toggle.disabled = false;
      toggle.removeAttribute('aria-busy');
    });
  });

  overlay.querySelectorAll('.notification-settings-time-select').forEach((select) => {
    select.addEventListener('change', async () => {
      const type = select.dataset.notificationType;
      const nextSettings = await updateNotificationSetting(type, { time: getSelectedTime(overlay, type) });
      updateRow(overlay, type, nextSettings[type]);
      updateNotificationSummary(document);
      onChange();
    });
  });

  return overlay;
}

export function openWidgetThemeSettingsSheet(onChange = () => {}) {
  const existing = document.querySelector('.widget-theme-settings-overlay');
  if (existing) existing.remove();

  const currentTheme = getState('widgetTheme') || 'light';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay widget-theme-settings-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet widget-theme-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="widget-theme-settings-title">
      <div class="modal-handle"></div>
      <div class="notification-settings-header">
        <h2 id="widget-theme-settings-title">홈 화면 위젯</h2>
        <button type="button" class="notification-settings-close" aria-label="닫기">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="widget-theme-sheet-options">
        ${renderWidgetThemeOption('light', currentTheme)}
        ${renderWidgetThemeOption('dark', currentTheme)}
      </div>
      <button type="button" class="btn btn-primary btn-full widget-theme-settings-done">완료</button>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);

  /* DOM 삽입 후 다음 프레임에서 .open 추가 */
  requestAnimationFrame(() => overlay.classList.add('open'));

  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 400);
  };
  bindSheetDragDismiss(overlay, close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('.notification-settings-close')?.addEventListener('click', close);
  overlay.querySelector('.widget-theme-settings-done')?.addEventListener('click', close);

  overlay.querySelectorAll('.widget-theme-option').forEach((option) => {
    option.addEventListener('click', () => {
      const selected = option.dataset.widgetTheme || 'light';
      setState('widgetTheme', selected);
      overlay.querySelectorAll('.widget-theme-option').forEach((item) => item.classList.remove('active'));
      option.classList.add('active');
      updateWidgetThemeSummary(document, selected);
      onChange(selected);
      showToast(`위젯 테마: ${widgetThemeSummary(selected)}`, 'success');
    });
  });

  return overlay;
}

function bindSheetDragDismiss(overlay, close) {
  const sheet = overlay.querySelector('.modal-sheet');
  if (!sheet) return;

  let startY = 0;
  let currentY = 0;
  let startTime = 0;
  let isDragging = false;

  const reset = () => {
    sheet.style.transition = '';
    sheet.style.transform = '';
    isDragging = false;
  };

  const stopTracking = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerCancel);
  };

  const shouldStartDrag = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    if (target.closest('button, select, input, textarea, a, label, [role="button"]')) return false;
    return Boolean(target.closest('.modal-handle')) || target === sheet || Boolean(target.closest('.notification-settings-header'));
  };

  const onPointerMove = (event) => {
    if (!isDragging) return;
    currentY = Math.max(0, event.clientY - startY);
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${currentY}px)`;
    if (currentY > 0) event.preventDefault();
  };

  const onPointerUp = (event) => {
    if (!isDragging) return;
    stopTracking();
    currentY = Math.max(0, event.clientY - startY);
    const elapsed = Math.max(1, Date.now() - startTime);
    const velocity = currentY / elapsed;
    const shouldClose = currentY >= 80 || (currentY >= 24 && velocity >= 0.5);

    if (shouldClose) {
      sheet.style.transition = '';
      sheet.style.transform = '';
      close();
      return;
    }

    reset();
  };

  const onPointerCancel = () => {
    stopTracking();
    reset();
  };

  sheet.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (!shouldStartDrag(event)) return;

    startY = event.clientY;
    currentY = 0;
    startTime = Date.now();
    isDragging = true;

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
  });
}

function renderNotificationRow(type) {
  const setting = getNotificationSettings()[type];
  const label = NOTIFICATION_LABELS[type];
  const timeParts = splitTime(setting.time);

  return `
    <div class="notification-settings-row" data-notification-row="${type}">
      <div class="notification-settings-copy">
        <div class="notification-settings-row-title">${label.title}</div>
        <div class="notification-settings-row-subtitle">${label.subtitle}</div>
      </div>
      <div class="notification-settings-time-control" data-notification-time-control="${type}" aria-label="${label.title} 시간">
        <select class="notification-settings-time-select" data-notification-period="${type}" data-notification-type="${type}" aria-label="${label.title} 오전 오후">
          ${PERIODS.map((period) => `<option value="${period.value}" ${timeParts.period === period.value ? 'selected' : ''}>${period.label}</option>`).join('')}
        </select>
        <select class="notification-settings-time-select" data-notification-hour="${type}" data-notification-type="${type}" aria-label="${label.title} 시">
          ${Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
            `<option value="${String(hour).padStart(2, '0')}" ${timeParts.hour === hour ? 'selected' : ''}>${hour}시</option>`
          )).join('')}
        </select>
        <select class="notification-settings-time-select" data-notification-minute="${type}" data-notification-type="${type}" aria-label="${label.title} 분">
          ${Array.from({ length: 60 }, (_, minute) => (
            `<option value="${String(minute).padStart(2, '0')}" ${timeParts.minute === minute ? 'selected' : ''}>${String(minute).padStart(2, '0')}분</option>`
          )).join('')}
        </select>
      </div>
      <button type="button" class="toggle ${setting.enabled ? 'active' : ''}" data-notification-toggle="${type}" aria-label="${label.title}" aria-pressed="${setting.enabled ? 'true' : 'false'}"></button>
    </div>
  `;
}

function updateRow(root, type, setting) {
  const row = root.querySelector(`[data-notification-row="${type}"]`);
  const period = row?.querySelector(`[data-notification-period="${type}"]`);
  const hour = row?.querySelector(`[data-notification-hour="${type}"]`);
  const minute = row?.querySelector(`[data-notification-minute="${type}"]`);
  const toggle = row?.querySelector(`[data-notification-toggle="${type}"]`);
  if (!row || !period || !hour || !minute || !toggle) return;

  const timeParts = splitTime(setting.time);
  period.value = timeParts.period;
  hour.value = String(timeParts.hour).padStart(2, '0');
  minute.value = String(timeParts.minute).padStart(2, '0');
  toggle.classList.toggle('active', setting.enabled);
  toggle.setAttribute('aria-pressed', setting.enabled ? 'true' : 'false');
}

function updateNotificationSummary(root) {
  root.querySelectorAll('.notification-settings-summary').forEach((summary) => {
    summary.textContent = notificationSummary();
  });
}

function updateWidgetThemeSummary(root, theme) {
  root.querySelectorAll('.widget-theme-settings-summary').forEach((summary) => {
    summary.textContent = widgetThemeSummary(theme);
  });
}

function notificationSummary() {
  const settings = getNotificationSettings();
  const diary = settings.diary.enabled ? `일기 ${formatTimeLabel(settings.diary.time)}` : '일기 꺼짐';
  const editor = settings.editor.enabled ? `에디터 ${formatTimeLabel(settings.editor.time)}` : '에디터 꺼짐';
  return `${diary} · ${editor}`;
}

function widgetThemeSummary(theme = getState('widgetTheme')) {
  return theme === 'dark' ? '다크' : '화이트';
}

function getSelectedTime(root, type) {
  const period = root.querySelector(`[data-notification-period="${type}"]`)?.value || 'PM';
  const hour = root.querySelector(`[data-notification-hour="${type}"]`)?.value || '12';
  const minute = root.querySelector(`[data-notification-minute="${type}"]`)?.value || '00';
  return joinTime(period, Number(hour), minute);
}

function splitTime(time) {
  const [rawHour, rawMinute] = String(time || '12:00').split(':').map(Number);
  const hour24 = Number.isInteger(rawHour) ? rawHour : 12;
  const minute = Number.isInteger(rawMinute) ? rawMinute : 0;
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour = hour24 % 12 || 12;

  return {
    period,
    hour,
    minute,
  };
}

function formatTimeLabel(time) {
  const parts = splitTime(time);
  const period = PERIODS.find((item) => item.value === parts.period)?.label || '오후';
  return `${period} ${parts.hour}:${String(parts.minute).padStart(2, '0')}`;
}

function joinTime(period, hour12, minute) {
  const normalizedHour = Math.min(Math.max(Number(hour12) || 12, 1), 12);
  let hour24 = normalizedHour % 12;
  if (period === 'PM') hour24 += 12;

  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
