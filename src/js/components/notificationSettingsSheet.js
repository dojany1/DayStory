import {
  getNotificationSettings,
  updateNotificationSetting,
} from '../services/notifications.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { t } from '../i18n/index.js';
import { renderPageHeader, bindPageHeaderBack } from './pageHeader.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/* 라벨/기간은 t() 로 동적 조회 — 언어 변경 시 재렌더에서 최신 값 반영 */
function getNotificationLabel(type) {
  return {
    title: t(`notification.${type}_title`),
    subtitle: t(`notification.${type}_subtitle`),
  };
}

function getPeriods() {
  return [
    { value: 'AM', label: t('notification.am') },
    { value: 'PM', label: t('notification.pm') },
  ];
}

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
        <div class="list-item-title">${t('notification.title')}</div>
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
      <div class="settings-section-title">${t('notification.title')}</div>
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
      ${renderPageHeader({ title: t('notification.title'), titleId: 'notification-settings-title', icon: 'close', backLabel: t('common.close') })}
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
  const label = getNotificationLabel(type);
  const periods = getPeriods();
  const timeParts = splitTime(setting.time);

  return `
    <div class="notification-settings-row" data-notification-row="${type}">
      <div class="notification-settings-copy">
        <div class="notification-settings-row-title">${label.title}</div>
        <div class="notification-settings-row-subtitle">${label.subtitle}</div>
      </div>
      <div class="notification-settings-time-control" data-notification-time-control="${type}" aria-label="${t('notification.aria_time', { title: label.title })}">
        <select class="notification-settings-time-select" data-notification-period="${type}" data-notification-type="${type}" aria-label="${t('notification.aria_ampm', { title: label.title })}">
          ${periods.map((period) => `<option value="${period.value}" ${timeParts.period === period.value ? 'selected' : ''}>${period.label}</option>`).join('')}
        </select>
        <select class="notification-settings-time-select" data-notification-hour="${type}" data-notification-type="${type}" aria-label="${t('notification.aria_hour', { title: label.title })}">
          ${Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
            `<option value="${String(hour).padStart(2, '0')}" ${timeParts.hour === hour ? 'selected' : ''}>${t('notification.hour_unit', { h: hour })}</option>`
          )).join('')}
        </select>
        <select class="notification-settings-time-select" data-notification-minute="${type}" data-notification-type="${type}" aria-label="${t('notification.aria_minute', { title: label.title })}">
          ${Array.from({ length: 60 }, (_, minute) => (
            `<option value="${String(minute).padStart(2, '0')}" ${timeParts.minute === minute ? 'selected' : ''}>${t('notification.minute_unit', { m: String(minute).padStart(2, '0') })}</option>`
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
  const diary = settings.diary.enabled
    ? t('notification.summary_diary_on', { time: formatTimeLabel(settings.diary.time) })
    : t('notification.summary_diary_off');
  const editor = settings.editor.enabled
    ? t('notification.summary_editor_on', { time: formatTimeLabel(settings.editor.time) })
    : t('notification.summary_editor_off');
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
  const period = getPeriods().find((item) => item.value === parts.period)?.label || t('notification.pm');
  return `${period} ${parts.hour}:${String(parts.minute).padStart(2, '0')}`;
}

function joinTime(period, hour12, minute) {
  const normalizedHour = Math.min(Math.max(Number(hour12) || 12, 1), 12);
  let hour24 = normalizedHour % 12;
  if (period === 'PM') hour24 += 12;

  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
