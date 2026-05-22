import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getParamsMock,
  getStateMock,
  fetchMyStoriesMock,
} = vi.hoisted(() => ({
  getParamsMock: vi.fn(),
  getStateMock: vi.fn(),
  fetchMyStoriesMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: vi.fn(),
  getParams: getParamsMock,
  setOnUnmount: vi.fn(),
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../src/js/components/confirmDialog.js', () => ({
  showConfirm: vi.fn(),
}));

vi.mock('../src/js/services/mystories.js', () => ({
  fetchMyStories: fetchMyStoriesMock,
  createMyStory: vi.fn(),
  updateMyStory: vi.fn(),
  fetchMyStoryById: vi.fn(),
  deleteMyStory: vi.fn(),
}));

vi.mock('../src/js/services/widget.js', () => ({
  syncDiaryStateFromList: vi.fn(),
}));

vi.mock('../src/js/services/sharing.js', () => ({
  shareStory: vi.fn(),
}));

vi.mock('../src/js/services/images.js', () => ({
  uploadImage: vi.fn(),
}));

vi.mock('../src/js/utils/scrollLock.js', () => ({
  lockScroll: vi.fn(),
  unlockScroll: vi.fn(),
}));

vi.mock('../src/js/firebase.js', () => ({
  auth: {
    currentUser: { uid: 'user-1' },
  },
  storage: {},
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  getBlob: vi.fn(),
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

const { renderMyStory } = await import('../src/js/pages/mystory.js');

function makeMyStory(overrides = {}) {
  return {
    id: 'my-24',
    uid: 'user-1',
    publish_date: '2026-04-24',
    title: '봄날의 일기',
    body: '기록 본문',
    image_url: 'https://example.com/my-story.png',
    ...overrides,
  };
}

async function flushTimers(ms = 0) {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
}

describe('My story card meta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:00:00'));

    document.body.innerHTML = '';

    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }

    getParamsMock.mockReset();
    getStateMock.mockReset();
    fetchMyStoriesMock.mockReset();

    getParamsMock.mockReturnValue({ date: '2026-04-24' });
    getStateMock.mockImplementation((key) => {
      if (key === 'user') {
        return {
          id: 'user-1',
          email: 'writer@example.com',
          displayName: '기본 이름',
        };
      }

      if (key === 'profile') {
        return {
          nickname: '프로필 닉네임',
        };
      }

      return null;
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('Given a saved my-story card, when the front side renders, then card meta should show the writer nickname instead of the story title', async () => {
    fetchMyStoriesMock.mockResolvedValue([makeMyStory({
      author_nickname: '작성자 <태그>',
    })]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const cardMeta = page.querySelector('.history-card-front .card-meta');

    expect(cardMeta?.textContent?.trim()).toBe('작성자 <태그>');
    expect(cardMeta?.innerHTML).not.toContain('<태그>');
    expect(cardMeta?.textContent).not.toContain('봄날의 일기');
  });

  it('Given a legacy my-story without saved author metadata, when the front side renders, then card meta should fall back to the current profile nickname', async () => {
    fetchMyStoriesMock.mockResolvedValue([makeMyStory()]);

    const page = renderMyStory();
    document.body.appendChild(page);

    await flushTimers(0);

    const cardMeta = page.querySelector('.history-card-front .card-meta');

    expect(cardMeta?.textContent?.trim()).toBe('프로필 닉네임');
    expect(cardMeta?.textContent).not.toContain('봄날의 일기');
  });
});
