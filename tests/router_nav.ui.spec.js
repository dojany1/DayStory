import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initRouter, registerRoute } from '../src/js/router.js';

function bindDaySelection(prefix) {
  const clickedDates = [];
  document.querySelectorAll(`#${prefix}-calendar .wheel-item`).forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll(`#${prefix}-calendar .wheel-item`).forEach((el) => {
        el.classList.remove('active');
      });
      item.classList.add('active');
      clickedDates.push(item.dataset.date);
    });
  });
  return clickedDates;
}

describe('Bottom navigation date reset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 24, 12));

    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }

    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }

    document.body.innerHTML = `
      <main id="page-container"></main>
      <nav id="bottom-nav">
        <button class="nav-item active" data-route="/editorstory" id="nav-editorstory"></button>
        <button class="nav-item" data-route="/mystory" id="nav-mystory"></button>
      </nav>
      <section>
        <div id="editorstory-month-scroll">
          <div class="wheel-item" data-month="1">1</div>
          <div class="wheel-item active" data-month="4">4</div>
        </div>
        <div id="editorstory-calendar">
          <div class="wheel-item" data-date="2026-01-24" data-month="1" data-day="24">24</div>
          <div class="wheel-item" data-date="2026-04-24" data-month="4" data-day="24">24</div>
        </div>
        <div id="mystory-month-scroll">
          <div class="wheel-item" data-month="1">1</div>
          <div class="wheel-item active" data-month="4">4</div>
        </div>
        <div id="mystory-calendar">
          <div class="wheel-item" data-date="2026-01-24" data-month="1" data-day="24">24</div>
          <div class="wheel-item" data-date="2026-04-24" data-month="4" data-day="24">24</div>
        </div>
      </section>
    `;

    registerRoute('/editorstory', () => document.createElement('section'));
    registerRoute('/mystory', () => document.createElement('section'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
    vi.useRealTimers();
  });

  it('Given editor and my story wheels contain repeated day numbers, when the current bottom tab is pressed again, then the exact local today date should be selected', async () => {
    const editorClickedDates = bindDaySelection('editorstory');
    const myStoryClickedDates = bindDaySelection('mystory');

    window.location.hash = '#/editorstory';
    initRouter();
    await Promise.resolve();

    document.getElementById('nav-editorstory').click();

    window.location.hash = '#/mystory';
    await Promise.resolve();

    document.getElementById('nav-mystory').click();

    expect(editorClickedDates).toEqual(['2026-04-24']);
    expect(myStoryClickedDates).toEqual(['2026-04-24']);
    expect(document.querySelector('#editorstory-calendar .wheel-item.active')?.dataset.date).toBe('2026-04-24');
    expect(document.querySelector('#mystory-calendar .wheel-item.active')?.dataset.date).toBe('2026-04-24');
  });
});
