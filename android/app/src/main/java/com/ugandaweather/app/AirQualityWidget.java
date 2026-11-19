package com.ugandaweather.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class AirQualityWidget extends AppWidgetProvider {

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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_air_quality);
        String rawJson = WidgetUtils.getStoredJson(context);

        PendingIntent launchApp = WidgetUtils.createAppPendingIntent(context);
        if (launchApp != null) {
            views.setOnClickPendingIntent(R.id.widget_aqi_root, launchApp);
        }

        JSONObject json = null;
        if (rawJson != null) {
            try {
                json = new JSONObject(rawJson);
            } catch (Exception error) {
                android.util.Log.w("UgandaWeatherWidget", "Air quality widget parse failed", error);
            }
        }

        String district = WidgetUtils.optionalString(json, "districtName");
        Integer aqi = WidgetUtils.optionalInteger(json, "aqi");
        String category = WidgetUtils.optionalString(json, "aqiCategory");

        views.setTextViewText(R.id.widget_aqi_district, district != null ? district : "Open app to load weather");
        views.setTextViewText(R.id.widget_aqi_value, aqi == null ? WidgetUtils.UNAVAILABLE : String.valueOf(aqi));
        views.setTextViewText(R.id.widget_aqi_category, category != null ? category : "Not available");
        views.setTextViewText(R.id.widget_aqi_advisory, advisoryFor(aqi));

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    // Guidance follows the standard air quality index bands. With no reading there is
    // no guidance to give, so the widget says so instead of assuming clean air.
    private static String advisoryFor(Integer aqi) {
        if (aqi == null) return "Air quality reading not available right now.";
        if (aqi > 150) return "Unhealthy air. Limit long outdoor activity.";
        if (aqi > 100) return "Sensitive groups should reduce outdoor activity.";
        if (aqi > 50) return "Moderate air. Acceptable for most people.";
        return "Air quality is satisfactory for outdoor activity.";
    }
}
