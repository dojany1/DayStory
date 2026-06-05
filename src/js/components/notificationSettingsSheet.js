import {
  getNotificationSettings,
  updateNotificationSetting,
} from '../services/notifications.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { t } from '../i18n/index.js';
import { renderPageHeader, bindPageHeaderBack } from './pageHeader.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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

export function renderNotificationListItem() {
  return `
    <div class="list-item" id="setting-notifications" role="button" tabindex="0">
      <div class="list-item-icon notification-settings-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          <path d="M4 2C2.8 3.7 2 5.7 2 8"/>
          <path d="M20 2c1.2 1.7 2 3.7 2 8"/>
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
  `;
}

export function renderNotificationSettingsSection() {
  return `
    <div class="settings-section notification-settings-section">
      <div class="settings-section-title">알림</div>
      ${renderNotificationListItem()}
    </div>
  `;
}

export function bindNotificationSettingsSection(page) {
  const item = page.querySelector('#setting-notifications');
  if (item) {
    if (item.dataset.notificationSettingsBound === 'true') return;
    item.dataset.notificationSettingsBound = 'true';
    const openSheet = () => openNotificationSettingsSheet(() => updateNotificationSummary(page));
    item.addEventListener('click', openSheet);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openSheet();
      }
    });
  }

}

export function openNotificationSettingsSheet(onChange = () => {}) {
  const existing = document.querySelector('.notification-settings-overlay');
  if (existing) {
    return existing;
  }

  const overlay = document.createElement('div');
  overlay.className = 'notification-settings-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'notification-settings-title');
  overlay.innerHTML = `
    <div class="notification-settings-sheet">
      ${renderPageHeader({ title: '알림', titleId: 'notification-settings-title', icon: 'close', backLabel: '닫기' })}
      <div class="notification-settings-list">
        ${renderNotificationRow('diary')}
        ${renderNotificationRow('editor')}
      </div>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);
  lockScroll();
  requestAnimationFrame(() => overlay.classList.add('visible'));

  overlay.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.notification-settings-sheet')) {
      e.preventDefault();
    }
  }, { passive: false });

  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    unlockScroll();
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    /* 안전망: transition 미발생 시 450ms 후 제거 */
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 450);
  };
  bindPageHeaderBack(overlay, close);

  overlay.querySelectorAll('[data-notification-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', async () => {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
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

function notificationSummary() {
  const settings = getNotificationSettings();
  const diary = settings.diary.enabled ? `일기 ${formatTimeLabel(settings.diary.time)}` : '일기 꺼짐';
  const editor = settings.editor.enabled ? `에디터 ${formatTimeLabel(settings.editor.time)}` : '에디터 꺼짐';
  return `${diary} · ${editor}`;
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
