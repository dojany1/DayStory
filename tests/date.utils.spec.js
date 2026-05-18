import { describe, expect, it, vi } from 'vitest';

import {
  formatLocalIsoDate,
  getDaysInMonth,
  getLocalToday,
  isValidCalendarDate,
  toLocalDateFromIso,
} from '../src/js/utils/date.js';

describe('Date utilities', () => {
  it('calculates month lengths with Gregorian leap years', () => {
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2025, 2)).toBe(28);

    [4, 6, 9, 11].forEach((month) => {
      expect(getDaysInMonth(2026, month)).toBe(30);
    });

    [1, 3, 5, 7, 8, 10, 12].forEach((month) => {
      expect(getDaysInMonth(2026, month)).toBe(31);
    });
  });

  it('validates real calendar dates before creating local dates', () => {
    expect(isValidCalendarDate(2024, 2, 29)).toBe(true);
    expect(isValidCalendarDate(2025, 2, 29)).toBe(false);
    expect(isValidCalendarDate(2026, 4, 31)).toBe(false);

    expect(formatLocalIsoDate(toLocalDateFromIso('2024-02-29'))).toBe('2024-02-29');
    expect(toLocalDateFromIso('2025-02-29')).toBeNull();
    expect(toLocalDateFromIso('2026-04-31')).toBeNull();
  });

  it('returns today from the local calendar instead of UTC calendar boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T16:30:00.000Z'));

    try {
      expect(getLocalToday()).toBe('2026-05-01');
    } finally {
      vi.useRealTimers();
    }
  });
});
