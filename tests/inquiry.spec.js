// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* welcome_seed.spec.js 의 firebase/firestore mock 패턴을 차용한다. */
const { addDocMock } = vi.hoisted(() => ({
  addDocMock: vi.fn(),
}));

vi.mock('../src/js/services/firebase.js', () => ({
  db: { _mockDb: true },
  storage: null,
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ _col: name })),
  addDoc: addDocMock,
  serverTimestamp: vi.fn(() => '__server_ts__'),
}));

/* getState('user') 를 테스트에서 제어 */
const { getStateMock } = vi.hoisted(() => ({ getStateMock: vi.fn() }));
vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
  setState: vi.fn(),
  subscribe: vi.fn(),
}));

/* locale 고정 (router/JSON 로딩 side-effect 회피) */
vi.mock('../src/js/i18n/index.js', () => ({
  getCurrentLang: vi.fn(() => 'ja'),
}));

/* OS 메타 — Capacitor / Device */
const { getInfoMock, getPlatformMock } = vi.hoisted(() => ({
  getInfoMock: vi.fn(),
  getPlatformMock: vi.fn(() => 'web'),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
}));
vi.mock('@capacitor/device', () => ({
  Device: { getInfo: getInfoMock },
}));

const {
  submitInquiry,
  canSubmitInquiry,
  recordInquirySubmission,
  INQUIRY_TYPES,
} = await import('../src/js/services/inquiries.js');

const COOLDOWN_KEY = 'daystory:inquiry-log';

describe('inquiries 서비스 — 문의 제출', () => {
  beforeEach(() => {
    localStorage.clear();
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'inq-1' });
    getStateMock.mockReset();
    getStateMock.mockImplementation((key) => (key === 'user' ? { id: 'uid-123' } : null));
    getInfoMock.mockReset();
    getInfoMock.mockResolvedValue({
      platform: 'ios',
      operatingSystem: 'ios',
      osVersion: '17.4',
      model: 'iPhone15,2',
      manufacturer: 'Apple',
    });
    getPlatformMock.mockReset();
    getPlatformMock.mockReturnValue('web');
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('필수 자동 수집 데이터를 포함한 payload 로 inquiries 컬렉션에 저장한다', async () => {
    const res = await submitInquiry({ type: 'bug', content: '  버그 있어요  ', entryCardId: 'story-9' });

    expect(res).toEqual({ ok: true, error: null });
    expect(addDocMock).toHaveBeenCalledTimes(1);

    const [colRef, payload] = addDocMock.mock.calls[0];
    expect(colRef).toEqual({ _col: 'inquiries' });
    expect(payload).toMatchObject({
      type: 'bug',
      content: '버그 있어요',          // trim 적용
      userId: 'uid-123',
      locale: 'ja',
      entryCardId: 'story-9',
      platform: 'ios',
      status: 'pending',
    });
    expect(payload.os).toMatchObject({ osVersion: '17.4', model: 'iPhone15,2', manufacturer: 'Apple' });
    expect(typeof payload.appVersion).toBe('string');
    expect(typeof payload.createdAtIso).toBe('string');
  });

  it('알 수 없는 type 은 etc 로, entryCardId 미지정 시 null 로 정규화한다', async () => {
    await submitInquiry({ type: 'nonsense', content: '내용' });
    const payload = addDocMock.mock.calls[0][1];
    expect(payload.type).toBe('etc');
    expect(payload.entryCardId).toBeNull();
  });

  it('내용이 비어 있으면 저장하지 않고 error:empty 를 반환한다', async () => {
    const res = await submitInquiry({ type: 'typo', content: '   ' });
    expect(res).toEqual({ ok: false, error: 'empty' });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('Device.getInfo 실패 시 platform 은 Capacitor.getPlatform 폴백을 사용한다', async () => {
    getInfoMock.mockRejectedValue(new Error('not native'));
    getPlatformMock.mockReturnValue('android');
    await submitInquiry({ type: 'feature', content: '제안' });
    const payload = addDocMock.mock.calls[0][1];
    expect(payload.platform).toBe('android');
  });

  it('로그인하지 않았으면 userId 는 null 로 저장된다', async () => {
    getStateMock.mockImplementation(() => null);
    await submitInquiry({ type: 'etc', content: '익명' });
    expect(addDocMock.mock.calls[0][1].userId).toBeNull();
  });

  it('INQUIRY_TYPES 는 버그/오탈자/기능/기타 4종이다', () => {
    expect(INQUIRY_TYPES).toEqual(['bug', 'typo', 'feature', 'etc']);
  });
});

describe('inquiries 서비스 — 도배 방지 쿨타임 (1시간 내 3회)', () => {
  beforeEach(() => {
    localStorage.clear();
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'inq' });
    getStateMock.mockImplementation((key) => (key === 'user' ? { id: 'u' } : null));
    getInfoMock.mockResolvedValue({ platform: 'web' });
    getPlatformMock.mockReturnValue('web');
  });
  afterEach(() => localStorage.clear());

  it('1시간 내 기록이 3개 미만이면 제출 가능하다', () => {
    const now = Date.now();
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify([now - 1000, now - 2000]));
    expect(canSubmitInquiry()).toBe(true);
  });

  it('1시간 내 기록이 3개면 제출이 차단된다', () => {
    const now = Date.now();
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify([now - 1000, now - 2000, now - 3000]));
    expect(canSubmitInquiry()).toBe(false);
  });

  it('1시간이 지난 오래된 기록은 prune 되어 다시 제출 가능하다', () => {
    const old = Date.now() - (61 * 60 * 1000); // 61분 전
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify([old, old, old]));
    expect(canSubmitInquiry()).toBe(true);
  });

  it('쿨타임 초과 시 submitInquiry 는 error:cooldown 을 반환하고 저장하지 않는다', async () => {
    const now = Date.now();
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify([now, now, now]));
    const res = await submitInquiry({ type: 'bug', content: '도배' });
    expect(res).toEqual({ ok: false, error: 'cooldown' });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('성공 제출 시 recordInquirySubmission 으로 타임스탬프가 누적된다', async () => {
    await submitInquiry({ type: 'bug', content: '첫 제출' });
    const log = JSON.parse(localStorage.getItem(COOLDOWN_KEY));
    expect(log.length).toBe(1);
    recordInquirySubmission();
    expect(JSON.parse(localStorage.getItem(COOLDOWN_KEY)).length).toBe(2);
  });
});
