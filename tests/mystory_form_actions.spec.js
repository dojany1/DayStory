import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPagesCss() {
  return readFileSync(resolve(process.cwd(), 'src/css/pages.css'), 'utf8');
}

function readRule(selector) {
  const css = readPagesCss();
  return css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[\\s\\S]*?\\}`))?.[0] || '';
}

describe('mystory form fixed actions layout', () => {
  it('Given the my story write form mounts, when the fixed action bar is styled, then its viewport anchors should be deterministic from the first frame', () => {
    const rule = readRule('.mystory-form-actions');

    expect(rule).toContain('/* 1. Positioning */');
    expect(rule).toContain('/* 2. Display & Box Model */');
    expect(rule).toContain('/* 3. Typography */');
    expect(rule).toContain('/* 4. Visuals */');
    expect(rule).toContain('/* 5. Misc */');
    expect(rule.indexOf('/* 1. Positioning */')).toBeLessThan(rule.indexOf('/* 2. Display & Box Model */'));
    expect(rule.indexOf('/* 2. Display & Box Model */')).toBeLessThan(rule.indexOf('/* 3. Typography */'));
    expect(rule.indexOf('/* 3. Typography */')).toBeLessThan(rule.indexOf('/* 4. Visuals */'));
    expect(rule.indexOf('/* 4. Visuals */')).toBeLessThan(rule.indexOf('/* 5. Misc */'));

    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toMatch(/bottom:\s*0/);
    expect(rule).toMatch(/left:\s*0/);
    expect(rule).toMatch(/right:\s*0/);
    expect(rule).toMatch(/width:\s*min\(100%,\s*var\(--mobile-max-width\)\)/);
    expect(rule).toMatch(/margin:\s*0\s+auto/);
    expect(rule).not.toMatch(/left:\s*50%/);
    expect(rule).not.toMatch(/transform:\s*translateX/);
  });
});
