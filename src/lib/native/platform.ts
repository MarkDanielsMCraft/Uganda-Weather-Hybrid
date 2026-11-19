export function isBrowser() {
  return typeof window !== "undefined";
}

export function isNativeAppSync(): boolean {
  if (!isBrowser()) return false;
  const win = window as unknown as {
    NativeSplash?: unknown;
    androidBridge?: unknown;
    webkit?: { messageHandlers?: { bridge?: unknown } };
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  return Boolean(
    win.NativeSplash ||
    win.androidBridge ||
    win.webkit?.messageHandlers?.bridge ||
    win.Capacitor?.isNativePlatform?.()
  );
}

export async function isNativeApp() {
  if (!isBrowser()) return false;
  if (isNativeAppSync()) return true;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function nativePlatform(): Promise<"ios" | "android" | "web"> {
  if (!isBrowser()) return "web";
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return "web";
    const platform = Capacitor.getPlatform();
    if (platform === "ios" || platform === "android") return platform;
    return "web";
  } catch {
    return "web";
  }
}
