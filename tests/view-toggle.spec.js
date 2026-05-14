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
