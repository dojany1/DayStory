import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  getStateMock,
  fetchStoriesMock,
  fetchMyStoriesMock,
  getBookmarkedStoryIdsMock,
  localTodayMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getStateMock: vi.fn(),
  fetchStoriesMock: vi.fn(),
  fetchMyStoriesMock: vi.fn(),
  getBookmarkedStoryIdsMock: vi.fn(),
  localTodayMock: vi.fn(() => '2026-04-24'),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
}));

vi.mock('../src/js/services/stories.js', () => ({
  fetchStories: fetchStoriesMock,
}));

vi.mock('../src/js/services/mystories.js', () => ({
  fetchMyStories: fetchMyStoriesMock,
}));

vi.mock('../src/js/services/bookmarks.js', () => ({
  getBookmarkedStoryIds: getBookmarkedStoryIdsMock,
  toggleBookmark: vi.fn(),
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../src/js/firebase.js', () => ({
  auth: {
    currentUser: { uid: 'user-1' },
  },
}));

vi.mock('../src/js/utils/date.js', async () => {
  const actual = await vi.importActual('../src/js/utils/date.js');
  return {
    ...actual,
    getLocalToday: () => localTodayMock(),
  };
});

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn().mockResolvedValue(undefined),
    selectionChanged: vi.fn().mockResolvedValue(undefined),
  },
  ImpactStyle: {
    Light: 'Light',
    Medium: 'Medium',
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn().mockResolvedValue(undefined),
  },
}));

const { renderCalendar } = await import('../src/js/pages/calendar.js');

async function flushCalendar() {
  await Promise.resolve();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
  await Promise.resolve();
}

function makeMyStory(day) {
  const paddedDay = String(day).padStart(2, '0');
  return {
    id: `my-${day}`,
    uid: 'user-1',
    publish_date: `2026-04-${paddedDay}`,
    title: `My Story ${day}`,
    body: `Body ${day}`,
    image_url: `https://example.com/my-${day}.png`,
  };
}

function makeHistoryStory(day) {
  const paddedDay = String(day).padStart(2, '0');
  return {
    id: `history-${day}`,
    publish_date: `2026-04-${paddedDay}`,
    historical_year: '1592',
    country: 'Korea',
    figure_name: `History ${day}`,
    summary: `Summary ${day}`,
    body: `Body ${day}`,
    image_url: `https://example.com/history-${day}.png`,
  };
}

