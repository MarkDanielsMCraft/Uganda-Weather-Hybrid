# Project specific ProGuard / R8 rules for Uganda Weather

# Preserve line numbers and source file attributes for Sentry / crash stack traces
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*,JavascriptInterface,EnclosingMethod,InnerClasses,Signature

# Keep all Capacitor core framework and reflection classes
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# Keep all Capacitor plugins and plugin constructors
-keep public class * extends com.getcapacitor.Plugin {
    public <init>(...);
    public *;
}

-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Cordova plugin bridges
-keep class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin {
    public <init>(...);
    public *;
}

# Keep application native bridges and widgets
-keep class com.ugandaweather.app.MainActivity$* { *; }
-keep class com.ugandaweather.app.*Widget { *; }
-keep class com.ugandaweather.app.WidgetUtils { *; }

-dontwarn com.google.android.gms.**
