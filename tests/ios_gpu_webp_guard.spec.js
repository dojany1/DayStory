/* =====================================================================
   ios_gpu_webp_guard.spec.js
   =====================================================================
   iOS WKWebView 의 GPU 프로세스 crash + WebP 디코더 실패 + 네트워크
   timeout 연쇄 실패 회귀 방지.

   핵심 invariant (소스 grep — GPU 레이어 수/실제 디코더 동작은 jsdom 으로
   검증 불가, 수동 검증 절차는 plan 문서 참고):

   1. CSS: .card-swiper .swiper-slide 기본 rule 에 will-change/backface 없음.
      → -active/-next/-prev 서브셀렉터에만 부여되어 GPU 레이어를 ±1 슬라이드로 한정.
   2. CSS: .flipper 기본 rule 에 will-change 없음 (preserve-3d 는 유지).
   3. editorstory.js / mystory.js 는 FALLBACK_IMG + IMG_ONERROR 상수 사용,
      isWebpUrl() 가드 + onerror 핸들러 적용.
   4. editorstory.js 의 Promise.all([...]) 안에 getBookmarkedStoryIds 가 없음.
   5. withTimeout default 가 12000 이상.
   ===================================================================== */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (p) => resolve(process.cwd(), p);
const pagesCss = () => readFileSync(root('src/css/pages.css'), 'utf8');
const componentsCss = () => readFileSync(root('src/css/components.css'), 'utf8');
const editorSrc = () => readFileSync(root('src/js/pages/editorstory.js'), 'utf8');
const mystorySrc = () => readFileSync(root('src/js/pages/mystory.js'), 'utf8');
const cardFaceSrc = () => readFileSync(root('src/js/components/cardDeck/cardFace.js'), 'utf8');
const controllerSrc = () => readFileSync(root('src/js/components/cardDeck/cardDeckController.js'), 'utf8');
const timeoutSrc = () => readFileSync(root('src/js/utils/timeout.js'), 'utf8');

/* 특정 selector 의 첫 번째 rule block (중괄호 안 내용) 만 추출 */
function extractRuleBlock(css, selectorRegex) {
  const match = css.match(new RegExp(selectorRegex.source + '\\s*\\{([\\s\\S]*?)\\}', 'm'));
  return match ? match[1] : '';
}

describe('Step 1 — GPU 레이어 scope 한정 (iOS WKWebView GPU crash 회피)', () => {
  it('pages.css 의 .card-swiper .swiper-slide 기본 rule 에 will-change/backface 가 없다', () => {
    const css = pagesCss();
    /* 기본 rule (정확히 .card-swiper .swiper-slide { ... }) */
    const baseBlock = extractRuleBlock(css, /\.card-swiper \.swiper-slide(?!-)/);
    expect(baseBlock).not.toMatch(/will-change\s*:/);
    expect(baseBlock).not.toMatch(/backface-visibility\s*:/);
  });

  it('pages.css 가 swiper-slide-active/-next/-prev 셀렉터에만 will-change 부여', () => {
    const css = pagesCss();
    /* active/next/prev 중 적어도 active 셀렉터가 존재 + will-change 부여 */
    expect(css).toMatch(/\.swiper-slide-active[\s\S]{0,300}will-change\s*:\s*transform/);
    /* backface-visibility 도 visible 슬라이드에만 */
    expect(css).toMatch(/\.swiper-slide-active[\s\S]{0,400}backface-visibility\s*:\s*hidden/);
  });

  it('components.css 의 .flipper 기본 rule 에 will-change 가 없다 (preserve-3d 는 유지)', () => {
    const css = componentsCss();
    const flipperBlock = extractRuleBlock(css, /^\.flipper(?!\.)/m);
    expect(flipperBlock.length).toBeGreaterThan(0);
    expect(flipperBlock).not.toMatch(/will-change\s*:/);
    /* preserve-3d 는 flip 동작에 필수이므로 유지 */
    expect(flipperBlock).toMatch(/transform-style\s*:\s*preserve-3d/);
  });

  it('pages.css 가 .swiper-slide-active .flipper 등에 will-change 부여', () => {
    const css = pagesCss();
    /* active flipper 자식 셀렉터 — 정확한 매칭 */
    expect(css).toMatch(/\.swiper-slide-active\s+\.flipper[\s\S]{0,300}will-change\s*:\s*transform/);
  });
});

