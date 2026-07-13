// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

/* =====================================================================
   router.setBackInterceptor — 안드로이드 하드웨어 뒤로가기 위임 계약
   ---------------------------------------------------------------------
   버그: /mystory/new(나의 일화 작성)에서 하드웨어 뒤로가기 시, 전역
   backButton 핸들러(main.js)와 페이지 로컬 backButton 리스너가 동시에
   발화해 두 네비게이션이 충돌 → 한 번에 뒤로가기가 안 먹었다.
   수정: 페이지가 setBackInterceptor(fn) 으로 자체 처리를 등록하면 전역
   핸들러가 기본 depth 네비게이션 대신 그 함수에 위임한다.
   ===================================================================== */

const { setBackInterceptor, getBackInterceptor } = await import('../src/js/router.js');

describe('router.setBackInterceptor / getBackInterceptor', () => {
  it('둘 다 함수로 export 된다', () => {
    expect(typeof setBackInterceptor).toBe('function');
    expect(typeof getBackInterceptor).toBe('function');
  });

  it('등록한 인터셉터를 getBackInterceptor 로 가져오고, null 로 해제된다', () => {
    const fn = vi.fn();
    setBackInterceptor(fn);
    expect(getBackInterceptor()).toBe(fn);
    setBackInterceptor(null);
    expect(getBackInterceptor()).toBe(null);
  });

  it('함수가 아닌 값을 넣으면 null 로 취급한다', () => {
    setBackInterceptor(fn => fn);
    setBackInterceptor('nope');
    expect(getBackInterceptor()).toBe(null);
  });

  it('전역 backButton 로직: 인터셉터가 있으면 위임하고 기본 네비게이션은 건너뛴다', () => {
    /* main.js 전역 핸들러의 위임 로직을 그대로 재현 */
    const interceptorFn = vi.fn();
    const defaultNav = vi.fn();
    const onHardwareBack = () => {
      const interceptor = getBackInterceptor();
      if (interceptor) { interceptor(); return; }
      defaultNav();
    };

    setBackInterceptor(interceptorFn);
    onHardwareBack();
    expect(interceptorFn).toHaveBeenCalledTimes(1);
    expect(defaultNav).not.toHaveBeenCalled();

    /* 인터셉터 해제(페이지 이탈) 후엔 기본 네비게이션이 동작 */
    setBackInterceptor(null);
    onHardwareBack();
    expect(defaultNav).toHaveBeenCalledTimes(1);
    expect(interceptorFn).toHaveBeenCalledTimes(1);
  });
});