describe('Calendar UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();

    navigateMock.mockReset();
    getStateMock.mockReset();
    fetchStoriesMock.mockReset();
    fetchMyStoriesMock.mockReset();
    getBookmarkedStoryIdsMock.mockReset();
    localTodayMock.mockReset();

    localTodayMock.mockReturnValue('2026-04-24');
    getStateMock.mockReturnValue({ id: 'user-1' });
    fetchStoriesMock.mockResolvedValue([]);
    fetchMyStoriesMock.mockResolvedValue([makeMyStory(23)]);
    getBookmarkedStoryIdsMock.mockResolvedValue([]);
  });

  it('Given the calendar grid, when styles are inspected, then date cells should have no rounding, shadows, or spacing between cells', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const gridRule = css.match(/\.calendar-grid\s*\{[\s\S]*?\}/)?.[0] || '';
    const cellRule = css.match(/\.cal-cell\s*\{[\s\S]*?\}/)?.[0] || '';
    const todayRule = css.match(/\.cal-cell-today\s*\{[\s\S]*?\}/)?.[0] || '';
    const peekRule = css.match(/\.cal-cell-peek\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(gridRule).toMatch(/gap:\s*0(?:px)?/);
    expect(gridRule).toMatch(/padding:\s*0(?:px)?/);
    expect(cellRule).toMatch(/border-radius:\s*0(?:px)?/);
    expect(cellRule).not.toMatch(/box-shadow:/);
    expect(todayRule).not.toMatch(/box-shadow:/);
    expect(peekRule).toMatch(/border-radius:\s*0(?:px)?/);
    expect(peekRule).not.toMatch(/box-shadow:/);
  });

  it('Given the calendar header, when styles are inspected, then the title and mode toggle should be centered with equal-width mode buttons', () => {
    const page = renderCalendar();
    document.body.appendChild(page);

    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const headerRule = css.match(/\.calendar-header\s*\{[\s\S]*?\}/)?.[0] || '';
    const titleRule = css.match(/\.calendar-title\s*\{[\s\S]*?\}/)?.[0] || '';
    const toggleRule = css.match(/\.calendar-toggle\s*\{[\s\S]*?\}/)?.[0] || '';
    const toggleButtonRule = css.match(/\.calendar-toggle-btn\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(page.querySelector('.calendar-title')?.textContent?.trim()).toBe('캘린더');
    expect(headerRule).toMatch(/align-items:\s*center/);
    expect(titleRule).toMatch(/text-align:\s*center/);
    expect(toggleRule).toMatch(/align-self:\s*center/);
    expect(toggleRule).toMatch(/width:\s*min\(100%,\s*240px\)/);
    expect(toggleButtonRule).toMatch(/flex:\s*1\s+1\s+0/);
    expect(toggleButtonRule).toMatch(/text-align:\s*center/);
  });

  it('Given mine calendar mode and an empty non-future date, when the user clicks the date, then it should open my-story writing for that date', async () => {
    const page = renderCalendar();
    document.body.appendChild(page);

    await flushCalendar();

    page.querySelector('.calendar-toggle-btn[data-mode="mine"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushCalendar();

    const emptyTodayCell = page.querySelector('.cal-cell[data-date="2026-04-24"]');

    expect(emptyTodayCell).not.toBeNull();
    expect(emptyTodayCell?.hasAttribute('disabled')).toBe(false);

    emptyTodayCell?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/mystory/new?date=2026-04-24');
  });

  it('Given February in a leap year, when the calendar renders, then it should expose exactly 29 date cells', async () => {
    localTodayMock.mockReturnValue('2024-02-29');

    const page = renderCalendar();
    document.body.appendChild(page);

    await flushCalendar();

    expect(page.querySelectorAll('.cal-cell[data-date^="2024-02-"]')).toHaveLength(29);
    expect(page.querySelector('.cal-cell[data-date="2024-02-29"]')).not.toBeNull();
    expect(page.querySelector('.cal-cell[data-date="2024-02-30"]')).toBeNull();
  });

  it('Given February in a common year, when the calendar renders, then it should expose exactly 28 date cells', async () => {
    localTodayMock.mockReturnValue('2025-02-28');

    const page = renderCalendar();
    document.body.appendChild(page);

    await flushCalendar();

    expect(page.querySelectorAll('.cal-cell[data-date^="2025-02-"]')).toHaveLength(28);
    expect(page.querySelector('.cal-cell[data-date="2025-02-29"]')).toBeNull();
  });

  it('Given a 30-day month, when the calendar renders, then day 31 should not be present', async () => {
    const page = renderCalendar();
    document.body.appendChild(page);

    await flushCalendar();

    expect(page.querySelectorAll('.cal-cell[data-date^="2026-04-"]')).toHaveLength(30);
    expect(page.querySelector('.cal-cell[data-date="2026-04-31"]')).toBeNull();
  });

  it('Given the calendar is on the current month, when the next button is tapped, then it should stay on that month', async () => {
    const page = renderCalendar();
    document.body.appendChild(page);

    await flushCalendar();

    const label = page.querySelector('#cal-month-label');
    const nextBtn = page.querySelector('#cal-next-month');

    expect(label?.textContent).toBe('2026년 4월');
    expect(nextBtn?.hasAttribute('disabled')).toBe(true);

    nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(label?.textContent).toBe('2026년 4월');
  });

  it('Given tutorial runtime is removed, when the calendar renders, then no mode toggle guidance should appear', async () => {
    const page = renderCalendar();
    document.body.appendChild(page);

    await flushCalendar();

    expect(document.querySelector('.contextual-tip-card')).toBeNull();
    expect(document.querySelector('.contextual-tip-spotlight')).toBeNull();
    expect(document.querySelector('.tutorial-blocker')).toBeNull();
  });

  it('Given stale tutorial storage exists, when the calendar renders, then no contextual tip should appear', async () => {
    localStorage.setItem('tutorial_done', 'true');

    const page = renderCalendar();
    document.body.appendChild(page);

    await flushCalendar();

    expect(localStorage.getItem('tutorial_done')).toBe('true');
    expect(document.querySelector('.contextual-tip-card')).toBeNull();
  });

  it('Given a history card popup, when the card back is inspected, then the date and detail button should be grouped on the right with detail below the date', async () => {
    fetchStoriesMock.mockResolvedValue([makeHistoryStory(24)]);

    const page = renderCalendar();
    document.body.appendChild(page);

    await flushCalendar();

    page.querySelector('.cal-cell-has-story[data-date="2026-04-24"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const footerRule = css.match(/\.calendar-card-popup \.back-footer\s*\{[\s\S]*?\}/)?.[0] || '';
    const dateActionsRule = css.match(/\.calendar-card-popup \.back-date-actions\s*\{[\s\S]*?\}/)?.[0] || '';
    const backFooter = document.querySelector('.calendar-card-popup .back-footer');
    const dateActions = backFooter?.querySelector('.back-date-actions');
    const date = dateActions?.querySelector('.back-date');
    const detailButton = dateActions?.querySelector('.card-detail-shortcut-btn');

    expect(backFooter).not.toBeNull();
    expect(dateActions?.parentElement).toBe(backFooter);
    expect(dateActions?.children[0]).toBe(date);
    expect(dateActions?.children[1]).toBe(detailButton);
    expect(date?.textContent).toContain('1592년 4월 24일');
    expect(detailButton?.textContent?.trim()).toBe('상세 보기');
    expect(footerRule).toMatch(/justify-content:\s*flex-end/);
    expect(dateActionsRule).toMatch(/margin-left:\s*auto/);
    expect(dateActionsRule).toMatch(/align-items:\s*flex-end/);

    detailButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/detail/history-24');
  });
});
