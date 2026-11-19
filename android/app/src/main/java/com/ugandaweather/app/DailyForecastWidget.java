package com.ugandaweather.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class DailyForecastWidget extends AppWidgetProvider {
    private static final int DAYS_COUNT = 5;
    private static final int[] DAY_ROW_IDS = {
        R.id.widget_daily_row_0, R.id.widget_daily_row_1, R.id.widget_daily_row_2, R.id.widget_daily_row_3, R.id.widget_daily_row_4
    };
    private static final int[] DAY_TEXT_IDS = {
        R.id.widget_daily_day_0, R.id.widget_daily_day_1, R.id.widget_daily_day_2, R.id.widget_daily_day_3, R.id.widget_daily_day_4
    };
    private static final int[] DAY_ICON_IDS = {
        R.id.widget_daily_icon_0, R.id.widget_daily_icon_1, R.id.widget_daily_icon_2, R.id.widget_daily_icon_3, R.id.widget_daily_icon_4
    };
    private static final int[] DAY_RAIN_IDS = {
        R.id.widget_daily_rain_0, R.id.widget_daily_rain_1, R.id.widget_daily_rain_2, R.id.widget_daily_rain_3, R.id.widget_daily_rain_4
    };
    private static final int[] DAY_LOW_IDS = {
        R.id.widget_daily_low_0, R.id.widget_daily_low_1, R.id.widget_daily_low_2, R.id.widget_daily_low_3, R.id.widget_daily_low_4
    };
    private static final int[] DAY_BAR_IDS = {
        R.id.widget_daily_bar_0, R.id.widget_daily_bar_1, R.id.widget_daily_bar_2, R.id.widget_daily_bar_3, R.id.widget_daily_bar_4
    };
    private static final int[] DAY_HIGH_IDS = {
        R.id.widget_daily_high_0, R.id.widget_daily_high_1, R.id.widget_daily_high_2, R.id.widget_daily_high_3, R.id.widget_daily_high_4
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager appWidgetManager,
        int appWidgetId,
        Bundle newOptions
    ) {
        updateWidget(context, appWidgetManager, appWidgetId);
    }

    private void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_daily);
        String rawJson = WidgetUtils.getStoredJson(context);

        PendingIntent launchApp = WidgetUtils.createAppPendingIntent(context);
        if (launchApp != null) {
            views.setOnClickPendingIntent(R.id.widget_daily_root, launchApp);
        }

        JSONObject json = null;
        if (rawJson != null) {
            try {
                json = new JSONObject(rawJson);
            } catch (Exception error) {
                android.util.Log.w("UgandaWeatherWidget", "Daily forecast widget parse failed", error);
            }
        }

        String district = WidgetUtils.optionalString(json, "districtName");
        views.setTextViewText(R.id.widget_daily_district, district != null ? district : "Open app to load weather");
        views.setInt(
            R.id.widget_daily_root,
            "setBackgroundResource",
            WidgetUtils.resolveBackgroundDrawable(WidgetUtils.optionalString(json, "conditionTheme"))
        );
        setRows(views, json != null ? json.optJSONArray("dailyForecast") : null);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    // Rows start with sample values from the layout (used for the widget picker
    // preview), so every row without real data must be hidden, never left as is.
    private void setRows(RemoteViews views, JSONArray daily) {
        for (int i = 0; i < DAYS_COUNT; i++) {
            JSONObject day = daily != null ? daily.optJSONObject(i) : null;
            String dayLabel = WidgetUtils.optionalString(day, "day");
            if (day == null || dayLabel == null) {
                views.setViewVisibility(DAY_ROW_IDS[i], View.GONE);
                continue;
            }
            Integer high = WidgetUtils.optionalInteger(day, "highC");
            Integer low = WidgetUtils.optionalInteger(day, "lowC");
            Integer rain = WidgetUtils.optionalInteger(day, "rainChance");

            views.setTextViewText(DAY_TEXT_IDS[i], i == 0 ? "Today" : dayLabel);
            views.setImageViewResource(
                DAY_ICON_IDS[i],
                WidgetUtils.resolveWeatherIconDrawable(WidgetUtils.optionalString(day, "conditionTheme"))
            );
            views.setTextViewText(DAY_LOW_IDS[i], low == null ? WidgetUtils.UNAVAILABLE : low + "°");
            views.setTextViewText(DAY_HIGH_IDS[i], high == null ? WidgetUtils.UNAVAILABLE : high + "°");
            views.setTextViewText(DAY_RAIN_IDS[i], rain == null || rain <= 0 ? "" : rain + "%");
            views.setImageViewResource(DAY_BAR_IDS[i], i == 0 ? R.drawable.widget_range_bar_today : R.drawable.widget_range_bar);
            views.setViewVisibility(DAY_ROW_IDS[i], View.VISIBLE);
        }
    }
}
