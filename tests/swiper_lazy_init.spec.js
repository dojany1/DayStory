/* =====================================================================
   swiper_lazy_init.spec.js
   =====================================================================
   editorstory / mystory 의 Swiper 가 hidden container 위에서 init 되어
   activeIndex 가 0(1월 1일) 에 stuck 되는 버그(Bug A) + iOS 카드 표시
   불가(Bug B) 의 회귀 방지 spec.

   핵심 invariant:
     - createCardSwiper 호출이 즉시(top-level) 가 아닌 lazy(ensureSwiper)
       함수 내부에서 일어난다.
     - mystory.js 가 getLocalToday() 를 사용 (직접 timezone offset 트릭 X).
     - cardSwiper.js 의 init guard 가 sw.activeIndex 기반으로 onSlideActive
       를 호출해 휠 동기화가 깨지지 않는다.

   주의: Swiper 의 실제 geometry / iOS WKWebView reflow 타이밍은 jsdom
        에서 검증 불가. 수동 검증 절차는 plan 문서 참고.
   ===================================================================== */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (p) => resolve(process.cwd(), p);
const editorSrc = () => readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
const mystorySrc = () => readFileSync(root('src/js/pages/mystory.js'), 'utf8');
const swiperSrc = () => readFileSync(root('src/js/utils/cardSwiper.js'), 'utf8');
const controllerSrc = () => readFileSync(root('src/js/components/cardDeck/cardDeckController.js'), 'utf8');

