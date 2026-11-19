import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

if (!serverUrl) {
  throw new Error(
    "Set CAPACITOR_SERVER_URL to the HTTPS deployment URL before running Capacitor commands.",
  );
}

const parsedServerUrl = new URL(serverUrl);
const isLocalhost = ["localhost", "127.0.0.1", "10.0.2.2"].includes(parsedServerUrl.hostname);
if (parsedServerUrl.protocol !== "https:" && !isLocalhost) {
  throw new Error("CAPACITOR_SERVER_URL must use HTTPS (except for local development).");
}

const allowedHosts =
  parsedServerUrl.hostname === "uganda-weather.com" ||
  parsedServerUrl.hostname === "www.uganda-weather.com"
    ? ["uganda-weather.com", "www.uganda-weather.com"]
    : [parsedServerUrl.hostname];

const config: CapacitorConfig = {
  appId: "com.ugandaweather.app",
  appName: "Uganda Weather",
  webDir: "public",
  server: {
    url: parsedServerUrl.origin,
    cleartext: parsedServerUrl.protocol === "http:",
    allowNavigation: allowedHosts,
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#12101a",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#1a1524",
    },
  },
};

export default config;
