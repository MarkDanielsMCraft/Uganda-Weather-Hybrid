"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native/platform";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalInstallGuideOpen = false;
const promptListeners = new Set<() => void>();

function notifyPromptListeners() {
  promptListeners.forEach((listener) => listener());
}

export function openInstallGuide(): void {
  globalInstallGuideOpen = true;
  notifyPromptListeners();
}

export function closeInstallGuide(): void {
  globalInstallGuideOpen = false;
  notifyPromptListeners();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    globalDeferredPrompt = event as BeforeInstallPromptEvent;
    // When the browser dispatches beforeinstallprompt, the app is not installed
    // (or was recently uninstalled). Clear the cached flag so the button reappears.
    try {
      localStorage.removeItem("uw:pwa-installed");
    } catch {
      // Storage unavailable
    }
    notifyPromptListeners();
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    try {
      localStorage.setItem("uw:pwa-installed", "1");
    } catch {
      // Storage unavailable
    }
    notifyPromptListeners();
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone();
}

export function useInstallPrompt() {
  const [isNative, setIsNative] = useState(false);
  const [installed, setInstalled] = useState(false);

  const promptEvent = useSyncExternalStore(
    (onStoreChange) => {
      promptListeners.add(onStoreChange);
      return () => promptListeners.delete(onStoreChange);
    },
    () => globalDeferredPrompt,
    () => null,
  );

  const installGuideOpen = useSyncExternalStore(
    (onStoreChange) => {
      promptListeners.add(onStoreChange);
      return () => promptListeners.delete(onStoreChange);
    },
    () => globalInstallGuideOpen,
    () => false,
  );

  useEffect(() => {
    void isNativeApp().then(setIsNative);
    let isPwaStored = false;
    try {
      isPwaStored = localStorage.getItem("uw:pwa-installed") === "1";
    } catch {}

    if (isStandalone()) {
      setInstalled(true);
    } else if (promptEvent) {
      setInstalled(false);
    } else if (isPwaStored) {
      setInstalled(true);
    } else {
      setInstalled(false);
    }
  }, [promptEvent]);

  const canInstall = !isNative && !installed && (Boolean(promptEvent) || isIosSafari() || typeof window !== "undefined");

  return {
    canInstall,
    isInstalled: installed || isNative,
    promptEvent,
    installGuideOpen,
    openInstallGuide,
    closeInstallGuide,
    triggerInstall: async (onIosHint?: () => void) => {
      if (globalDeferredPrompt) {
        await globalDeferredPrompt.prompt();
        const choice = await globalDeferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          try {
            localStorage.setItem("uw:pwa-installed", "1");
          } catch {}
          setInstalled(true);
        }
      } else if (isIosSafari()) {
        if (onIosHint) {
          onIosHint();
        } else {
          openInstallGuide();
        }
      } else {
        openInstallGuide();
      }
    },
  };
}
