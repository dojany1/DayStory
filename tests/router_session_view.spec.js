import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initRouter, registerRoute } from '../src/js/router.js';

function navTo(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('router content view session state', () => {
  beforeEach(async () => {
    document.body.innerHTML = `<main id="page-container"></main><nav id="bottom-nav"></nav>`;
    sessionStorage.clear();
    registerRoute('/editorstory', () => document.createElement('section'));
    registerRoute('/mystory', () => document.createElement('section'));
    registerRoute('/detail/:id', () => document.createElement('section'));
    registerRoute('/settings', () => document.createElement('section'));
    window.location.hash = '#/editorstory';
    initRouter();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterEach(async () => {
    sessionStorage.clear();
    window.location.hash = '';
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.body.innerHTML = '';
  });

  it('Given calendar mode is active, when a detail bottom sheet route opens, then the calendar view session should be preserved for close/back', async () => {
    sessionStorage.setItem('ds_session_view', 'calendar');

    await navTo('#/detail/story-1');

    expect(sessionStorage.getItem('ds_session_view')).toBe('calendar');
  });

  it('Given calendar mode is active, when leaving content pages for a normal route, then the temporary view session should be cleared', async () => {
    sessionStorage.setItem('ds_session_view', 'calendar');

    await navTo('#/settings');

    expect(sessionStorage.getItem('ds_session_view')).toBeNull();
  });
});
