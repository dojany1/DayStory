/* =====================================================================
   avatar_cache_offline.spec.js
   =====================================================================
   오프라인 상태에서도 유저 프로필 이미지가 표시되도록 하는
   avatarCache 유틸과 profile.js / main.js 연동을 검증한다.

   핵심 invariant:
   1. loadAvatarFromCache: localStorage 에서 uid 별 캐시된 data URL 반환
   2. clearAvatarCache: 캐시 삭제
   3. saveAvatarToCache: 오프라인(navigator.onLine=false)이면 저장 생략
   4. saveAvatarToCache: fetch 성공 시 localStorage 에 data URL 저장
   5. saveAvatarToCache: fetch 실패 시 조용히 무시 (best-effort)
   6. profile.js 가 avatarCache.js 를 import 하고 loadAvatarFromCache / saveAvatarToCache 를 사용한다
   7. profile.js 가 navigator.onLine 체크를 포함한다
   8. main.js 가 saveAvatarToCache 를 import 하고 photoURL 이 있을 때 호출한다
   ===================================================================== */

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = (p) => resolve(process.cwd(), p);
const profileSrc = () => readFileSync(root('src/js/pages/profile.js'), 'utf8');
const mainSrc = () => readFileSync(root('src/main.js'), 'utf8');
const settingsSectionsSrc = () =>
  readFileSync(root('src/js/components/settingsSections.js'), 'utf8');

/* ─── 유닛 테스트: avatarCache.js 함수 동작 ─── */

const { saveAvatarToCache, loadAvatarFromCache, clearAvatarCache } = await import(
  '../src/js/utils/avatarCache.js'
);

describe('avatarCache — localStorage 기반 저장/로드/삭제', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('loadAvatarFromCache: 저장된 값이 없으면 null 반환', () => {
    expect(loadAvatarFromCache('uid_abc')).toBeNull();
  });

  it('loadAvatarFromCache: uid 가 없으면 null 반환', () => {
    expect(loadAvatarFromCache('')).toBeNull();
    expect(loadAvatarFromCache(null)).toBeNull();
  });

  it('loadAvatarFromCache: localStorage 에 저장된 data URL 반환', () => {
    localStorage.setItem('ds_av_uid123', 'data:image/jpeg;base64,abc==');
    expect(loadAvatarFromCache('uid123')).toBe('data:image/jpeg;base64,abc==');
  });

  it('clearAvatarCache: 캐싱된 값 삭제', () => {
    localStorage.setItem('ds_av_uid123', 'data:image/jpeg;base64,abc==');
    clearAvatarCache('uid123');
    expect(loadAvatarFromCache('uid123')).toBeNull();
  });

  it('clearAvatarCache: uid 가 없어도 예외 없이 무시', () => {
    expect(() => clearAvatarCache('')).not.toThrow();
    expect(() => clearAvatarCache(null)).not.toThrow();
  });

  it('saveAvatarToCache: navigator.onLine=false 이면 fetch 없이 저장 생략', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('navigator', { ...navigator, onLine: false });

    await saveAvatarToCache('uid123', 'https://firebasestorage.googleapis.com/fake.jpg');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(loadAvatarFromCache('uid123')).toBeNull();
  });

  it('saveAvatarToCache: fetch 실패해도 예외 없이 무시 (best-effort)', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await expect(saveAvatarToCache('uid123', 'https://firebasestorage.googleapis.com/fake.jpg'))
      .resolves.toBeUndefined();
    expect(loadAvatarFromCache('uid123')).toBeNull();
  });

  it('saveAvatarToCache: fetch 성공 시 localStorage 에 data URL 저장', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true });

    const fakeDataUrl = 'data:image/jpeg;base64,fakeimagedata==';
    const mockBlob = new Blob(['fakedata'], { type: 'image/jpeg' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    }));

    /* jsdom 의 FileReader 는 실제로 동작하므로 실제 결과를 사용하기 위해
       readAsDataURL 을 stubbing 한다 */
    const origFileReader = globalThis.FileReader;
    const MockFileReader = function () {
      this.result = fakeDataUrl;
      this.readAsDataURL = (_blob) => {
        Promise.resolve().then(() => this.onload?.({ target: this }));
      };
      this.onerror = null;
      this.onload = null;
    };
    vi.stubGlobal('FileReader', MockFileReader);

    await saveAvatarToCache('uid123', 'https://firebasestorage.googleapis.com/fake.jpg');

    expect(loadAvatarFromCache('uid123')).toBe(fakeDataUrl);

    vi.stubGlobal('FileReader', origFileReader);
  });

  it('saveAvatarToCache: HTTP 응답이 실패(ok=false)이면 저장 생략', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await saveAvatarToCache('uid123', 'https://firebasestorage.googleapis.com/fake.jpg');
    expect(loadAvatarFromCache('uid123')).toBeNull();
  });

  it('saveAvatarToCache: uid 가 없으면 저장 생략', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('navigator', { ...navigator, onLine: true });

    await saveAvatarToCache('', 'https://firebasestorage.googleapis.com/fake.jpg');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/* ─── 정적 분석: profile.js 연동 ─── */

describe('profile.js — 오프라인 아바타 캐시 연동 (정적 분석)', () => {
  it('avatarCache.js 를 import 한다', () => {
    expect(profileSrc()).toMatch(/from\s+['"].*avatarCache/);
  });

  it('loadAvatarFromCache 를 호출한다', () => {
    expect(profileSrc()).toMatch(/loadAvatarFromCache\s*\(/);
  });

  it('saveAvatarToCache 를 호출한다', () => {
    expect(profileSrc()).toMatch(/saveAvatarToCache\s*\(/);
  });

  it('clearAvatarCache 를 호출한다 (로그아웃 시 정리 — settingsSections.js)', () => {
    expect(settingsSectionsSrc()).toMatch(/clearAvatarCache\s*\(/);
  });

  it('navigator.onLine 을 체크하여 오프라인 분기 처리', () => {
    expect(profileSrc()).toMatch(/navigator\.onLine/);
  });
});

/* ─── 정적 분석: main.js 연동 ─── */

describe('main.js — 로그인 시 아바타 사전 캐시 (정적 분석)', () => {
  it('saveAvatarToCache 를 import 한다', () => {
    expect(mainSrc()).toMatch(/saveAvatarToCache/);
  });

  it('photoURL 이 있을 때 saveAvatarToCache 를 호출한다', () => {
    expect(mainSrc()).toMatch(/saveAvatarToCache\s*\([^)]*photoURL/);
  });
});
