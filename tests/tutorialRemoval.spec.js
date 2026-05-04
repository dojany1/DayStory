import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Tutorial removal and rebuild workspace', () => {
  it('Given the laggy tutorial is removed, when runtime files are inspected, then no page should import or render tutorial guidance', () => {
    const runtimeFiles = [
      'src/main.js',
      'src/js/pages/editorstory.js',
      'src/js/pages/calendar.js',
      'src/js/pages/mystory.js',
      'src/js/pages/profile.js',
      'src/js/components/settingsSections.js',
      'src/css/pages.css',
      'src/css/variables.css',
    ];

    for (const path of runtimeFiles) {
      const content = readRepoFile(path);
      expect(content).not.toMatch(/contextualTip|showContextualTip|contextual-tip/);
      expect(content).not.toMatch(/tutorial_done/);
      expect(content).not.toMatch(/tutorial-active|tutorial-panel|tutorial-blocker/);
    }
  });

  it('Given tutorial is rebuilt without a separate folder, when app wiring is inspected, then the tour should live in shared components', () => {
    const main = readRepoFile('src/main.js');
    const router = readRepoFile('src/js/router.js');
    const editorStory = readRepoFile('src/js/pages/editorstory.js');
    const settingsSections = readRepoFile('src/js/components/settingsSections.js');

    expect(existsSync(resolve(process.cwd(), 'src/js/tutorial'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/js/components/tutorialTour.js'))).toBe(true);
    expect(main).not.toContain("import('./js/tutorial/tutorialPage.js')");
    expect(router).toContain('renderTutorialTourForRoute');
    expect(editorStory).not.toContain('/tutorial/');
    expect(settingsSections).toContain('startTutorialTour');
  });
});
