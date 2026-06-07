/* css_tokens.spec.js — variables.css 토큰 존재성 + 접근성 글로벌 블록 검증
   ============================================================
   파일 텍스트 매칭만 사용 (jsdom의 getComputedStyle 은 :root 변수 해석을 보장하지 않음). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readCss(rel) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('Wave 3 — variables.css 토큰 누락 보강', () => {
  const variables = readCss('src/css/variables.css');

  it('--font-sans 시스템 폰트 fallback 토큰이 정의된다', () => {
    expect(variables).toMatch(/--font-sans\s*:/);
  });

  it('--text-md 토큰이 정의된다 (text-base와 text-lg 사이 크기)', () => {
    expect(variables).toMatch(/--text-md\s*:/);
  });

  it('--color-text-on-image 토큰이 정의된다', () => {
    expect(variables).toMatch(/--color-text-on-image\s*:/);
  });

  it('--color-editor-comment 배경 토큰이 정의된다', () => {
    expect(variables).toMatch(/--color-editor-comment\s*:/);
  });

  it('--color-text-on-editor-comment 토큰이 정의된다 (라이트/다크 대비)', () => {
    expect(variables).toMatch(/--color-text-on-editor-comment\s*:/);
  });

  it('--z-overlay 토큰이 z-modal/z-toast/z-splash 와 함께 정의된다', () => {
    expect(variables).toMatch(/--z-overlay\s*:/);
  });

  it('data-font-size="small" 프리셋이 --text-xs와 --text-2xl 까지 재정의한다', () => {
    const smallBlock = variables.match(/\[data-font-size="small"\]\s*\{([^}]*)\}/);
    expect(smallBlock).not.toBeNull();
    expect(smallBlock[1]).toMatch(/--text-xs\s*:/);
    expect(smallBlock[1]).toMatch(/--text-2xl\s*:/);
  });

  it('data-font-size="large" 프리셋도 --text-xs와 --text-2xl 까지 재정의한다', () => {
    const largeBlock = variables.match(/\[data-font-size="large"\]\s*\{([^}]*)\}/);
    expect(largeBlock).not.toBeNull();
    expect(largeBlock[1]).toMatch(/--text-xs\s*:/);
    expect(largeBlock[1]).toMatch(/--text-2xl\s*:/);
  });
});

describe('Language font tokens — LINE Seed multilingual stack', () => {
  const variables = readCss('src/css/variables.css');
  const base = readCss('src/css/base.css');
  const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const sharing = readCss('src/js/services/sharing.js');

  it('Given LINE Seed multilingual fonts, when index.html is inspected, then EN and JP webfont faces are loaded', () => {
    expect(indexHtml).toMatch(/font-family:\s*'LINESeedEN'/);
    expect(indexHtml).toMatch(/LINESeedSans_W_Rg\.woff2/);
    expect(indexHtml).toMatch(/font-family:\s*'LINESeedJP'/);
    expect(indexHtml).toMatch(/LINESeedJP_OTF_Rg\.woff2/);
  });

  it('Given the Korean locale, when :root:lang(ko) tokens are inspected, then LINE Seed KR is the first UI font', () => {
    const block = variables.match(/:root:lang\(ko\)\s*\{([^}]*)\}/);
    expect(block).not.toBeNull();
    expect(block[1]).toMatch(/--font-ui\s*:\s*'LINESeedKR'/);
    expect(block[1]).toMatch(/--font-body\s*:\s*var\(--font-ui\)/);
  });

  it('Given Latin locales, when :root:lang(en|es) tokens are inspected, then LINE Seed EN is the first UI font', () => {
    const block = variables.match(/:root:lang\(en\),\s*:root:lang\(es\)\s*\{([^}]*)\}/);
    expect(block).not.toBeNull();
    expect(block[1]).toMatch(/--font-ui\s*:\s*'LINESeedEN'/);
    expect(block[1]).toMatch(/--font-sans\s*:\s*var\(--font-ui\)/);
  });

  it('Given the Japanese locale, when :root:lang(ja) tokens are inspected, then LINE Seed JP is the first UI font', () => {
    const block = variables.match(/:root:lang\(ja\)\s*\{([^}]*)\}/);
    expect(block).not.toBeNull();
    expect(block[1]).toMatch(/--font-ui\s*:\s*'LINESeedJP'/);
  });

  it('Given the Chinese locale, when :root:lang(zh) tokens are inspected, then system CJK fonts remain first to avoid tofu', () => {
    const block = variables.match(/:root:lang\(zh\)\s*\{([^}]*)\}/);
    expect(block).not.toBeNull();
    expect(block[1]).toMatch(/--font-ui\s*:\s*-apple-system,\s*'PingFang SC'/);
  });

  it('Given language-specific font tokens, when base :lang rules are inspected, then they do not hardcode competing font stacks', () => {
    expect(base).not.toMatch(/:lang\(en\),\s*\n:lang\(es\)\s*\{\s*font-family:\s*'Inter'/);
    expect(base).not.toMatch(/:lang\(ja\)\s*\{\s*font-family:\s*'Hiragino Sans'/);
    expect(base).not.toMatch(/:lang\(zh\)\s*\{\s*font-family:\s*-apple-system/);
  });

  it('Given share capture watermark UI, when styles are inspected, then hardcoded system sans is replaced with the UI token', () => {
    expect(sharing).not.toMatch(/font-family:-apple-system,sans-serif/);
    expect(sharing).toMatch(/font-family:var\(--font-ui\)/);
  });
});

describe('Wave 3 — base.css 접근성 글로벌 블록', () => {
  const base = readCss('src/css/base.css');

  it('@media (prefers-reduced-motion: reduce) 블록이 존재한다', () => {
    expect(base).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
  });

  it('reduced-motion 블록에서 animation/transition 을 거의 무력화한다 (0\\.01ms 또는 none)', () => {
    const reducedBlock = base.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{([\s\S]*?)\n\}/);
    expect(reducedBlock).not.toBeNull();
    expect(reducedBlock[1]).toMatch(/(animation[^:]*:\s*(none|0)|animation-duration\s*:\s*(0\.01ms|0s|0))/i);
    expect(reducedBlock[1]).toMatch(/(transition[^:]*:\s*(none|0)|transition-duration\s*:\s*(0\.01ms|0s|0))/i);
  });

  it('Given iOS touch interactions, when base styles are inspected, then interactive elements disable double-tap delay and tap highlight', () => {
    const interactiveTouchRule = base.match(/button,\s*\na,[\s\S]*?\{\s*[\s\S]*?touch-action\s*:\s*manipulation[\s\S]*?-webkit-tap-highlight-color\s*:\s*transparent/);

    expect(interactiveTouchRule).not.toBeNull();
    expect(interactiveTouchRule[0]).toMatch(/\.card/);
    expect(interactiveTouchRule[0]).toMatch(/\.mystory-form-actions button/);
  });
});

describe('Wave 3 — pages.css 하드코딩 색상 정리 + 터치 영역', () => {
  const pages = readCss('src/css/pages.css');
  const components = readCss('src/css/components.css');

  it('.theme-option.active 가 더 이상 #1c1c1e 를 하드코딩하지 않는다', () => {
    const block = pages.match(/\.theme-option\.active\s*\{([^}]*)\}/);
    expect(block).not.toBeNull();
    /* 하드코딩 hex 가 사라지고 var(...) 토큰을 사용해야 한다 */
    expect(block[1]).not.toMatch(/#1c1c1e/i);
    expect(block[1]).toMatch(/var\(--/);
  });

  it('.detail-editor-note-label 의 텍스트 색이 더 이상 #3f3200 을 하드코딩하지 않는다', () => {
    const block = pages.match(/\.detail-editor-note-label\s*\{([^}]*)\}/);
    expect(block).not.toBeNull();
    expect(block[1]).not.toMatch(/#3f3200/i);
    expect(block[1]).toMatch(/var\(--color-text-on-editor-comment/);
  });

  it('.page-header-back 터치 영역이 44px 이상이거나 ::before 확장이 정의된다', () => {
    const directBlock = components.match(/\.page-header-back\s*\{([^}]*)\}/);
    expect(directBlock).not.toBeNull();
    /* 직접 44px 이상 OR ::before 확장 OR padding 확장 — 셋 중 하나 */
    const direct = directBlock[1];
    const hasDirect44 = /width\s*:\s*4[4-9]px|width\s*:\s*5\d+px/.test(direct);
    const hasBefore = /\.page-header-back::before|\.page-header-back:before/.test(components);
    const hasPadding = /padding\s*:\s*[1-9]/.test(direct);
    expect(hasDirect44 || hasBefore || hasPadding).toBe(true);
  });

  it('crop-modal-overlay z-index 가 토큰 var(--z-...) 를 사용한다', () => {
    const block = components.match(/\.crop-modal-overlay\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/z-index\s*:\s*var\(--z-/);
  });

  it('confirm-dialog-overlay z-index 가 토큰을 사용한다', () => {
    const block = components.match(/\.confirm-dialog-overlay\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/z-index\s*:\s*var\(--z-/);
  });

  it('profile-edit-overlay z-index 가 토큰을 사용한다', () => {
    const block = pages.match(/\.profile-edit-overlay\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/z-index\s*:\s*var\(--z-/);
  });
});
