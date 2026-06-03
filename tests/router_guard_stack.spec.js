/* =====================================================================
   router_guard_stack.spec.js — beforeNavigate 가드 스택 (audit 4-1)
   =====================================================================
   회귀 방지: 페이지(에디터 등)가 pushBeforeNavigate 로 가드를 추가했다가
   제거해도, setBeforeNavigate 로 등록된 베이스 가드(main.js 인증/네비)가
   사라지지 않아야 한다. 이전 구현은 setBeforeNavigate(null) 로 베이스 가드를
   통째로 지워, 에디터 방문 후 앱 전역 가드가 비활성화되는 버그가 있었다.
   ===================================================================== */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initRouter,
  registerRoute,
  setBeforeNavigate,
  pushBeforeNavigate,
} from '../src/js/router.js';

let removers = [];
function track(remove) {
  removers.push(remove);
  return remove;
}

function navTo(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('router beforeNavigate 가드 스택 (audit 4-1)', () => {
  beforeEach(() => {
    document.body.innerHTML = `<main id="page-container"></main><nav id="bottom-nav"></nav>`;
    registerRoute('/a', () => document.createElement('section'));
    registerRoute('/b', () => document.createElement('section'));
    registerRoute('/c', () => document.createElement('section'));
    window.location.hash = '#/a';
    initRouter();
  });

  afterEach(() => {
    removers.forEach((r) => r());
    removers = [];
    setBeforeNavigate(null);
    document.body.innerHTML = '';
    window.location.hash = '';
  });

  it('베이스 가드와 push 된 페이지 가드가 모두 실행된다', async () => {
    const base = vi.fn(() => true);
    const page = vi.fn(() => true);
    setBeforeNavigate(base);
    track(pushBeforeNavigate(page));

    await navTo('#/b');

    expect(base).toHaveBeenCalled();
    expect(page).toHaveBeenCalled();
  });

  it('★ 페이지 가드를 제거해도 베이스 가드는 그대로 살아있다 (4-1 회귀)', async () => {
    const base = vi.fn(() => true);
    const page = vi.fn(() => true);
    setBeforeNavigate(base);
    const remove = pushBeforeNavigate(page);

    await navTo('#/b');
    expect(page).toHaveBeenCalled();

    remove(); // 에디터 언마운트 시뮬레이션 (setOnUnmount → removeNavGuard)
    base.mockClear();
    page.mockClear();

    await navTo('#/c');
    expect(base).toHaveBeenCalled(); // ★ 베이스 가드 여전히 동작
    expect(page).not.toHaveBeenCalled(); // 제거된 페이지 가드는 호출 안 됨
  });

  it('push 된 가드가 false 를 반환하면 이동이 차단된다 (베이스 부수효과 미실행)', async () => {
    const base = vi.fn(() => true);
    setBeforeNavigate(base);
    track(pushBeforeNavigate(() => false));

    await navTo('#/b');

    /* 스택 가드가 먼저 false → 베이스 가드는 실행되지 않아야 한다 */
    expect(base).not.toHaveBeenCalled();
  });
});
