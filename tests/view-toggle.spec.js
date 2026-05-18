import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (p) => resolve(process.cwd(), p);

describe('View toggle — editorstory', () => {
  it('has view-toggle-btn in renderEditorStory HTML', () => {
    const src = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    expect(src).toMatch(/view-toggle-btn/);
  });

  it('has page-calendar-view container in renderEditorStory HTML', () => {
    const src = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    expect(src).toMatch(/page-calendar-view/);
  });

  it('imports renderGrid from calendar.js', () => {
    const src = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    expect(src).toMatch(/renderGrid/);
    expect(src).toMatch(/calendar\.js/);
  });

  it('imports isAtCurrentMonth from calendar.js', () => {
    const src = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    expect(src).toMatch(/isAtCurrentMonth/);
  });
});

describe('View toggle — mystory', () => {
  it('has view-toggle-btn in renderMyStory HTML', () => {
    const src = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    expect(src).toMatch(/view-toggle-btn/);
  });

  it('has page-calendar-view container in renderMyStory HTML', () => {
    const src = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    expect(src).toMatch(/page-calendar-view/);
  });

  it('imports renderGrid from calendar.js', () => {
    const src = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    expect(src).toMatch(/renderGrid/);
    expect(src).toMatch(/calendar\.js/);
  });
});

describe('View toggle — calendar.js exports', () => {
  it('exports renderGrid', () => {
    const src = readFileSync(root('src/js/pages/calendar.js'), 'utf8');
    expect(src).toMatch(/export function renderGrid/);
  });

  it('exports isAtCurrentMonth', () => {
    const src = readFileSync(root('src/js/pages/calendar.js'), 'utf8');
    expect(src).toMatch(/export function isAtCurrentMonth/);
  });

  it('exports WEEKDAYS', () => {
    const src = readFileSync(root('src/js/pages/calendar.js'), 'utf8');
    expect(src).toMatch(/export const WEEKDAYS/);
  });
});

describe('View toggle — /calendar route removed', () => {
  it('main.js has no /calendar route registration', () => {
    const src = readFileSync(root('src/main.js'), 'utf8');
    expect(src).not.toMatch(/registerRoute\(['"]\/calendar['"]/);
  });

  it('index.html has no nav-calendar button', () => {
    const src = readFileSync(root('index.html'), 'utf8');
    expect(src).not.toMatch(/nav-calendar/);
  });
});

describe('View toggle — shared storage key sync', () => {
  it('editorstory uses shared key ds_default_view (not page-specific key)', () => {
    const src = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    expect(src).not.toMatch(/daystory_editorstory_view/);
    expect(src).not.toMatch(/daystory_story_view/);
    expect(src).toMatch(/ds_default_view/);
  });

  it('mystory uses shared key ds_default_view (not page-specific key)', () => {
    const src = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    expect(src).not.toMatch(/daystory_mystory_view/);
    expect(src).not.toMatch(/daystory_story_view/);
    expect(src).toMatch(/ds_default_view/);
  });

  it('both pages use the exact same key string', () => {
    const editor = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    const mystory = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    const SHARED_KEY = 'ds_default_view';
    expect(editor).toMatch(SHARED_KEY);
    expect(mystory).toMatch(SHARED_KEY);
  });
});

describe('View toggle — session view state', () => {
  it('editorstory toggle handler writes to ds_session_view, not ds_default_view', () => {
    const src = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    expect(src).toMatch(/sessionStorage\.setItem\(['"]ds_session_view['"]/);
    expect(src).not.toMatch(/localStorage\.setItem\(['"]ds_default_view['"]/);
  });

  it('mystory toggle handler writes to ds_session_view, not ds_default_view', () => {
    const src = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    expect(src).toMatch(/sessionStorage\.setItem\(['"]ds_session_view['"]/);
    expect(src).not.toMatch(/localStorage\.setItem\(['"]ds_default_view['"]/);
  });

  it('editorstory reads ds_session_view with fallback to ds_default_view', () => {
    const src = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    expect(src).toMatch(/sessionStorage\.getItem\(['"]ds_session_view['"]/);
    expect(src).toMatch(/ds_default_view/);
  });

  it('mystory reads ds_session_view with fallback to ds_default_view', () => {
    const src = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    expect(src).toMatch(/sessionStorage\.getItem\(['"]ds_session_view['"]/);
    expect(src).toMatch(/ds_default_view/);
  });

  it('router.js clears ds_session_view when leaving content pages', () => {
    const src = readFileSync(root('src/js/router.js'), 'utf8');
    expect(src).toMatch(/ds_session_view/);
    expect(src).toMatch(/editorstory/);
    expect(src).toMatch(/mystory/);
  });
});

describe('View toggle — settings default view option', () => {
  it('settingsSections.js uses ds_default_view key', () => {
    const src = readFileSync(root('src/js/components/settingsSections.js'), 'utf8');
    expect(src).toMatch(/ds_default_view/);
  });

  it('settingsSections.js renders view-option buttons', () => {
    const src = readFileSync(root('src/js/components/settingsSections.js'), 'utf8');
    expect(src).toMatch(/view-option/);
    expect(src).toMatch(/data-view/);
  });

  it('settingsSections.js binds view mode options', () => {
    const src = readFileSync(root('src/js/components/settingsSections.js'), 'utf8');
    expect(src).toMatch(/bindViewModeOptions/);
  });
});

describe('View toggle — CSS', () => {
  it('pages.css contains view-toggle-btn styles', () => {
    const src = readFileSync(root('src/css/pages.css'), 'utf8');
    expect(src).toMatch(/\.view-toggle-btn/);
  });

  it('pages.css contains page-calendar-view styles', () => {
    const src = readFileSync(root('src/css/pages.css'), 'utf8');
    expect(src).toMatch(/\.page-calendar-view/);
  });

  it('pages.css contains view transition animations', () => {
    const src = readFileSync(root('src/css/pages.css'), 'utf8');
    expect(src).toMatch(/viewEnter/);
    expect(src).toMatch(/viewExit/);
    expect(src).toMatch(/\.view-enter/);
    expect(src).toMatch(/\.view-exit/);
  });
});
