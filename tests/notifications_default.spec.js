// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    schedule: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    createChannel: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
    checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
  },
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
}));

const STORAGE_KEY = 'ds_notification_settings_v1';

const { getNotificationSettings } = await import(
  '../src/js/services/notifications.js'
);

describe('notifications default settings — 신규 사용자 알림 기본 ON', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('localStorage가 비어있는 신규 사용자에게 diary 알림이 기본 ON으로 적용된다', () => {
    const settings = getNotificationSettings();
    expect(settings.diary.enabled).toBe(true);
    expect(settings.diary.time).toBe('12:00');
  });

  it('editor 알림은 기본 OFF 유지 (사용자가 켜야 발화)', () => {
    const settings = getNotificationSettings();
    expect(settings.editor.enabled).toBe(false);
  });

  it('기존 사용자가 명시적으로 OFF로 저장한 settings는 마이그레이션으로 덮어쓰지 않는다', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        diary: { enabled: false, time: '09:00' },
        editor: { enabled: false, time: '20:00' },
      })
    );
    const settings = getNotificationSettings();
    expect(settings.diary.enabled).toBe(false);
    expect(settings.diary.time).toBe('09:00');
    expect(settings.editor.enabled).toBe(false);
    expect(settings.editor.time).toBe('20:00');
  });

  it('기존 사용자가 ON으로 저장한 settings도 그대로 유지된다', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        diary: { enabled: true, time: '21:00' },
      })
    );
    const settings = getNotificationSettings();
    expect(settings.diary.enabled).toBe(true);
    expect(settings.diary.time).toBe('21:00');
  });

  it('저장된 settings에 diary가 누락되어 있으면 fallback으로 ON 적용', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        editor: { enabled: true, time: '10:00' },
      })
    );
    const settings = getNotificationSettings();
    expect(settings.diary.enabled).toBe(true);
    expect(settings.editor.enabled).toBe(true);
  });
});
