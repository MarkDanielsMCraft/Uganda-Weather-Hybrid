package com.ugandaweather.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class SunriseWidget extends AppWidgetProvider {

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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_sunrise);
        String rawJson = WidgetUtils.getStoredJson(context);

        PendingIntent launchApp = WidgetUtils.createAppPendingIntent(context);
        if (launchApp != null) {
            views.setOnClickPendingIntent(R.id.widget_sunrise_root, launchApp);
        }

        JSONObject json = null;
        if (rawJson != null) {
            try {
                json = new JSONObject(rawJson);
            } catch (Exception error) {
                android.util.Log.w("UgandaWeatherWidget", "Sunrise widget parse failed", error);
            }
        }

        String district = WidgetUtils.optionalString(json, "districtName");
        String sunrise = WidgetUtils.optionalString(json, "sunriseText");
        String sunset = WidgetUtils.optionalString(json, "sunsetText");
        String daylight = WidgetUtils.formatDaylight(sunrise, sunset);

        views.setTextViewText(R.id.widget_sunrise_district, district != null ? district : "Open app to load weather");
        views.setTextViewText(R.id.widget_sunrise_time, WidgetUtils.textOrUnavailable(sunrise));
        views.setTextViewText(R.id.widget_sunset_time, WidgetUtils.textOrUnavailable(sunset));
        // Daylight is worked out from the two times above. When either is missing the
        // line is hidden rather than showing a fixed value.
        views.setTextViewText(R.id.widget_sunrise_daylight, daylight != null ? daylight : "");
        views.setViewVisibility(R.id.widget_sunrise_daylight, daylight != null ? View.VISIBLE : View.GONE);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
