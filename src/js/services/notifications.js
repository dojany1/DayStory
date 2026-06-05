import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { showToast } from '../components/toast.js';
import { t } from '../i18n/index.js';

const STORAGE_KEY = 'ds_notification_settings_v1';

const DEFAULT_SETTINGS = {
  diary: { enabled: true, time: '12:00' },
  editor: { enabled: false, time: '12:00' },
};

/* title/body 는 발송 시점에 t() 로 현재 언어로 조회한다 (notification.push_* 키) */
const NOTIFICATION_META = {
  diary: {
    id: 1001,
    route: '/mystory',
  },
  editor: {
    id: 1002,
    route: '/editorstory',
  },
};

let actionListenerHandle = null;
let webNotificationNavigate = null;
let webPermissionGrantedForSession = false;
let notificationPermissionRequest = null;
const webNotificationTimers = new Map();

export function getNotificationSettings() {
  const saved = readSavedSettings();

  return {
    diary: normalizeNotificationSetting(saved.diary, DEFAULT_SETTINGS.diary),
    editor: normalizeNotificationSetting(saved.editor, DEFAULT_SETTINGS.editor),
  };
}

export async function updateNotificationSetting(type, patch) {
  if (!NOTIFICATION_META[type]) return getNotificationSettings();

  const settings = getNotificationSettings();
  const current = settings[type];
  const next = normalizeNotificationSetting({ ...current, ...patch }, DEFAULT_SETTINGS[type]);
  const isEnabling = patch?.enabled === true;

  if (isEnabling) {
    const granted = await requestNotificationPermissionOnce();

    if (!granted) {
      next.enabled = false;
      showToast(t('notification.toast_need_perm'), 'warning');
    }
  }

  settings[type] = next;
  saveSettings(settings);

  await syncNotificationSchedules(type);
  return getNotificationSettings();
}

async function requestNotificationPermissionOnce() {
  if (!notificationPermissionRequest) {
    notificationPermissionRequest = (isNativeNotificationsAvailable()
      ? ensureNativeNotificationPermission()
      : ensureWebNotificationPermission()
    ).finally(() => {
      notificationPermissionRequest = null;
    });
  }

  return notificationPermissionRequest;
}

export async function syncNotificationSchedules(type = null) {
  const settings = getNotificationSettings();
  const types = type && NOTIFICATION_META[type] ? [type] : Object.keys(NOTIFICATION_META);

  if (!isNativeNotificationsAvailable()) {
    syncWebNotificationSchedules(settings, types);
    return;
  }

  /* 채널이 없으면 Android 8+ 에서 헤드업/소리 없이 조용히 처리되거나 누락된다. */
  await ensureAndroidNotificationChannel();

  const cancelTargets = types.map((notificationType) => ({ id: NOTIFICATION_META[notificationType].id }));

  try {
    await LocalNotifications.cancel({ notifications: cancelTargets });
  } catch (err) {
    console.warn('알림 예약 취소 실패:', err);
  }

  const notifications = types
    .filter((notificationType) => settings[notificationType]?.enabled)
    .map((notificationType) => buildNotificationRequest(notificationType, settings[notificationType]));

  if (!notifications.length) return;

  try {
    await LocalNotifications.schedule({ notifications });
  } catch (err) {
    console.warn('알림 예약 실패:', err);
    showToast(t('notification.toast_schedule_failed'), 'error');
  }
}

export async function registerNotificationActionNavigation(navigate) {
  webNotificationNavigate = navigate;

  if (!isNativeNotificationsAvailable()) {
    return {
      remove: () => {
        if (webNotificationNavigate === navigate) webNotificationNavigate = null;
      },
    };
  }

  if (actionListenerHandle?.remove) {
    await actionListenerHandle.remove();
    actionListenerHandle = null;
  }

  actionListenerHandle = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (action) => {
      const route = action?.notification?.extra?.route;
      if (route) navigate(route);
    }
  );

  return actionListenerHandle;
}

function buildNotificationRequest(type, setting) {
  const meta = NOTIFICATION_META[type];
  const { hour, minute } = parseTime(setting.time);

  return {
    id: meta.id,
    title: t(`notification.push_${type}_title`),
    body: t(`notification.push_${type}_body`),
    schedule: {
      on: { hour, minute },
      /* Doze 모드/절전에서도 발화하도록 — 그렇지 않으면 예약은 되지만 시간에 안 옴. */
      allowWhileIdle: true,
    },
    autoCancel: true,
    /* Android 8+ 알림 채널 — 채널이 없으면 헤드업/소리 없이 조용히 발생. */
    channelId: 'daystory_default',
    extra: {
      type,
      route: meta.route,
    },
  };
}