describe('Step 2 — 이미지 fallback + WebP 차단', () => {
  it('cardFace 가 FALLBACK_IMG 와 IMG_ONERROR 상수를 정의한다 (공통)', () => {
    const src = cardFaceSrc();
    expect(src).toMatch(/const\s+FALLBACK_IMG\s*=\s*['"]\/assets\/editor_profile\.png['"]/);
    expect(src).toMatch(/const\s+IMG_ONERROR\s*=/);
    expect(src).toMatch(/this\.onerror\s*=\s*null/);
  });

  it('editorstory.js: imageSrc 는 story.image_url 을 우선 사용 (차단 롤백)', () => {
    const src = editorSrc();
    /* 단순 fallback 패턴만 유지: imageSrc = story.image_url || FALLBACK_IMG */
    expect(src).toMatch(/imageSrc\s*=\s*story\.image_url\s*\|\|\s*FALLBACK_IMG/);
  });

  it('editorstory.js: isWebpUrl 차단을 더 이상 사용하지 않음 (롤백 검증)', () => {
    const src = editorSrc();
    expect(src).not.toMatch(/isWebpUrl\s*\(/);
    /* import 도 제거되어 있어야 함 (storage.js 자체는 다른 곳에서 import) */
    expect(src).not.toMatch(/import\s*\{[^}]*isWebpUrl[^}]*\}\s*from/);
  });

  it('cardFace 의 카드 메인 <img> 에 onerror + loading="lazy" 부여 (공통)', () => {
    const src = cardFaceSrc();
    expect(src).toMatch(/<img[^>]*loading="lazy"[^>]*onerror=|<img[^>]*onerror=[^>]*loading="lazy"/);
  });

  it('mystory.js: 카드 이미지는 story.image_url 을 cardImageWrap 에 전달 (fallback/onerror 는 cardFace 가 처리)', () => {
    const src = mystorySrc();
    expect(src).toMatch(/cardImageWrap\(\{\s*src:\s*story\.image_url/);
  });

  it('mystory.js: isWebpUrl 차단을 더 이상 사용하지 않음 (롤백 검증)', () => {
    const src = mystorySrc();
    expect(src).not.toMatch(/isWebpUrl\s*\(/);
    expect(src).not.toMatch(/import\s*\{[^}]*isWebpUrl[^}]*\}\s*from/);
  });

  it('utils/storage.js: isWebpUrl 유틸 자체는 유지 (profile.js 에서 사용)', () => {
    const src = readFileSync(root('src/js/utils/storage.js'), 'utf8');
    expect(src).toMatch(/export\s+function\s+isWebpUrl/);
    const profileSrc = readFileSync(root('src/js/pages/profile.js'), 'utf8');
    expect(profileSrc).toMatch(/isWebpUrl/);
  });
});

describe('Step 3 — 네트워크 timeout + Promise.all 디커플', () => {
  it('withTimeout default 가 12000ms 이상', () => {
    const src = timeoutSrc();
    /* ms = 12000 또는 더 큰 숫자 */
    const m = src.match(/withTimeout\s*\([^)]*ms\s*=\s*(\d+)/);
    expect(m).not.toBeNull();
    const def = parseInt(m[1], 10);
    expect(def).toBeGreaterThanOrEqual(12000);
  });

  it('editorstory.js 의 Promise.all 안에 getBookmarkedStoryIds 가 없다', () => {
    const src = editorSrc();
    /* Promise.all([ ... ]) 블록 내부에 getBookmarkedStoryIds 가 등장하면 안 됨 */
    const allBlocks = src.match(/Promise\.all\(\s*\[[\s\S]*?\]\s*\)/g) || [];
    for (const block of allBlocks) {
      expect(block).not.toMatch(/getBookmarkedStoryIds/);
    }
  });

  it('editorstory.js 가 getBookmarkedStoryIds 를 별도 호출 + catch 로 가드', () => {
    const src = editorSrc();
    /* getBookmarkedStoryIds() 호출이 .catch 와 연결되어 있어야 함 */
    expect(src).toMatch(/getBookmarkedStoryIds\s*\([^)]*\)[\s\S]{0,200}\.catch/);
  });

  it('services/stories.js 의 fetchTodayStory timeout 이 8000 이상', () => {
    const src = readFileSync(root('src/js/services/stories.js'), 'utf8');
    /* fetchTodayStory 안의 withTimeout(getDocs(q), <ms>) 의 ms 가 ≥ 8000 */
    const fetchTodayBlock = src.match(/export\s+async\s+function\s+fetchTodayStory[\s\S]{0,800}/);
    expect(fetchTodayBlock).not.toBeNull();
    const m = fetchTodayBlock[0].match(/withTimeout\([^,]+,\s*(\d+)/);
    if (m) {
      expect(parseInt(m[1], 10)).toBeGreaterThanOrEqual(8000);
    }
  });

  it('services/mystories.js 의 fetchMyStories timeout 이 12000 이상', () => {
    const src = readFileSync(root('src/js/services/mystories.js'), 'utf8');
    const m = src.match(/withTimeout\([^,]+,\s*(\d+)/);
    if (m) {
      expect(parseInt(m[1], 10)).toBeGreaterThanOrEqual(12000);
    }
  });
});

describe('Step 4 — Swiper Virtual 도입 (iOS GPU crash 근본 fix)', () => {
  const cardSwiperSrc = () => readFileSync(root('src/js/utils/cardSwiper.js'), 'utf8');

  it('cardSwiper.js 가 Swiper Virtual 모듈을 import 한다', () => {
    const src = cardSwiperSrc();
    expect(src).toMatch(/import\s*\{[^}]*Virtual[^}]*\}\s*from\s*['"]swiper\/modules['"]/);
    expect(src).toMatch(/import\s+['"]swiper\/css\/virtual['"]/);
  });

  it('cardSwiper.js 의 virtual 옵션이 addSlidesBefore/After + cache:false 를 가진다', () => {
    const src = cardSwiperSrc();
    /* virtual 블록 안에 핵심 옵션이 존재 */
    expect(src).toMatch(/virtual\s*:\s*\{[\s\S]*?addSlidesBefore\s*:\s*\d+/);
    expect(src).toMatch(/virtual\s*:\s*\{[\s\S]*?addSlidesAfter\s*:\s*\d+/);
    expect(src).toMatch(/virtual\s*:\s*\{[\s\S]*?cache\s*:\s*false/);
  });

  it('cardSwiper.js 가 modules: [Virtual] 을 Swiper 옵션에 전달', () => {
    const src = cardSwiperSrc();
    expect(src).toMatch(/modules\s*:\s*\[\s*Virtual\s*\]/);
  });

  it('cardSwiper.js 시그니처가 slides + renderSlide 를 받는다 (slideCount 폐기)', () => {
    const src = cardSwiperSrc();
    expect(src).toMatch(/renderSlide/);
    /* slides 파라미터 destructure */
    expect(src).toMatch(/createCardSwiper[\s\S]{0,200}slides[,\s}]/);
  });

  it('컨트롤러가 createCardSwiper 에 slides + renderSlide 전달, editorstory 가 buildSlideHTML 제공', () => {
    expect(controllerSrc()).toMatch(/createCardSwiper\([\s\S]*?slides[\s\S]*?renderSlide\s*:/);
    expect(editorSrc()).toMatch(/renderSlideHTML\s*:\s*\([^)]*\)\s*=>\s*buildSlideHTML/);
  });

  it('editorstory.js 에서 wrapperEl.innerHTML 사전 빌드 패턴이 제거됨 (Virtual 이 렌더)', () => {
    const src = editorSrc();
    /* 더 이상 wrapperEl.innerHTML = slides.map(...).join 형태가 없어야 함 */
    expect(src).not.toMatch(/wrapperEl\.innerHTML\s*=\s*slides[\s\S]{0,200}\.join/);
  });

  it('mystory 가 renderSlideHTML 로 buildMyStorySlideHTML 을 제공 (createCardSwiper 는 컨트롤러가 호출)', () => {
    expect(controllerSrc()).toMatch(/createCardSwiper\([\s\S]*?slides[\s\S]*?renderSlide\s*:/);
    expect(mystorySrc()).toMatch(/renderSlideHTML\s*:\s*\([^)]*\)\s*=>\s*buildMyStorySlideHTML/);
  });

  it('mystory.js 에서 wrapperEl.innerHTML 사전 빌드 패턴이 제거됨', () => {
    const src = mystorySrc();
    expect(src).not.toMatch(/wrapperEl\.innerHTML\s*=\s*slides[\s\S]{0,200}\.join/);
  });
});

describe('Step 5 — .flipper 의 transform transition 을 is-flipping 으로 분리', () => {
  it('components.css 의 .flipper 기본 rule 에 transition: transform 가 없다', () => {
    const css = componentsCss();
    const flipperBlock = extractRuleBlock(css, /^\.flipper(?!\.)/m);
    expect(flipperBlock.length).toBeGreaterThan(0);
    /* transition: transform 패턴이 base rule 안에 있으면 안 됨 (Swiper 와 충돌) */
    expect(flipperBlock).not.toMatch(/transition\s*:\s*transform/);
  });

  it('components.css 의 .flipper.is-flipping 에 transition: transform 이 있다 (flip 시에만 활성)', () => {
    const css = componentsCss();
    const isFlippingBlock = extractRuleBlock(css, /^\.flipper\.is-flipping/m);
    expect(isFlippingBlock.length).toBeGreaterThan(0);
    expect(isFlippingBlock).toMatch(/transition\s*:\s*transform/);
  });
});

describe('회귀 방지 (이전 fix 유지)', () => {
  it('editor avatar 는 여전히 /assets/editor_profile.png 로 고정', () => {
    expect(editorSrc()).toMatch(/\/assets\/editor_profile\.png/);
  });

  it('컨트롤러의 lazy ensureSwiper 패턴이 유지된다', () => {
    expect(controllerSrc()).toMatch(/ensureSwiper\s*=\s*\(/);
    expect(controllerSrc()).toMatch(/offsetParent\s*===\s*null/);
  });

  it('컨트롤러가 getLocalToday 를 사용 (timezone 트릭 미사용)', () => {
    const src = controllerSrc();
    expect(src).toMatch(/localTodayStr\s*=\s*getLocalToday\s*\(\s*\)/);
    expect(src).not.toMatch(/getTimezoneOffset\s*\(\s*\)\s*\*\s*60000/);
  });
});
