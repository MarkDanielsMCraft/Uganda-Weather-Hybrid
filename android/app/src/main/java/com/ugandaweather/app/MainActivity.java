package com.ugandaweather.app;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private ImageView splashOverlay;
    private long splashStartTime = 0;
    private static final long MIN_SPLASH_TIME = 1000;
    private Handler safetyHandler;
    private Runnable safetyRunnable;
    private Handler hideHandler;
    private Runnable hideRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        // Plugins must be registered before super.onCreate builds the bridge.
        registerPlugin(WidgetDataPlugin.class);
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(Color.parseColor("#12101a"));
            getBridge().getWebView().addJavascriptInterface(new SplashBridge(), "NativeSplash");
        }
        if (savedInstanceState == null) {
            showSplashOverlay();
        }
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.app.NotificationChannel channel = new android.app.NotificationChannel(
                "weather_alerts",
                "Severe Weather Alerts",
                android.app.NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Urgent storm warnings and weather alerts for your district");
            channel.enableLights(true);
            channel.setLightColor(Color.parseColor("#E8A838"));
            channel.enableVibration(true);

            android.app.NotificationManager manager = getSystemService(android.app.NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void showSplashOverlay() {
        splashStartTime = System.currentTimeMillis();
        splashOverlay = new ImageView(this);
        splashOverlay.setImageResource(R.drawable.splash);
        splashOverlay.setScaleType(ImageView.ScaleType.CENTER_CROP);
        splashOverlay.setBackgroundColor(Color.parseColor("#12101a"));

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        );
        addContentView(splashOverlay, params);
        splashOverlay.bringToFront();

        // Safety fallback: fade out if not hidden by web app within 6.0 seconds
        safetyHandler = new Handler(Looper.getMainLooper());
        safetyRunnable = this::hideSplashOverlay;
        safetyHandler.postDelayed(safetyRunnable, 6000);
    }

    public void hideSplashOverlay() {
        if (safetyHandler != null && safetyRunnable != null) {
            safetyHandler.removeCallbacks(safetyRunnable);
            safetyRunnable = null;
        }
        if (splashOverlay != null) {
            long elapsed = System.currentTimeMillis() - splashStartTime;
            long delay = Math.max(0, MIN_SPLASH_TIME - elapsed);

            hideHandler = new Handler(Looper.getMainLooper());
            hideRunnable = () -> {
                runOnUiThread(() -> {
                    if (splashOverlay != null) {
                        splashOverlay.animate()
                            .alpha(0f)
                            .setDuration(350)
                            .withEndAction(() -> {
                                if (splashOverlay != null && splashOverlay.getParent() != null) {
                                    ((ViewGroup) splashOverlay.getParent()).removeView(splashOverlay);
                                    splashOverlay = null;
                                }
                            })
                            .start();
                    }
                });
            };
            hideHandler.postDelayed(hideRunnable, delay);
        }
    }

    @Override
    public void onDestroy() {
        if (safetyHandler != null && safetyRunnable != null) {
            safetyHandler.removeCallbacks(safetyRunnable);
        }
        if (hideHandler != null && hideRunnable != null) {
            hideHandler.removeCallbacks(hideRunnable);
        }
        super.onDestroy();
    }

    public class SplashBridge {
        @JavascriptInterface
        public void hide() {
            hideSplashOverlay();
        }
    }
}
