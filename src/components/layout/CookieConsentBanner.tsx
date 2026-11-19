"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GlassPanel } from "@/components/glass/GlassCard";
import { CookiesContent, PrivacyContent } from "@/components/layout/LegalContent";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { isNativeApp, isNativeAppSync } from "@/lib/native/platform";
import { useTranslation } from "@/lib/i18n";

const STORAGE_KEY = "uw:cookie-consent";

export function CookieConsentBanner() {
  const { dict } = useTranslation();
  const [visible, setVisible] = useState(false);
  const groupId = useId();
  const privacyRef = useRef<HTMLButtonElement>(null);
  const cookiesRef = useRef<HTMLButtonElement>(null);
  const { openSheet } = useDetailSheet();
  const setAnalyticsConsent = usePreferencesStore((s) => s.setAnalyticsConsent);

  useEffect(() => {
    if (isNativeAppSync()) return;
    let cancelled = false;
    void isNativeApp().then((native) => {
      if (cancelled || native) return;
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {}
      setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  function acceptAll() {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {}
    setAnalyticsConsent(true);
    setVisible(false);
  }

  function essentialOnly() {
    try {
      localStorage.setItem(STORAGE_KEY, "essential-only");
    } catch {}
    setAnalyticsConsent(false);
    setVisible(false);
  }

  return (
    <GlassPanel className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-50 mx-auto max-w-lg px-4 py-4 shadow-2xl lg:bottom-6 lg:left-auto lg:right-6">
      <p className="text-[14px] leading-relaxed text-white/82">
        {dict.consent.cookieNoticeStart}{" "}
        <button
          type="button"
          ref={privacyRef}
          onClick={() =>
            openSheet({
              tileId: `${groupId}-privacy`,
              title: dict.legal.privacy,
              anchorEl: privacyRef.current,
              content: <PrivacyContent />,
            })
          }
          className="text-white underline underline-offset-2 hover:text-white/80"
        >
          {dict.legal.privacy}
        </button>{" "}
        {dict.consent.andWord}{" "}
        <button
          type="button"
          ref={cookiesRef}
          onClick={() =>
            openSheet({
              tileId: `${groupId}-cookies`,
              title: dict.legal.cookies,
              anchorEl: cookiesRef.current,
              content: <CookiesContent />,
            })
          }
          className="text-white underline underline-offset-2 hover:text-white/80"
        >
          {dict.legal.cookies}
        </button>
        {dict.consent.cookieNoticeEnd === "." ? "." : ` ${dict.consent.cookieNoticeEnd}`}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={essentialOnly}
          className="flex-1 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[15px] font-medium text-white/85 backdrop-blur-md transition hover:bg-white/10"
        >
          {dict.consent.essentialOnly}
        </button>
        <button
          type="button"
          onClick={acceptAll}
          className="flex-1 rounded-full border border-white/30 bg-white/[0.18] px-4 py-2.5 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-md transition hover:bg-white/[0.26]"
        >
          {dict.consent.acceptAll}
        </button>
      </div>
    </GlassPanel>
  );
}
