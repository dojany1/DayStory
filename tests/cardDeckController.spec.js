// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  setStateMock,
  setOnUnmountMock,
  renderGridMock,
  createCardSwiperMock,
} = vi.hoisted(() => ({
  setStateMock: vi.fn(),
  setOnUnmountMock: vi.fn(),
  renderGridMock: vi.fn(),
  createCardSwiperMock: vi.fn(),
}));

vi.mock('../src/js/state.js', () => ({
  setState: setStateMock,
}));

vi.mock('../src/js/router.js', () => ({
  setOnUnmount: setOnUnmountMock,
}));

vi.mock('../src/js/utils/date.js', () => ({
  getLocalToday: () => '2026-06-03',
}));

vi.mock('../src/js/utils/cardSwiper.js', () => ({
  createCardSwiper: createCardSwiperMock,
}));

vi.mock('../src/js/pages/calendar.js', () => ({
  WEEKDAYS: ['일', '월', '화', '수', '목', '금', '토'],
  isAtCurrentMonth: vi.fn(() => true),
  renderGrid: renderGridMock,
}));

const { buildCardDeck } = await import('../src/js/components/cardDeck/cardDeckController.js');

async function flushMount() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('cardDeckController — calendar view wheel state', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    localStorage.clear();
    setStateMock.mockReset();
    setOnUnmountMock.mockReset();
    renderGridMock.mockReset();
    createCardSwiperMock.mockReset();
  });

  it('Given calendar view is restored, when the deck mounts, then the hidden day wheel still activates the initial date month', async () => {
    sessionStorage.setItem('ds_session_view', 'calendar');

    const page = buildCardDeck({
      idPrefix: 'testdeck',
      pageClass: 'testdeck-page',
      calMode: 'history',
      lastDateKey: 'lastEditorStoryDate',
      loadData: async () => ({
        stories: [{ id: 's-1', publish_date: '2026-06-02', title: 'June story' }],
        initialDate: '2026-06-02',
        calStores: {},
        bookmarkedIds: [],
      }),
      renderSlideHTML: () => '<div class="flip-container"></div>',
      bindCard: vi.fn(),
    });
    document.body.appendChild(page);

    await flushMount();

    expect(page.querySelector('#testdeck-day-picker')?.hidden).toBe(true);
    expect(page.querySelector('#testdeck-card-area')?.hidden).toBe(true);
    expect(page.querySelector('.wheel-item[data-month="6"]')?.classList.contains('active')).toBe(true);
    expect(page.querySelector('.wheel-item[data-date="2026-06-02"]')?.classList.contains('active')).toBe(true);
    expect(renderGridMock).toHaveBeenCalled();
    expect(createCardSwiperMock).not.toHaveBeenCalled();
  });

  it('Given calendar view is restored from a previously opened story date, when the deck mounts, then the calendar grid starts on that story month', async () => {
    sessionStorage.setItem('ds_session_view', 'calendar');

    const page = buildCardDeck({
      idPrefix: 'testdeck',
      pageClass: 'testdeck-page',
      calMode: 'history',
      lastDateKey: 'lastEditorStoryDate',
      loadData: async () => ({
        stories: [{ id: 's-1', publish_date: '2026-04-24', title: 'April story' }],
        initialDate: '2026-04-24',
        calStores: {
          historyStories: [{ id: 's-1', publish_date: '2026-04-24', title: 'April story' }],
        },
        bookmarkedIds: [],
      }),
      renderSlideHTML: () => '<div class="flip-container"></div>',
      bindCard: vi.fn(),
    });
    document.body.appendChild(page);

    await flushMount();

    const renderedState = renderGridMock.mock.calls.at(-1)?.[1];
    expect(renderedState.year).toBe(2026);
    expect(renderedState.month).toBe(3);

    renderedState.onStoryOpen({ id: 's-1', publish_date: '2026-04-24' }, '2026-04-24');

    expect(setStateMock).toHaveBeenCalledWith('lastEditorStoryDate', '2026-04-24');
  });
});
