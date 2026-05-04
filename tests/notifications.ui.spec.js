import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  getStateMock,
  setStateMock,
  showToastMock,
  isNativePlatformMock,
  checkPermissionsMock,
  requestPermissionsMock,
  scheduleMock,
  cancelMock,
  addListenerMock,
  webRequestPermissionMock,
  webNotificationInstances,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getStateMock: vi.fn(),
  setStateMock: vi.fn(),
  showToastMock: vi.fn(),
  isNativePlatformMock: vi.fn(),
  checkPermissionsMock: vi.fn(),
  requestPermissionsMock: vi.fn(),
  scheduleMock: vi.fn(),
  cancelMock: vi.fn(),
  addListenerMock: vi.fn(),
  webRequestPermissionMock: vi.fn(),
  webNotificationInstances: [],
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
  setState: setStateMock,
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: showToastMock,
}));

vi.mock('../src/js/firebase.js', () => ({
  auth: {
    currentUser: { uid: 'user-1' },
  },
  db: {},
  storage: {},
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ forEach: vi.fn() }),
  query: vi.fn(),
  setDoc: vi.fn(),
  where: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));

vi.mock('cropperjs', () => ({
  default: class CropperMock {
    destroy() {}
    rotate() {}
    getCroppedCanvas() {
      return {
        toBlob(callback) {
          callback(new Blob(['test'], { type: 'image/jpeg' }));
        },
      };
    }
  },
}));

vi.mock('cropperjs/dist/cropper.css', () => ({}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: isNativePlatformMock,
  },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: checkPermissionsMock,
    requestPermissions: requestPermissionsMock,
    schedule: scheduleMock,
    cancel: cancelMock,
    addListener: addListenerMock,
  },
}));

const { renderSettings } = await import('../src/js/pages/settings.js');
const { renderProfile } = await import('../src/js/pages/profile.js');
const {
  getNotificationSettings,
  registerNotificationActionNavigation,
  syncNotificationSchedules,
  updateNotificationSetting,
} = await import('../src/js/services/notifications.js');

function setDefaultState() {
  getStateMock.mockImplementation((key) => {
    if (key === 'user') {
      return {
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'User',
      };
    }

    if (key === 'profile') {
      return {
        nickname: 'User',
      };
    }

    if (key === 'theme') return 'light';
    if (key === 'fontSize') return 'medium';
    if (key === 'widgetTheme') return 'light';

    return null;
  });
}

function settingsSectionSignature(page) {
  return Array.from(page.querySelectorAll('.settings-section')).map((section) => ({
    title: section.querySelector('.settings-section-title')?.textContent?.trim(),
    rows: Array.from(section.querySelectorAll('.list-item')).map((row) => ({
      id: row.id,
      role: row.getAttribute('role'),
      tabIndex: row.getAttribute('tabindex'),
      hasIcon: Boolean(row.querySelector('.list-item-icon')),
      hasContent: Boolean(row.querySelector('.list-item-content')),
    })),
  }));
}

async function flushTimers() {
  await Promise.resolve();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
  await Promise.resolve();
}

