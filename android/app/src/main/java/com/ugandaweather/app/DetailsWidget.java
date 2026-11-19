package com.ugandaweather.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class DetailsWidget extends AppWidgetProvider {

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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_details);
        String rawJson = WidgetUtils.getStoredJson(context);

        PendingIntent launchApp = WidgetUtils.createAppPendingIntent(context);
        if (launchApp != null) {
            views.setOnClickPendingIntent(R.id.widget_details_root, launchApp);
        }

        JSONObject json = null;
        if (rawJson != null) {
            try {
                json = new JSONObject(rawJson);
            } catch (Exception error) {
                android.util.Log.w("UgandaWeatherWidget", "Details widget parse failed", error);
            }
        }

        // Every field is set on every update so the layout's sample values (used only
        // for the widget picker preview) are never shown as real readings.
        String district = WidgetUtils.optionalString(json, "districtName");
        Integer rain = WidgetUtils.optionalInteger(json, "precipitationChance");
        Integer wind = WidgetUtils.optionalInteger(json, "windSpeedKph");
        Integer humidity = WidgetUtils.optionalInteger(json, "humidity");
        Integer feels = WidgetUtils.optionalInteger(json, "feelsLikeC");

        views.setInt(
            R.id.widget_details_root,
            "setBackgroundResource",
            WidgetUtils.resolveBackgroundDrawable(WidgetUtils.optionalString(json, "conditionTheme"))
        );
        views.setTextViewText(R.id.widget_details_district, district != null ? district : "Open app to load weather");
        views.setTextViewText(R.id.widget_details_rain, rain == null ? WidgetUtils.UNAVAILABLE : rain + "%");
        views.setTextViewText(R.id.widget_details_wind, wind == null ? WidgetUtils.UNAVAILABLE : wind + " km/h");
        views.setTextViewText(R.id.widget_details_humidity, humidity == null ? WidgetUtils.UNAVAILABLE : humidity + "%");
        views.setTextViewText(R.id.widget_details_feels, feels == null ? WidgetUtils.UNAVAILABLE : feels + "°");

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
