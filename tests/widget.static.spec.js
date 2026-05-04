import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Android home widget resources', () => {
  it('Given the 2x2 widget layout, when inspected, then it should match the reference card structure and proportions', () => {
    const layout = readRepoFile('android/app/src/main/res/layout/widget_daystory.xml');

    expect(layout).toContain('android:id="@+id/widget_root"');
    expect(layout).toContain('android:id="@+id/widget_weekday"');
    expect(layout).toContain('android:id="@+id/widget_day"');
    expect(layout).toContain('android:id="@+id/widget_month"');
    expect(layout).toContain('android:id="@+id/widget_letter_btn"');
    expect(layout).toContain('android:id="@+id/widget_letter_dot"');
    expect(layout).toContain('android:id="@+id/widget_diary_btn"');
    expect(layout).toMatch(/android:padding="16dp"/);
    expect(layout).toMatch(/android:textSize="16sp"/);
    expect(layout).toMatch(/android:textSize="56sp"/);
    expect(layout).toMatch(/android:textSize="12sp"/);
    expect(layout).toMatch(/android:layout_width="30dp"[\s\S]*android:layout_height="30dp"[\s\S]*android:id="@\+id\/widget_letter_icon"|android:id="@\+id\/widget_letter_icon"[\s\S]*android:layout_width="30dp"[\s\S]*android:layout_height="30dp"/);
    expect(layout).toMatch(/android:id="@\+id\/widget_diary_btn"[\s\S]*android:layout_height="40dp"/);
  });

  it('Given widget drawables, when inspected, then active and completed diary states should use reference colors and strokes', () => {
    const active = readRepoFile('android/app/src/main/res/drawable/widget_pen_btn_bg.xml');
    const completed = readRepoFile('android/app/src/main/res/drawable/widget_pen_btn_bg_disabled.xml');
    const envelope = readRepoFile('android/app/src/main/res/drawable/ic_widget_envelope.xml');
    const pen = readRepoFile('android/app/src/main/res/drawable/ic_widget_pen.xml');

    expect(active).toContain('android:color="#FFFFFFFF"');
    expect(active).toContain('android:width="2dp"');
    expect(active).toContain('android:color="#FFD8D8D8"');
    expect(completed).toContain('android:color="#FFF0F0F0"');
    expect(completed).toContain('android:color="#FFE3E3E3"');
    expect(envelope).toContain('android:strokeWidth="2.2"');
    expect(pen).toContain('android:strokeWidth="2.2"');
  });

  it('Given the widget provider, when inspected, then it should preserve letter badge and diary completion state switching', () => {
    const provider = readRepoFile('android/app/src/main/java/com/daystory/app/widget/DayStoryWidgetProvider.java');

    expect(provider).toContain('views.setViewVisibility(R.id.widget_letter_dot, hasNewLetter ? View.VISIBLE : View.GONE)');
    expect(provider).toContain('R.drawable.widget_pen_btn_bg_disabled');
    expect(provider).toContain('R.drawable.ic_widget_pen_disabled');
    expect(provider).toContain('R.drawable.widget_pen_btn_bg');
    expect(provider).toContain('R.drawable.ic_widget_pen');
  });

  it('Given widget settings previews, when inspected, then they should be compact and live inside the bottom sheet flow', () => {
    const css = readRepoFile('src/css/pages.css');
    const component = readRepoFile('src/js/components/widgetThemePreview.js');
    const profile = readRepoFile('src/js/pages/profile.js');
    const settings = readRepoFile('src/js/pages/settings.js');
    const notificationSheet = readRepoFile('src/js/components/notificationSettingsSheet.js');
    const previewRule = css.match(/\.widget-theme-preview\s*\{[\s\S]*?\}/)?.[0] || '';
    const sheetPreviewRule = css.match(/\.widget-theme-settings-sheet\s+\.widget-theme-preview\s*\{[\s\S]*?\}/)?.[0] || '';

    expect(previewRule).toContain('display: flex');
    expect(previewRule).toContain('aspect-ratio: 1 / 1');
    expect(previewRule).toContain('flex-direction: column');
    expect(previewRule).toContain('justify-content: space-between');
    expect(previewRule).toContain('align-items: center');
    expect(sheetPreviewRule).toContain('width: min(132px, 100%)');
    expect(sheetPreviewRule).toContain('padding: 12px');
    expect(sheetPreviewRule).toContain('border-radius: 20px');
    expect(sheetPreviewRule).toContain('border-width: 4px');
    expect(component).toContain('widget-preview-weekday');
    expect(component).toContain('widget-preview-envelope');
    expect(component).toContain('widget-preview-pen-button');
    expect(notificationSheet).toContain('openWidgetThemeSettingsSheet');
    expect(notificationSheet).toContain('widget-theme-settings-sheet');
    expect(profile).not.toContain('renderWidgetThemeOption');
    expect(settings).not.toContain('renderWidgetThemeOption');
  });
});
