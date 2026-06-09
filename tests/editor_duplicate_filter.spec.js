import { beforeEach, describe, expect, it, vi } from 'vitest';

/* 에디터 콘텐츠 관리의 '중복' 필터: 같은 publish_date 가 2건 이상인 날짜를
   식별/노출해 관리자가 중복 발행분을 찾아 삭제할 수 있게 한다.
   (캘린더 카드 팝업에서 "1월 23일 카드 여러 장"으로 새던 데이터 정리용 도구) */

const {
  navigateMock,
  getStateMock,
  fetchAllStoriesEditorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getStateMock: vi.fn(),
  fetchAllStoriesEditorMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  setBeforeNavigate: vi.fn(),
  pushBeforeNavigate: vi.fn(() => vi.fn()),
  setOnUnmount: vi.fn(),
}));
vi.mock('../src/js/state.js', () => ({ getState: getStateMock, setState: vi.fn() }));
vi.mock('../src/js/components/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../src/js/components/confirmDialog.js', () => ({ showConfirm: vi.fn() }));
vi.mock('../src/js/services/stories.js', () => ({
  fetchAllStoriesEditor: fetchAllStoriesEditorMock,
  createStory: vi.fn(),
  updateStory: vi.fn(),
  deleteStory: vi.fn(),
  publishStory: vi.fn(),
  uploadImage: vi.fn(),
  fetchStoryById: vi.fn().mockResolvedValue(null),
}));
vi.mock('../src/js/services/firebase.js', () => ({
  db: null,
  storage: null,
  auth: { currentUser: { uid: 'editor-1', email: 'e@e.com', displayName: 'Ed', photoURL: '' } },
}));
vi.mock('cropperjs', () => ({ default: class { destroy() {} } }));
vi.mock('cropperjs/dist/cropper.css', () => ({}));
vi.mock('../src/js/utils/date.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, getLocalToday: () => '2026-06-07' };
});

const { renderEditor } = await import('../src/js/pages/editor.js');

function story(id, date, status = 'published') {
  return { id, status, figure_name: id, title: id, publish_date: date, country: 'KR', image_url: 'https://e.com/x.png' };
}

async function flush() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
}

describe('editor content-manager duplicate filter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    navigateMock.mockReset();
    getStateMock.mockReset();
    fetchAllStoriesEditorMock.mockReset();
    getStateMock.mockImplementation((key) => (key === 'isAdmin' ? true : null));
  });

  it('counts duplicate dates and, when filtered, shows only stories on dates with 2+ entries', async () => {
    fetchAllStoriesEditorMock.mockResolvedValue([
      story('a', '2026-01-23'),
      story('b', '2026-01-23'),
      story('c', '2026-01-10'),
    ]);

    const page = renderEditor();
    document.body.appendChild(page);
    await flush();

    /* 통계: 중복 날짜는 1월 23일 한 곳 → "1" */
    expect(page.querySelector('#stat-duplicate')?.textContent).toBe('1');

    /* 기본(전체) 보기: 1/10·1/23 모두 글이 보임 */
    expect(page.querySelectorAll('.editor-calendar-cell[data-date="2026-01-23"] .editor-calendar-story').length).toBe(2);
    expect(page.querySelectorAll('.editor-calendar-cell[data-date="2026-01-10"] .editor-calendar-story').length).toBe(1);

    /* '중복' 필터 클릭 */
    const dupBtn = page.querySelector('.editor-stat[data-filter="duplicate"]');
    expect(dupBtn).toBeTruthy();
    dupBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    /* 중복 날짜(1/23)의 2건만 남고, 단일 날짜(1/10)는 숨겨진다 */
    expect(page.querySelectorAll('.editor-calendar-cell[data-date="2026-01-23"] .editor-calendar-story').length).toBe(2);
    expect(page.querySelectorAll('.editor-calendar-cell[data-date="2026-01-10"] .editor-calendar-story').length).toBe(0);
  });

  it('reports zero duplicates when every publish_date is unique', async () => {
    fetchAllStoriesEditorMock.mockResolvedValue([
      story('a', '2026-01-23'),
      story('b', '2026-01-24'),
    ]);

    const page = renderEditor();
    document.body.appendChild(page);
    await flush();

    expect(page.querySelector('#stat-duplicate')?.textContent).toBe('0');
  });
});
