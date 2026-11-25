"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  fetchReferencedLocationWeather,
  getCurrentOrNextHourRainChance,
  getDistrictQuickActions,
  getStatusMeta,
  resolveDynamicFollowUps,
  type AdvisorMessage,
} from "@/components/advisor/advisor-helpers";
import { playAdvisorPopSound } from "@/components/advisor/advisor-sound";
import { GlassPanel } from "@/components/glass/GlassCard";
import { useOptionalDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
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
import {
  compressImageForAdvisor,
  type AdvisorImageAttachment,
} from "@/lib/ai/advisor-image";
import { isMultiLocationQuery } from "@/lib/ai/advisor-tools";
import {
  buildSpokenAdvisorTurnText,
  fetchVoiceCapabilities,
  isHandsFreeCutInCommand,
  isVoiceInputSupported,
  isVoiceOutputSupported,
  primeVoicePlaybackForGesture,
  resolveHandsFreeVoiceCommand,
  isEchoOfSpokenReply,
  supportsHandsFreeVoice,
  speakAdvisorReply,
  startVoiceInput,
  stopVoiceOutput,
  type VoiceInputHandle,
  type VoiceServerCapabilities,
} from "@/lib/ai/advisor-voice";
import { loadWeatherCache } from "@/lib/offline/weather-cache";
import { useHideOnScrollDown } from "@/hooks/useHideOnScrollDown";
import { buildPlainTextAdvisorSms, buildSmsHref } from "@/lib/places/sms-share";
import { useTranslation } from "@/lib/i18n";
import { formatConditionLg } from "@/lib/weather/copy-lg";
import { usePreferencesStore } from "@/stores/preferencesStore";
import type { WeatherBundle } from "@/types/weather";

const POPUP_DISMISSED_KEY = "uw:advisor-popup-dismissed:v2";

const BRAND_GLASS_GREEN =
  "bg-brand-green/65 text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl";

const LISTENER_RESTART_DELAY_MS = 300;
const MAX_LISTENER_RESTARTS_PER_REPLY = 10;
const QUICK_LISTENER_END_MS = 1000;
const REPLY_ECHO_TAIL_MS = 600;

function tokenizeSpokenWords(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean);
}

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
  const voiceMode = usePreferencesStore((state) => state.voiceMode);
  const setVoiceMode = usePreferencesStore((state) => state.setVoiceMode);
  const { installGuideOpen } = useInstallPrompt();
  const detailSheet = useOptionalDetailSheet();
  const isDetailSheetOpen = Boolean(detailSheet?.sheet);

  const [isOpen, setIsOpen] = useState(false);
  // Steps the closed launcher out of the way while people scroll down to read.
  const { hidden: launcherHidden, reveal: revealLauncher } = useHideOnScrollDown(!isOpen);
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
  const [voiceInputState, setVoiceInputState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [attachedImage, setAttachedImage] = useState<AdvisorImageAttachment | null>(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const autoSpeakNextRef = useRef(false);
  const handsFreeSessionRef = useRef(false);
  const handsFreeTimerRef = useRef<number | null>(null);
  const latestFollowUpsRef = useRef<string[]>([]);
  const startVoiceSessionRef = useRef<
    ((options?: { duringReply?: string; autoHandsFree?: boolean }) => void) | null
  >(null);
  /** True while a hands free reply is playing. The listener runs at the same
      time, so the person can answer or interrupt without waiting. */
  const replyPlayingRef = useRef(false);
  /** Time when the spoken reply ended, so normal silence right after speech
      does not count as a failed listen. */
  const replyEndedAtRef = useRef(0);
  /** Number of the newest spoken reply, so stopping an older reply never runs
      its end callback. */
  const spokenReplySeqRef = useRef(0);
  /** True while an answer is being generated, updated right away without
      waiting for the next screen paint so voice listeners start reliably. */
  const isBusyRef = useRef(false);
  const isOpenRef = useRef(false);
  const cameraRequestSeqRef = useRef(0);
  const messagesRef = useRef<AdvisorMessage[]>([]);
  /** Restarts of the listener during one reply. A broken or busy microphone
      can end the listener instantly, so restarts are spaced out and capped. */
  const listenerRestartsRef = useRef(0);
  /** A real question heard while the reply played. It is asked as soon as
      the reply ends, so nothing the person says is lost. */
  const pendingQuestionRef = useRef<string | null>(null);
  const runBriefingRef = useRef<((prompt: string) => Promise<void>) | null>(null);
  /** Number of the newest listener. Callbacks from an older, replaced
      listener are ignored, so they can never restart the microphone. */
  const listenerSeqRef = useRef(0);
  /** Empty listens in a row during a hands free conversation. One retry is
      allowed, so a short word cut off by the listener restarting is asked
      for again instead of ending the conversation without a sign. */
  const emptyListenRetriesRef = useRef(0);
  const photoMenuRef = useRef<HTMLDivElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isListening = voiceInputState !== "idle";
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceServerCapabilities, setVoiceServerCapabilities] = useState<VoiceServerCapabilities>({
    lugandaTts: false,
    lugandaStt: false,
    englishNeuralTts: false,
  });
  const [voiceInputReady, setVoiceInputReady] = useState(false);
  const [voiceOutputReady, setVoiceOutputReady] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const voiceHandleRef = useRef<VoiceInputHandle | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const hasInteractedRef = useRef(false);
  const chimePlayedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const cloudConfigured = isFirebaseAiConfigured();
  const activeDistrictName = weather?.district.name ?? districtName ?? "Kampala";
  const activeDistrictSlug = weather?.district.slug ?? "";
  const prevLanguageRef = useRef(uiLanguage);
  const prevDistrictSlugRef = useRef(activeDistrictSlug);
  isOpenRef.current = isOpen;
  messagesRef.current = messages;

  const silenceActiveVoiceIO = useCallback(() => {
    listenerSeqRef.current += 1;
    spokenReplySeqRef.current += 1;
    if (handsFreeTimerRef.current !== null) {
      window.clearTimeout(handsFreeTimerRef.current);
      handsFreeTimerRef.current = null;
    }
    replyPlayingRef.current = false;
    replyEndedAtRef.current = 0;
    pendingQuestionRef.current = null;
    voiceHandleRef.current?.abort();
    voiceHandleRef.current = null;
    setVoiceInputState("idle");
    stopVoiceOutput();
    setSpeakingMessageId(null);
  }, []);

  const endVoiceConversation = useCallback(
    (disableVoiceMode: boolean) => {
      handsFreeSessionRef.current = false;
      autoSpeakNextRef.current = false;
      emptyListenRetriesRef.current = 0;
      silenceActiveVoiceIO();
      if (disableVoiceMode) {
        setVoiceMode(false);
      }
    },
    [setVoiceMode, silenceActiveVoiceIO],
  );

  const refreshCapabilities = useCallback(async () => {
    const status = await detectOnDeviceAvailability();
    setOnDeviceAvailability(status);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchVoiceCapabilities().then((caps) => {
      if (active) setVoiceServerCapabilities(caps);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncVoiceSupport = () => {
      setVoiceInputReady(isVoiceInputSupported(uiLanguage, voiceServerCapabilities));
      setVoiceOutputReady(isVoiceOutputSupported(uiLanguage, voiceServerCapabilities));
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
  }, [uiLanguage, voiceServerCapabilities]);

  useEffect(() => {
    if (prevLanguageRef.current === uiLanguage) return;
    prevLanguageRef.current = uiLanguage;
    // A language switch ends any voice conversation, so the mic never comes
    // back on by itself in the new language.
    endVoiceConversation(false);
  }, [endVoiceConversation, uiLanguage]);

  const stopLiveCamera = useCallback(() => {
    cameraRequestSeqRef.current += 1;
    if (cameraStreamRef.current) {
      for (const track of cameraStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      }
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLiveCameraOpen(false);
  }, []);

  const handleOpenLiveCamera = useCallback(async () => {
    setPhotoMenuOpen(false);
    // On mobile touch devices, the native OS camera app (<input capture="environment">)
    // provides hardware autofocus, flash, and GPS EXIF tagging. On desktop/laptops,
    // <input capture> opens the file picker, so we open a live getUserMedia viewfinder.
    const isMobileTouch =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isMobileTouch || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    const camSeq = ++cameraRequestSeqRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (camSeq !== cameraRequestSeqRef.current || !isOpenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setLiveCameraOpen(true);
      window.setTimeout(() => {
        if (videoRef.current && cameraStreamRef.current) {
          videoRef.current.srcObject = cameraStreamRef.current;
          void videoRef.current.play().catch(() => {});
        }
      }, 20);
    } catch {
      if (camSeq === cameraRequestSeqRef.current && isOpenRef.current) {
        cameraInputRef.current?.click();
      }
    }
  }, []);

  const handleCaptureLiveCameraFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      stopLiveCamera();
      return;
    }
    const maxDim = 768;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      stopLiveCamera();
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
    stopLiveCamera();
    if (!base64) return;
    setError(null);
    setAttachedImage({
      base64,
      mimeType: "image/jpeg",
      previewUrl: dataUrl,
      metadata: {
        capturedAtIso: new Date().toISOString(),
        timestampSource: "exif",
        ageMinutes: 0,
        isStale: false,
        location: weather?.district?.coordinates
          ? {
              lat: weather.district.coordinates.lat,
              lon: weather.district.coordinates.lon,
              withinUganda: true,
              nearestDistrictSlug: weather.district.slug,
              nearestDistrictName: weather.district.name,
              distanceToActiveKm: 0,
              matchesActiveDistrict: true,
            }
          : null,
      },
    });
  }, [stopLiveCamera, weather]);

  useEffect(() => {
    if (!isOpen) {
      endVoiceConversation(false);
      setPhotoMenuOpen(false);
      stopLiveCamera();
    } else if (detailSheet?.sheet) {
      detailSheet.closeSheet();
    }
  }, [detailSheet, endVoiceConversation, isOpen, stopLiveCamera]);

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
    let autoHideTimer: number | null = null;
    let cleanupScroll: (() => void) | null = null;

    const timer = window.setTimeout(() => {
      if (cancelled || hasInteractedRef.current) return;
      try {
        if (sessionStorage.getItem(POPUP_DISMISSED_KEY) === "1") return;
      } catch {
        // Ignore storage restrictions
      }
      setShowPopup(true);
      autoHideTimer = window.setTimeout(() => {
        autoHideTimer = null;
        setShowPopup(false);
      }, 9_000);
      const handleScrollHide = () => {
        setShowPopup(false);
      };
      window.addEventListener("scroll", handleScrollHide, { passive: true, capture: true });
      cleanupScroll = () => {
        window.removeEventListener("scroll", handleScrollHide, { capture: true });
      };
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
      if (autoHideTimer !== null) {
        window.clearTimeout(autoHideTimer);
      }
      cleanupScroll?.();
      cleanupInteraction?.();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (liveCameraOpen) {
          event.stopPropagation();
          stopLiveCamera();
          return;
        }
        if (photoMenuOpen) {
          event.stopPropagation();
          setPhotoMenuOpen(false);
          return;
        }
        setIsOpen(false);
      }
    };
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        photoMenuOpen &&
        photoMenuRef.current &&
        !photoMenuRef.current.contains(target)
      ) {
        setPhotoMenuOpen(false);
      }
      if (
        containerRef.current &&
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
  }, [isOpen, liveCameraOpen, photoMenuOpen, stopLiveCamera]);

  useEffect(() => {
    if (!activeDistrictSlug) return;
    if (!prevDistrictSlugRef.current) {
      prevDistrictSlugRef.current = activeDistrictSlug;
      return;
    }
    if (prevDistrictSlugRef.current === activeDistrictSlug) return;
    prevDistrictSlugRef.current = activeDistrictSlug;
    isBusyRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    // A new place ends the voice conversation: its suggestions no longer apply.
    endVoiceConversation(false);
    latestFollowUpsRef.current = [];
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setPhase(null);
    setPhotoMenuOpen(false);
    setAttachedImage(null);
    stopLiveCamera();
  }, [activeDistrictSlug, endVoiceConversation, stopLiveCamera]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
      if (handsFreeTimerRef.current !== null) {
        window.clearTimeout(handsFreeTimerRef.current);
        handsFreeTimerRef.current = null;
      }
      listenerSeqRef.current += 1;
      spokenReplySeqRef.current += 1;
      isBusyRef.current = false;
      handsFreeSessionRef.current = false;
      autoSpeakNextRef.current = false;
      replyPlayingRef.current = false;
      pendingQuestionRef.current = null;
      voiceHandleRef.current?.abort();
      voiceHandleRef.current = null;
      stopVoiceOutput();
      abortRef.current?.abort();
      stopLiveCamera();
    };
  }, [stopLiveCamera]);

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
  const canAskAdvisor =
    Boolean(weather) &&
    (readiness === "on_device_ready" ||
      readiness === "cloud_ready" ||
      readiness === "offline_unavailable");
  const canSend = canAskAdvisor && !isBusy;

  const runBriefing = useCallback(
    async (promptText: string, targetAudience: AdvisorAudience) => {
      if (!weather || isBusyRef.current) return;
      if (
        readiness !== "on_device_ready" &&
        readiness !== "cloud_ready" &&
        readiness !== "offline_unavailable"
      ) {
        return;
      }

      silenceActiveVoiceIO();
      abortRef.current?.abort();
      const seq = ++requestSeqRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      isBusyRef.current = true;

      const userText =
        promptText.trim() ||
        (attachedImage ? copy.photoDefaultPrompt : copy.quickQuestions[targetAudience]);
      const pendingImage = attachedImage;
      setAttachedImage(null);
      setPhotoMenuOpen(false);
      const userId = `u-${Date.now()}-${seq}`;
      const assistantId = `a-${Date.now()}-${seq}`;

      const priorHistory = messagesRef.current
        .filter((msg) => !msg.streaming && msg.text.trim().length > 0)
        .slice(-8)
        .map((msg) => ({ role: msg.role, text: msg.text }));

      setError(null);
      setPhase("thinking");
      const queuedMessages: AdvisorMessage[] = [
        ...messagesRef.current,
        {
          id: userId,
          role: "user",
          text: userText,
          imagePreviewUrl: pendingImage?.previewUrl,
        },
        { id: assistantId, role: "assistant", text: "", streaming: true },
      ];
      messagesRef.current = queuedMessages;
      setMessages(queuedMessages);

      let outcome: Awaited<ReturnType<typeof generateHybridWeatherBriefing>>;
      try {
        let effectiveWeather =
          !effectiveOnline && !weather.stale
            ? (loadWeatherCache(weather.district.slug)?.data ?? { ...weather, stale: true })
            : weather;

        let effectiveQuestion = userText;
        let spellingCorrection: { typed: string; resolvedName: string } | undefined;
        const referencedLocation = isMultiLocationQuery(userText)
          ? null
          : resolveReferencedUgandaLocation(userText);
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

        outcome = await generateHybridWeatherBriefing({
          weather: effectiveWeather,
          audience: targetAudience,
          language: uiLanguage,
          customQuestion: effectiveQuestion,
          history: priorHistory,
          spellingCorrection,
          image: pendingImage
            ? {
                base64: pendingImage.base64,
                mimeType: pendingImage.mimeType,
                metadata: pendingImage.metadata,
              }
            : undefined,
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
      } catch (err) {
        if (seq === requestSeqRef.current) {
          isBusyRef.current = false;
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
          setPhase(null);
        }
        throw err;
      }

      if (controller.signal.aborted || seq !== requestSeqRef.current) return;

      isBusyRef.current = false;
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setPhase(null);

      if (outcome.ok) {
        const completedMessages = messagesRef.current.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                text: outcome.data.text,
                source: outcome.data.source,
                model: outcome.data.model,
                usedCachedWeather: outcome.data.usedCachedWeather,
                verdict: outcome.data.verdict,
                followUps: outcome.data.followUps,
                streaming: false,
              }
            : msg,
        );
        messagesRef.current = completedMessages;
        const nextFollowUps = resolveDynamicFollowUps(completedMessages);
        latestFollowUpsRef.current = nextFollowUps;
        setMessages(completedMessages);
        if (!isOpenRef.current) {
          autoSpeakNextRef.current = false;
          handsFreeSessionRef.current = false;
        } else if (autoSpeakNextRef.current || voiceMode) {
          const shouldContinueHandsFree =
            handsFreeSessionRef.current && supportsHandsFreeVoice(uiLanguage);
          autoSpeakNextRef.current = false;
          if (voiceOutputReady && outcome.data.text) {
            const spokenTurnText = buildSpokenAdvisorTurnText(
              outcome.data.text,
              nextFollowUps,
              uiLanguage,
              shouldContinueHandsFree,
            );
            setSpeakingMessageId(assistantId);
            replyPlayingRef.current = shouldContinueHandsFree;
            replyEndedAtRef.current = 0;
            listenerRestartsRef.current = 0;
            pendingQuestionRef.current = null;
            const replySeq = ++spokenReplySeqRef.current;
            const started = speakAdvisorReply({
              text: spokenTurnText,
              language: uiLanguage,
              capabilities: voiceServerCapabilities,
              onEnd: () => {
                if (replySeq !== spokenReplySeqRef.current) return;
                replyPlayingRef.current = false;
                replyEndedAtRef.current = Date.now();
                setSpeakingMessageId((current) => (current === assistantId ? null : current));
                const heldQuestion = pendingQuestionRef.current;
                pendingQuestionRef.current = null;
                if (heldQuestion && handsFreeSessionRef.current) {
                  silenceActiveVoiceIO();
                  autoSpeakNextRef.current = true;
                  void runBriefingRef.current?.(heldQuestion);
                  return;
                }
                // The listener that ran during the reply simply keeps going.
                if (voiceHandleRef.current) return;
                if (shouldContinueHandsFree && handsFreeSessionRef.current) {
                  if (handsFreeTimerRef.current !== null) {
                    window.clearTimeout(handsFreeTimerRef.current);
                  }
                  handsFreeTimerRef.current = window.setTimeout(() => {
                    handsFreeTimerRef.current = null;
                    if (handsFreeSessionRef.current) {
                      startVoiceSessionRef.current?.({ autoHandsFree: true });
                    }
                  }, 350);
                }
              },
            });
            if (!started) {
              replyPlayingRef.current = false;
              handsFreeSessionRef.current = false;
              setSpeakingMessageId(null);
            } else if (shouldContinueHandsFree) {
              // Luganda is tap to talk; only English opens the mic during the reply.
              startVoiceSessionRef.current?.({ duringReply: spokenTurnText });
            }
          } else {
            handsFreeSessionRef.current = false;
          }
        }
      } else {
        autoSpeakNextRef.current = false;
        handsFreeSessionRef.current = false;
        setMessages((prev) => {
          const next = prev.filter((msg) => msg.id !== assistantId);
          messagesRef.current = next;
          return next;
        });
        if (outcome.error.code !== "aborted") {
          setError(outcome.error);
        }
      }
    },
    [
      attachedImage,
      copy.photoDefaultPrompt,
      copy.quickQuestions,
      effectiveOnline,
      readiness,
      silenceActiveVoiceIO,
      uiLanguage,
      voiceMode,
      voiceOutputReady,
      voiceServerCapabilities,
      weather,
    ],
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
    endVoiceConversation(true);
    if (!isBusyRef.current && phase === null && !abortRef.current) return;
    isBusyRef.current = false;
    requestSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase(null);
    setMessages((prev) => {
      const next = prev
        .map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg))
        .filter((msg) => msg.role === "user" || msg.text.length > 0);
      messagesRef.current = next;
      return next;
    });
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
    isBusyRef.current = false;
    requestSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    endVoiceConversation(true);
    latestFollowUpsRef.current = [];
    setPhotoMenuOpen(false);
    setAttachedImage(null);
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setPhase(null);
  };

  const startVoiceListeningSession = useCallback(
    (options?: { duringReply?: string; autoHandsFree?: boolean }) => {
      if (!canAskAdvisor || isBusyRef.current) return;
      const duringReply = options?.duringReply;
      // Set once the person really answers. Until then, while the reply plays,
      // only a choice ("one", "two", "2") or "stop" may cut in, so the app's own
      // voice coming back through the microphone can never start a question.
      let personSpoke = !duringReply;
      let heardAnything = false;
      let sawInterim = false;
      let utteranceStartedNearReply = false;
      let handledError = false;
      // Set when the speech service is unreachable during the reply: stop
      // quietly and listen normally once the reply ends.
      let pausedUntilReplyEnds = false;
      const startedAt = Date.now();
      const seq = ++listenerSeqRef.current;
      const isCurrent = () => seq === listenerSeqRef.current;
      const activeChoices = () =>
        latestFollowUpsRef.current.length > 0
          ? latestFollowUpsRef.current
          : getDistrictQuickActions(weather, copy, uiLanguage).map((a) => a.prompt);
      const isCutIn = (text: string) =>
        isHandsFreeCutInCommand(text, activeChoices());
      const matchesExactChoiceText = (text: string) => {
        const normalized = text.replace(/[!?.:,;]+$/g, "").trim().toLowerCase();
        if (!normalized) return false;
        return activeChoices().some(
          (choice) => choice.replace(/[!?.:,;]+$/g, "").trim().toLowerCase() === normalized,
        );
      };
      const inReplySilenceGrace = () =>
        replyPlayingRef.current ||
        (replyEndedAtRef.current > 0 && Date.now() - replyEndedAtRef.current < REPLY_ECHO_TAIL_MS);
      /** True when heard text should be ignored as the app's own voice. */
      const ignoreWhileReplying = (text: string) => {
        if (!duringReply || personSpoke) return false;
        if (replyPlayingRef.current) return !isCutIn(text);
        if (isCutIn(text) || matchesExactChoiceText(text)) return false;
        const couldBeReplyEcho = sawInterim
          ? utteranceStartedNearReply
          : replyEndedAtRef.current > 0 && Date.now() - replyEndedAtRef.current < 1800;
        if (!couldBeReplyEcho) return false;
        return !text.trim() || isEchoOfSpokenReply(text, duringReply);
      };
      const takeTurn = () => {
        if (personSpoke) return;
        personSpoke = true;
        // The person has answered now, so an earlier held question is dropped.
        pendingQuestionRef.current = null;
        if (replyPlayingRef.current) {
          spokenReplySeqRef.current += 1;
          replyPlayingRef.current = false;
          stopVoiceOutput();
          setSpeakingMessageId(null);
        }
      };
      setVoiceMode(true);
      if (!duringReply) {
        spokenReplySeqRef.current += 1;
        stopVoiceOutput();
        setSpeakingMessageId(null);
      }
      setError(null);
      setVoiceInputState("recording");
      // Never leave an older listener, or its pending restart, behind a new one.
      if (handsFreeTimerRef.current !== null) {
        window.clearTimeout(handsFreeTimerRef.current);
        handsFreeTimerRef.current = null;
      }
      voiceHandleRef.current?.abort();
      const handle = startVoiceInput({
        language: uiLanguage,
        capabilities: voiceServerCapabilities,
        allowRecordedFallback: !duringReply && !options?.autoHandsFree,
        onStatusChange: (nextState) => {
          if (!isCurrent()) return;
          setVoiceInputState(nextState);
        },
        onAudioLevel: (level) => {
          if (!isCurrent()) return;
          setVoiceLevel(level);
        },
        onTranscript: (text) => {
          if (!isCurrent()) return;
          if (text.trim()) {
            heardAnything = true;
            if (!sawInterim) {
              sawInterim = true;
              utteranceStartedNearReply = inReplySilenceGrace();
            }
          }
          // Wait for a finished word or sentence before cutting into a reply,
          // so a sentence starting with "To ..." or "One ..." never cuts itself off.
          if (duringReply && !personSpoke) return;
          takeTurn();
          setQuestion(text.slice(0, 240));
        },
        onFinal: (text) => {
          if (!isCurrent()) return;
          const cleaned = text.trim().slice(0, 240);
          setQuestion("");
          if (cleaned) heardAnything = true;
          if (ignoreWhileReplying(cleaned)) {
            // A real question said over the reply (not echo, at least 3 words)
            // is kept and asked as soon as the reply ends.
            if (
              duringReply &&
              replyPlayingRef.current &&
              tokenizeSpokenWords(cleaned).length >= 3 &&
              !isEchoOfSpokenReply(cleaned, duringReply)
            ) {
              pendingQuestionRef.current = cleaned;
            }
            return;
          }
          takeTurn();
          if (cleaned) emptyListenRetriesRef.current = 0;
          if (!cleaned) {
            handsFreeSessionRef.current = false;
            return;
          }
          const command = resolveHandsFreeVoiceCommand(cleaned, activeChoices());
          if (command.kind === "stop") {
            handsFreeSessionRef.current = false;
            autoSpeakNextRef.current = false;
            setVoiceMode(false);
            if (voiceOutputReady) {
              const promptSeq = ++spokenReplySeqRef.current;
              setSpeakingMessageId("__voice_prompt__");
              const started = speakAdvisorReply({
                text: copy.voiceEnded,
                language: uiLanguage,
                capabilities: voiceServerCapabilities,
                onEnd: () => {
                  if (promptSeq !== spokenReplySeqRef.current) return;
                  setSpeakingMessageId((cur) => (cur === "__voice_prompt__" ? null : cur));
                },
              });
              if (!started) {
                setSpeakingMessageId((cur) => (cur === "__voice_prompt__" ? null : cur));
              }
            }
            return;
          }
          // Luganda is tap to talk: the answer is read aloud, then the mic stays off.
          handsFreeSessionRef.current = supportsHandsFreeVoice(uiLanguage);
          autoSpeakNextRef.current = true;
          void runBriefingRef.current?.(command.prompt);
        },
        onError: (code) => {
          if (!isCurrent()) return;
          setVoiceInputState("idle");
          if (duringReply && !personSpoke && code === "network" && replyPlayingRef.current) {
            pausedUntilReplyEnds = true;
            return;
          }
          if (
            options?.autoHandsFree &&
            (code === "network" || code === "service-not-allowed" || code === "language-not-supported")
          ) {
            handledError = true;
            handsFreeSessionRef.current = false;
            return;
          }
          const micUnusable =
            code === "mic_denied" || code === "audio-capture" || code === "start_failed" || code === "not-allowed";
          // Silence or a timeout while the reply plays is normal. The listener
          // restarts in onEnd. A blocked or missing microphone is never hidden.
          if (duringReply && !personSpoke && inReplySilenceGrace() && !micUnusable) return;
          handledError = true;
          if (
            code === "empty_transcript" &&
            handsFreeSessionRef.current &&
            emptyListenRetriesRef.current < 1
          ) {
            emptyListenRetriesRef.current += 1;
            const retryReplySeq = ++spokenReplySeqRef.current;
            const listenAgain = () => {
              if (retryReplySeq !== spokenReplySeqRef.current) return;
              setSpeakingMessageId((cur) => (cur === "__voice_prompt__" ? null : cur));
              if (handsFreeSessionRef.current) {
                startVoiceSessionRef.current?.({ autoHandsFree: true });
              }
            };
            setSpeakingMessageId("__voice_prompt__");
            const spoke =
              voiceOutputReady &&
              speakAdvisorReply({
                text: copy.voiceSayAgain,
                language: uiLanguage,
                capabilities: voiceServerCapabilities,
                onEnd: listenAgain,
              });
            if (!spoke) {
              setSpeakingMessageId((cur) => (cur === "__voice_prompt__" ? null : cur));
              listenAgain();
            }
            return;
          }
          emptyListenRetriesRef.current = 0;
          handsFreeSessionRef.current = false;
          const msg =
            code === "mic_denied" || code === "not-allowed"
              ? copy.voiceErrorMicDenied
              : code === "empty_transcript"
                ? copy.voiceErrorEmpty
                : copy.voiceErrorGeneral;
          setError({ code: "failed", message: msg });
        },
        onEnd: () => {
          if (!isCurrent()) return;
          voiceHandleRef.current = null;
          setVoiceInputState("idle");
          if (handledError || !duringReply || personSpoke || !handsFreeSessionRef.current) return;
          // The reply's own end starts normal listening once it finishes.
          if (pausedUntilReplyEnds && replyPlayingRef.current) return;
          // Only a listener that ends at once with nothing heard points to a
          // broken microphone. Normal silence timeouts in a long reply do not count.
          const endedAtOnce = !heardAnything && Date.now() - startedAt < QUICK_LISTENER_END_MS;
          listenerRestartsRef.current = endedAtOnce ? listenerRestartsRef.current : 0;
          if (listenerRestartsRef.current >= MAX_LISTENER_RESTARTS_PER_REPLY) {
            // The microphone keeps ending at once. Stop instead of looping.
            handsFreeSessionRef.current = false;
            setError({ code: "failed", message: copy.voiceErrorGeneral });
            return;
          }
          if (endedAtOnce) listenerRestartsRef.current += 1;
          if (handsFreeTimerRef.current !== null) window.clearTimeout(handsFreeTimerRef.current);
          handsFreeTimerRef.current = window.setTimeout(() => {
            handsFreeTimerRef.current = null;
            if (!handsFreeSessionRef.current) return;
            // Keep listening for the rest of the reply, then for the answer.
            startVoiceSessionRef.current?.(
              replyPlayingRef.current ? { duringReply } : { autoHandsFree: true },
            );
          }, LISTENER_RESTART_DELAY_MS);
        },
      });
      voiceHandleRef.current = handle;
      if (!handle) {
        handsFreeSessionRef.current = false;
        setVoiceInputState("idle");
      }
    },
    [
      canAskAdvisor,
      copy,
      setVoiceMode,
      uiLanguage,
      voiceOutputReady,
      voiceServerCapabilities,
      weather,
    ],
  );

  useEffect(() => {
    runBriefingRef.current = (prompt: string) => runBriefing(prompt, audience);
  }, [runBriefing, audience]);

  useEffect(() => {
    startVoiceSessionRef.current = startVoiceListeningSession;
  }, [startVoiceListeningSession]);

  const handleToggleVoiceInput = () => {
    primeVoicePlaybackForGesture();
    if (speakingMessageId !== null || replyPlayingRef.current || voiceInputState !== "idle") {
      endVoiceConversation(true);
      return;
    }
    setVoiceMode(true);
    emptyListenRetriesRef.current = 0;
    handsFreeSessionRef.current = supportsHandsFreeVoice(uiLanguage);
    startVoiceListeningSession();
  };

  const handleToggleSpeakReply = (msg: AdvisorMessage) => {
    if (!msg.text) return;
    if (speakingMessageId === msg.id) {
      endVoiceConversation(true);
      return;
    }
    endVoiceConversation(false);
    setVoiceMode(true);
    setSpeakingMessageId(msg.id);
    const replySeq = ++spokenReplySeqRef.current;
    const started = speakAdvisorReply({
      text: msg.text,
      language: uiLanguage,
      capabilities: voiceServerCapabilities,
      onEnd: () => {
        if (replySeq !== spokenReplySeqRef.current) return;
        setSpeakingMessageId((current) => (current === msg.id ? null : current));
      },
    });
    if (!started) {
      setSpeakingMessageId(null);
    }
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

  useEffect(() => {
    if (isDetailSheetOpen || districtModalOpen || installGuideOpen) {
      setShowPopup(false);
    }
  }, [districtModalOpen, installGuideOpen, isDetailSheetOpen]);

  if ((districtModalOpen || isDetailSheetOpen || installGuideOpen) && !isOpen) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      onFocusCapture={revealLauncher}
      className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] z-[55] flex flex-col items-end gap-1.5 transition-transform duration-200 ease-out motion-reduce:transition-none sm:bottom-6 sm:right-6 ${
        isOpen ? "left-[max(0.75rem,env(safe-area-inset-left,0px))] sm:left-auto" : ""
      } ${!isOpen && launcherHidden ? "pointer-events-none translate-y-[calc(100%+2rem)]" : ""}`}
    >
      {isOpen && (
        <GlassPanel
          className="flex h-[min(620px,calc(100dvh-92px))] w-full max-w-[430px] flex-col overflow-hidden sm:w-[430px]"
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
                {getCurrentOrNextHourRainChance(weather)}% · {Math.round(weather.wind.speedKph)} km/h
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
            <div className="flex flex-1 flex-col justify-between overflow-y-auto px-3.5 pt-3 pb-2 sm:px-5 sm:pt-4 sm:pb-3">
              <div className="my-auto flex flex-col items-center py-4 text-center sm:py-6">
                <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-white sm:text-[23px]">
                  {copy.greeting}
                </h2>
                {!weather && (
                  <p className="mt-2 text-[12px] text-white/50">{copy.loadingWeather}</p>
                )}
              </div>

              <div className="space-y-1.5 pt-2">
                {getDistrictQuickActions(weather, copy, uiLanguage).map((action, idx) => (
                  <button
                    key={action.key}
                    type="button"
                    disabled={!canSend}
                    aria-label={action.prompt}
                    onClick={() => handleQuickPrompt(action.audience, action.prompt)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-left text-[13px] leading-snug text-white/92 transition-colors hover:border-white/25 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="mr-1.5 font-semibold text-brand-green">
                        {idx + 1}.
                      </span>
                      {action.prompt}
                    </span>
                    <span className="shrink-0 text-[11px] text-white/50">
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
                        className={`max-w-[82%] space-y-2 rounded-2xl rounded-br-sm px-3.5 py-2.5 text-[13px] leading-snug ${BRAND_GLASS_GREEN}`}
                      >
                        {msg.imagePreviewUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={msg.imagePreviewUrl}
                            alt={copy.photoAlt}
                            className="max-h-36 w-full rounded-xl object-cover"
                          />
                        )}
                        <p data-testid="advisor-user-message">{msg.text}</p>
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
                      <div
                        data-testid="advisor-phase-indicator"
                        className="min-h-[76px] space-y-2.5 py-0.5"
                      >
                        <p className="text-[12.5px] font-medium text-white/75">
                          {thinkingLabel}
                        </p>
                        <div className="space-y-2" aria-hidden="true">
                          <div className="glass-shimmer h-3 w-full max-w-[260px] rounded-full" />
                          <div className="glass-shimmer h-3 w-full max-w-[220px] rounded-full" />
                          <div className="glass-shimmer h-3 w-full max-w-[160px] rounded-full" />
                        </div>
                      </div>
                    )}

                    {!msg.streaming && msg.verdict && (
                      <p
                        data-testid="advisor-verdict-badge"
                        className={`text-[12px] font-semibold tracking-wide ${
                          msg.verdict.level === "go"
                            ? "text-brand-green"
                            : msg.verdict.level === "caution"
                              ? "text-caution"
                              : "text-alert-red"
                        }`}
                      >
                        {uiLanguage === "lg" ? msg.verdict.labelLg : msg.verdict.labelEn}
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
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-white/50">
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
                            : msg.source === "saved_forecast"
                              ? copy.sourceSavedForecast
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
                        {msg.text && (
                          <a
                            href={buildSmsHref(
                              buildPlainTextAdvisorSms(
                                activeDistrictName,
                                msg.text,
                              ),
                            )}
                            aria-label={copy.shareReplySms}
                            data-testid="advisor-share-sms"
                            className="pointer-fine:hidden inline-flex items-center rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-white/75 transition hover:bg-white/[0.15] hover:text-white relative before:absolute before:-inset-x-1 before:-inset-y-[10px] before:content-['']"
                          >
                            SMS
                          </a>
                        )}
                        {voiceOutputReady && msg.text && (
                          <button
                            type="button"
                            onClick={() => handleToggleSpeakReply(msg)}
                            data-testid="advisor-listen-button"
                            aria-label={
                              speakingMessageId === msg.id
                                ? copy.stopListenReply
                                : copy.listenReply
                            }
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition relative before:absolute before:-inset-x-1 before:-inset-y-[10px] before:content-[''] ${
                              speakingMessageId === msg.id
                                ? "bg-brand-green/65 text-white"
                                : "bg-white/[0.08] text-white/75 hover:bg-white/[0.15] hover:text-white"
                            }`}
                          >
                            <svg
                              viewBox="0 0 16 16"
                              fill="currentColor"
                              className="h-3 w-3 shrink-0"
                              aria-hidden="true"
                            >
                              {speakingMessageId === msg.id ? (
                                <rect x="4" y="4" width="8" height="8" rx="1.5" />
                              ) : (
                                <path d="M8.5 3.2a.75.75 0 0 0-1.22-.58L4.3 5H2.75A1.25 1.25 0 0 0 1.5 6.25v3.5A1.25 1.25 0 0 0 2.75 11H4.3l2.98 2.38A.75.75 0 0 0 8.5 12.8V3.2Zm2.34 1.94a.75.75 0 0 1 1.06.03 4.25 4.25 0 0 1 0 5.66.75.75 0 1 1-1.09-1.03 2.75 2.75 0 0 0 0-3.6.75.75 0 0 1 .03-1.06Z" />
                              )}
                            </svg>
                            <span>
                              {speakingMessageId === msg.id
                                ? copy.stopListenReply
                                : copy.listenReply}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {!isBusy &&
                !photoMenuOpen &&
                messages.length > 0 &&
                messages[messages.length - 1]?.role === "assistant" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {resolveDynamicFollowUps(messages).map((followUp, idx) => (
                      <button
                        key={followUp}
                        type="button"
                        disabled={!canSend}
                        aria-label={followUp}
                        onClick={() => handleQuickPrompt(audience, followUp)}
                        className="rounded-full border border-white/15 px-3.5 py-1.5 text-left text-[12px] text-white/80 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                      >
                        <span className="mr-1.5 font-semibold text-brand-green">
                          {idx + 1}.
                        </span>
                        <span>{followUp}</span>
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
          <div className="relative px-3 pt-2 pb-3 sm:px-4">
            {attachedImage && (
              <div className="mb-2 flex items-center gap-2.5 px-1 py-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachedImage.previewUrl}
                  alt={copy.photoAlt}
                  className="h-9 w-9 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-white/85">
                    {copy.photoReady}
                  </p>
                  {attachedImage.metadata.location && !attachedImage.metadata.location.withinUganda ? (
                    <p className="truncate text-[11px] font-medium text-alert-red">
                      {copy.photoOutsideUganda}
                    </p>
                  ) : attachedImage.metadata.location &&
                    !attachedImage.metadata.location.matchesActiveDistrict &&
                    attachedImage.metadata.location.nearestDistrictName ? (
                    <p className="truncate text-[11px] font-medium text-alert-red">
                      {copy.photoDifferentArea
                        .replace("{photoDistrict}", attachedImage.metadata.location.nearestDistrictName)
                        .replace("{activeDistrict}", activeDistrictName)}
                    </p>
                  ) : attachedImage.metadata.isStale ? (
                    <p className="truncate text-[11px] font-medium text-caution">
                      {copy.photoStale}
                    </p>
                  ) : !attachedImage.metadata.location ? (
                    <p className="truncate text-[11px] font-medium text-caution">
                      {copy.photoNoGps}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  aria-label={copy.closeAria}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {liveCameraOpen && (
              <div className="mb-2 space-y-2">
                <div className="relative overflow-hidden rounded-xl bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-44 w-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={stopLiveCamera}
                    className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[12px] font-medium text-white/85 transition hover:bg-white/[0.15]"
                  >
                    {dict.common.close}
                  </button>
                  <button
                    type="button"
                    onClick={handleCaptureLiveCameraFrame}
                    className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${BRAND_GLASS_GREEN}`}
                  >
                    {copy.photoTakeLive}
                  </button>
                </div>
              </div>
            )}

            <div ref={photoMenuRef}>
              {photoMenuOpen && effectiveOnline && cloudConfigured && !isBusy && (
                <div
                  role="menu"
                  className="absolute bottom-[calc(100%-6px)] left-3 z-50 w-[min(224px,calc(100%-1.5rem))] space-y-1 rounded-[18px] border border-white/[0.14] bg-[rgba(14,20,34,0.97)] p-[6px] shadow-[0_18px_40px_-6px_rgba(0,0,0,0.75),0_4px_12px_-2px_rgba(0,0,0,0.45)] backdrop-blur-[32px] backdrop-saturate-[200%]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void handleOpenLiveCamera();
                    }}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-full px-[14px] py-[7px] text-left text-[14px] font-medium text-[#f8fafc] transition-colors hover:bg-brand-green/65 hover:text-on-brand focus-visible:bg-brand-green/65 focus-visible:text-on-brand focus-visible:outline-none"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 shrink-0" aria-hidden="true">
                      <path d="M3.5 7.5A1.75 1.75 0 0 1 5.25 5.75h1.4l.9-1.5A1.5 1.5 0 0 1 8.85 3.5h2.3a1.5 1.5 0 0 1 1.3.75l.9 1.5h1.4A1.75 1.75 0 0 1 16.5 7.5v6.75A1.75 1.75 0 0 1 14.75 16h-9.5A1.75 1.75 0 0 1 3.5 14.25V7.5Z" />
                      <circle cx="10" cy="10.75" r="2.75" />
                    </svg>
                    <span>{copy.photoTakeLive}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPhotoMenuOpen(false);
                      uploadInputRef.current?.click();
                    }}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-full px-[14px] py-[7px] text-left text-[14px] font-medium text-[#f8fafc] transition-colors hover:bg-brand-green/65 hover:text-on-brand focus-visible:bg-brand-green/65 focus-visible:text-on-brand focus-visible:outline-none"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 shrink-0" aria-hidden="true">
                      <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="2" />
                      <path d="M5.5 13.25 8.5 10l2.25 2.25 2-1.75 2 2.75" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="7.5" cy="7.75" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    <span>{copy.photoUpload}</span>
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] py-1 pr-1 pl-1.5 focus-within:border-white/30 sm:gap-1.5 sm:pr-1.5 sm:pl-2.5"
              >
                {effectiveOnline && cloudConfigured && !isBusy && (
                  <>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      tabIndex={-1}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const activeCoords = weather?.district?.coordinates
                          ? {
                              slug: weather.district.slug,
                              lat: weather.district.coordinates.lat,
                              lon: weather.district.coordinates.lon,
                            }
                          : undefined;
                        void compressImageForAdvisor(file, activeCoords)
                          .then((compressed) => {
                            setError(null);
                            setAttachedImage(compressed);
                          })
                          .catch((err: unknown) => {
                            const errCode = err instanceof Error ? err.message : "";
                            setError({
                              code: "invalid_input",
                              message:
                                errCode === "HEIC_NOT_SUPPORTED"
                                  ? copy.photoErrorUnsupportedHeic
                                  : errCode === "IMAGE_TOO_LARGE"
                                    ? copy.photoErrorTooLarge
                                    : copy.photoErrorGeneral,
                            });
                          });
                      }}
                    />
                    <input
                      ref={uploadInputRef}
                      type="file"
                      tabIndex={-1}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const activeCoords = weather?.district?.coordinates
                          ? {
                              slug: weather.district.slug,
                              lat: weather.district.coordinates.lat,
                              lon: weather.district.coordinates.lon,
                            }
                          : undefined;
                        void compressImageForAdvisor(file, activeCoords)
                          .then((compressed) => {
                            setError(null);
                            setAttachedImage(compressed);
                          })
                          .catch((err: unknown) => {
                            const errCode = err instanceof Error ? err.message : "";
                            setError({
                              code: "invalid_input",
                              message:
                                errCode === "HEIC_NOT_SUPPORTED"
                                  ? copy.photoErrorUnsupportedHeic
                                  : errCode === "IMAGE_TOO_LARGE"
                                    ? copy.photoErrorTooLarge
                                    : copy.photoErrorGeneral,
                            });
                          });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoMenuOpen((prev) => !prev)}
                      disabled={!canSend}
                      aria-haspopup="menu"
                      aria-expanded={photoMenuOpen}
                      data-testid="advisor-camera-button"
                      aria-label={copy.photoButtonAria}
                      title={copy.photoButtonAria}
                      className={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 ${
                        photoMenuOpen
                          ? "bg-brand-green/65 text-white"
                          : "bg-white/[0.08] text-white/80 hover:bg-white/[0.15] hover:text-white"
                      }`}
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
                        <path d="M3.5 7.5A1.75 1.75 0 0 1 5.25 5.75h1.4l.9-1.5A1.5 1.5 0 0 1 8.85 3.5h2.3a1.5 1.5 0 0 1 1.3.75l.9 1.5h1.4A1.75 1.75 0 0 1 16.5 7.5v6.75A1.75 1.75 0 0 1 14.75 16h-9.5A1.75 1.75 0 0 1 3.5 14.25V7.5Z" />
                        <circle cx="10" cy="10.75" r="2.75" />
                      </svg>
                    </button>
                  </>
                )}
                <label htmlFor={questionInputId} className="sr-only">
                  {copy.questionLabel}
                </label>
                <input
                  id={questionInputId}
                  type="text"
                  value={question}
                  maxLength={240}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={
                    voiceInputState === "recording"
                      ? copy.voiceListening
                      : voiceInputState === "transcribing"
                        ? copy.voiceProcessing
                        : copy.questionPlaceholder
                  }
                  className="min-h-[36px] min-w-0 flex-1 bg-transparent px-1 text-[12.5px] text-white placeholder:text-white/50 focus:outline-none sm:min-h-[40px] sm:px-1.5 sm:text-[14px]"
                />
                {voiceInputReady && !isBusy && (
                  <button
                    type="button"
                    onClick={handleToggleVoiceInput}
                    disabled={!canSend && !isListening}
                    data-testid="advisor-voice-button"
                    aria-label={
                      isListening || speakingMessageId !== null
                        ? copy.voiceStopAria
                        : copy.voiceSpeakAria
                    }
                    className={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none sm:h-10 sm:w-10 ${
                      isListening
                        ? "bg-[#b42318] text-white ring-2 ring-white/40"
                        : "bg-white/[0.08] text-white/80 hover:bg-white/[0.15] hover:text-white"
                    }`}
                  >
                    {voiceInputState === "recording" ? (
                      <span className="flex items-end gap-[2px]" aria-hidden="true">
                        {[0.45, 0.9, 0.65].map((weight, idx) => (
                          <span
                            key={idx}
                            className="w-[2.5px] rounded-full bg-white transition-all duration-75"
                            style={{
                              height: `${Math.round(5 + Math.max(0.18, voiceLevel * weight) * 11)}px`,
                            }}
                          />
                        ))}
                      </span>
                    ) : (
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`pointer-events-none h-4 w-4 ${voiceInputState === "transcribing" ? "animate-spin motion-reduce:animate-none" : ""}`}
                        aria-hidden="true"
                      >
                        <path d="M10 2.5a2.75 2.75 0 0 0-2.75 2.75v4.5a2.75 2.75 0 1 0 5.5 0v-4.5A2.75 2.75 0 0 0 10 2.5Z" />
                        <path d="M5.25 9.25a.75.75 0 0 0-1.5 0 6.25 6.25 0 0 0 5.5 6.2v1.8h-2a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-2v-1.8a6.25 6.25 0 0 0 5.5-6.2.75.75 0 0 0-1.5 0 4.75 4.75 0 1 1-9.5 0Z" />
                      </svg>
                    )}
                  </button>
                )}
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
                    className={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:bg-brand-green/80 active:scale-[0.95] motion-reduce:transition-none sm:h-10 sm:w-10 ${BRAND_GLASS_GREEN}`}
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
                    className={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:bg-brand-green/80 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none sm:h-10 sm:w-10 ${BRAND_GLASS_GREEN}`}
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
            </div>

            <p className="mt-2 text-center text-[11px] text-white/45">
              {copy.disclaimer}
            </p>
          </div>
        </GlassPanel>
      )}

      {/* Connected horizontal row: pop-up greeting docked beside the brand green glass launcher (hidden when panel is already open, since the panel header has its own close button) */}
      {!isOpen && (
      <div className="flex items-center gap-2">
        {showPopup && !installGuideOpen && (
          <GlassPanel
            clip={false}
            className="relative flex max-w-[min(248px,calc(100vw-96px))] items-center gap-2 rounded-full px-4 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)] max-[359px]:hidden"
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
            setIsOpen(true);
          }}
          className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[16px] rounded-bl-[4px] min-[360px]:h-12 min-[360px]:w-14 min-[360px]:rounded-[18px] transition hover:bg-brand-green/80 active:scale-95 focus-visible:outline-none motion-reduce:transition-none ${BRAND_GLASS_GREEN}`}
        >
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-white" />
            <span className="h-2 w-2 rounded-full bg-white" />
            <span className="h-2 w-2 rounded-full bg-white" />
          </span>
        </button>
      </div>
      )}
    </div>
  );
}
