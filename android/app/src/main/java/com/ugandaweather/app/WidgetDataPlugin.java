package com.ugandaweather.app;

import android.content.Context;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * Receives the latest weather from the web app and stores it for the home screen widgets.
 *
 * This goes through a Capacitor plugin instead of a plain JavaScript interface because
 * Capacitor only accepts plugin calls from the main page of the app's allowed sites.
 * A plain interface would also accept writes from any embedded frame.
 */
@CapacitorPlugin(name = "WidgetData")
public class WidgetDataPlugin extends Plugin {
    private static final String TAG = "UgandaWeatherWidget";
    private static final int MAX_PAYLOAD_CHARS = 16384;

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.isEmpty() || json.length() > MAX_PAYLOAD_CHARS) {
            call.reject("Widget data is missing or too large");
            return;
        }

        try {
            JSONObject payload = new JSONObject(json);
            if (WidgetUtils.optionalString(payload, "districtName") == null
                || WidgetUtils.optionalString(payload, "districtSlug") == null) {
                call.reject("Widget data has no district");
                return;
            }
        } catch (Exception error) {
            Log.w(TAG, "Rejected invalid widget data");
            call.reject("Widget data is not valid");
            return;
        }

        Context appContext = getContext().getApplicationContext();
        WidgetUtils.saveJson(appContext, json);
        try {
            WidgetUtils.notifyAllWidgets(appContext);
        } catch (Exception error) {
            Log.e(TAG, "Could not refresh widgets", error);
        }
        call.resolve();
    }
}
