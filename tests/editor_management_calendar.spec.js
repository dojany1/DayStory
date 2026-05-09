import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  setBeforeNavigateMock,
  getStateMock,
  fetchAllStoriesEditorMock,
  createStoryMock,
  updateStoryMock,
  deleteStoryMock,
  publishStoryMock,
  uploadImageMock,
  fetchStoryByIdMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  setBeforeNavigateMock: vi.fn(),
  getStateMock: vi.fn(),
  fetchAllStoriesEditorMock: vi.fn(),
  createStoryMock: vi.fn(),
  updateStoryMock: vi.fn(),
  deleteStoryMock: vi.fn(),
  publishStoryMock: vi.fn(),
  uploadImageMock: vi.fn(),
  fetchStoryByIdMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  setBeforeNavigate: setBeforeNavigateMock,
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../src/js/services/stories.js', () => ({
  fetchAllStoriesEditor: fetchAllStoriesEditorMock,
  createStory: createStoryMock,
  updateStory: updateStoryMock,
  deleteStory: deleteStoryMock,
  publishStory: publishStoryMock,
  uploadImage: uploadImageMock,
  fetchStoryById: fetchStoryByIdMock,
}));

vi.mock('../src/js/firebase.js', () => ({
  db: null,
  storage: null,
  auth: {
    currentUser: {
      uid: 'editor-1',
      email: 'editor@example.com',
      displayName: 'Editor',
      photoURL: '',
    },
  },
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

const { renderEditor, renderEditorNew } = await import('../src/js/pages/editor.js');

function setEditorState() {
  getStateMock.mockImplementation((key) => {
    if (key === 'profile') {
      return {
        role: 'editor',
        displayName: 'Editor',
        photoURL: '',
      };
    }

    if (key === 'user') {
      return {
        id: 'editor-1',
        email: 'editor@example.com',
        displayName: 'Editor',
      };
    }

    return null;
  });
}

async function flushEditor() {
  await Promise.resolve();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
  await Promise.resolve();
}

describe('May 4 editor management recovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '#/editor';

    navigateMock.mockReset();
    setBeforeNavigateMock.mockReset();
    getStateMock.mockReset();
    fetchAllStoriesEditorMock.mockReset();
    createStoryMock.mockReset();
    updateStoryMock.mockReset();
    deleteStoryMock.mockReset();
    publishStoryMock.mockReset();
    uploadImageMock.mockReset();
    fetchStoryByIdMock.mockReset();

    setEditorState();
    fetchAllStoriesEditorMock.mockResolvedValue([]);
    fetchStoryByIdMock.mockResolvedValue(null);
  });

  it('renders the content manager as a flat calendar without the removed side peek UI', async () => {
    fetchAllStoriesEditorMock.mockResolvedValue([
      {
        id: 'story-may',
        status: 'published',
        figure_name: 'May Story',
        title: 'May Story',
        publish_date: '2026-05-04',
        country: 'KR',
        image_url: 'https://example.com/may.png',
      },
      {
        id: 'story-draft',
        status: 'draft',
        figure_name: 'Draft Story',
        title: 'Draft Story',
        publish_date: '2026-05-12',
        country: 'KR',
      },
    ]);

    const page = renderEditor();
    document.body.appendChild(page);

    await flushEditor();

    expect(page.querySelector('.editor-calendar-header .calendar-title')?.textContent).toBe('콘텐츠 관리');
    expect(page.querySelector('.editor-calendar-grid')).not.toBeNull();
    expect(page.querySelector('.editor-calendar-cell[data-date="2026-05-04"] .editor-calendar-story-title')?.textContent).toContain('May Story');
    expect(page.querySelector('.editor-calendar-cell[data-date="2026-05-12"] .badge-draft')?.textContent).toContain('초안');
    expect(page.querySelector('#editor-new')).toBeNull();
    expect(page.querySelector('.editor-new-btn')).toBeNull();
    expect(page.querySelector('.editor-calendar-empty-mark')).toBeNull();
    expect(page.querySelector('.editor-item')).toBeNull();
    expect(page.querySelector('.card-side-peek')).toBeNull();
  });

  it('opens the new story form from an empty date and keeps existing story clicks on edit', async () => {
    fetchAllStoriesEditorMock.mockResolvedValue([
      {
        id: 'story-may',
        status: 'published',
        figure_name: 'May Story',
        title: 'May Story',
        publish_date: '2026-05-04',
        country: 'KR',
      },
    ]);

    const page = renderEditor();
    document.body.appendChild(page);

    await flushEditor();

    page.querySelector('.editor-calendar-cell[data-date="2026-05-20"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navigateMock).toHaveBeenCalledWith('/editor/new?date=2026-05-20');

    page.querySelector('.editor-calendar-cell[data-date="2026-05-04"] .editor-calendar-story')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navigateMock).toHaveBeenCalledWith('/editor/new?edit=story-may');
  });

  it('prefills the publish date when opened from the editor calendar', async () => {
    window.location.hash = '#/editor/new?date=2026-05-20';

    const page = renderEditorNew();
    document.body.appendChild(page);

    await flushEditor();

    expect(page.querySelector('#sf-publish-date')?.value).toBe('2026-05-20');
  });

  it('does not keep the empty Android widget configure attribute', () => {
    const xml = readFileSync(
      resolve(process.cwd(), 'android/app/src/main/res/xml/daystory_widget_info.xml'),
      'utf8',
    );

    expect(xml).not.toContain('android:configure=""');
  });

  it('keeps editor calendar styling flat and hides inline calendar actions', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const editorPageRule = css.match(/\.editor-page\s*\{[\s\S]*?\}/)?.[0] || '';
    const statsRule = css.match(/\.editor-stats\s*\{[\s\S]*?\}/)?.[0] || '';
    const cellRule = css.match(/\.editor-calendar-cell\s*\{[\s\S]*?\}/)?.[0] || '';
    const titleRowRule = css.match(/\.editor-calendar-title-row\s*\{[\s\S]*?\}/)?.[0] || '';
    const actionsRule = css.match(/\.editor-calendar-actions\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(editorPageRule).toMatch(/padding:\s*var\(--space-3\) var\(--space-4\) var\(--space-6\)/);
    expect(statsRule).toMatch(/border-radius:\s*var\(--radius-full\)/);
    expect(titleRowRule).toMatch(/grid-template-columns:\s*36px\s+minmax\(0,\s*1fr\)\s+36px/);
    expect(cellRule).toMatch(/aspect-ratio:\s*3\s*\/\s*4/);
    expect(cellRule).toMatch(/border-radius:\s*0/);
    expect(actionsRule).toMatch(/display:\s*none/);
    expect(css).not.toMatch(/\.editor-new-btn/);
    expect(css).not.toMatch(/\.editor-calendar-empty-mark/);
  });
});
