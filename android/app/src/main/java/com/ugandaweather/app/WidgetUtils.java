package com.ugandaweather.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

public final class WidgetUtils {
    public static final String PREFS_NAME = "UgandaWeatherWidget";
    public static final String STORAGE_KEY = "uw:widget:data:v2";
    public static final String LIVE_API_BASE = "https://uganda-weather.com/api/v1/weather/current?district=";
    public static final ExecutorService FETCH_EXECUTOR = Executors.newSingleThreadExecutor();
    public static final String UNAVAILABLE = "--";

    private static final Pattern CLOCK_PATTERN =
        Pattern.compile("^\\s*(\\d{1,2}):(\\d{2})\\s*([ap]m)?\\s*$", Pattern.CASE_INSENSITIVE);

    public static final Class<?>[] ALL_WIDGET_CLASSES = new Class<?>[] {
        WeatherWidget.class,
        DetailsWidget.class,
        DailyForecastWidget.class,
        AirQualityWidget.class,
        AgricultureWidget.class,
        SunriseWidget.class
    };

    private WidgetUtils() {}

    public static String getStoredJson(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(STORAGE_KEY, null);
    }

    public static void saveJson(Context context, String json) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(STORAGE_KEY, json).apply();
    }

    /**
     * Returns the district the person last opened in the app, or null when the app has
     * never saved one. Callers must not guess a district: showing weather for a place the
     * person never chose would look like their own forecast.
     */
    public static String resolveDistrictSlug(String rawJson) {
        if (rawJson == null) return null;
        try {
            return optionalString(new JSONObject(rawJson), "districtSlug");
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * Android's org.json returns the text "null" from optString when the value is JSON
     * null, and the web app sends null for every missing reading. This helper returns a
     * real null for missing, null, or blank values so no widget ever prints "null".
     */
    public static String optionalString(JSONObject json, String key) {
        if (json == null || !json.has(key) || json.isNull(key)) return null;
        String value = json.optString(key, "").trim();
        return value.isEmpty() ? null : value;
    }

    public static Integer optionalInteger(JSONObject json, String key) {
        if (json == null) return null;
        Object value = json.opt(key);
        if (!(value instanceof Number)) return null;
        double number = ((Number) value).doubleValue();
        return !Double.isNaN(number) && !Double.isInfinite(number)
            ? (int) Math.round(number)
            : null;
    }

    public static String textOrUnavailable(String value) {
        return value == null ? UNAVAILABLE : value;
    }

    /** Same wording the website uses for a district's rainfall pattern. */
    public static String rainfallPatternLabel(String pattern) {
        if ("bimodal".equals(pattern)) return "Two rainy seasons a year";
        if ("unimodal".equals(pattern)) return "One long rainy season a year";
        return null;
    }

    /**
     * Works out daylight length from the sunrise and sunset text the API sends (for
     * example "6:43 am" and "6:52 pm"). Returns null when either time cannot be read,
     * so the widget hides the line instead of showing a number it did not calculate.
     */
    public static String formatDaylight(String sunriseText, String sunsetText) {
        Integer sunrise = clockMinutes(sunriseText);
        Integer sunset = clockMinutes(sunsetText);
        if (sunrise == null || sunset == null || sunset <= sunrise) return null;
        int minutes = sunset - sunrise;
        return String.format(Locale.ROOT, "Daylight %dh %02dm", minutes / 60, minutes % 60);
    }

    static Integer clockMinutes(String text) {
        if (text == null) return null;
        Matcher matcher = CLOCK_PATTERN.matcher(text);
        if (!matcher.matches()) return null;
        int hour = Integer.parseInt(matcher.group(1));
        int minute = Integer.parseInt(matcher.group(2));
        String period = matcher.group(3);
        if (minute > 59) return null;
        if (period == null) {
            if (hour > 23) return null;
        } else {
            if (hour < 1 || hour > 12) return null;
            boolean isPm = period.equalsIgnoreCase("pm");
            hour = hour % 12 + (isPm ? 12 : 0);
        }
        return hour * 60 + minute;
    }

    /**
     * The server falls back to sample weather when every provider fails and marks it
     * with source "demo" or "demo-fallback". A widget has no room to explain that, so
     * sample data must never be stored or shown as a real forecast.
     */
    public static boolean isSampleData(JSONObject data) {
        String source = optionalString(data, "source");
        return source != null && source.startsWith("demo");
    }

    private static void putRounded(JSONObject target, String key, JSONObject source, String sourceKey)
        throws org.json.JSONException {
        Integer value = optionalInteger(source, sourceKey);
        target.put(key, value == null ? JSONObject.NULL : value);
    }

    private static void putText(JSONObject target, String key, JSONObject source, String sourceKey)
        throws org.json.JSONException {
        String value = optionalString(source, sourceKey);
        target.put(key, value == null ? JSONObject.NULL : value);
    }

    public static String fetchLiveWidgetJson(String districtSlug) {
        if (districtSlug == null || districtSlug.isEmpty()) return null;
        HttpURLConnection conn = null;
        try {
            String encodedSlug = URLEncoder.encode(districtSlug, StandardCharsets.UTF_8.name());
            URL url = new URL(LIVE_API_BASE + encodedSlug);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("User-Agent", "UgandaWeather-Android");
            if (conn.getResponseCode() != 200) {
                return null;
            }
            StringBuilder builder = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)
            )) {
                String line;
                while ((line = reader.readLine()) != null) {
                    builder.append(line);
                }
            }
            JSONObject root = new JSONObject(builder.toString());
            JSONObject data = root.optJSONObject("data");
            if (data == null || isSampleData(data)) return null;

            JSONObject district = data.optJSONObject("district");
            String districtName = optionalString(district, "name");
            String resolvedSlug = optionalString(district, "slug");
            if (districtName == null) return null;

            JSONObject temperature = data.optJSONObject("temperature");
            JSONObject condition = data.optJSONObject("condition");
            JSONObject daily = data.optJSONObject("daily");
            JSONObject precipitation = data.optJSONObject("precipitation");
            JSONObject wind = data.optJSONObject("wind");
            JSONObject astronomy = data.optJSONObject("astronomy");
            JSONObject airQuality = data.optJSONObject("airQuality");
            JSONArray alerts = data.optJSONArray("alerts");
            JSONArray hourly = data.optJSONArray("hourly");

            JSONObject widgetJson = new JSONObject();
            widgetJson.put("districtName", districtName);
            widgetJson.put("districtSlug", resolvedSlug != null ? resolvedSlug : districtSlug);
            putRounded(widgetJson, "temperatureC", temperature, "celsius");
            putRounded(widgetJson, "feelsLikeC", temperature, "feelsLike");
            String conditionText = optionalString(condition, "text");
            widgetJson.put("conditionText", conditionText != null ? conditionText : "Weather unavailable");
            String conditionTheme = optionalString(condition, "theme");
            widgetJson.put("conditionTheme", conditionTheme != null ? conditionTheme : "unknown");
            putRounded(widgetJson, "highC", daily, "high");
            putRounded(widgetJson, "lowC", daily, "low");
            putRounded(widgetJson, "precipitationChance", precipitation, "chance");
            putRounded(widgetJson, "windSpeedKph", wind, "speedKph");
            putText(widgetJson, "windDirectionText", wind, "direction");
            putRounded(widgetJson, "humidity", data, "humidity");
            putRounded(widgetJson, "uvIndex", data, "uvIndex");
            putText(widgetJson, "sunriseText", astronomy, "sunrise");
            putText(widgetJson, "sunsetText", astronomy, "sunset");
            putRounded(widgetJson, "aqi", airQuality, "aqi");
            putText(widgetJson, "aqiCategory", airQuality, "category");
            putText(widgetJson, "agroSeason", district, "rainfallPattern");

            JSONObject firstAlert = (alerts != null && alerts.length() > 0) ? alerts.optJSONObject(0) : null;
            String alertTitle = optionalString(firstAlert, "title");
            widgetJson.put("hasActiveAlert", firstAlert != null);
            widgetJson.put("alertTitle", alertTitle != null ? alertTitle : JSONObject.NULL);
            putText(widgetJson, "updatedAt", data, "updatedAt");

            JSONArray timeline = new JSONArray();
            if (hourly != null) {
                for (int i = 0; i < hourly.length() && timeline.length() < 12; i++) {
                    JSONObject item = hourly.optJSONObject(i);
                    if (item == null || !"hour".equals(item.optString("kind", "hour"))) continue;
                    JSONObject point = new JSONObject();
                    point.put("time", item.optString("time", ""));
                    point.put("label", item.optString("label", ""));
                    putRounded(point, "tempC", item, "temp");
                    String theme = optionalString(item, "theme");
                    point.put("conditionTheme", theme != null ? theme : "unknown");
                    putRounded(point, "rainChance", item, "rainChance");
                    point.put("kind", "hour");
                    timeline.put(point);
                }
            }
            widgetJson.put("hourlyTimeline", timeline);

            JSONArray dailyForecast = data.optJSONArray("dailyForecast");
            JSONArray dailyArray = new JSONArray();
            if (dailyForecast != null) {
                for (int i = 0; i < dailyForecast.length() && dailyArray.length() < 5; i++) {
                    JSONObject item = dailyForecast.optJSONObject(i);
                    String day = optionalString(item, "day");
                    if (item == null || day == null) continue;
                    JSONObject dayPoint = new JSONObject();
                    dayPoint.put("day", day);
                    String theme = optionalString(item, "theme");
                    dayPoint.put("conditionTheme", theme != null ? theme : "unknown");
                    putRounded(dayPoint, "highC", item, "high");
                    putRounded(dayPoint, "lowC", item, "low");
                    putRounded(dayPoint, "rainChance", item, "rainChance");
                    dailyArray.put(dayPoint);
                }
            }
            widgetJson.put("dailyForecast", dailyArray);
            return widgetJson.toString();
        } catch (Exception error) {
            android.util.Log.w("UgandaWeatherWidget", "Live widget fetch error", error);
            return null;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    public static PendingIntent createAppPendingIntent(Context context) {
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) {
            return null;
        }
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    public static int resolveBackgroundDrawable(String conditionTheme) {
        if ("clear".equals(conditionTheme)) {
            return R.drawable.widget_background_clear;
        } else if ("rain".equals(conditionTheme)) {
            return R.drawable.widget_background_rain;
        } else if ("cloudy".equals(conditionTheme) || "partly_cloudy".equals(conditionTheme)) {
            return R.drawable.widget_background_cloudy;
        } else if ("thunder".equals(conditionTheme)) {
            return R.drawable.widget_background_thunder;
        } else if ("night".equals(conditionTheme)) {
            return R.drawable.widget_background_night;
        }
        return R.drawable.widget_background;
    }

    public static int resolveWeatherIconDrawable(String theme) {
        if ("clear".equals(theme)) {
            return R.drawable.ic_weather_sun;
        } else if ("rain".equals(theme)) {
            return R.drawable.ic_weather_rain;
        } else if ("thunder".equals(theme)) {
            return R.drawable.ic_weather_thunder;
        } else if ("night".equals(theme)) {
            return R.drawable.ic_weather_night;
        }
        return R.drawable.ic_weather_cloud;
    }

    public static void notifyAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> widgetClass : ALL_WIDGET_CLASSES) {
            try {
                ComponentName component = new ComponentName(context, widgetClass);
                int[] widgetIds = manager.getAppWidgetIds(component);
                if (widgetIds != null && widgetIds.length > 0) {
                    Intent updateIntent = new Intent(context, widgetClass);
                    updateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                    updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds);
                    context.sendBroadcast(updateIntent);
                }
            } catch (Exception error) {
                android.util.Log.w("UgandaWeatherWidget", "Failed notifying widget " + widgetClass.getSimpleName(), error);
            }
        }
    }
}
