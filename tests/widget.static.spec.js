import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Android widget integration contracts', () => {
  it('registers the local DayStory widget Capacitor plugin on Android startup', () => {
    const mainActivity = read('android/app/src/main/java/com/daystory/app/MainActivity.java');

    expect(mainActivity).toMatch(/import\s+com\.daystory\.app\.widget\.DayStoryWidgetPlugin;/);
    expect(mainActivity).toMatch(/registerPlugin\(DayStoryWidgetPlugin\.class\)/);
  });

  it('routes widget deep links from cold and warm app launches', () => {
    const main = read('src/main.js');

    expect(main).toMatch(/App\.getLaunchUrl\(\)/);
    expect(main).toMatch(/App\.addListener\('appUrlOpen'/);
    expect(main).toMatch(/daystory:\/\/letter/);
    expect(main).toMatch(/daystory:\/\/diary\/new/);
    expect(main).toMatch(/navigate\('\/editorstory'\)/);
    expect(main).toMatch(/navigate\(`\/mystory\/new\?date=\$\{today\}`\)/);
  });

  it('keeps the widget state synchronized from the editor and my-story pages', () => {
    const editorStory = read('src/js/pages/editorstory.js');
    const myStory = read('src/js/pages/mystory.js');

    expect(editorStory).toMatch(/markLetterRead/);
    expect(editorStory).toMatch(/markLetterUnread/);
    expect(myStory).toMatch(/syncDiaryStateFromList/);
  });
});
