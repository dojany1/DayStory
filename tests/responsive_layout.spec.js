/* =====================================================================
   responsive_layout.spec.js — 기기 크기별 레이아웃 붕괴 방지 회귀 테스트
   =====================================================================
   배경: iPhone Pro Max(430·440pt) 에서는 앱 폭이 420px 로 잘려 좌우에
   데스크톱 배경 띠가 노출되고, iPhone SE/mini(667·812pt) 에서는
   `.flipper { min-height: 500px }` 가 `max-height: 100%` 를 무력화해
   카드 하단이 잘려 나갔다. 두 증상 모두 "화면 크기 적응 로직 부재" 라는
   같은 뿌리에서 나온다.

   검증 방식: jsdom 은 레이아웃을 계산하지 않으므로 css_tokens.spec.js 와
   동일하게 CSS 파일 텍스트를 직접 매칭한다.
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSrc(rel) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

/* CSS 주석을 제거해 규칙 경계를 명확히 한다 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/* 셀렉터가 정확히 일치하는 규칙 본문만 뽑는다.
   `.flipper` 를 찾을 때 `.flipper.is-flipping` 이 잡히지 않도록
   규칙 시작(`}` 또는 파일 첫머리) 을 앵커로 쓴다. */
function ruleBody(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = stripComments(css).match(new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
}

describe('원인 1 — 앱 폭 상한이 실기기가 아닌 데스크톱 전용이어야 한다', () => {
  const variables = readSrc('src/css/variables.css');

  it('Given a real phone, when :root is inspected, then --mobile-max-width does not cap the width', () => {
    const root = ruleBody(variables, ':root');
    expect(root).not.toBeNull();
    expect(root).toMatch(/--mobile-max-width\s*:\s*100%/);
  });

  it('Given a desktop viewport, when the min-width media query is inspected, then the card-style cap returns', () => {
    const mq = stripComments(variables)
      .match(/@media\s*\(\s*min-width\s*:\s*600px\s*\)\s*\{([\s\S]*?)\n\}/);
    expect(mq).not.toBeNull();
    expect(mq[1]).toMatch(/--mobile-max-width\s*:\s*\d+px/);
  });

  it('Given the 420px cap, when :root is inspected, then it no longer hardcodes a pixel width', () => {
    const root = ruleBody(variables, ':root');
    expect(root).not.toMatch(/--mobile-max-width\s*:\s*\d+px/);
  });
});

describe('카드 메트릭 폴백 토큰 — 메트릭 주입이 없는 컨텍스트 보호', () => {
  const variables = readSrc('src/css/variables.css');
  const root = ruleBody(variables, ':root');

  /* .history-card-front 는 카드덱 외에 editor.js 관리자 프리뷰와
     캡처 클론에서도 렌더된다. 폴백이 없으면 calc() 가 무효가 된다. */
  it('Given a context without injected metrics, when :root is inspected, then --card-scale falls back to 1', () => {
    expect(root).toMatch(/--card-scale\s*:\s*1\b/);
  });

  it('Given a context without injected metrics, when :root is inspected, then --card-w and --card-h have fallbacks', () => {
    expect(root).toMatch(/--card-w\s*:/);
    expect(root).toMatch(/--card-h\s*:/);
  });
});

describe('원인 2 — .flipper 의 하드 최소 높이가 카드를 잘라내지 않아야 한다', () => {
  const components = readSrc('src/css/components.css');
  const flipper = ruleBody(components, '.flipper');

  it('Given a short viewport, when .flipper is inspected, then min-height no longer overrides max-height', () => {
    expect(flipper).not.toBeNull();
    expect(flipper).not.toMatch(/min-height\s*:\s*\d{3,}px/);
  });

  it('Given a narrow viewport, when .flipper is inspected, then min-width no longer forces 280px', () => {
    expect(flipper).not.toMatch(/min-width\s*:\s*280px/);
  });

  it('Given a narrow viewport, when .flip-container is inspected, then min-width no longer forces 280px', () => {
    const container = ruleBody(components, '.flip-container');
    expect(container).not.toBeNull();
    expect(container).not.toMatch(/min-width\s*:\s*280px/);
  });
});

describe('원인 4 — 카드 비율이 단일 토큰으로 통일되어야 한다', () => {
  const components = readSrc('src/css/components.css');

  it('Given the shared ratio token, when .flipper is inspected, then it no longer declares its own 3/5 ratio', () => {
    const flipper = ruleBody(components, '.flipper');
    expect(flipper).not.toMatch(/aspect-ratio\s*:\s*3\s*\/\s*5/);
  });

  it('Given the shared ratio token, when .history-card-mini is inspected, then it uses --card-aspect-ratio', () => {
    const mini = ruleBody(components, '.history-card-mini');
    expect(mini).not.toBeNull();
    expect(mini).toMatch(/aspect-ratio\s*:\s*var\(--card-aspect-ratio\)/);
  });

  it('Given every card surface, when the stylesheets are inspected, then no hardcoded card ratio remains', () => {
    const css = stripComments(components) + stripComments(readSrc('src/css/pages.css'));
    expect(css).not.toMatch(/aspect-ratio\s*:\s*3\s*\/\s*5\b/);
    expect(css).not.toMatch(/aspect-ratio\s*:\s*3\s*\/\s*4\.8\b/);
  });
});

describe('원인 3 — 카드 박스가 주입된 메트릭으로 크기를 잡아야 한다', () => {
  const pages = readSrc('src/css/pages.css');

  it('Given injected metrics, when .card-swiper is inspected, then it sizes from --card-w/--card-h', () => {
    const swiper = ruleBody(pages, '.card-swiper');
    expect(swiper).not.toBeNull();
    expect(swiper).toMatch(/width\s*:\s*var\(--card-w/);
    expect(swiper).toMatch(/height\s*:\s*var\(--card-h/);
  });

  it('Given the loading skeleton, when it is inspected, then it uses the same metrics as the real card', () => {
    const skeleton = ruleBody(pages, '.editorstory-card-area > .skeleton-card');
    expect(skeleton).not.toBeNull();
    expect(skeleton).toMatch(/width\s*:\s*var\(--card-w/);
    expect(skeleton).toMatch(/height\s*:\s*var\(--card-h/);
  });
});

describe('원인 5 — 카드 내부 타이포가 카드 크기에 비례해야 한다', () => {
  const components = readSrc('src/css/components.css');

  for (const sel of ['.card-date', '.card-year', '.card-image-title']) {
    it(`Given a scaled card, when ${sel} is inspected, then its font-size follows --card-scale`, () => {
      const body = ruleBody(components, sel);
      expect(body).not.toBeNull();
      expect(body).toMatch(/font-size\s*:\s*clamp\([^;]*var\(--card-scale/);
    });
  }
});

describe('원인 6 — 캘린더 카드 팝업이 작은 화면에서 넘치지 않아야 한다', () => {
  const pages = readSrc('src/css/pages.css');

  it('Given a 667pt screen, when the popup card stage is inspected, then its height is bounded', () => {
    const stage = ruleBody(pages, '.calendar-card-popup-stage .flip-container');
    expect(stage).not.toBeNull();
    expect(stage).toMatch(/height\s*:\s*var\(--card-h/);
    expect(stage).toMatch(/max-height\s*:\s*100%/);
  });
});

describe('토큰 드리프트 방어 — CSS 비율과 JS 기본 비율이 같아야 한다', () => {
  it('Given --card-aspect-ratio, when cardMetrics defaults are inspected, then both describe the same ratio', () => {
    const variables = readSrc('src/css/variables.css');
    const metrics = readSrc('src/js/utils/cardMetrics.js');

    const cssRatio = variables.match(/--card-aspect-ratio\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/);
    expect(cssRatio).not.toBeNull();

    const jsW = metrics.match(/DEFAULT_CARD_RATIO_W\s*=\s*([\d.]+)/);
    const jsH = metrics.match(/DEFAULT_CARD_RATIO_H\s*=\s*([\d.]+)/);
    expect(jsW).not.toBeNull();
    expect(jsH).not.toBeNull();

    expect(Number(jsW[1])).toBe(Number(cssRatio[1]));
    expect(Number(jsH[1])).toBe(Number(cssRatio[2]));
  });
});