describe('Swiper lazy init — 공통 컨트롤러(cardDeckController.js)', () => {
  it('createCardSwiper 호출은 ensureSwiper 함수 내부에 있다', () => {
    const src = controllerSrc();
    expect(src).toMatch(/ensureSwiper\s*=\s*\(/);
    /* createCardSwiper( 가 ensureSwiper 정의 블록 이전(=top-level)에 나타나면 안 됨 */
    const ensureIdx = src.indexOf('ensureSwiper');
    const createIdx = src.indexOf('createCardSwiper(');
    expect(ensureIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(ensureIdx);
  });

  it('ensureSwiper 는 offsetParent === null 가드를 가진다', () => {
    expect(controllerSrc()).toMatch(/offsetParent\s*===\s*null/);
  });

  it('savedView calendar 진입 시 즉시 ensureSwiper() 를 호출하지 않는다', () => {
    /* 'if (currentView !== ' 패턴 — calendar 가 아닐 때만 즉시 init */
    expect(controllerSrc()).toMatch(/currentView\s*!==\s*['"]calendar['"]/);
  });

  it('초기 ensureSwiper 호출이 requestAnimationFrame 내부에 있다 (DOM 삽입 후 보장)', () => {
    expect(controllerSrc()).toMatch(/requestAnimationFrame\s*\(\s*tryInit\s*\)/);
  });

  it('ensureSwiper init 이 retry 패턴(MAX_ATTEMPTS)을 가진다 (iOS offsetParent null 흡수)', () => {
    const src = controllerSrc();
    expect(src).toMatch(/MAX_ATTEMPTS/);
    expect(src).toMatch(/\+\+attempts\s*<\s*MAX_ATTEMPTS/);
  });
});

/* mystory.js 의 wheel/Swiper/date-persistence 로직은 공통 컨트롤러
   (cardDeckController.js) 로 이전됨 → 위 "공통 컨트롤러" describe 가 커버.
   여기서는 mystory 가 컨트롤러에 넘기는 config 계약만 검증한다. */
describe('mystory.js — buildCardDeck config', () => {
  it('mystory 가 buildCardDeck 컨트롤러를 통해 렌더된다', () => {
    expect(mystorySrc()).toMatch(/buildCardDeck/);
  });

  it('mystory 가 lastDateKey="lastMyStoryDate" + getState 로 초기 날짜를 계산한다', () => {
    const src = mystorySrc();
    expect(src).toMatch(/lastDateKey:\s*['"]lastMyStoryDate['"]/);
    expect(src).toMatch(/getState\s*\(\s*['"]lastMyStoryDate['"]\s*\)/);
  });
});

describe('Date persistence — 공통 컨트롤러 + editorstory config', () => {
  it('컨트롤러가 setState 를 state.js 로부터 import 한다', () => {
    expect(controllerSrc()).toMatch(/import\s*\{[^}]*setState[^}]*\}\s*from\s*['"][^'"]*state\.js['"]/);
  });

  it('editorstory 가 lastDateKey="lastEditorStoryDate" + getState 로 초기 날짜를 계산한다', () => {
    const src = editorSrc();
    expect(src).toMatch(/lastDateKey:\s*['"]lastEditorStoryDate['"]/);
    expect(src).toMatch(/getState\s*\(\s*['"]lastEditorStoryDate['"]\s*\)/);
  });

  it('컨트롤러 onSlideActive 가 setState(config.lastDateKey) 로 날짜를 저장한다', () => {
    expect(controllerSrc()).toMatch(/setState\s*\(\s*config\.lastDateKey\s*,/);
  });

  it('컨트롤러 initialIdx 가 today(todayIso) fallback 체인을 가진다 (January 1 방어)', () => {
    const src = controllerSrc();
    expect(src).toMatch(/if\s*\(\s*initialIdx\s*<\s*0\s*\)\s*initialIdx\s*=\s*dateItems\.findIndex/);
    expect(src).toMatch(/todayIso/);
  });
});

describe('휠 즉시 표시 (초기 진입 smooth 우회) — 공통 컨트롤러', () => {
  it('컨트롤러: activateDayWheelByIndex 가 instant 인자를 받는다', () => {
    expect(controllerSrc()).toMatch(/function\s+activateDayWheelByIndex\s*\(\s*idx\s*,\s*instant\s*=\s*false\s*\)/);
  });

  it('컨트롤러: syncMonthWheel 가 instant 인자를 받는다', () => {
    expect(controllerSrc()).toMatch(/function\s+syncMonthWheel\s*\(\s*dayMonth\s*,\s*instant\s*=\s*false\s*\)/);
  });

  it('컨트롤러: instant 모드에서 scrollLeft 직접 할당 (smooth 우회)', () => {
    const src = controllerSrc();
    expect(src).toMatch(/if\s*\(\s*instant\s*\)\s*dayEl\.scrollLeft\s*=/);
    expect(src).toMatch(/if\s*\(\s*instant\s*\)\s*monthEl\.scrollLeft\s*=/);
  });

  it('컨트롤러: 초기 진입 휠 호출이 instant=true 를 전달한다', () => {
    expect(controllerSrc()).toMatch(/activateDayWheelByIndex\s*\(\s*initialIdx\s*,\s*true\s*\)/);
  });
});

describe('cardSwiper.js — init guard', () => {
  it('on.init 핸들러가 sw.activeIndex 를 callback 에 전달한다', () => {
    const src = swiperSrc();
    /* slideTo 후 onSlideActive 가 호출되어야 하고, 인자는 sw.activeIndex 기반 */
    expect(src).toMatch(/on:\s*\{[\s\S]*init\s*\(\s*sw\s*\)/);
    /* slideTo(initialSlide, 0, false) 가 여전히 존재 (방어선) */
    expect(src).toMatch(/sw\.slideTo\(\s*initialSlide\s*,\s*0\s*,\s*false\s*\)/);
    /* onSlideActive 호출 시 sw.activeIndex 가 인자로 전달됨 */
    expect(src).toMatch(/onSlideActive\?\.\(\s*(idx|sw\.activeIndex)\s*\)/);
  });
});

describe('Editor avatar — 로컬 PNG 고정 (iOS WKWebView WebP crash 회피)', () => {
  it('storage.js 가 isWebpUrl 유틸을 export 한다 (사용자 avatar 용)', async () => {
    const mod = await import('../src/js/utils/storage.js');
    expect(typeof mod.isWebpUrl).toBe('function');
    expect(mod.isWebpUrl('https://example.com/avatar.webp')).toBe(true);
    expect(mod.isWebpUrl('https://example.com/avatar.jpg')).toBe(false);
    expect(mod.isWebpUrl('https://firebasestorage.googleapis.com/v0/b/x/o/users%2Fu1%2Fdiary%2Fprofile_avatar_123.webp?alt=media&token=abc')).toBe(true);
    expect(mod.isWebpUrl('https://firebasestorage.googleapis.com/v0/b/x/o/users%2Fu1%2Fdiary%2Fprofile_avatar_123.jpg?alt=media&token=abc')).toBe(false);
    expect(mod.isWebpUrl('')).toBe(false);
    expect(mod.isWebpUrl(null)).toBe(false);
  });

  it('profile.js 는 WebP 대신 JPEG 로 avatar 업로드', () => {
    const src = readFileSync(root('src/js/pages/profile.js'), 'utf8');
    expect(src).not.toMatch(/profile_avatar_\$\{timestamp\}\.webp/);
    expect(src).toMatch(/profile_avatar_\$\{timestamp\}\.jpg/);
    expect(src).not.toMatch(/toBlob\([^)]*['"]image\/webp['"]/);
  });

  it('public/assets/editor_profile.png 가 존재한다', () => {
    /* 이 파일이 없으면 카드 뒷면 아바타가 깨진다. */
    const buf = readFileSync(root('public/assets/editor_profile.png'));
    expect(buf.length).toBeGreaterThan(0);
  });

  it('editorstory.js 가 editor avatar 로 /assets/editor_profile.png 만 사용한다', () => {
    const src = editorSrc();
    expect(src).toMatch(/\/assets\/editor_profile\.png/);
    /* story.editor.photoURL 을 img src 로 직접 사용하지 않음 (WebP crash 회피) */
    expect(src).not.toMatch(/src="\$\{escapeHtml\(story\.editor\.photoURL\)/);
  });

  it('calendar.js 가 editor avatar 로 /assets/editor_profile.png 만 사용한다', () => {
    const src = readFileSync(root('src/js/pages/calendar.js'), 'utf8');
    expect(src).toMatch(/\/assets\/editor_profile\.png/);
    expect(src).not.toMatch(/src="\$\{escapeHtml\(editorPhotoURL\)/);
  });

  it('detail.js 가 editor avatar 로 /assets/editor_profile.png 만 사용한다', () => {
    const src = readFileSync(root('src/js/pages/detail.js'), 'utf8');
    expect(src).toMatch(/\/assets\/editor_profile\.png/);
    expect(src).not.toMatch(/src="\$\{escapeHtml\(editorAvatar\)/);
  });

  it('editor.js 의 admin preview 도 /assets/editor_profile.png 사용', () => {
    const src = readFileSync(root('src/js/pages/editor.js'), 'utf8');
    expect(src).toMatch(/\/assets\/editor_profile\.png/);
  });

  it('profile.js 가 사용자 photoURL 표시 시 isWebpUrl 가드 사용', () => {
    const src = readFileSync(root('src/js/pages/profile.js'), 'utf8');
    expect(src).toMatch(/isWebpUrl/);
  });
});

describe('Existing invariants (regression guard)', () => {
  it('컨트롤러의 setOnUnmount 가 swiper.destroy 를 null-safe 하게 호출', () => {
    const src = controllerSrc();
    expect(src).toMatch(/setOnUnmount\(/);
    expect(src).toMatch(/swiper\s*&&\s*!swiper\.destroyed/);
  });

  it('컨트롤러가 getLocalToday 를 import (회귀 방지)', () => {
    expect(controllerSrc()).toMatch(/import\s*\{[^}]*getLocalToday[^}]*\}\s*from\s*['"][^'"]*utils\/date\.js['"]/);
  });
});
