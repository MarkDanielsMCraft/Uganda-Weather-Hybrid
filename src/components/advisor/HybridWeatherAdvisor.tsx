"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  fetchReferencedLocationWeather,
  getDistrictQuickActions,
  getStatusMeta,
  type AdvisorMessage,
} from "@/components/advisor/advisor-helpers";
import { playAdvisorPopSound } from "@/components/advisor/advisor-sound";
import { GlassPanel } from "@/components/glass/GlassCard";
import {
  detectOnDeviceAvailability,
  generateHybridWeatherBriefing,
  isFirebaseAiConfigured,
  resolveHybridReadiness,
  resolveReferencedUgandaLocation,
  syncAdvisorRemoteConfig,
  type AdvisorAudience,
  type BriefingPhase,
  type HybridRuntimeReadiness,
  type OnDeviceModelAvailability,
  type WeatherBriefingError,
} from "@/lib/ai";
import { loadWeatherCache } from "@/lib/offline/weather-cache";
import { useTranslation } from "@/lib/i18n";
import { formatConditionLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

const POPUP_DISMISSED_KEY = "uw:advisor-popup-dismissed:v2";

const BRAND_GLASS_GREEN =
  "bg-brand-green/65 text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl";

export function HybridWeatherAdvisor({
  weather,
  districtName,
}: {
  weather: WeatherBundle | null;
  districtName?: string;
}) {
  const { dict, uiLanguage } = useTranslation();
  const copy = dict.hybridAdvisor;
  const questionInputId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [showRuntimeDetails, setShowRuntimeDetails] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [districtModalOpen, setDistrictModalOpen] = useState(false);
  const [audience, setAudience] = useState<AdvisorAudience>("general");
  const [question, setQuestion] = useState("");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [onDeviceAvailability, setOnDeviceAvailability] =
    useState<OnDeviceModelAvailability | null>(null);
  const [phase, setPhase] = useState<BriefingPhase | null>(null);
  const [thinkingStep, setThinkingStep] = useState<0 | 1 | 2>(0);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [error, setError] = useState<WeatherBriefingError | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const hasInteractedRef = useRef(false);
  const chimePlayedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const cloudConfigured = isFirebaseAiConfigured();
  const activeDistrictName = weather?.district.name ?? districtName ?? "Kampala";
  const activeDistrictSlug = weather?.district.slug ?? "";

  const refreshCapabilities = useCallback(async () => {
    const status = await detectOnDeviceAvailability();
    setOnDeviceAvailability(status);
  }, []);

  useEffect(() => {
    void refreshCapabilities();
    if (cloudConfigured) {
      void syncAdvisorRemoteConfig();
    }
  }, [refreshCapabilities, cloudConfigured]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      void refreshCapabilities();
    };
    const handleOffline = () => {
      setIsOnline(false);
      void refreshCapabilities();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshCapabilities]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isOpen) {
      hasInteractedRef.current = true;
      chimePlayedRef.current = true;
    }
    document.documentElement.dataset.advisorOpen = isOpen ? "1" : "0";
    window.dispatchEvent(new CustomEvent("uw:advisor-open", { detail: isOpen }));
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDistrictModalOpen(document.documentElement.dataset.districtModalOpen === "1");
    const handleDistrictModal = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      setDistrictModalOpen(Boolean(detail));
    };
    window.addEventListener("uw:district-modal-open", handleDistrictModal);
    return () => window.removeEventListener("uw:district-modal-open", handleDistrictModal);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(POPUP_DISMISSED_KEY) === "1") return;
    } catch {
      // Ignore storage restrictions
    }

    let cancelled = false;
    let soundPlayed = false;
    let cleanupInteraction: (() => void) | null = null;

    const timer = window.setTimeout(() => {
      if (cancelled || hasInteractedRef.current) return;
      try {
        if (sessionStorage.getItem(POPUP_DISMISSED_KEY) === "1") return;
      } catch {
        // Ignore storage restrictions
      }
      setShowPopup(true);
      void playAdvisorPopSound().then((played) => {
        if (cancelled) return;
        if (played) {
          chimePlayedRef.current = true;
          soundPlayed = true;
        }
        if (!soundPlayed) {
          const triggerOnce = () => {
            if (!chimePlayedRef.current && !cancelled) {
              chimePlayedRef.current = true;
              soundPlayed = true;
              void playAdvisorPopSound();
            }
            cleanupInteraction?.();
            cleanupInteraction = null;
          };
          window.addEventListener("pointerdown", triggerOnce, { once: true });
          window.addEventListener("keydown", triggerOnce, { once: true });
          cleanupInteraction = () => {
            window.removeEventListener("pointerdown", triggerOnce);
            window.removeEventListener("keydown", triggerOnce);
          };
        }
      });
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cleanupInteraction?.();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick, { passive: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!activeDistrictSlug) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setPhase(null);
  }, [activeDistrictSlug]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (phase !== "thinking") {
      setThinkingStep(0);
      return;
    }
    const t1 = window.setTimeout(() => setThinkingStep(1), 850);
    const t2 = window.setTimeout(() => setThinkingStep(2), 1750);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [phase]);

  useEffect(() => {
    if (isOpen && feedEndRef.current && typeof feedEndRef.current.scrollIntoView === "function") {
      feedEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isOpen, messages, phase]);

  const effectiveOnline = isOnline && !offlineOnly;

  const readiness: HybridRuntimeReadiness | "checking" =
    onDeviceAvailability === null
      ? "checking"
      : resolveHybridReadiness({
          isOnline: effectiveOnline,
          onDeviceAvailability,
          cloudConfigured,
        });

  const statusMeta = getStatusMeta(readiness, effectiveOnline, copy);
  const isBusy = phase !== null;
  const canSend =
    Boolean(weather) &&
    !isBusy &&
    (readiness === "on_device_ready" ||
      readiness === "cloud_ready" ||
      readiness === "offline_unavailable");

  const runBriefing = useCallback(
    async (promptText: string, targetAudience: AdvisorAudience) => {
      if (!weather || isBusy) return;
      if (
        readiness !== "on_device_ready" &&
        readiness !== "cloud_ready" &&
        readiness !== "offline_unavailable"
      ) {
        return;
      }

      abortRef.current?.abort();
      const seq = ++requestSeqRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      const userText = promptText.trim() || copy.quickQuestions[targetAudience];
      const userId = `u-${Date.now()}-${seq}`;
      const assistantId = `a-${Date.now()}-${seq}`;

      setError(null);
      setPhase("thinking");
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", text: userText },
        { id: assistantId, role: "assistant", text: "", streaming: true },
      ]);

      let effectiveWeather =
        !effectiveOnline && !weather.stale
          ? (loadWeatherCache(weather.district.slug)?.data ?? { ...weather, stale: true })
          : weather;

      let effectiveQuestion = userText;
      let spellingCorrection: { typed: string; resolvedName: string } | undefined;
      const referencedLocation = resolveReferencedUgandaLocation(userText);
      if (referencedLocation) {
        const currentSlug = weather.district.slug.toLowerCase();
        const currentName = weather.district.name.toLowerCase();
        const targetKey =
          referencedLocation.kind === "district"
            ? referencedLocation.slug.toLowerCase()
            : referencedLocation.key.toLowerCase();
        const isDifferentLocation =
          targetKey !== currentSlug &&
          referencedLocation.name.toLowerCase() !== currentName;

        if (isDifferentLocation) {
          const fetchedWeather = await fetchReferencedLocationWeather(
            referencedLocation,
            effectiveOnline,
            controller.signal,
          );
          if (fetchedWeather) {
            effectiveWeather = fetchedWeather;
          }
        }

        if (referencedLocation.matchedBySpellingCorrection && referencedLocation.typedTerm) {
          spellingCorrection = {
            typed: referencedLocation.typedTerm,
            resolvedName: referencedLocation.name,
          };
        }

        if (referencedLocation.isBareLocationQuery) {
          effectiveQuestion =
            uiLanguage === "lg"
              ? `Embeera y'obudde e ${referencedLocation.name} eri etya leero?`
              : `What is the weather and safety summary for ${referencedLocation.name} today?`;
        }
      }

      const historyTurns = messages
        .filter((msg) => !msg.streaming && msg.text.trim().length > 0)
        .slice(-8)
        .map((msg) => ({ role: msg.role, text: msg.text }));

      const outcome = await generateHybridWeatherBriefing({
        weather: effectiveWeather,
        audience: targetAudience,
        language: uiLanguage,
        customQuestion: effectiveQuestion,
        history: historyTurns,
        spellingCorrection,
        isOnline: effectiveOnline,
        signal: controller.signal,
        onPhaseChange: (nextPhase) => {
          if (!controller.signal.aborted && seq === requestSeqRef.current) {
            setPhase(nextPhase);
          }
        },
        onChunk: (accumulated) => {
          if (!controller.signal.aborted && seq === requestSeqRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, text: accumulated, streaming: true } : msg,
              ),
            );
          }
        },
      });

      if (controller.signal.aborted || seq !== requestSeqRef.current) return;

      setPhase(null);

      if (outcome.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  text: outcome.data.text,
                  source: outcome.data.source,
                  model: outcome.data.model,
                  usedCachedWeather: outcome.data.usedCachedWeather,
                  streaming: false,
                }
              : msg,
          ),
        );
      } else {
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));
        if (outcome.error.code !== "aborted") {
          setError(outcome.error);
        }
      }
    },
    [copy.quickQuestions, effectiveOnline, isBusy, messages, readiness, uiLanguage, weather],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;
    const nextQuestion = question;
    setQuestion("");
    void runBriefing(nextQuestion, audience);
  };

  const handleQuickPrompt = (targetAudience: AdvisorAudience, promptText: string) => {
    setAudience(targetAudience);
    if (canSend) {
      void runBriefing(promptText, targetAudience);
    }
  };

  const handleStop = () => {
    if (phase === null && !abortRef.current) return;
    requestSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase(null);
    setMessages((prev) =>
      prev
        .map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg))
        .filter((msg) => msg.role === "user" || msg.text.length > 0),
    );
  };

  const hidePopupTemporarily = () => {
    setShowPopup(false);
  };

  const dismissPopup = () => {
    setShowPopup(false);
    try {
      sessionStorage.setItem(POPUP_DISMISSED_KEY, "1");
    } catch {
      // Ignore storage restrictions
    }
  };

  const handleResetChat = () => {
    requestSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setPhase(null);
  };

  const thinkingLabel =
    thinkingStep === 0
      ? copy.stepReading.replace("{district}", activeDistrictName)
      : thinkingStep === 1
        ? copy.stepChecking
        : copy.stepDrafting;

  const hasCachedForecast = Boolean(
    activeDistrictSlug && loadWeatherCache(activeDistrictSlug)?.data,
  );

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] z-[55] flex flex-col items-end gap-1.5 sm:bottom-6 sm:right-6 ${
        districtModalOpen && !isOpen ? "hidden" : ""
      }`}
    >
      {isOpen && (
        <GlassPanel
          className="flex h-[min(620px,calc(100dvh-116px))] w-[min(430px,calc(100vw-24px))] flex-col"
        >
          {/* Minimal top bar */}
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
            <div className="flex min-w-0 items-center gap-2 text-[12px]">
              <button
                type="button"
                aria-expanded={showRuntimeDetails}
                data-testid="advisor-runtime-badge"
                onClick={() => setShowRuntimeDetails((prev) => !prev)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 font-medium transition hover:bg-white/[0.14] ${statusMeta.textClass}`}
              >
                <span role="status" aria-live="polite">
                  {statusMeta.label}
                </span>
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                  className={`h-3 w-3 opacity-75 transition-transform duration-150 ${
                    showRuntimeDetails ? "rotate-180" : ""
                  }`}
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span aria-hidden="true" className="text-white/25">
                /
              </span>
              <span className="truncate text-white/60">{activeDistrictName}</span>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  aria-label={copy.newChatAria}
                  onClick={handleResetChat}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none"
                >
                  <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7">
                    <path d="M9 3.5v11M3.5 9h11" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                aria-label={copy.closeAria}
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {showRuntimeDetails && (
            <div
              data-testid="advisor-runtime-inspector"
              className="mx-4 mb-1.5 flex items-center justify-between gap-2 rounded-full bg-white/[0.05] px-2.5 py-1.5 text-[11px] text-white/75"
            >
              <div className="inline-flex items-center rounded-full bg-white/[0.06] p-0.5">
                <button
                  type="button"
                  aria-pressed={!offlineOnly}
                  onClick={() => setOfflineOnly(false)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    !offlineOnly
                      ? "bg-brand-green/65 text-white backdrop-blur-xl"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  {copy.modeOnline}
                </button>
                <button
                  type="button"
                  aria-pressed={offlineOnly}
                  onClick={() => setOfflineOnly(true)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    offlineOnly
                      ? "bg-brand-green/65 text-white backdrop-blur-xl"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  {copy.modeOffline}
                </button>
              </div>
              <span className="pr-1.5 text-white/75">
                {hasCachedForecast ? copy.forecastSaved : copy.forecastNotSaved}
              </span>
            </div>
          )}

          {/* Live weather context strip */}
          {weather && (
            <div className="flex items-center justify-between gap-2 px-4 pb-1 text-[12px] text-white/70">
              <span className="truncate">
                {Math.round(weather.temperature.celsius)}° ·{" "}
                {uiLanguage === "lg"
                  ? formatConditionLg(weather.condition.text, weather.isDay)
                  : weather.condition.text}
              </span>
              <span className="shrink-0 text-white/55">
                {Math.round(weather.precipitation.chance)}% · {Math.round(weather.wind.speedKph)} km/h
              </span>
            </div>
          )}

          {uiLanguage === "lg" && (
            <p className="px-4 pb-1.5 text-[11px] text-white/60">
              {dict.lugandaBeta.noticeTitle}
            </p>
          )}

          {/* Spacious empty state OR active chat stream */}
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-between overflow-y-auto px-5 pt-4 pb-3">
              <div className="my-auto flex flex-col items-center py-6 text-center">
                <h2 className="text-[23px] font-semibold leading-tight tracking-tight text-white">
                  {copy.greeting}
                </h2>
                {!weather && (
                  <p className="mt-2 text-[12px] text-white/50">{copy.loadingWeather}</p>
                )}
              </div>

              <div className="space-y-1.5 pt-2">
                {getDistrictQuickActions(weather, copy).map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    disabled={!canSend}
                    onClick={() => handleQuickPrompt(action.audience, action.prompt)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-left text-[13px] text-white/90 transition-colors hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                  >
                    <span>{action.prompt}</span>
                    <span className="shrink-0 text-[11px] text-white/45">
                      {action.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
              {messages.map((msg) => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div
                        className={`max-w-[82%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-[13px] leading-snug ${BRAND_GLASS_GREEN}`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    data-testid="advisor-briefing-result"
                    className="max-w-[92%] space-y-1.5"
                  >
                    {msg.streaming && !msg.text && (
                      <p
                        data-testid="advisor-phase-indicator"
                        className="text-[13px] font-medium text-white/75"
                      >
                        {thinkingLabel}
                      </p>
                    )}

                    {msg.text && (
                      <div className="space-y-2 text-[14px] leading-relaxed text-white/92">
                        {msg.text
                          .split(/\n+/)
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line, index) => (
                            <p key={index}>{line}</p>
                          ))}
                      </div>
                    )}

                    {msg.streaming && msg.text && (
                      <p
                        data-testid="advisor-phase-indicator"
                        className="pt-1 text-[12px] text-white/50"
                      >
                        {copy.phaseWriting}
                      </p>
                    )}

                    {!msg.streaming && msg.source && (
                      <div className="flex items-center gap-2 pt-1 text-[11px] text-white/50">
                        <span
                          data-testid="advisor-source-badge"
                          className={
                            msg.source === "on_device"
                              ? "font-medium text-[var(--color-brand-green)]"
                              : "font-medium text-white/70"
                          }
                        >
                          {msg.source === "on_device"
                            ? copy.sourceOnDevice
                            : copy.sourceCloud}
                        </span>
                        <span aria-hidden="true">/</span>
                        <span
                          className={
                            msg.usedCachedWeather
                              ? "text-white/65"
                              : "text-white/50"
                          }
                        >
                          {msg.usedCachedWeather ? copy.dataCached : copy.dataLive}
                        </span>
                        {msg.model && msg.model !== "local-guard" && (
                          <>
                            <span aria-hidden="true">/</span>
                            <span className="text-white/45">{msg.model}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {!isBusy &&
                messages.length > 0 &&
                messages[messages.length - 1]?.role === "assistant" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[copy.followUps.bestHours, copy.followUps.tonightRisk].map((followUp) => (
                      <button
                        key={followUp}
                        type="button"
                        disabled={!canSend}
                        onClick={() => handleQuickPrompt(audience, followUp)}
                        className="rounded-full border border-white/15 px-3.5 py-1.5 text-left text-[12px] text-white/80 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                      >
                        {followUp}
                      </button>
                    ))}
                  </div>
                )}

              {error && (
                <p
                  role="alert"
                  className="text-[12px] leading-snug text-white/85"
                >
                  {error.message}
                </p>
              )}

              <div ref={feedEndRef} />
            </div>
          )}

          {/* Unified bottom composer */}
          <div className="px-4 pt-2 pb-3">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1 pr-1.5 pl-3 focus-within:border-white/30"
            >
              <label htmlFor={questionInputId} className="sr-only">
                {copy.questionLabel}
              </label>
              <input
                id={questionInputId}
                type="text"
                value={question}
                maxLength={240}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={copy.questionPlaceholder}
                className="min-h-[40px] min-w-0 flex-1 bg-transparent px-1.5 text-[14px] text-white placeholder:text-white/45 focus:outline-none"
              />
              {isBusy ? (
                <button
                  key="advisor-stop"
                  type="button"
                  aria-label={copy.stopButton}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleStop();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleStop();
                  }}
                  className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:bg-brand-green/80 active:scale-[0.95] motion-reduce:transition-none ${BRAND_GLASS_GREEN}`}
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="pointer-events-none h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <rect x="4" y="4" width="8" height="8" rx="1.5" />
                  </svg>
                </button>
              ) : (
                <button
                  key="advisor-send"
                  type="submit"
                  aria-label={copy.sendButton}
                  disabled={!canSend}
                  className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:bg-brand-green/80 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${BRAND_GLASS_GREEN}`}
                >
                  <svg
                    viewBox="0 0 18 18"
                    fill="none"
                    className="pointer-events-none h-4 w-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M9 14V4M4.5 8.5L9 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </form>

            <p className="mt-2 text-center text-[11px] text-white/45">
              {copy.disclaimer}
            </p>
          </div>
        </GlassPanel>
      )}

      {/* Connected horizontal row: pop-up greeting docked beside the brand green glass launcher */}
      <div className="flex items-center gap-2">
        {!isOpen && showPopup && (
          <GlassPanel
            clip={false}
            className="relative flex max-w-[min(248px,calc(100vw-96px))] items-center gap-2 rounded-full px-4 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
          >
            <button
              type="button"
              onClick={() => {
                hidePopupTemporarily();
                setIsOpen(true);
              }}
              className="min-w-0 flex-1 text-left text-[12.5px] font-medium leading-snug text-white/92 transition-colors hover:text-white motion-reduce:transition-none"
            >
              {copy.teaserPrompt.replace("{district}", activeDistrictName)}
            </button>
            <button
              type="button"
              aria-label={copy.closeAria}
              onClick={dismissPopup}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-t border-r border-white/[0.14] bg-[rgba(14,20,34,0.88)]"
            />
          </GlassPanel>
        )}

        <button
          type="button"
          data-testid="advisor-launcher"
          aria-label={copy.title}
          aria-expanded={isOpen}
          onMouseEnter={() => {
            if (isOpen) return;
            if (
              typeof window.matchMedia === "function" &&
              !window.matchMedia("(hover: hover)").matches
            ) {
              return;
            }
            if (hoverTimerRef.current !== null) {
              window.clearTimeout(hoverTimerRef.current);
            }
            hoverTimerRef.current = window.setTimeout(() => {
              hidePopupTemporarily();
              setIsOpen(true);
              hoverTimerRef.current = null;
            }, 120);
          }}
          onMouseLeave={() => {
            if (hoverTimerRef.current !== null) {
              window.clearTimeout(hoverTimerRef.current);
              hoverTimerRef.current = null;
            }
          }}
          onClick={() => {
            if (hoverTimerRef.current !== null) {
              window.clearTimeout(hoverTimerRef.current);
              hoverTimerRef.current = null;
            }
            hidePopupTemporarily();
            setIsOpen((prev) => !prev);
          }}
          className={`inline-flex h-12 w-14 shrink-0 cursor-pointer items-center justify-center rounded-[18px] rounded-bl-[4px] transition hover:bg-brand-green/80 active:scale-95 focus-visible:outline-none motion-reduce:transition-none ${BRAND_GLASS_GREEN}`}
        >
          {isOpen ? (
            <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6 text-white" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          ) : (
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-white" />
              <span className="h-2 w-2 rounded-full bg-white" />
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