describe('Notification settings UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="mobile-wrapper"></div>';
    localStorage.clear();

    navigateMock.mockReset();
    getStateMock.mockReset();
    setStateMock.mockReset();
    showToastMock.mockReset();
    isNativePlatformMock.mockReset();
    checkPermissionsMock.mockReset();
    requestPermissionsMock.mockReset();
    scheduleMock.mockReset();
    cancelMock.mockReset();
    addListenerMock.mockReset();
    webRequestPermissionMock.mockReset();
    webNotificationInstances.length = 0;

    isNativePlatformMock.mockReturnValue(false);
    checkPermissionsMock.mockResolvedValue({ display: 'granted' });
    requestPermissionsMock.mockResolvedValue({ display: 'granted' });
    scheduleMock.mockResolvedValue({ notifications: [] });
    cancelMock.mockResolvedValue(undefined);
    addListenerMock.mockResolvedValue({ remove: vi.fn() });
    webRequestPermissionMock.mockResolvedValue('granted');
    class WebNotificationMock {
      static permission = 'default';
      static requestPermission = webRequestPermissionMock;

      constructor(title, options) {
        this.title = title;
        this.options = options;
        this.onclick = null;
        webNotificationInstances.push(this);
      }
    }
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: WebNotificationMock,
    });
    setDefaultState();
  });

  it('Given the settings page, when it renders, then the notification tab should appear as the first settings section below the header', () => {
    const page = renderSettings();
    document.body.appendChild(page);

    const sections = page.querySelectorAll('.settings-section');

    expect(sections[0]?.querySelector('.settings-section-title')?.textContent?.trim()).toBe('알림');
    expect(sections[0]?.querySelector('#setting-notifications')).not.toBeNull();
    expect(sections[0]?.querySelector('#setting-widget-theme')).not.toBeNull();
    expect(sections[0]?.querySelector('#setting-notifications')?.nextElementSibling?.id).toBe('setting-widget-theme');
  });

  it('Given the profile page, when it renders, then the notification tab should appear immediately after the user card', () => {
    const page = renderProfile();
    document.body.appendChild(page);

    const userCard = page.querySelector('.settings-user-info');
    const notificationSection = page.querySelector('.settings-section');

    expect(userCard?.nextElementSibling).toBe(notificationSection);
    expect(notificationSection?.querySelector('.settings-section-title')?.textContent?.trim()).toBe('알림');
    expect(notificationSection?.querySelector('#setting-notifications')).not.toBeNull();
    expect(notificationSection?.querySelector('#setting-widget-theme')).not.toBeNull();
  });

  it('Given profile and settings pages, when their settings sections render, then row structure and keyboard access should match', () => {
    const profilePage = renderProfile();
    const settingsPage = renderSettings();
    document.body.appendChild(profilePage);
    document.body.appendChild(settingsPage);

    expect(settingsSectionSignature(settingsPage)).toEqual(settingsSectionSignature(profilePage));

    settingsPage.querySelectorAll('.settings-section .list-item').forEach((row) => {
      expect(row.getAttribute('role')).toBe('button');
      expect(row.getAttribute('tabindex')).toBe('0');
      expect(row.querySelector('.list-item-icon')).not.toBeNull();
      expect(row.querySelector('.list-item-content')).not.toBeNull();
    });
  });

  it('Given the display section renders, when inspected, then widget theme options should not be inline under display', () => {
    const page = renderSettings();
    document.body.appendChild(page);

    const displaySection = Array.from(page.querySelectorAll('.settings-section'))
      .find((section) => section.querySelector('.settings-section-title')?.textContent?.trim() === '디스플레이');

    expect(displaySection?.querySelector('#setting-widget-theme')).toBeNull();
    expect(displaySection?.querySelector('.widget-theme-option-group')).toBeNull();
  });

  it('Given the notification tab, when the user taps it, then the bottom sheet should show unclipped select controls with 12:00 defaults', () => {
    const page = renderSettings();
    document.body.appendChild(page);

    page.querySelector('#setting-notifications')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const sheet = document.querySelector('.notification-settings-sheet');
    const diaryPeriod = sheet?.querySelector('select[data-notification-period="diary"]');
    const diaryHour = sheet?.querySelector('select[data-notification-hour="diary"]');
    const diaryMinute = sheet?.querySelector('select[data-notification-minute="diary"]');
    const editorPeriod = sheet?.querySelector('select[data-notification-period="editor"]');
    const editorHour = sheet?.querySelector('select[data-notification-hour="editor"]');
    const editorMinute = sheet?.querySelector('select[data-notification-minute="editor"]');

    expect(sheet).not.toBeNull();
    expect(sheet?.querySelector('input[type="time"]')).toBeNull();
    expect(diaryPeriod?.value).toBe('PM');
    expect(diaryHour?.value).toBe('12');
    expect(diaryMinute?.value).toBe('00');
    expect(editorPeriod?.value).toBe('PM');
    expect(editorHour?.value).toBe('12');
    expect(editorMinute?.value).toBe('00');
  });

  it('Given the notification bottom sheet, when dragged down past the threshold, then it should close', () => {
    const page = renderSettings();
    document.body.appendChild(page);

    page.querySelector('#setting-notifications')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const overlay = document.querySelector('.notification-settings-overlay');
    const sheet = document.querySelector('.notification-settings-sheet');
    const handle = sheet?.querySelector('.modal-handle');

    handle?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 0 }));
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 120 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 120 }));
    overlay?.dispatchEvent(new Event('transitionend'));

    expect(document.querySelector('.notification-settings-overlay')).toBeNull();
  });

  it('Given the notification bottom sheet, when a short drag ends, then it should remain open', () => {
    const page = renderSettings();
    document.body.appendChild(page);

    page.querySelector('#setting-notifications')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const sheet = document.querySelector('.notification-settings-sheet');
    const handle = sheet?.querySelector('.modal-handle');

    handle?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 0 }));
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 32 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 32 }));

    expect(document.querySelector('.notification-settings-overlay')).not.toBeNull();
    expect(sheet?.style.transform).toBe('');
  });

  it('Given the notification bottom sheet, when a select control is dragged, then the sheet should not close', () => {
    const page = renderSettings();
    document.body.appendChild(page);

    page.querySelector('#setting-notifications')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const select = document.querySelector('select[data-notification-hour="diary"]');

    select?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 0 }));
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 140 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 140 }));

    expect(document.querySelector('.notification-settings-overlay')).not.toBeNull();
  });

  it('Given the widget theme tab, when the user taps it, then a compact bottom sheet should set the widget theme', () => {
    const page = renderSettings();
    document.body.appendChild(page);

    page.querySelector('#setting-widget-theme')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const sheet = document.querySelector('.widget-theme-settings-sheet');
    const darkOption = sheet?.querySelector('[data-widget-theme="dark"]');

    expect(sheet).not.toBeNull();
    expect(sheet?.querySelector('.widget-theme-sheet-options')).not.toBeNull();
    expect(sheet?.querySelectorAll('.widget-theme-option').length).toBe(2);
    expect(sheet?.querySelector('.widget-theme-preview')).not.toBeNull();

    darkOption?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(setStateMock).toHaveBeenCalledWith('widgetTheme', 'dark');
    expect(darkOption?.classList.contains('active')).toBe(true);
    expect(page.querySelector('.widget-theme-settings-summary')?.textContent).toBe('다크');
    expect(showToastMock).toHaveBeenCalledWith('위젯 테마: 다크', 'success');
  });

  it('Given the widget theme bottom sheet, when dragged down past the threshold, then it should close', () => {
    const page = renderSettings();
    document.body.appendChild(page);

    page.querySelector('#setting-widget-theme')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const overlay = document.querySelector('.widget-theme-settings-overlay');
    const handle = document.querySelector('.widget-theme-settings-sheet .modal-handle');

    handle?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 0 }));
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 100 }));
    overlay?.dispatchEvent(new Event('transitionend'));

    expect(document.querySelector('.widget-theme-settings-overlay')).toBeNull();
  });

  it('Given settings sections render, when inspected, then the license row should not be present', () => {
    const page = renderSettings();
    document.body.appendChild(page);

    expect(page.querySelector('#setting-license')).toBeNull();
  });

  it('Given a native app with notification permission granted, when the diary notification is enabled, then local notification 1001 should be scheduled', async () => {
    isNativePlatformMock.mockReturnValue(true);

    await updateNotificationSetting('diary', { enabled: true });

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock.mock.calls[0][0].notifications[0]).toMatchObject({
      id: 1001,
      extra: { route: '/mystory', type: 'diary' },
    });
  });

  it('Given notification permission is denied, when the user enables a notification, then the setting should stay off and no schedule should be created', async () => {
    isNativePlatformMock.mockReturnValue(true);
    checkPermissionsMock.mockResolvedValue({ display: 'denied' });
    requestPermissionsMock.mockResolvedValue({ display: 'denied' });

    await updateNotificationSetting('diary', { enabled: true });

    expect(getNotificationSettings().diary.enabled).toBe(false);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('Given the web app with browser notification permission granted, when the diary notification is enabled, then a test browser notification should fire and route to my story', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T11:59:30'));

    try {
      isNativePlatformMock.mockReturnValue(false);
      await registerNotificationActionNavigation(navigateMock);
      await updateNotificationSetting('diary', { enabled: true, time: '12:00' });

      expect(getNotificationSettings().diary.enabled).toBe(true);
      expect(webRequestPermissionMock).toHaveBeenCalled();
      expect(scheduleMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30000);

      expect(webNotificationInstances[0]?.title).toBe('일기 쓸 시간이에요');
      webNotificationInstances[0]?.onclick?.();

      expect(navigateMock).toHaveBeenCalledWith('/mystory');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Given an enabled diary notification, when the time changes, then the previous notification should be cancelled and rescheduled', async () => {
    isNativePlatformMock.mockReturnValue(true);
    await updateNotificationSetting('diary', { enabled: true });

    scheduleMock.mockClear();
    cancelMock.mockClear();

    await updateNotificationSetting('diary', { time: '21:30' });

    expect(cancelMock).toHaveBeenCalledWith({ notifications: [{ id: 1001 }] });
    expect(scheduleMock.mock.calls[0][0].notifications[0].schedule.on).toMatchObject({
      hour: 21,
      minute: 30,
    });
  });

  it('Given notification action navigation is registered, when a diary notification is tapped, then it should route to my story', async () => {
    isNativePlatformMock.mockReturnValue(true);
    let actionHandler;
    addListenerMock.mockImplementation((eventName, handler) => {
      if (eventName === 'localNotificationActionPerformed') actionHandler = handler;
      return Promise.resolve({ remove: vi.fn() });
    });

    await registerNotificationActionNavigation(navigateMock);
    actionHandler({
      notification: {
        extra: { route: '/mystory' },
      },
    });

    expect(navigateMock).toHaveBeenCalledWith('/mystory');
  });

  it('Given saved notification settings, when schedules sync on app start, then only enabled notifications should be scheduled', async () => {
    isNativePlatformMock.mockReturnValue(true);
    localStorage.setItem('ds_notification_settings_v1', JSON.stringify({
      diary: { enabled: true, time: '12:00' },
      editor: { enabled: false, time: '12:00' },
    }));

    await syncNotificationSchedules();

    expect(cancelMock).toHaveBeenCalledWith({ notifications: [{ id: 1001 }, { id: 1002 }] });
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock.mock.calls[0][0].notifications[0].id).toBe(1001);
  });
});
