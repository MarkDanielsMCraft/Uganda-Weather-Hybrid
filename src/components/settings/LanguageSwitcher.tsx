"use client";

import { useEffect, useRef, useState } from "react";
import { LugandaFeedbackForm } from "@/components/feedback/LugandaFeedbackForm";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { useTranslation } from "@/lib/i18n";

export function LanguageSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { uiLanguage, setUiLanguage, dict } = useTranslation();
  const { openSheet } = useDetailSheet();
  const reportBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  function handleOpenFeedback() {
    openSheet({
      tileId: "luganda-beta-feedback",
      title: dict.lugandaBeta.sheetTitle,
      anchorEl: reportBtnRef.current,
      content: <LugandaFeedbackForm />,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold leading-snug text-white/75">
          {dict.settings.language}
        </span>
        <div
          role="radiogroup"
          aria-label={dict.settings.language}
          className="inline-flex rounded-full border border-white/12 bg-white/[0.06] p-1 backdrop-blur-md"
        >
          <button
            type="button"
            role="radio"
            aria-checked={uiLanguage === "en"}
            onClick={() => setUiLanguage("en")}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              uiLanguage === "en"
                ? "bg-brand-green/65 text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl"
                : "text-white/70 hover:text-white"
            }`}
          >
            English
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={uiLanguage === "lg"}
            onClick={() => setUiLanguage("lg")}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              uiLanguage === "lg"
                ? "bg-brand-green/65 text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl"
                : "text-white/70 hover:text-white"
            }`}
          >
            Oluganda
          </button>
        </div>
      </div>
      <p className="text-[13px] leading-snug text-white/75">
        {uiLanguage === "lg"
          ? "Embeera y'obudde, amagezi ag'ebyobulimi, n'obukuumi bw'oku nnyanja mu Luganda."
          : "Weather forecast, agriculture advisories, and marine safety in English."}
      </p>
      {uiLanguage === "lg" && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pt-1.5">
          <span className="text-[12px] text-white/75">
            {dict.lugandaBeta.noticeTitle}
          </span>
          <button
            ref={reportBtnRef}
            type="button"
            onClick={handleOpenFeedback}
            className="rounded-full bg-brand-green/65 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-brand-green/80 active:scale-[0.98] motion-reduce:transition-none"
          >
            {dict.lugandaBeta.reportButton}
          </button>
        </div>
      )}
    </div>
  );
}
