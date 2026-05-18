import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigateMock, getStateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getStateMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
  setState: vi.fn(),
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../src/js/components/confirmDialog.js', () => ({
  showConfirm: vi.fn(),
}));

vi.mock('../src/js/components/notificationSettingsSheet.js', () => ({
  bindNotificationSettingsSection: vi.fn(),
  renderNotificationSettingsSection: () => '<div class="settings-section"><div class="settings-section-title">알림</div></div>',
}));

vi.mock('../src/js/firebase.js', () => ({
  auth: null,
  db: null,
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));

const { renderSettingsSections, bindSettingsSections } = await import('../src/js/components/settingsSections.js');
const { TUTORIAL_TOUR_STEPS, renderTutorialTourForRoute } = await import('../src/js/components/tutorialTour.js');

function readRepoFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Tutorial replay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    navigateMock.mockReset();
    getStateMock.mockImplementation((key) => {
      if (key === 'user') return { id: 'guest' };
      if (key === 'profile') return null;
      if (key === 'theme') return 'light';
      return null;
    });
  });

  it('Given app information settings, when rendered, then tutorial replay should start the focused page tour', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSettingsSections();
    document.body.appendChild(wrapper);
    bindSettingsSections(wrapper);

    const row = wrapper.querySelector('#setting-tutorial');
    expect(row).not.toBeNull();
    expect(row?.querySelector('.list-item-title')?.textContent).toBe('튜토리얼 다시 보기');

    row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(sessionStorage.getItem('daystory:tutorial-tour-active')).toBe('true');
    expect(sessionStorage.getItem('daystory:tutorial-tour-step')).toBe('0');
    expect(navigateMock).toHaveBeenCalledWith('/editorstory');
  });

  it('Given tutorial replay is app-level, when inspected, then it should not register a separate tutorial route or folder', () => {
    const main = readRepoFile('src/main.js');
    const settings = readRepoFile('src/js/components/settingsSections.js');

    expect(main).not.toContain("registerRoute('/tutorial'");
    expect(main).not.toContain("js/tutorial");
    expect(settings).toContain('startTutorialTour');
    expect(settings).not.toMatch(/contextualTip|tutorial_done|daystory:tip-seen:/);
  });

  it('Given the tour explains the app, when step definitions are inspected, then page and widget guidance should be included', () => {
    const routes = TUTORIAL_TOUR_STEPS.map((step) => step.route);
    const selectors = TUTORIAL_TOUR_STEPS.map((step) => step.selector);
    const copy = TUTORIAL_TOUR_STEPS.map((step) => `${step.title} ${step.body}`).join('\n');

    expect(routes).toEqual(expect.arrayContaining([
      '/editorstory',
      '/calendar',
      '/mystory',
      '/bookmarks',
      '/profile',
    ]));
    expect(selectors).toEqual(expect.arrayContaining([
      '#editorstory-card-area .flip-container',
      '#editorstory-calendar .wheel-item.active',
      '.calendar-toggle-btn.active',
      '#collection-search-input',
      '#setting-widget-theme',
    ]));
    expect(copy).toContain('위젯');
  });

  it('Given the focused tour is active, when the route renders, then it should focus the current page target and advance by next click', () => {
    const card = document.createElement('div');
    card.className = 'flip-container';
    card.scrollIntoView = vi.fn();
    card.getBoundingClientRect = () => ({
      left: 20,
      top: 80,
      width: 240,
      height: 320,
      right: 260,
      bottom: 400,
    });
    const activeDateButton = document.createElement('button');
    activeDateButton.className = 'wheel-item active';
    activeDateButton.scrollIntoView = vi.fn();
    activeDateButton.getBoundingClientRect = () => ({
      left: 16,
      top: 24,
      width: 40,
      height: 32,
      right: 56,
      bottom: 56,
    });
    const datePicker = document.createElement('div');
    datePicker.id = 'editorstory-calendar';
    datePicker.className = 'modern-wheel-scroll';
    datePicker.appendChild(activeDateButton);
    const cardArea = document.createElement('div');
    cardArea.id = 'editorstory-card-area';
    cardArea.appendChild(card);
    document.body.append(datePicker, cardArea);

    sessionStorage.setItem('daystory:tutorial-tour-active', 'true');
    sessionStorage.setItem('daystory:tutorial-tour-step', '0');

    renderTutorialTourForRoute('/editorstory', navigateMock);

    expect(document.querySelector('.tutorial-tour-layer')).not.toBeNull();
    expect(card.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));
    expect(document.querySelector('.tutorial-tour-title')?.textContent).toBe('오늘의 카드');
    expect(document.querySelector('.tutorial-tour-progress')?.textContent).toBe(`1 / ${TUTORIAL_TOUR_STEPS.length}`);
    expect(document.querySelector('.tutorial-tour-spotlight')?.dataset.targetSelector).toBe('#editorstory-card-area .flip-container');
    expect(document.querySelector('.tutorial-blocker')).toBeNull();
    expect(document.body.classList.contains('tutorial-active')).toBe(false);
    expect(readRepoFile('src/css/pages.css')).toMatch(/\.tutorial-tour-layer\s*\{[\s\S]*?pointer-events:\s*auto/);

    document.querySelector('.tutorial-tour-next')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('.tutorial-tour-progress')?.textContent).toBe(`2 / ${TUTORIAL_TOUR_STEPS.length}`);
    expect(document.querySelector('.tutorial-tour-spotlight')?.dataset.targetSelector).toBe('#editorstory-calendar .wheel-item.active');
    expect(activeDateButton.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));

    document.querySelector('.tutorial-tour-next')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigateMock).toHaveBeenCalledWith('/calendar');
    expect(sessionStorage.getItem('daystory:tutorial-tour-step')).toBe('2');
  });

  it('Given the next button is tapped repeatedly, when the tour advances, then only one step should be consumed per rendered button', () => {
    const card = document.createElement('div');
    card.className = 'flip-container';
    card.getBoundingClientRect = () => ({
      left: 20,
      top: 80,
      width: 240,
      height: 320,
      right: 260,
      bottom: 400,
    });
    const activeDateButton = document.createElement('button');
    activeDateButton.className = 'wheel-item active';
    activeDateButton.getBoundingClientRect = () => ({
      left: 16,
      top: 24,
      width: 40,
      height: 32,
      right: 56,
      bottom: 56,
    });
    const datePicker = document.createElement('div');
    datePicker.id = 'editorstory-calendar';
    datePicker.appendChild(activeDateButton);
    const cardArea = document.createElement('div');
    cardArea.id = 'editorstory-card-area';
    cardArea.appendChild(card);
    document.body.append(datePicker, cardArea);

    sessionStorage.setItem('daystory:tutorial-tour-active', 'true');
    sessionStorage.setItem('daystory:tutorial-tour-step', '0');

    renderTutorialTourForRoute('/editorstory', navigateMock);
    const firstNext = document.querySelector('.tutorial-tour-next');

    firstNext?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    firstNext?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(sessionStorage.getItem('daystory:tutorial-tour-step')).toBe('1');
    expect(navigateMock).not.toHaveBeenCalled();

    const secondNext = document.querySelector('.tutorial-tour-next');
    secondNext?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    secondNext?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(sessionStorage.getItem('daystory:tutorial-tour-step')).toBe('2');
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/calendar');
  });
});
