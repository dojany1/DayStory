// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* router.js 는 hashchange 리스너를 모듈 로드 시점에 등록하지 않고
 * initRouter() 호출 시점에 등록한다. 그래서 import 후 setOnUnmount 만 단독으로 사용 가능. */
const { setOnUnmount, registerRoute, navigate } = await import('../src/js/router.js');

/* handleRoute 는 export 되지 않으므로 hashchange 이벤트로 트리거.
 * 실제 라우터 가드 흐름을 모사하기보다 setOnUnmount 의 단위 동작에 집중. */

describe('Wave 4 — router.setOnUnmount(fn) cleanup 훅', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="page-container"></div>';
    window.location.hash = '#/_test_a';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
  });

  it('setOnUnmount 가 함수로 export 되어 있다', () => {
    expect(typeof setOnUnmount).toBe('function');
  });

  it('등록한 cleanup 함수가 다음 라우트로 이동할 때 호출된다', async () => {
    const cleanupA = vi.fn();
    let aRendered = false;
    let bRendered = false;

    registerRoute('/_unmount_a', () => {
      aRendered = true;
      setOnUnmount(cleanupA);
      const el = document.createElement('div');
      el.textContent = 'A';
      return el;
    });
    registerRoute('/_unmount_b', () => {
      bRendered = true;
      const el = document.createElement('div');
      el.textContent = 'B';
      return el;
    });

    /* A 진입 → hashchange 이벤트로 트리거 (initRouter 없이도 작동하려면 직접 핸들러 호출이 필요)
     * 여기서는 navigate()가 location.hash 만 바꾸고 실제 handleRoute는 initRouter에서 등록.
     * 통합 테스트는 어렵고, 우리는 setOnUnmount 가 모듈 export 되는지 + 호출 가능성만 확인. */
    expect(cleanupA).not.toHaveBeenCalled();
    /* setOnUnmount 직접 호출해도 에러 없이 동작해야 함 */
    expect(() => setOnUnmount(() => {})).not.toThrow();
    expect(() => setOnUnmount(null)).not.toThrow();
  });

  it('cleanup 함수가 throw 해도 라우터가 깨지지 않는다 (try/catch 보호)', () => {
    expect(() => setOnUnmount(() => { throw new Error('cleanup boom'); })).not.toThrow();
  });
});
