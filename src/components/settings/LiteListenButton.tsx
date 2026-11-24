"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchVoiceCapabilities,
  isVoiceOutputSupported,
  prefetchVoiceClip,
  speakAdvisorReply,
  stopVoiceOutput,
  type VoiceServerCapabilities,
} from "@/lib/ai/advisor-voice";
import { usePreferencesStore } from "@/stores/preferencesStore";

export function LiteListenButton({
  spokenTextEn,
  spokenTextLg,
  language,
}: {
  spokenTextEn: string;
  spokenTextLg: string;
  language: "en" | "lg";
}) {
  const voiceMode = usePreferencesStore((state) => state.voiceMode);
  const setVoiceMode = usePreferencesStore((state) => state.setVoiceMode);
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
  const prevContentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchVoiceCapabilities().then((caps) => {
      if (active) setServerCapabilities(caps);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncSupport = () => {
      setVoiceReady(isVoiceOutputSupported(language, serverCapabilities));
    };
    syncSupport();

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener?.("voiceschanged", syncSupport);
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.removeEventListener?.("voiceschanged", syncSupport);
      }
    };
  }, [language, serverCapabilities]);

  useEffect(() => {
    const contentKey = `${language}:${spokenTextEn}:${spokenTextLg}`;
    if (prevContentKeyRef.current !== null && prevContentKeyRef.current !== contentKey) {
      if (isSpeakingRef.current) {
        stopVoiceOutput();
      }
      setPlaybackState("idle");
    }
    prevContentKeyRef.current = contentKey;
  }, [language, spokenTextEn, spokenTextLg]);

  useEffect(() => {
    return () => {
      if (isSpeakingRef.current) {
        stopVoiceOutput();
      }
    };
  }, []);

  if (!voiceReady) return null;

  const isLg = language === "lg";
  const spokenText = isLg ? spokenTextLg : spokenTextEn;

  const handlePrefetch = () => {
    prefetchVoiceClip({
      text: spokenText,
      language,
      capabilities: serverCapabilities,
    });
  };

  const handleToggle = () => {
    if (isSpeaking) {
      setVoiceMode(false);
      stopVoiceOutput();
      setPlaybackState("idle");
      return;
    }
    setVoiceMode(true);
    setPlaybackState("loading");
    const started = speakAdvisorReply({
      text: spokenText,
      language,
      capabilities: serverCapabilities,
      onStateChange: (nextState) => setPlaybackState(nextState),
      onEnd: () => setPlaybackState("idle"),
    });
    if (!started) {
      setPlaybackState("idle");
    }
  };

  const label = isSpeaking
    ? isLg
      ? "Yimiriza eddoboozi"
      : "Stop audio"
    : isLg
      ? "Wuliriza"
      : "Listen";

  return (
    <button
      type="button"
      onClick={handleToggle}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      onPointerDown={handlePrefetch}
      data-testid="lite-listen-toggle"
      aria-pressed={isSpeaking}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.95] ${
        isSpeaking
          ? "border-white/25 bg-brand-green/75 text-white shadow-[0_6px_18px_rgba(13,144,59,0.35)]"
          : voiceMode
            ? "border-brand-green/50 bg-brand-green/25 text-white hover:bg-brand-green/35"
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
