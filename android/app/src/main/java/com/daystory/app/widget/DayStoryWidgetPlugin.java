package com.daystory.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DayStoryWidget")
public class DayStoryWidgetPlugin extends Plugin {

    @PluginMethod
    public void setLetterState(PluginCall call) {
        Boolean hasNew = call.getBoolean("hasNewLetter");
        if (hasNew == null) {
            call.reject("Missing hasNewLetter");
            return;
        }
        Context ctx = getContext();
        SharedPreferences.Editor editor = ctx
                .getSharedPreferences(DayStoryWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
                .edit();
        editor.putBoolean(DayStoryWidgetProvider.KEY_HAS_NEW_LETTER, hasNew);
        editor.apply();
        DayStoryWidgetProvider.updateAll(ctx);
        resolveOk(call);
    }

    @PluginMethod
    public void setDiaryState(PluginCall call) {
        Boolean hasDiary = call.getBoolean("hasTodayDiary");
        String diaryDate = call.getString("diaryDate", "");
        if (hasDiary == null) {
            call.reject("Missing hasTodayDiary");
            return;
        }
        Context ctx = getContext();
        SharedPreferences.Editor editor = ctx
                .getSharedPreferences(DayStoryWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
                .edit();
        editor.putBoolean(DayStoryWidgetProvider.KEY_HAS_TODAY_DIARY, hasDiary);
        editor.putString(DayStoryWidgetProvider.KEY_DIARY_DATE, diaryDate == null ? "" : diaryDate);
        editor.apply();
        DayStoryWidgetProvider.updateAll(ctx);
        resolveOk(call);
    }

    @PluginMethod
    public void setTheme(PluginCall call) {
        String theme = call.getString("theme");
        if (theme == null
                || (!DayStoryWidgetProvider.THEME_LIGHT.equals(theme)
                && !DayStoryWidgetProvider.THEME_DARK.equals(theme))) {
            call.reject("Invalid theme (expected 'light' or 'dark')");
            return;
        }
        Context ctx = getContext();
        SharedPreferences.Editor editor = ctx
                .getSharedPreferences(DayStoryWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
                .edit();
        editor.putString(DayStoryWidgetProvider.KEY_THEME, theme);
        editor.apply();
        DayStoryWidgetProvider.updateAll(ctx);
        resolveOk(call);
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        DayStoryWidgetProvider.updateAll(getContext());
        resolveOk(call);
    }

    private void resolveOk(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }
}
