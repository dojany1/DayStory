import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const {
  navigateMock,
  setBeforeNavigateMock,
  getStateMock,
  showToastMock,
  fetchAllStoriesEditorMock,
  createStoryMock,
  updateStoryMock,
  deleteStoryMock,
  publishStoryMock,
  uploadImageMock,
  fetchStoryByIdMock,
  cropperCanvasOptions,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  setBeforeNavigateMock: vi.fn(),
  getStateMock: vi.fn(),
  showToastMock: vi.fn(),
  fetchAllStoriesEditorMock: vi.fn(),
  createStoryMock: vi.fn(),
  updateStoryMock: vi.fn(),
  deleteStoryMock: vi.fn(),
  publishStoryMock: vi.fn(),
  uploadImageMock: vi.fn(),
  fetchStoryByIdMock: vi.fn(),
  cropperCanvasOptions: [],
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
  setBeforeNavigate: setBeforeNavigateMock,
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: showToastMock,
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
    getCroppedCanvas(options) {
      cropperCanvasOptions.push(options);
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

function fillRequiredStoryFields(page) {
  page.querySelector('#sf-title').value = 'Attribution Story';
  page.querySelector('#sf-hist-year').value = '1901';
  page.querySelector('#sf-publish-date').value = '2026-04-29';
  page.querySelector('#sf-country').value = 'Korea';
  page.querySelector('#sf-body').value = 'Story body';
  page.querySelector('#sf-image').value = 'https://example.com/story.png';
  page.querySelector('#sf-image-source').value = 'Wikimedia Commons CC BY';
}

describe('Editor attribution workflow', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '#/editor/new';

    navigateMock.mockReset();
    setBeforeNavigateMock.mockReset();
    getStateMock.mockReset();
    showToastMock.mockReset();
    fetchAllStoriesEditorMock.mockReset();
    createStoryMock.mockReset();
    updateStoryMock.mockReset();
    deleteStoryMock.mockReset();
    publishStoryMock.mockReset();
    uploadImageMock.mockReset();
    fetchStoryByIdMock.mockReset();
    cropperCanvasOptions.length = 0;

    setEditorState();
    fetchAllStoriesEditorMock.mockResolvedValue([]);
    createStoryMock.mockResolvedValue({ id: 'created-story' });
    updateStoryMock.mockResolvedValue({ id: 'story-1' });
    fetchStoryByIdMock.mockResolvedValue(null);
  });

  it('Given the content manager list, when rendered, then it should provide back and new-story actions', async () => {
    const backSpy = vi.spyOn(history, 'back').mockImplementation(() => {});

    try {
      const page = renderEditor();
      document.body.appendChild(page);

      await flushEditor();

      const backButton = page.querySelector('#editor-back');
      const newButton = page.querySelector('#editor-new');

      expect(backButton).not.toBeNull();
      expect(newButton).not.toBeNull();

      backButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      newButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(backSpy).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith('/editor/new');
    } finally {
      backSpy.mockRestore();
    }
  });

  it('Given a new story form with reference lines, when saved as draft, then story_sources should be stored as structured data', async () => {
    const backSpy = vi.spyOn(history, 'back').mockImplementation(() => {});

    try {
      const page = renderEditorNew();
      document.body.appendChild(page);

      await flushEditor();

      fillRequiredStoryFields(page);
      page.querySelector('#sf-sources').value = [
        'Museum Essay | https://example.com/museum',
        'Printed Book',
      ].join('\n');

      page.querySelector('#sf-save-draft')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      await flushEditor();

      expect(createStoryMock).toHaveBeenCalledWith(expect.objectContaining({
        image_license: 'Wikimedia Commons CC BY',
        story_sources: [
          { title: 'Museum Essay', url: 'https://example.com/museum' },
          { title: 'Printed Book', url: '' },
        ],
        status: 'draft',
      }));
    } finally {
      backSpy.mockRestore();
    }
  });

  it('Given an existing story with references, when edit form loads, then story_sources should be restored into textarea lines', async () => {
    window.location.hash = '#/editor/new?edit=story-1';
    fetchStoryByIdMock.mockResolvedValue({
      id: 'story-1',
      title: 'Existing Story',
      figure_name: 'Existing Story',
      historical_year: 1901,
      publish_date: '2026-04-29',
      country: 'Korea',
      body: 'Existing body',
      image_url: 'https://example.com/story.png',
      image_license: 'Existing license',
      story_sources: [
        { title: 'Museum Essay', url: 'https://example.com/museum' },
        { title: 'Printed Book', url: '' },
      ],
    });

    const page = renderEditorNew();
    document.body.appendChild(page);

    await flushEditor();

    expect(page.querySelector('#sf-sources')?.value).toBe([
      'Museum Essay | https://example.com/museum',
      'Printed Book',
    ].join('\n'));
  });

  it('Given the content manager stories, when rendered, then they should appear in a calendar grid instead of a stacked list', async () => {
    fetchAllStoriesEditorMock.mockResolvedValue([
      { id: 's-pub', status: 'published', figure_name: 'Pub', title: 'Pub', publish_date: '2026-04-01', country: 'KR', image_url: 'https://example.com/pub.png' },
      { id: 's-dr', status: 'draft', figure_name: 'Draft', title: 'Draft', publish_date: '2026-04-15', country: 'KR' },
    ]);

    const page = renderEditor();
    document.body.appendChild(page);

    await flushEditor();

    expect(page.querySelector('.editor-calendar-grid')).not.toBeNull();
    expect(page.querySelector('.editor-calendar-cell[data-date="2026-04-01"] .editor-calendar-story-title')?.textContent).toContain('Pub');
    expect(page.querySelector('.editor-calendar-cell[data-date="2026-04-15"] .editor-calendar-story-title')?.textContent).toContain('Draft');
    expect(page.querySelector('.editor-calendar-header .calendar-title')?.textContent).toBe('콘텐츠 관리');
    expect(page.querySelector('.editor-item')).toBeNull();
  });

  it('Given the content manager calendar styles, then it should match the flat calendar page layout instead of the dashboard-card layout', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
    const editorPageRule = css.match(/\.editor-page\s*\{[\s\S]*?\}/)?.[0] || '';
    const statsRule = css.match(/\.editor-stats\s*\{[\s\S]*?\}/)?.[0] || '';
    const cellRule = css.match(/\.editor-calendar-cell\s*\{[\s\S]*?\}/)?.[0] || '';
    const actionsRule = css.match(/\.editor-calendar-actions\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(editorPageRule).toMatch(/padding:\s*var\(--space-3\) var\(--space-4\) var\(--space-6\)/);
    expect(statsRule).toMatch(/border-radius:\s*var\(--radius-full\)/);
    expect(statsRule).not.toMatch(/gap:\s*var\(--space-3\)/);
    expect(cellRule).toMatch(/aspect-ratio:\s*3\s*\/\s*4/);
    expect(cellRule).toMatch(/border-radius:\s*0/);
    expect(actionsRule).toMatch(/display:\s*none/);
  });

  it('Given the editor calendar, when the month arrows are clicked, then the visible month should change without leaving calendar mode', async () => {
    fetchAllStoriesEditorMock.mockResolvedValue([
      { id: 's-may', status: 'published', figure_name: 'May Story', title: 'May Story', publish_date: '2026-05-04', country: 'KR' },
      { id: 's-apr', status: 'published', figure_name: 'April Story', title: 'April Story', publish_date: '2026-04-30', country: 'KR' },
    ]);

    const page = renderEditor();
    document.body.appendChild(page);

    await flushEditor();

    expect(page.querySelector('#editor-month-label')?.textContent).toContain('2026');
    expect(page.querySelector('#editor-month-label')?.textContent).toContain('5');

    page.querySelector('#editor-prev-month')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushEditor();

    expect(page.querySelector('#editor-month-label')?.textContent).toContain('4');
    expect(page.querySelector('.editor-calendar-cell[data-date="2026-04-30"] .editor-calendar-story-title')?.textContent).toContain('April Story');
    expect(page.querySelector('.editor-calendar-grid')).not.toBeNull();
  });

  it('Given the editor calendar, when a date cell is clicked, then it should open the new story form for that date', async () => {
    fetchAllStoriesEditorMock.mockResolvedValue([
      { id: 's-apr', status: 'published', figure_name: 'April Story', title: 'April Story', publish_date: '2026-04-30', country: 'KR' },
    ]);

    const page = renderEditor();
    document.body.appendChild(page);

    await flushEditor();

    page.querySelector('.editor-calendar-cell[data-date="2026-04-20"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/editor/new?date=2026-04-20');
  });

  it('Given the editor new form is opened from a calendar date, then the publish date should be prefilled', async () => {
    window.location.hash = '#/editor/new?date=2026-04-20';

    const page = renderEditorNew();
    document.body.appendChild(page);

    await flushEditor();

    expect(page.querySelector('#sf-publish-date')?.value).toBe('2026-04-20');
  });

  it('Given the editor calendar, when stories with different statuses are rendered, then the badges should use class-based styling instead of inline color styles', async () => {
    fetchAllStoriesEditorMock.mockResolvedValue([
      { id: 's-pub', status: 'published', figure_name: 'Pub', publish_date: '2026-04-01', country: 'KR' },
      { id: 's-dr', status: 'draft', figure_name: 'Draft', publish_date: '2026-04-02', country: 'KR' },
      { id: 's-sc', status: 'scheduled', figure_name: 'Sched', publish_date: '2026-04-03', country: 'KR' },
      { id: 's-ar', status: 'archived', figure_name: 'Arch', publish_date: '2026-04-04', country: 'KR' },
    ]);

    const page = renderEditor();
    document.body.appendChild(page);

    await flushEditor();

    /* 모든 상태 필터를 켜서 4개 카드가 모두 보이도록 */
    page.querySelector('[data-filter="all"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushEditor();

    const badges = page.querySelectorAll('.editor-calendar-story .badge');
    expect(badges.length).toBeGreaterThanOrEqual(4);

    const classNames = Array.from(badges).map((b) => b.className);
    expect(classNames.some((c) => c.includes('badge-accent'))).toBe(true);
    expect(classNames.some((c) => c.includes('badge-draft'))).toBe(true);
    expect(classNames.some((c) => c.includes('badge-scheduled'))).toBe(true);
    expect(classNames.some((c) => c.includes('badge-archived'))).toBe(true);

    /* 회귀: 인라인 background 스타일이 더 이상 사용되지 않아야 한다 */
    badges.forEach((badge) => {
      expect(badge.getAttribute('style') || '').not.toMatch(/background\s*:/);
    });
  });

  it('Given an editor story image stored on Google Storage, when editing it, then the cropper should load it as an editable card-sized image', async () => {
    const originalFetch = globalThis.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['remote-image'], { type: 'image/jpeg' }),
    });
    URL.createObjectURL = vi.fn(() => 'blob:editable-editor-story');
    URL.revokeObjectURL = vi.fn();
    uploadImageMock.mockResolvedValue('https://firebasestorage.googleapis.com/edited.jpg');

    try {
      const page = renderEditorNew();
      document.body.appendChild(page);

      await flushEditor();

      const imageInput = page.querySelector('#sf-image');
      imageInput.value = 'https://storage.googleapis.com/daystory-bucket/editor/photo.jpg';
      imageInput.dispatchEvent(new Event('input', { bubbles: true }));

      page.querySelector('#sf-image-edit-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushEditor();
      document.querySelector('#cropper-image')?.dispatchEvent(new Event('load'));
      document.querySelector('#btn-crop-confirm')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushEditor();

      expect(globalThis.fetch).toHaveBeenCalledWith('https://storage.googleapis.com/daystory-bucket/editor/photo.jpg');
      expect(cropperCanvasOptions[0]).toMatchObject({ maxWidth: 1200, maxHeight: 1500 });
      expect(uploadImageMock).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});
