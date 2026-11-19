package com.ugandaweather.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class AgricultureWidget extends AppWidgetProvider {

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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_agriculture);
        String rawJson = WidgetUtils.getStoredJson(context);

        PendingIntent launchApp = WidgetUtils.createAppPendingIntent(context);
        if (launchApp != null) {
            views.setOnClickPendingIntent(R.id.widget_agro_root, launchApp);
        }

        JSONObject json = null;
        if (rawJson != null) {
            try {
                json = new JSONObject(rawJson);
            } catch (Exception error) {
                android.util.Log.w("UgandaWeatherWidget", "Agriculture widget parse failed", error);
            }
        }

        String district = WidgetUtils.optionalString(json, "districtName");
        String season = WidgetUtils.rainfallPatternLabel(WidgetUtils.optionalString(json, "agroSeason"));
        // precipitationChance is today's chance, not a weekly figure, so the label says today.
        Integer rain = WidgetUtils.optionalInteger(json, "precipitationChance");

        views.setTextViewText(R.id.widget_agro_district, district != null ? district : "Open app to load weather");
        views.setTextViewText(R.id.widget_agro_season, season != null ? season : "Season not available");
        views.setTextViewText(
            R.id.widget_agro_rain_chance,
            rain == null ? "Rain chance not available" : "Rain chance today " + rain + "%"
        );
        views.setTextViewText(R.id.widget_agro_advisory, advisoryFor(rain));

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    // Short guidance from today's rain chance only. With no rain chance there is no
    // basis for advice, so the widget points to the app instead.
    private static String advisoryFor(Integer rain) {
        if (rain == null) return "Open the app for farm guidance.";
        if (rain > 70) return "Heavy rain likely. Clear drainage and collect rain water.";
        if (rain < 20) return "Dry day likely. Mulch to keep moisture in the soil.";
        return "Some rain possible. Check the app before planting or spraying.";
    }
}
