import { describe, expect, it } from 'vitest';

import { compareVersions, isUpdateAvailable } from '../src/js/utils/version.js';

describe('compareVersions — SemVer comparator', () => {
  it('returns negative when a < b, positive when a > b, 0 when equal', () => {
    expect(compareVersions('1.3.5', '1.3.6')).toBeLessThan(0);
    expect(compareVersions('1.3.6', '1.3.5')).toBeGreaterThan(0);
    expect(compareVersions('1.3.6', '1.3.6')).toBe(0);
  });

  it('compares major and minor segments before patch', () => {
    expect(compareVersions('1.4.0', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('1.10.0', '1.9.99')).toBeGreaterThan(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0);
  });

  it('treats missing trailing segments as zero (1.4 == 1.4.0)', () => {
    expect(compareVersions('1.4', '1.4.0')).toBe(0);
    expect(compareVersions('1.4', '1.4.1')).toBeLessThan(0);
    expect(compareVersions('2', '1.99.99')).toBeGreaterThan(0);
  });

  it('strips an optional leading v prefix', () => {
    expect(compareVersions('v1.3.5', '1.3.6')).toBeLessThan(0);
    expect(compareVersions('V2.0.0', 'v2.0.0')).toBe(0);
  });

  it('ignores pre-release and build suffixes for the numeric comparison', () => {
    /* "1.4.0-beta.1" 의 숫자 prefix 만 사용 — 사용자에게 정식 업데이트 알림용이라
       pre-release 정밀 비교는 불필요. */
    expect(compareVersions('1.4.0-beta.1', '1.4.0')).toBe(0);
    expect(compareVersions('1.4.0+build.7', '1.4.0')).toBe(0);
    expect(compareVersions('1.3.9-rc.2', '1.4.0')).toBeLessThan(0);
  });

  it('treats non-numeric or empty inputs as 0 segments (defensive)', () => {
    expect(compareVersions('', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('abc', '0.0.0')).toBe(0);
    expect(compareVersions('1.x.0', '1.0.0')).toBe(0);
  });
});

describe('isUpdateAvailable — guards the update notification', () => {
  it('returns true only when current is strictly older than latest', () => {
    expect(isUpdateAvailable('1.3.5', '1.3.6')).toBe(true);
    expect(isUpdateAvailable('1.3.6', '1.3.6')).toBe(false);
    expect(isUpdateAvailable('1.3.7', '1.3.6')).toBe(false);
  });

  it('returns false for missing or invalid inputs (no false positives)', () => {
    expect(isUpdateAvailable('', '1.3.6')).toBe(false);
    expect(isUpdateAvailable('1.3.5', '')).toBe(false);
    expect(isUpdateAvailable(null, '1.3.6')).toBe(false);
    expect(isUpdateAvailable('1.3.5', undefined)).toBe(false);
    expect(isUpdateAvailable('1.3.5', 'not-a-version')).toBe(false);
  });

  it('handles the documented 1.3.5 → 1.3.6 example', () => {
    expect(isUpdateAvailable('1.3.5', '1.3.6')).toBe(true);
  });
});
