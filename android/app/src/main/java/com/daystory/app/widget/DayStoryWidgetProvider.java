package com.daystory.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import com.daystory.app.MainActivity;
import com.daystory.app.R;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

public class DayStoryWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "daystory_widget_prefs";
    public static final String KEY_HAS_NEW_LETTER = "has_new_letter";
    public static final String KEY_HAS_TODAY_DIARY = "has_today_diary";
    public static final String KEY_DIARY_DATE = "diary_date";
    public static final String KEY_THEME = "widget_theme";

    public static final String THEME_LIGHT = "light";
    public static final String THEME_DARK = "dark";

    private static final String DEEP_LINK_LETTER = "daystory://letter";
    private static final String DEEP_LINK_DIARY = "daystory://diary/new";

    private static final int COLOR_TEXT_PRIMARY_LIGHT = 0xFF000000;
    private static final int COLOR_TEXT_SECONDARY_LIGHT = 0xFF222222;
    private static final int COLOR_TEXT_PRIMARY_DARK = 0xFFF3F3F4;
    private static final int COLOR_TEXT_SECONDARY_DARK = 0xFFB7B7BC;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onEnabled(Context context) {
        updateAll(context);
    }

    public static void updateAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        ComponentName cn = new ComponentName(context, DayStoryWidgetProvider.class);
        int[] ids = mgr.getAppWidgetIds(cn);
        for (int id : ids) {
            updateWidget(context, mgr, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager mgr, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_daystory);

        Calendar cal = Calendar.getInstance();
        SimpleDateFormat weekdayFmt = new SimpleDateFormat("EEE", Locale.ENGLISH);
        SimpleDateFormat monthFmt = new SimpleDateFormat("MMMM yyyy", Locale.ENGLISH);
        String weekday = weekdayFmt.format(cal.getTime()).toUpperCase(Locale.ENGLISH);
        String day = String.valueOf(cal.get(Calendar.DAY_OF_MONTH));
        String monthYear = monthFmt.format(cal.getTime()).toUpperCase(Locale.ENGLISH);
        String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.getTime());

        views.setTextViewText(R.id.widget_weekday, weekday);
        views.setTextViewText(R.id.widget_day, day);
        views.setTextViewText(R.id.widget_month, monthYear);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean hasNewLetter = prefs.getBoolean(KEY_HAS_NEW_LETTER, true);
        String savedDiaryDate = prefs.getString(KEY_DIARY_DATE, "");
        boolean hasTodayDiary = prefs.getBoolean(KEY_HAS_TODAY_DIARY, false)
                && todayDate.equals(savedDiaryDate);
        String theme = prefs.getString(KEY_THEME, THEME_LIGHT);
        boolean isDark = THEME_DARK.equals(theme);

        applyTheme(views, isDark, hasTodayDiary);

        views.setViewVisibility(R.id.widget_letter_dot, hasNewLetter ? View.VISIBLE : View.GONE);

        views.setOnClickPendingIntent(R.id.widget_root,
                buildLaunchIntent(context, DEEP_LINK_LETTER, 1));
        views.setOnClickPendingIntent(R.id.widget_letter_btn,
                buildLaunchIntent(context, DEEP_LINK_LETTER, 2));
        views.setOnClickPendingIntent(R.id.widget_diary_btn,
                buildLaunchIntent(context, DEEP_LINK_DIARY, 3));

        mgr.updateAppWidget(appWidgetId, views);
    }

    private static void applyTheme(RemoteViews views, boolean isDark, boolean hasTodayDiary) {
        int textPrimary = isDark ? COLOR_TEXT_PRIMARY_DARK : COLOR_TEXT_PRIMARY_LIGHT;
        int textSecondary = isDark ? COLOR_TEXT_SECONDARY_DARK : COLOR_TEXT_SECONDARY_LIGHT;

        int rootBg = isDark ? R.drawable.widget_bg_dark : R.drawable.widget_bg;
        int penBgActive = isDark ? R.drawable.widget_pen_btn_bg_dark : R.drawable.widget_pen_btn_bg;
        int penBgDisabled = isDark
                ? R.drawable.widget_pen_btn_bg_disabled_dark
                : R.drawable.widget_pen_btn_bg_disabled;
        int envelopeIcon = isDark ? R.drawable.ic_widget_envelope_dark : R.drawable.ic_widget_envelope;
        int penIconActive = isDark ? R.drawable.ic_widget_pen_dark : R.drawable.ic_widget_pen;
        int penIconDisabled = isDark
                ? R.drawable.ic_widget_pen_disabled_dark
                : R.drawable.ic_widget_pen_disabled;

        views.setInt(R.id.widget_root, "setBackgroundResource", rootBg);
        views.setTextColor(R.id.widget_weekday, textPrimary);
        views.setTextColor(R.id.widget_day, textPrimary);
        views.setTextColor(R.id.widget_month, textSecondary);
        views.setImageViewResource(R.id.widget_letter_icon, envelopeIcon);

        if (hasTodayDiary) {
            views.setInt(R.id.widget_diary_btn, "setBackgroundResource", penBgDisabled);
            views.setImageViewResource(R.id.widget_pen_icon, penIconDisabled);
        } else {
            views.setInt(R.id.widget_diary_btn, "setBackgroundResource", penBgActive);
            views.setImageViewResource(R.id.widget_pen_icon, penIconActive);
        }
    }

    private static PendingIntent buildLaunchIntent(Context context, String deepLink, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(deepLink));
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }
}
