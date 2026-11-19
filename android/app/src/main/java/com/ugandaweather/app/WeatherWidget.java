package com.ugandaweather.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.app.PendingIntent;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class WeatherWidget extends AppWidgetProvider {
    private static final int DAYS_COUNT = 5;
    private static final int[] DAY_ROW_IDS = {
        R.id.widget_day_row_0, R.id.widget_day_row_1, R.id.widget_day_row_2, R.id.widget_day_row_3, R.id.widget_day_row_4
    };
    private static final int[] DAY_TEXT_IDS = {
        R.id.widget_day_0, R.id.widget_day_1, R.id.widget_day_2, R.id.widget_day_3, R.id.widget_day_4
    };
    private static final int[] DAY_ICON_IDS = {
        R.id.widget_day_icon_0, R.id.widget_day_icon_1, R.id.widget_day_icon_2, R.id.widget_day_icon_3, R.id.widget_day_icon_4
    };
    private static final int[] DAY_LOW_IDS = {
        R.id.widget_day_low_0, R.id.widget_day_low_1, R.id.widget_day_low_2, R.id.widget_day_low_3, R.id.widget_day_low_4
    };
    private static final int[] DAY_BAR_IDS = {
        R.id.widget_day_bar_0, R.id.widget_day_bar_1, R.id.widget_day_bar_2, R.id.widget_day_bar_3, R.id.widget_day_bar_4
    };
    private static final int[] DAY_HIGH_IDS = {
        R.id.widget_day_high_0, R.id.widget_day_high_1, R.id.widget_day_high_2, R.id.widget_day_high_3, R.id.widget_day_high_4
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }

        final Context appContext = context.getApplicationContext();
        final String slug = WidgetUtils.resolveDistrictSlug(WidgetUtils.getStoredJson(appContext));
        // No saved district means the app has not been opened yet, so there is nothing
        // honest to fetch. The widget keeps showing "Open app to load weather".
        if (slug == null) return;

        final PendingResult pendingResult = goAsync();
        WidgetUtils.FETCH_EXECUTOR.execute(() -> {
            try {
                String freshJson = WidgetUtils.fetchLiveWidgetJson(slug);
                if (freshJson != null) {
                    WidgetUtils.saveJson(appContext, freshJson);
                    AppWidgetManager manager = AppWidgetManager.getInstance(appContext);
                    for (int appWidgetId : appWidgetIds) {
                        updateAppWidget(appContext, manager, appWidgetId);
                    }
                }
            } catch (Exception error) {
                android.util.Log.w("UgandaWeatherWidget", "Background widget refresh failed", error);
            } finally {
                pendingResult.finish();
            }
        });
    }

    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager appWidgetManager,
        int appWidgetId,
        Bundle newOptions
    ) {
        updateAppWidget(context, appWidgetManager, appWidgetId);
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_weather);
        String rawJson = WidgetUtils.getStoredJson(context);

        PendingIntent launchApp = WidgetUtils.createAppPendingIntent(context);
        if (launchApp != null) {
            views.setOnClickPendingIntent(R.id.widget_root, launchApp);
        }

        if (rawJson != null) {
            try {
                JSONObject json = new JSONObject(rawJson);
                String district = WidgetUtils.optionalString(json, "districtName");
                String condition = WidgetUtils.optionalString(json, "conditionText");
                Integer temp = WidgetUtils.optionalInteger(json, "temperatureC");
                Integer high = WidgetUtils.optionalInteger(json, "highC");
                Integer low = WidgetUtils.optionalInteger(json, "lowC");
                Integer rain = WidgetUtils.optionalInteger(json, "precipitationChance");
                boolean hasAlert = json.optBoolean("hasActiveAlert", false);
                String alert = hasAlert ? formatCompactAlertTitle(WidgetUtils.optionalString(json, "alertTitle")) : "";

                String theme = WidgetUtils.optionalString(json, "conditionTheme");
                views.setInt(R.id.widget_root, "setBackgroundResource", WidgetUtils.resolveBackgroundDrawable(theme));
                views.setTextViewText(R.id.widget_district, district != null ? district : "Uganda Weather");
                views.setTextViewText(R.id.widget_condition, condition != null ? condition : "Weather unavailable");
                views.setTextViewText(R.id.widget_temp, temp == null ? "--" : temp + "°");
                views.setTextViewText(
                    R.id.widget_range,
                    high == null || low == null ? "High and low unavailable" : "High " + high + "°  Low " + low + "°"
                );
                views.setTextViewText(R.id.widget_alert, alert);
                views.setViewVisibility(R.id.widget_alert_container, hasAlert ? android.view.View.VISIBLE : android.view.View.GONE);
                views.setTextViewText(
                    R.id.widget_rain,
                    rain == null ? "Rain chance unavailable" : "Rain chance " + rain + "%"
                );

                setDailyForecast(views, json.optJSONArray("dailyForecast"));
            } catch (Exception error) {
                android.util.Log.w("UgandaWeatherWidget", "Could not read widget data", error);
                setUnavailableContent(views);
            }
        } else {
            setUnavailableContent(views);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private String formatCompactAlertTitle(String title) {
        if (title == null || title.trim().isEmpty()) return "Weather Alert";
        String clean = title.trim();
        int cut = clean.indexOf(" over ");
        if (cut > 0 && cut <= 30) {
            return clean.substring(0, cut);
        }
        int comma = clean.indexOf(",");
        if (comma > 0 && comma <= 30) {
            return clean.substring(0, comma);
        }
        return clean.length() > 26 ? clean.substring(0, 26) : clean;
    }

    // Rows start with sample values from the layout (used for the widget picker
    // preview), so every row without real data must be hidden, never left as is.
    private void setDailyForecast(RemoteViews views, JSONArray daily) {
        for (int i = 0; i < DAYS_COUNT; i++) {
            JSONObject day = daily != null ? daily.optJSONObject(i) : null;
            String dayLabel = WidgetUtils.optionalString(day, "day");
            if (day == null || dayLabel == null) {
                views.setViewVisibility(DAY_ROW_IDS[i], android.view.View.GONE);
                continue;
            }
            String dayName = i == 0 ? "Today" : dayLabel;
            String dayTheme = WidgetUtils.optionalString(day, "conditionTheme");
            Integer high = WidgetUtils.optionalInteger(day, "highC");
            Integer low = WidgetUtils.optionalInteger(day, "lowC");

            views.setTextViewText(DAY_TEXT_IDS[i], dayName);
            views.setImageViewResource(DAY_ICON_IDS[i], WidgetUtils.resolveWeatherIconDrawable(dayTheme));
            views.setTextViewText(DAY_LOW_IDS[i], low == null ? "--" : low + "°");
            views.setTextViewText(DAY_HIGH_IDS[i], high == null ? "--" : high + "°");
            views.setImageViewResource(DAY_BAR_IDS[i], i == 0 ? R.drawable.widget_range_bar_today : R.drawable.widget_range_bar);
            views.setViewVisibility(DAY_ROW_IDS[i], android.view.View.VISIBLE);
        }
    }

    private void setUnavailableContent(RemoteViews views) {
        views.setTextViewText(R.id.widget_district, "Uganda Weather");
        views.setTextViewText(R.id.widget_condition, "Open app to load weather");
        views.setTextViewText(R.id.widget_temp, "--");
        views.setTextViewText(R.id.widget_range, "High and low unavailable");
        views.setTextViewText(R.id.widget_rain, "Rain chance unavailable");
        views.setTextViewText(R.id.widget_alert, "");
        views.setViewVisibility(R.id.widget_alert_container, android.view.View.GONE);
        setDailyForecast(views, null);
    }
}
