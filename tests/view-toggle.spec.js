import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (p) => resolve(process.cwd(), p);

describe('View toggle — 공통 컨트롤러(cardDeckController.js)', () => {
  const controller = () => readFileSync(root('src/js/components/cardDeck/cardDeckController.js'), 'utf8');

  it('has view-toggle-btn in card deck shell HTML', () => {
    expect(controller()).toMatch(/view-toggle-btn/);
  });

  it('has page-calendar-view container in card deck shell HTML', () => {
    expect(controller()).toMatch(/page-calendar-view/);
  });

  it('imports renderGrid from calendar.js', () => {
    const src = controller();
    expect(src).toMatch(/renderGrid/);
    expect(src).toMatch(/calendar\.js/);
  });

  it('imports isAtCurrentMonth from calendar.js', () => {
    expect(controller()).toMatch(/isAtCurrentMonth/);
  });
});

/* mystory 의 view-toggle UI/로직은 공통 컨트롤러(cardDeckController.js) 로
   이전됨 → 위 "공통 컨트롤러" describe 가 커버. mystory 는 buildCardDeck 경유. */
describe('View toggle — mystory (config)', () => {
  it('mystory 가 buildCardDeck 컨트롤러를 통해 렌더된다', () => {
    const src = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    expect(src).toMatch(/buildCardDeck/);
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

  it('exports getWeekdays', () => {
    const src = readFileSync(root('src/js/pages/calendar.js'), 'utf8');
    expect(src).toMatch(/export function getWeekdays/);
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
  it('editorstory uses shared key ds_default_view via controller (not page-specific key)', () => {
    const src = readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
    expect(src).not.toMatch(/daystory_editorstory_view/);
    expect(src).not.toMatch(/daystory_story_view/);
    /* 뷰 상태 키는 공통 컨트롤러가 관리 (editorstory 는 buildCardDeck 경유) */
    const controller = readFileSync(root('src/js/components/cardDeck/cardDeckController.js'), 'utf8');
    expect(controller).toMatch(/ds_default_view/);
  });

  it('mystory uses shared key ds_default_view via controller (not page-specific key)', () => {
    const src = readFileSync(root('src/js/pages/mystory.js'), 'utf8');
    expect(src).not.toMatch(/daystory_mystory_view/);
    expect(src).not.toMatch(/daystory_story_view/);
    /* 뷰 상태 키는 공통 컨트롤러가 관리 (mystory 는 buildCardDeck 경유) */
    const controller = readFileSync(root('src/js/components/cardDeck/cardDeckController.js'), 'utf8');
    expect(controller).toMatch(/ds_default_view/);
  });

  it('both pages share the same view key via the card deck controller (single source)', () => {
    /* 두 페이지가 동일한 buildCardDeck 컨트롤러를 사용 → 뷰 키가 단일 소스로 일치 보장 */
    const controller = readFileSync(root('src/js/components/cardDeck/cardDeckController.js'), 'utf8');
    expect(controller).toMatch('ds_default_view');
  });
});

describe('View toggle — session view state', () => {
  it('card deck toggle handler writes to ds_session_view, not ds_default_view', () => {
    const src = readFileSync(root('src/js/components/cardDeck/cardDeckController.js'), 'utf8');
    expect(src).toMatch(/sessionStorage\.setItem\(['"]ds_session_view['"]/);
    expect(src).not.toMatch(/localStorage\.setItem\(['"]ds_default_view['"]/);
  });

  it('card deck reads ds_session_view with fallback to ds_default_view', () => {
    const src = readFileSync(root('src/js/components/cardDeck/cardDeckController.js'), 'utf8');
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
    expect(src).toMatch(/bindViewModeItem/);
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
