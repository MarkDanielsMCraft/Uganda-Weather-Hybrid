"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GlassPanel } from "@/components/glass/GlassCard";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { isNativeApp } from "@/lib/native/platform";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useTranslation } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone();
}

/** System Share glyph, drawn rather than described. "Tap Share" is only
    followable if you can see which of the bar's buttons is meant. */
function IconShare({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

/**
 * The install prompt, as a popup over the page rather than a card in it.
 *
 * It used to render inline in the scroll column, so it pushed the weather
 * down the screen to make room for itself. It also had no action at all on
 * On mobile web browsers without install prompts: the "Add to Home Screen" button is only rendered when the browser
 * hands over a `beforeinstallprompt` event, and some browsers never do, so what
 * a device got was a panel of text with a small cross. Tapping it did
 * nothing, because nothing was listening.
 *
 * Browsers without install prompts cannot be asked to install a site, so the fix is not to
 * wire the panel to an install call it cannot make. It is to stop the panel
 * reading as a button, show the two steps as steps, and draw the Share
 * glyph so "tap Share" points at something recognisable. Where the browser
 * does support installing, the button does the real thing.
 *
 * Deliberately no framer-motion here. This component mounts on every page,
 * so importing it would put an animation library back on the first-load
 * path that PR #17 took it off. A CSS transition is enough for a panel that
 * slides up once.
 */
export function PwaInstallBanner() {
  const { dict } = useTranslation();
  const { installGuideOpen, closeInstallGuide } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // Not read for its value, only as the signal that the cookie banner has
  // been answered and this prompt may take the corner.
  const analyticsConsent = usePreferencesStore((state) => state.analyticsConsent);

  const dismiss = useCallback(() => {
    setShown(false);
    setVisible(false);
    closeInstallGuide();
  }, [closeInstallGuide]);

  const handleInstalled = useCallback(() => {
    try {
      localStorage.setItem("uw:pwa-installed", "1");
    } catch {}
    dismiss();
  }, [dismiss]);

  useEffect(() => {
    if (installGuideOpen) {
      setVisible(true);
      setShown(true);
      if (isIosSafari()) {
        setIosHint(true);
      }
    }
  }, [installGuideOpen]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void isNativeApp().then((native) => {
      if (native || cancelled) return;
      if (isStandalone()) return;
      try {
        if (localStorage.getItem("uw:pwa-installed") === "1") return;
      } catch {}

      const onPrompt = (event: Event) => {
        event.preventDefault();
        setPromptEvent(event as BeforeInstallPromptEvent);
        // Only auto-show on mobile once cookie consent has been answered so
        // multiple bottom overlays never stack on first load.
        if (analyticsConsent !== null) {
          setVisible(true);
          setIosHint(false);
        }
      };

      window.addEventListener("beforeinstallprompt", onPrompt);

      const onInstalled = () => {
        handleInstalled();
      };
      window.addEventListener("appinstalled", onInstalled);

      const iosTimer = window.setTimeout(() => {
        if (isIosSafari() && analyticsConsent !== null) {
          setIosHint(true);
          setVisible(true);
        }
      }, 1500);

      cleanup = () => {
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
        window.clearTimeout(iosTimer);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [analyticsConsent, handleInstalled]);

  // One frame between mounting and animating, so the panel slides in from
  // below instead of appearing already in place.
  useEffect(() => {
    if (!visible) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, dismiss]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] ${
        installGuideOpen
          ? "flex items-end justify-center sm:items-center sm:p-4 bg-black/40 backdrop-blur-sm"
          : "lg:hidden"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={dict.consent.pwaTitle}
    >
      {/* Tap anywhere off the panel to dismiss. No dimming, matching the
          detail sheet: the page behind an overlay stays fully visible. */}
      <button
        type="button"
        aria-label={dict.consent.pwaDismiss}
        onClick={dismiss}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        className={`w-full max-w-md p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] transition-transform duration-300 ease-out ${
          installGuideOpen ? "relative z-10" : "absolute inset-x-0 bottom-0"
        } ${shown ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* `text-on-sky` for the same reason the detail sheet carries a text
            shadow: legibility on real glass comes from a shadow under the
            text, not from a more opaque panel. Without it the forecast rows
            behind this panel read straight through the copy. */}
        <GlassPanel
          className="text-on-sky px-4 py-4"
          // Denser than a tile. The shared panel tint is tuned for glass
          // sitting on the sky, and this lands on the forecast list, where
          // day names and temperatures read straight through the copy at
          // that opacity. Same hue as every other panel, carried further.
          style={{ background: "rgba(28,28,30,0.86)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-white">{dict.consent.pwaTitle}</p>
              <p className="mt-1 text-[13px] leading-snug text-white/55">
                {dict.consent.pwaSubtitle}
              </p>
            </div>
            <button
              type="button"
              aria-label={dict.consent.pwaDismiss}
              onClick={dismiss}
              className="shrink-0 text-[18px] leading-none text-white/40 hover:text-white/70"
            >
              ×
            </button>
          </div>

          {iosHint ? (
            <>
              <ol className="mt-3 space-y-2 text-[13px] leading-snug text-white/75">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] text-white/70">
                    1
                  </span>
                  <span className="flex items-center gap-1.5">
                    {dict.consent.pwaIosStep1Pre}
                    <IconShare className="h-4 w-4 text-white/85" />
                    {dict.consent.pwaIosStep1Post}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] text-white/70">
                    2
                  </span>
                  <span>{dict.consent.pwaIosStep2}</span>
                </li>
              </ol>
              {/* Safari cannot be asked to install, so this closes the panel
                  and marks installed when the user taps Got it. */}
              <button
                type="button"
                onClick={handleInstalled}
                className="mt-3 w-full rounded-[14px] border border-white/30 bg-white/[0.18] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.24)] backdrop-blur-xl transition hover:bg-white/[0.26]"
              >
                {dict.common.gotIt}
              </button>
            </>
          ) : promptEvent ? (
            <button
              type="button"
              data-pwa-trigger="true"
              disabled={installing}
              onClick={() => {
                setInstalling(true);
                void promptEvent
                  .prompt()
                  .then(() => promptEvent.userChoice)
                  .then((choice) => {
                    if (choice.outcome === "accepted") {
                      handleInstalled();
                    } else {
                      dismiss();
                    }
                  })
                  .finally(() => {
                    setInstalling(false);
                  });
              }}
              className="mt-3 w-full rounded-full bg-brand-green/65 px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-brand-green/80 disabled:opacity-60"
            >
              {installing ? dict.common.installing : dict.common.addToHomeScreen}
            </button>
          ) : (
            <>
              <ol className="mt-3 space-y-2 text-[13px] leading-snug text-white/75">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] text-white/70">
                    1
                  </span>
                  <span>{dict.consent.pwaStep1}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] text-white/70">
                    2
                  </span>
                  <span>{dict.consent.pwaStep2}</span>
                </li>
              </ol>
              <button
                type="button"
                onClick={dismiss}
                className="mt-3 w-full rounded-[14px] border border-white/30 bg-white/[0.18] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.24)] backdrop-blur-xl transition hover:bg-white/[0.26]"
              >
                {dict.common.gotIt}
              </button>
            </>
          )}
        </GlassPanel>
      </div>
    </div>,
    document.body,
  );
}
