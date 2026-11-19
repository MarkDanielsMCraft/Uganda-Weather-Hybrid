"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { GlassSelect } from "@/components/glass/GlassSelect";
import { useTranslation } from "@/lib/i18n";
import type { LugandaFeedbackCategory } from "@/lib/validation/schemas";
import { usePreferencesStore } from "@/stores/preferencesStore";

const CATEGORIES: readonly LugandaFeedbackCategory[] = [
  "translation",
  "grammar",
  "layout",
  "other",
];

const GLASS_INPUT_CLASS =
  "w-full rounded-[12px] border border-white/15 bg-white/[0.07] px-3.5 py-2.5 text-[16px] sm:text-[14px] text-white placeholder:text-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition focus:border-white/35 focus:bg-white/[0.11] focus:outline-none";

const GLASS_INPUT_ERROR_CLASS =
  "border-[#ff453a]/85 ring-1 ring-[#ff453a]/35 focus:border-[#ff453a]";

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions,
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormStatus = "idle" | "submitting" | "sent" | "failed";
type ValidationField = "details" | "email" | "turnstile";

function InlineFieldError({ id, message }: { id: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium leading-snug text-[#ff6961]"
    >
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </p>
  );
}

/** Lucide `CircleCheckBig` icon with zero background fill. */
function LucideCheckCircle({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

/** Lucide `CircleX` icon with zero background fill. */
function LucideXCircle({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

/** Lucide `LoaderCircle` icon with zero background fill. */
function LucideLoaderCircle({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function LugandaFeedbackForm() {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const districtSlug = usePreferencesStore((s) => s.districtSlug);
  const idPrefix = useId();

  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

  const [category, setCategory] =
    useState<LugandaFeedbackCategory>("translation");
  const [currentText, setCurrentText] = useState("");
  const [suggestedText, setSuggestedText] = useState("");
  const [details, setDetails] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [validationError, setValidationError] = useState<{
    field: ValidationField;
    message: string;
  } | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const detailsInputRef = useRef<HTMLTextAreaElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const detailsSectionRef = useRef<HTMLDetailsElement | null>(null);
  const isFormVisible = status === "idle";

  useEffect(() => {
    if (!turnstileSiteKey || !isFormVisible) {
      return;
    }
    if (typeof window === "undefined") return;

    let cancelled = false;

    function mountWidget() {
      if (cancelled || !turnstileContainerRef.current || !window.turnstile) {
        return;
      }
      if (turnstileWidgetIdRef.current) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {}
        turnstileWidgetIdRef.current = null;
      }

      turnstileWidgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          sitekey: turnstileSiteKey,
          theme: "dark",
          size: "flexible",
          callback: (token: string) => {
            if (!cancelled) {
              setTurnstileToken(token);
              setValidationError(null);
            }
          },
          "expired-callback": () => {
            if (!cancelled) setTurnstileToken("");
          },
          "error-callback": () => {
            if (!cancelled) setTurnstileToken("");
          },
        },
      );
    }

    if (window.turnstile) {
      mountWidget();
    } else {
      let script = document.getElementById(
        TURNSTILE_SCRIPT_ID,
      ) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", mountWidget);
      return () => {
        cancelled = true;
        script?.removeEventListener("load", mountWidget);
        if (turnstileWidgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(turnstileWidgetIdRef.current);
          } catch {}
          turnstileWidgetIdRef.current = null;
        }
      };
    }

    return () => {
      cancelled = true;
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {}
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [turnstileSiteKey, isFormVisible]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDetails = details.trim();
    if (trimmedDetails.length < 5) {
      setValidationError({
        field: "details",
        message: dict.lugandaBeta.errorValidation,
      });
      detailsInputRef.current?.focus();
      return;
    }

    const trimmedEmail = contactEmail.trim();
    if (trimmedEmail.length > 0 && !EMAIL_PATTERN.test(trimmedEmail)) {
      if (detailsSectionRef.current) {
        detailsSectionRef.current.open = true;
      }
      setValidationError({
        field: "email",
        message: dict.lugandaBeta.errorEmail,
      });
      emailInputRef.current?.focus();
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      setValidationError({
        field: "turnstile",
        message: dict.lugandaBeta.errorTurnstile,
      });
      return;
    }

    setValidationError(null);
    setFailureReason(null);
    setStatus("submitting");

    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "/";
    const pageOrSection = districtSlug
      ? `${pathname} (${districtSlug})`
      : pathname;

    try {
      const response = await fetch("/api/v1/feedback/luganda", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          currentText: currentText.trim(),
          suggestedText: suggestedText.trim(),
          details: trimmedDetails,
          pageOrSection,
          contactEmail: contactEmail.trim(),
          turnstileToken: turnstileToken || undefined,
          website,
        }),
      });

      if (!response.ok) {
        setFailureReason(dict.lugandaBeta.failedBody);
        setStatus("failed");
        return;
      }

      setStatus("sent");
    } catch {
      setFailureReason(dict.lugandaBeta.failedBody);
      setStatus("failed");
    }
  }

  function handleResetNew() {
    setCategory("translation");
    setCurrentText("");
    setSuggestedText("");
    setDetails("");
    setContactEmail("");
    setWebsite("");
    setTurnstileToken("");
    setValidationError(null);
    setFailureReason(null);
    setStatus("idle");
  }

  function handleRetryAfterFailure() {
    setTurnstileToken("");
    setFailureReason(null);
    setValidationError(null);
    setStatus("idle");
  }

  if (status === "submitting") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center py-6 text-center"
        data-testid="feedback-state-submitting"
      >
        <LucideLoaderCircle className="h-11 w-11 shrink-0 animate-spin text-[var(--color-brand-green)]" />
        <p className="mt-3 text-[17px] font-semibold text-white">
          {dict.lugandaBeta.submittingButton}
        </p>
        <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-white/75">
          {isLuganda
            ? "Linda katono nga tuweereza obubaka bwo."
            : "Please wait while we deliver your report."}
        </p>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div
        className="flex flex-col items-center py-4 text-center"
        data-testid="feedback-state-sent"
      >
        <LucideCheckCircle className="h-11 w-11 shrink-0 text-[var(--color-brand-green)]" />
        <p className="mt-3 text-[17px] font-semibold text-white">
          {dict.lugandaBeta.successTitle}
        </p>
        <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-white/80">
          {dict.lugandaBeta.successBody}
        </p>
        <button
          type="button"
          onClick={handleResetNew}
          className="mt-5 min-h-[44px] w-full rounded-full bg-brand-green/65 px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-brand-green/80 active:scale-[0.99] motion-reduce:transition-none"
        >
          {dict.lugandaBeta.sendAnotherButton}
        </button>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div
        role="alert"
        className="flex flex-col items-center py-4 text-center"
        data-testid="feedback-state-failed"
      >
        <LucideXCircle className="h-11 w-11 shrink-0 text-[#ef4444]" />
        <p className="mt-3 text-[17px] font-semibold text-white">
          {dict.lugandaBeta.failedTitle}
        </p>
        <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-white/80">
          {failureReason ?? dict.lugandaBeta.failedBody}
        </p>
        <button
          type="button"
          onClick={handleRetryAfterFailure}
          className="mt-5 min-h-[44px] w-full rounded-full bg-brand-green/65 px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-brand-green/80 active:scale-[0.99] motion-reduce:transition-none"
        >
          {dict.lugandaBeta.tryAgainButton}
        </button>
      </div>
    );
  }

  const optionalSummary = isLuganda
    ? "Ebirala eby'okwongerako (si kya tteeka)"
    : "Additional details and email (optional)";

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3.5"
      noValidate
    >
      <p className="text-[14px] leading-relaxed text-white/80">
        {dict.lugandaBeta.formIntro}
      </p>

      <div>
        <label
          id={`${idPrefix}-category-label`}
          htmlFor={`${idPrefix}-category`}
          className="mb-1.5 block text-[13px] font-medium text-white/85"
        >
          {dict.lugandaBeta.categoryLabel}
        </label>
        <GlassSelect
          id={`${idPrefix}-category`}
          ariaLabelledBy={`${idPrefix}-category-label`}
          value={category}
          onChange={setCategory}
          triggerClassName={GLASS_INPUT_CLASS}
          options={CATEGORIES.map((item) => ({
            value: item,
            label: dict.lugandaBeta.categories[item],
          }))}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center">
          <label
            htmlFor={`${idPrefix}-details`}
            className="text-[13px] font-medium text-white/85"
          >
            {dict.lugandaBeta.detailsLabel}
          </label>
          <span aria-hidden="true" className="ml-1 text-[13px] font-semibold text-[#ff453a]">
            *
          </span>
        </div>
        <textarea
          ref={detailsInputRef}
          id={`${idPrefix}-details`}
          rows={3}
          required
          aria-required="true"
          aria-invalid={validationError?.field === "details"}
          aria-describedby={
            validationError?.field === "details"
              ? `${idPrefix}-details-error`
              : undefined
          }
          minLength={5}
          maxLength={2000}
          value={details}
          onChange={(e) => {
            setDetails(e.target.value);
            if (validationError?.field === "details") setValidationError(null);
          }}
          placeholder={dict.lugandaBeta.detailsPlaceholder}
          className={`${GLASS_INPUT_CLASS} resize-y ${
            validationError?.field === "details" ? GLASS_INPUT_ERROR_CLASS : ""
          }`}
        />
        {validationError?.field === "details" && (
          <InlineFieldError
            id={`${idPrefix}-details-error`}
            message={validationError.message}
          />
        )}
      </div>

      <details
        ref={detailsSectionRef}
        className="group rounded-[12px] border border-white/12 bg-white/[0.04] px-3.5 py-1.5"
      >
        <summary className="flex min-h-[40px] cursor-pointer list-none items-center justify-between text-[13px] font-medium text-white/80">
          <span>{optionalSummary}</span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="h-4 w-4 text-white/55 transition-transform group-open:rotate-180"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </summary>

        <div className="mt-3 space-y-3">
          <div>
            <label
              htmlFor={`${idPrefix}-current`}
              className="mb-1 block text-[12.5px] font-medium text-white/75"
            >
              {dict.lugandaBeta.currentTextLabel}
            </label>
            <input
              id={`${idPrefix}-current`}
              type="text"
              maxLength={300}
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              placeholder={dict.lugandaBeta.currentTextPlaceholder}
              className={GLASS_INPUT_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-suggested`}
              className="mb-1 block text-[12.5px] font-medium text-white/75"
            >
              {dict.lugandaBeta.suggestedTextLabel}
            </label>
            <input
              id={`${idPrefix}-suggested`}
              type="text"
              maxLength={300}
              value={suggestedText}
              onChange={(e) => setSuggestedText(e.target.value)}
              placeholder={dict.lugandaBeta.suggestedTextPlaceholder}
              className={GLASS_INPUT_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-email`}
              className="mb-1 block text-[12.5px] font-medium text-white/75"
            >
              {dict.lugandaBeta.contactEmailLabel}
            </label>
            <input
              ref={emailInputRef}
              id={`${idPrefix}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              aria-invalid={validationError?.field === "email"}
              aria-describedby={
                validationError?.field === "email"
                  ? `${idPrefix}-email-error`
                  : undefined
              }
              maxLength={160}
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                if (validationError?.field === "email") setValidationError(null);
              }}
              placeholder={dict.lugandaBeta.contactEmailPlaceholder}
              className={`${GLASS_INPUT_CLASS} ${
                validationError?.field === "email" ? GLASS_INPUT_ERROR_CLASS : ""
              }`}
            />
            {validationError?.field === "email" && (
              <InlineFieldError
                id={`${idPrefix}-email-error`}
                message={validationError.message}
              />
            )}
          </div>
        </div>
      </details>

      {/* Honeypot field hidden from human users */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`${idPrefix}-website`}>Website</label>
        <input
          id={`${idPrefix}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {turnstileSiteKey && (
        <div className="w-full max-w-full overflow-hidden pt-1">
          <div
            ref={turnstileContainerRef}
            data-testid="turnstile-widget-container"
            className="w-full"
          />
          {validationError?.field === "turnstile" && (
            <InlineFieldError
              id={`${idPrefix}-turnstile-error`}
              message={validationError.message}
            />
          )}
        </div>
      )}

      <button
        type="submit"
        className="min-h-[44px] w-full rounded-full bg-brand-green/65 px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-brand-green/80 active:scale-[0.99] motion-reduce:transition-none sm:text-[14px]"
      >
        {dict.lugandaBeta.submitButton}
      </button>
    </form>
  );
}
