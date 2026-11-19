"use client";

import { useEffect, useRef, useState } from "react";
import { LugandaFeedbackForm } from "@/components/feedback/LugandaFeedbackForm";
import { GlassPanel } from "@/components/glass/GlassCard";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { useTranslation } from "@/lib/i18n";

const DISMISS_STORAGE_KEY = "uw:lg-beta-notice-dismissed";

export function LugandaBetaBanner() {
  const { uiLanguage, dict } = useTranslation();
  const { openSheet } = useDetailSheet();
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const reportBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevLanguageRef = useRef(uiLanguage);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAdvisorOpen(document.documentElement.dataset.advisorOpen === "1");
    try {
      setDismissed(sessionStorage.getItem(DISMISS_STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    const handleAdvisorOpen = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      setAdvisorOpen(Boolean(detail));
    };
    window.addEventListener("uw:advisor-open", handleAdvisorOpen);
    return () => window.removeEventListener("uw:advisor-open", handleAdvisorOpen);
  }, []);

  useEffect(() => {
    // When a user actively turns on the Luganda version during their session,
    // surface the beta notice again even if they dismissed it earlier.
    if (prevLanguageRef.current !== "lg" && uiLanguage === "lg") {
      setDismissed(false);
      try {
        sessionStorage.removeItem(DISMISS_STORAGE_KEY);
      } catch {}
    }
    prevLanguageRef.current = uiLanguage;
  }, [uiLanguage]);

  useEffect(() => {
    if (!mounted || uiLanguage !== "lg" || dismissed) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDismissed(true);
        try {
          sessionStorage.setItem(DISMISS_STORAGE_KEY, "1");
        } catch {}
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mounted, uiLanguage, dismissed]);

  if (!mounted || uiLanguage !== "lg" || dismissed) {
    return null;
  }

  function handleDismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, "1");
    } catch {}
  }

  function handleOpenForm() {
    openSheet({
      tileId: "luganda-beta-feedback",
      title: dict.lugandaBeta.sheetTitle,
      anchorEl: bannerRef.current ?? reportBtnRef.current,
      content: <LugandaFeedbackForm />,
    });
  }

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-modal="false"
      aria-label={dict.lugandaBeta.noticeTitle}
      className={`mb-3 w-full xl:fixed xl:bottom-6 xl:left-6 xl:z-30 xl:mb-0 xl:w-[285px] ${
        advisorOpen ? "max-xl:hidden" : ""
      }`}
    >
      <GlassPanel className="text-on-sky px-3.5 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.48)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-snug text-white">
              {dict.lugandaBeta.noticeTitle}
            </p>
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/75">
              {dict.lugandaBeta.noticeBody}
            </p>
          </div>
          <button
            type="button"
            aria-label={dict.lugandaBeta.dismissAria}
            onClick={handleDismiss}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] leading-none text-white/60 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none"
          >
            ×
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-end">
          <button
            ref={reportBtnRef}
            type="button"
            onClick={handleOpenForm}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-brand-green/65 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-brand-green/80 active:scale-[0.98] motion-reduce:transition-none"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 text-white/90"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-4 3.5V5a1 1 0 0 1 1-1Z" />
            </svg>
            <span>{dict.lugandaBeta.reportButton}</span>
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