/* 한 번만 등록되는 알림 채널 — 권한 부여 후/처음 예약 전에 보장. */
let notificationChannelEnsured = false;
async function ensureAndroidNotificationChannel() {
  if (notificationChannelEnsured) return;
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform && Capacitor.getPlatform() !== 'android') return;

  try {
    await LocalNotifications.createChannel({
      id: 'daystory_default',
      name: t('notification.channel_name'),
      description: t('notification.channel_desc'),
      importance: 4,        /* IMPORTANCE_HIGH */
      visibility: 1,        /* VISIBILITY_PUBLIC */
      vibration: true,
    });
    notificationChannelEnsured = true;
  } catch (err) {
    console.warn('알림 채널 생성 실패:', err);
  }
}

async function ensureNativeNotificationPermission() {
  try {
    /* 채널은 권한과 별개로 미리 생성해 두는 것이 안전 (특히 Android 13+ 첫 권한 요청 시). */
    await ensureAndroidNotificationChannel();

    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;

    const requested = await LocalNotifications.requestPermissions();
    return requested.display === 'granted';
  } catch (err) {
    console.warn('알림 권한 확인 실패:', err);
    return false;
  }
}

async function ensureWebNotificationPermission() {
  if (!hasWebNotificationSupport()) return false;
  if (Notification.permission === 'granted' || webPermissionGrantedForSession) return true;
  if (Notification.permission === 'denied') return false;

  try {
    const permission = await Notification.requestPermission();
    webPermissionGrantedForSession = permission === 'granted';
    return webPermissionGrantedForSession;
  } catch (err) {
    console.warn('웹 알림 권한 확인 실패:', err);
    return false;
  }
}

function isNativeNotificationsAvailable() {
  return Capacitor.isNativePlatform();
}

function hasWebNotificationSupport() {
  return typeof Notification !== 'undefined';
}

function hasWebNotificationPermission() {
  return hasWebNotificationSupport() && (Notification.permission === 'granted' || webPermissionGrantedForSession);
}

function syncWebNotificationSchedules(settings, types) {
  types.forEach(clearWebNotificationTimer);

  if (!hasWebNotificationPermission()) return;

  types
    .filter((notificationType) => settings[notificationType]?.enabled)
    .forEach((notificationType) => {
      scheduleWebNotification(notificationType, settings[notificationType]);
    });
}

function clearWebNotificationTimer(type) {
  const timer = webNotificationTimers.get(type);
  if (timer) clearTimeout(timer);
  webNotificationTimers.delete(type);
}

function scheduleWebNotification(type, setting) {
  const delay = getNextDelay(setting.time);
  const timer = setTimeout(() => {
    showWebNotification(type);

    const latestSetting = getNotificationSettings()[type];
    if (latestSetting?.enabled) scheduleWebNotification(type, latestSetting);
  }, delay);

  webNotificationTimers.set(type, timer);
}

function showWebNotification(type) {
  if (!hasWebNotificationPermission()) return;

  const meta = NOTIFICATION_META[type];
  const notification = new Notification(t(`notification.push_${type}_title`), {
    body: t(`notification.push_${type}_body`),
    tag: `daystory-${type}`,
    data: {
      type,
      route: meta.route,
    },
  });

  notification.onclick = () => {
    webNotificationNavigate?.(meta.route);
  };
}

function getNextDelay(time) {
  const { hour, minute } = parseTime(time);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

function readSavedSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch (err) {
    return {};
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    diary: normalizeNotificationSetting(settings.diary, DEFAULT_SETTINGS.diary),
    editor: normalizeNotificationSetting(settings.editor, DEFAULT_SETTINGS.editor),
  }));
}

function normalizeNotificationSetting(value, fallback) {
  if (value === undefined || value === null) {
    return { enabled: Boolean(fallback.enabled), time: fallback.time };
  }
  return {
    enabled: Boolean(value?.enabled),
    time: isValidTime(value?.time) ? value.time : fallback.time,
  };
}

function parseTime(time) {
  const [hour, minute] = (isValidTime(time) ? time : '12:00').split(':').map(Number);
  return { hour, minute };
}

function isValidTime(time) {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
