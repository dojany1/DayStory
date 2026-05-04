import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { renderTutorialTourForRouteMock } = vi.hoisted(() => ({
  renderTutorialTourForRouteMock: vi.fn(),
}));

vi.mock('../src/js/components/tutorialTour.js', () => ({
  renderTutorialTourForRoute: renderTutorialTourForRouteMock,
}));

const router = await import('../src/js/router.js');

function readRepoFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

async function flushRoute() {
  await Promise.resolve();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
  await Promise.resolve();
}

describe('Page header and route focus consistency', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
    renderTutorialTourForRouteMock.mockReset();
  });

  it('Given page title headers, when page modules are inspected, then they should use shared alignment classes instead of inline positioning', () => {
    const pageFiles = [
      'src/js/pages/bookmarks.js',
      'src/js/pages/search.js',
      'src/js/pages/profile.js',
      'src/js/pages/settings.js',
      'src/js/pages/report.js',
      'src/js/pages/license.js',
      'src/js/pages/mystory.js',
      'src/js/pages/editor.js',
      'src/js/pages/donate.js',
    ];

    pageFiles.forEach((file) => {
      const source = readRepoFile(file);

      expect(source, file).not.toMatch(/<div class="page-header" style=/);
      expect(source, file).not.toMatch(/<h1 class="page-header-title" style=/);
      expect(source, file).not.toMatch(/<button class="page-header-back"[^>]*style=/);
    });
  });

  it('Given shared page header styles, when CSS is inspected, then title-only and back-button headers should center titles consistently', () => {
    const css = readRepoFile('src/css/components.css');
    const centeredRule = css.match(/\.page-header-centered\s*\{[\s\S]*?\}/)?.[0] || '';
    const backRule = css.match(/\.page-header-with-back\s*\{[\s\S]*?\}/)?.[0] || '';
    const titleRule = css.match(/\.page-header-centered \.page-header-title,\s*\.page-header-with-back \.page-header-title\s*\{[\s\S]*?\}/)?.[0] || '';
    const spacerRule = css.match(/\.page-header-spacer\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(centeredRule).toMatch(/justify-content:\s*center/);
    expect(centeredRule).toMatch(/text-align:\s*center/);
    expect(backRule).toMatch(/grid-template-columns:\s*36px minmax\(0,\s*1fr\) 36px/);
    expect(titleRule).toMatch(/grid-column:\s*2/);
    expect(titleRule).toMatch(/text-align:\s*center/);
    expect(spacerRule).toMatch(/width:\s*36px/);
    expect(spacerRule).toMatch(/height:\s*36px/);
  });

  it('Given a bottom navigation button has focus, when navigation completes, then focus should stay on the exact active tab button instead of the page container', async () => {
    document.body.innerHTML = `
      <main id="page-container" class="page-container"></main>
      <nav id="bottom-nav">
        <button class="nav-item" data-route="/header-focus-start">Start</button>
        <button class="nav-item" data-route="/header-focus-target">Target</button>
      </nav>
    `;
    window.location.hash = '#/header-focus-start';

    router.registerRoute('/header-focus-start', () => {
      const page = document.createElement('div');
      page.className = 'page';
      page.innerHTML = '<div class="page-header page-header-centered"><h1 class="page-header-title">시작</h1></div>';
      return page;
    });
    router.registerRoute('/header-focus-target', () => {
      const page = document.createElement('div');
      page.className = 'page';
      page.innerHTML = '<div class="page-header page-header-centered"><h1 class="page-header-title">대상</h1></div>';
      return page;
    });

    router.initRouter();
    await flushRoute();

    const targetButton = document.querySelector('.nav-item[data-route="/header-focus-target"]');
    targetButton.focus();
    targetButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushRoute();

    const container = document.getElementById('page-container');

    expect(container?.getAttribute('tabindex')).toBeNull();
    expect(document.activeElement).toBe(targetButton);
    expect(targetButton.classList.contains('active')).toBe(true);
  });
});
