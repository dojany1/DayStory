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

  it('makes the launcher activity use the app icon explicitly', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const launcherActivity = manifest.match(/<activity[\s\S]*?android:name="\.MainActivity"[\s\S]*?>/)?.[0] ?? '';

    expect(launcherActivity).toContain('android:icon="@mipmap/ic_launcher"');
    expect(launcherActivity).toContain('android:roundIcon="@mipmap/ic_launcher_round"');
  });

  it('keeps the widget visible in Android launchers with a label and preview fallback', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const widgetInfo = read('android/app/src/main/res/xml/daystory_widget_info.xml');
    const provider = read('android/app/src/main/java/com/daystory/app/widget/DayStoryWidgetProvider.java');

    expect(manifest).toMatch(/android:name="com\.daystory\.app\.widget\.DayStoryWidgetProvider"/);
    expect(manifest).toMatch(/android:enabled="true"/);
    expect(manifest).toMatch(/android:label="@string\/widget_label"/);
    expect(widgetInfo).toMatch(/android:label="@string\/widget_label"/);
    expect(widgetInfo).toMatch(/android:previewImage="@drawable\/widget_preview"/);
    expect(widgetInfo).toMatch(/android:previewLayout="@layout\/widget_daystory"/);
    expect(widgetInfo).not.toContain('android:configure=""');
    expect(read('android/app/src/main/res/layout/widget_daystory.xml')).not.toMatch(/<View\b/);
    expect(read('android/app/src/main/res/layout/widget_daystory.xml')).not.toMatch(/android:layout_margin(?:Top|End)="-/);
    expect(provider).toMatch(/public void onEnabled\(Context context\)/);
    expect(provider).toMatch(/updateAll\(context\)/);
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
    expect(editorStory).not.toMatch(/markLetterUnread/);
    expect(myStory).toMatch(/syncDiaryStateFromList/);
  });
});
