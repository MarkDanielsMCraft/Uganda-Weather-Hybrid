"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { QueryClientContext } from "@tanstack/react-query";
import { useOptionalDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { getDistrictBySlug } from "@/lib/districts";
import { useAppReady } from "@/hooks/useAppReady";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { loadWeatherCache } from "@/lib/offline/weather-cache";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { localizeDistrictName, useTranslation } from "@/lib/i18n";
import { warmFirebaseAiClient } from "@/lib/ai/firebase-client";
import {
  fetchVoiceCapabilities,
  isVoiceOutputSupported,
  prefetchVoiceClip,
  primeVoicePlaybackForGesture,
  speakAdvisorReply,
  stopVoiceOutput,
  type VoiceServerCapabilities,
} from "@/lib/ai/advisor-voice";
import {
  buildSectionNarration,
  buildSheetNarration,
  selectSpokenPayload,
} from "@/lib/voice/narrator";

// Module-level guard so even if desktop TopBar and mobile MobileHeader both
// mount WeatherListenButton, only one instance can ever auto-narrate a section.
let lastGlobalAutoNarratedKey = "";

export function resetWeatherListenAutoNarrateForTests(): void {
  lastGlobalAutoNarratedKey = "";
}

function parseDistrictSlugFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = /^\/(?:lg\/)?district\/([^/?#]+)/.exec(pathname);
  if (!match?.[1]) return null;
  try {
    const decoded = decodeURIComponent(match[1]).trim().toLowerCase();
    return getDistrictBySlug(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export interface WeatherListenButtonProps {
  compact?: boolean;
  tileIdOverride?: string | null;
  spokenTextOverride?: string | null;
  getLiveSpokenText?: () => string;
  autoNarrateOnSheetChange?: boolean;
  testId?: string;
}

function WeatherListenButtonWithQuery(props: WeatherListenButtonProps) {
  const pathname = usePathname();
  const storeDistrictSlug = usePreferencesStore((state) => state.districtSlug);
  const storeActivePlace = usePreferencesStore((state) => state.activePlace);
  const routeDistrictSlug = parseDistrictSlugFromPathname(pathname);
  const effectiveDistrictSlug = routeDistrictSlug ?? storeDistrictSlug;
  const effectivePlace = routeDistrictSlug ? null : storeActivePlace;
  const ready = useAppReady();
  const { data } = useWeatherBundle(effectiveDistrictSlug, ready, effectivePlace);
  return <WeatherListenButtonInner {...props} weather={data?.data ?? null} />;
}

export function WeatherListenButton(props: WeatherListenButtonProps) {
  const pathname = usePathname();
  const queryClient = useContext(QueryClientContext);
  const storeDistrictSlug = usePreferencesStore((state) => state.districtSlug);
  const storeActivePlace = usePreferencesStore((state) => state.activePlace);
  if (!queryClient) {
    const routeDistrictSlug = parseDistrictSlugFromPathname(pathname);
    const effectiveDistrictSlug = routeDistrictSlug ?? storeDistrictSlug;
    const effectivePlace = routeDistrictSlug ? null : storeActivePlace;
    const cached = loadWeatherCache(effectivePlace?.key ?? effectiveDistrictSlug)?.data ?? null;
    return <WeatherListenButtonInner {...props} weather={cached} />;
  }
  return <WeatherListenButtonWithQuery {...props} />;
}

function WeatherListenButtonInner({
  compact = false,
  tileIdOverride,
  spokenTextOverride,
  getLiveSpokenText,
  autoNarrateOnSheetChange = false,
  testId = "weather-listen-toggle",
  weather,
}: WeatherListenButtonProps & {
  weather: import("@/types/weather").WeatherBundle | null;
}) {
  const { dict, uiLanguage } = useTranslation();
  const pathname = usePathname();
  const detailSheet = useOptionalDetailSheet();
  const [districtModalOpen, setDistrictModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDistrictModalOpen(document.documentElement.dataset.districtModalOpen === "1");
    const handleDistrictModal = (event: Event) => {
      setDistrictModalOpen(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener("uw:district-modal-open", handleDistrictModal);
    return () => window.removeEventListener("uw:district-modal-open", handleDistrictModal);
  }, []);

  const isHomeOrDistrictRoute =
    !pathname ||
    pathname === "/" ||
    pathname === "/lg" ||
    /^\/(?:lg\/)?district(?:\/|$)/.test(pathname);

  const activeTileId =
    tileIdOverride !== undefined
      ? tileIdOverride
      : detailSheet?.sheet
        ? `${detailSheet.sheet.tileId} ${detailSheet.sheet.title}`
        : districtModalOpen
          ? "about-district"
          : !isHomeOrDistrictRoute
            ? pathname
            : null;

  const storeDistrictSlug = usePreferencesStore((state) => state.districtSlug);
  const storeActivePlace = usePreferencesStore((state) => state.activePlace);
  const routeDistrictSlug = parseDistrictSlugFromPathname(pathname);
  const districtSlug = routeDistrictSlug ?? storeDistrictSlug;
  const activePlace = routeDistrictSlug ? null : storeActivePlace;
  const voiceMode = usePreferencesStore((state) => state.voiceMode);
  const setVoiceMode = usePreferencesStore((state) => state.setVoiceMode);
  const district = getDistrictBySlug(districtSlug);

  const [serverCapabilities, setServerCapabilities] = useState<VoiceServerCapabilities>({
    lugandaTts: false,
    lugandaStt: false,
    englishNeuralTts: false,
  });
  const [voiceReady, setVoiceReady] = useState(false);
  const [playbackState, setPlaybackState] = useState<"idle" | "loading" | "playing">("idle");
  const isSpeaking = playbackState !== "idle";
  const isSpeakingRef = useRef(false);
  isSpeakingRef.current = isSpeaking;
  const lastAutoNarratedKeyRef = useRef<string | null>(null);
  const prevContextKeyRef = useRef<string | null>(null);

  const sectionNarration = activeTileId
    ? buildSectionNarration(activeTileId, district ?? weather?.district ?? null)
    : null;
  const hasExplicitSpokenText =
    typeof spokenTextOverride === "string" && spokenTextOverride.trim().length > 0;
  const hasNarrationSource = Boolean(
    weather || sectionNarration || hasExplicitSpokenText || spokenTextOverride === null,
  );

  useEffect(() => {
    if (!hasNarrationSource) return;
    if (uiLanguage === "en") {
      warmFirebaseAiClient();
    }
    let active = true;
    void fetchVoiceCapabilities().then((caps) => {
      if (active) setServerCapabilities(caps);
    });
    return () => {
      active = false;
    };
  }, [hasNarrationSource, uiLanguage]);

  useEffect(() => {
    const syncVoiceSupport = () => {
      setVoiceReady(isVoiceOutputSupported(uiLanguage, serverCapabilities));
    };
    syncVoiceSupport();

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener?.("voiceschanged", syncVoiceSupport);
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.removeEventListener?.("voiceschanged", syncVoiceSupport);
      }
    };
  }, [uiLanguage, serverCapabilities]);

  useEffect(() => {
    const contextKey = `${uiLanguage}:${districtSlug}:${activePlace?.key ?? ""}:${activeTileId ?? ""}`;
    if (prevContextKeyRef.current !== null && prevContextKeyRef.current !== contextKey) {
      if (isSpeakingRef.current) {
        stopVoiceOutput();
      }
      setPlaybackState("idle");
    }
    prevContextKeyRef.current = contextKey;
  }, [uiLanguage, districtSlug, activePlace?.key, activeTileId]);

  useEffect(() => {
    return () => {
      if (isSpeakingRef.current) {
        stopVoiceOutput();
      }
    };
  }, []);

  const displayName = weather
    ? localizeDistrictName(
        (activePlace && (dict.places.items[activePlace.key]?.name ?? activePlace.name)) ??
          district?.name ??
          weather.district.name,
        dict,
      )
    : district?.name ?? "";

  const fallbackPair = sectionNarration
    ? sectionNarration
    : weather
      ? buildSheetNarration(activeTileId, weather, displayName)
      : { en: "", lg: "" };
  const fallbackPayload = selectSpokenPayload(fallbackPair, uiLanguage);

  const resolveSpokenPayload = useCallback(() => {
    const liveDomText = getLiveSpokenText?.().trim() ?? "";
    if (liveDomText) {
      return { text: liveDomText, sourceLanguage: undefined as undefined };
    }
    if (typeof spokenTextOverride === "string" && spokenTextOverride.trim()) {
      return { text: spokenTextOverride.trim(), sourceLanguage: undefined as undefined };
    }
    return fallbackPayload;
  }, [fallbackPayload, getLiveSpokenText, spokenTextOverride]);

  const triggerSpeak = useCallback(() => {
    const payload = resolveSpokenPayload();
    if (!payload.text) return;
    setPlaybackState("loading");
    const started = speakAdvisorReply({
      text: payload.text,
      language: uiLanguage,
      sourceLanguage: payload.sourceLanguage,
      capabilities: serverCapabilities,
      onStateChange: (nextState) => setPlaybackState(nextState),
      onEnd: () => setPlaybackState("idle"),
      onError: () => setPlaybackState("idle"),
    });
    if (!started) {
      setPlaybackState("idle");
    }
  }, [resolveSpokenPayload, serverCapabilities, uiLanguage]);

  const autoNarrateKey = activeTileId
    ? `${uiLanguage}:${districtSlug}:${activePlace?.key ?? ""}:${activeTileId}`
    : "";

  useEffect(() => {
    if (!voiceMode || !activeTileId || !autoNarrateOnSheetChange) {
      if (
        lastAutoNarratedKeyRef.current &&
        lastGlobalAutoNarratedKey === lastAutoNarratedKeyRef.current
      ) {
        lastGlobalAutoNarratedKey = "";
      }
      lastAutoNarratedKeyRef.current = "";
      return;
    }
    if (!voiceReady || !hasNarrationSource || spokenTextOverride === null) {
      return;
    }
    if (
      lastAutoNarratedKeyRef.current === autoNarrateKey ||
      lastGlobalAutoNarratedKey === autoNarrateKey
    ) {
      return;
    }
    lastAutoNarratedKeyRef.current = autoNarrateKey;
    lastGlobalAutoNarratedKey = autoNarrateKey;
    triggerSpeak();
  }, [
    activeTileId,
    autoNarrateKey,
    autoNarrateOnSheetChange,
    hasNarrationSource,
    spokenTextOverride,
    triggerSpeak,
    voiceMode,
    voiceReady,
  ]);

  if (!voiceReady || !hasNarrationSource) return null;

  const handlePrefetch = () => {
    const payload = resolveSpokenPayload();
    if (!payload.text) return;
    prefetchVoiceClip({
      text: payload.text,
      language: uiLanguage,
      sourceLanguage: payload.sourceLanguage,
      capabilities: serverCapabilities,
    });
  };

  const handlePointerWarmup = () => {
    primeVoicePlaybackForGesture();
    if (uiLanguage === "en") {
      warmFirebaseAiClient();
    }
  };

  const handleToggle = () => {
    if (isSpeaking) {
      setVoiceMode(false);
      stopVoiceOutput();
      setPlaybackState("idle");
      return;
    }
    // Mark the current sheet/section as already narrated BEFORE enabling
    // `voiceMode` so the companion effect does not double-fire 1ms later and
    // self-abort the user-gesture audio session.
    if (autoNarrateKey) {
      lastAutoNarratedKeyRef.current = autoNarrateKey;
      lastGlobalAutoNarratedKey = autoNarrateKey;
    }
    setVoiceMode(true);
    triggerSpeak();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      onPointerDown={handlePointerWarmup}
      data-testid={testId}
      aria-pressed={isSpeaking}
      aria-label={
        isSpeaking
          ? dict.hybridAdvisor.stopListenReply
          : dict.hybridAdvisor.listenReply
      }
      title={
        isSpeaking
          ? dict.hybridAdvisor.stopListenReply
          : dict.hybridAdvisor.listenReply
      }
      className={`inline-flex shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.95] ${
        compact ? "h-9 w-9" : "h-9 w-9"
      } ${
        isSpeaking
          ? "border-white/25 bg-brand-green/75 text-white shadow-[0_6px_18px_rgba(13,144,59,0.35)]"
          : "border-white/15 bg-white/10 text-white/90 hover:border-white/25 hover:bg-white/[0.16]"
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={`h-3.5 w-3.5 ${playbackState === "loading" ? "animate-spin motion-reduce:animate-none" : ""}`}
        aria-hidden="true"
      >
        {playbackState === "loading" ? (
          <circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="16 8" />
        ) : playbackState === "playing" ? (
          <rect x="4" y="4" width="8" height="8" rx="1.5" />
        ) : (
          <path d="M8.5 3.2a.75.75 0 0 0-1.22-.58L4.3 5H2.75A1.25 1.25 0 0 0 1.5 6.25v3.5A1.25 1.25 0 0 0 2.75 11H4.3l2.98 2.38A.75.75 0 0 0 8.5 12.8V3.2Zm2.34 1.94a.75.75 0 0 1 1.06.03 4.25 4.25 0 0 1 0 5.66.75.75 0 1 1-1.09-1.03 2.75 2.75 0 0 0 0-3.6.75.75 0 0 1 .03-1.06Z" />
        )}
      </svg>
    </button>
  );
}
