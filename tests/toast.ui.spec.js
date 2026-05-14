import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Toast positioning', () => {
  it('Given toast notifications, when styles are inspected, then they should appear above the bottom navigation bar', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/base.css'), 'utf8');
    const containerRule = css.match(/\.toast-container\s*\{[\s\S]*?\}/)?.[0] || '';
    const toastInRule = css.match(/@keyframes toastIn\s*\{[\s\S]*?to\s*\{[^}]*\}\s*\}/)?.[0] || '';
    const toastOutRule = css.match(/@keyframes toastOut\s*\{[\s\S]*?to\s*\{[^}]*\}\s*\}/)?.[0] || '';

    expect(containerRule).toMatch(/bottom:\s*calc\(var\(--nav-height\)\s*\+\s*var\(--safe-area-bottom\)\s*\+\s*var\(--space-3\)\)/);
    expect(containerRule).not.toMatch(/top:/);
    expect(containerRule).toMatch(/left:\s*50%/);
    expect(containerRule).toMatch(/transform:\s*translateX\(-50%\)/);
    expect(containerRule).toMatch(/align-items:\s*center/);
    expect(toastInRule).toMatch(/from\s*\{[^}]*translateY\(var\(--space-4\)\)/);
    expect(toastOutRule).toMatch(/to\s*\{[^}]*translateY\(var\(--space-4\)\)/);
  });
});
