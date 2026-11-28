import type { SupportedLocale } from "@/lib/i18n/types";
import { isFirebaseAiConfigured } from "@/lib/ai/firebase-client";
import { getAdvisorRemoteConfig } from "@/lib/ai/remote-config";
import { transcribeEnglishAudioWithFirebaseAi } from "@/lib/ai/firebase-audio-transcribe";
import * as firebaseTtsNamespace from "@/lib/ai/firebase-tts";
import {
  isFirebaseNeuralTtsAvailable,
  synthesizeSpeechWithFirebaseAi,
} from "@/lib/ai/firebase-tts";
import {
  createPcmStreamSession,
  isWebAudioStreamSupported,
  primePcmStreamAudioForGesture,
  stopActivePcmStream,
} from "@/lib/voice/pcm-stream-player";

function getStreamSpeechWithFirebaseAi():
  | typeof import("@/lib/ai/firebase-tts").streamSpeechWithFirebaseAi
  | null {
  try {
    const fn = (
      firebaseTtsNamespace as {
        streamSpeechWithFirebaseAi?: typeof import("@/lib/ai/firebase-tts").streamSpeechWithFirebaseAi;
      }
    ).streamSpeechWithFirebaseAi;
    return typeof fn === "function" ? fn : null;
  } catch {
    return null;
  }
}

export interface VoiceServerCapabilities {
  lugandaTts: boolean;
  lugandaStt: boolean;
  lugandaTranslation?: boolean;
  englishNeuralTts: boolean;
}

const DEFAULT_CAPABILITIES: VoiceServerCapabilities = {
  lugandaTts: false,
  lugandaStt: false,
  lugandaTranslation: false,
  englishNeuralTts: false,
};

let cachedCapabilities: VoiceServerCapabilities | null = null;
let capabilitiesPromise: Promise<VoiceServerCapabilities> | null = null;
const VOICE_CAPS_STORAGE_KEY = "uw:voice-caps:v1";

function readStoredVoiceCapabilities(): VoiceServerCapabilities | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage?.getItem(VOICE_CAPS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VoiceServerCapabilities>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      lugandaTts: Boolean(parsed.lugandaTts),
      lugandaStt: Boolean(parsed.lugandaStt),
      lugandaTranslation: Boolean(parsed.lugandaTranslation),
      englishNeuralTts: Boolean(parsed.englishNeuralTts),
    };
  } catch {
    return null;
  }
}

function writeStoredVoiceCapabilities(caps: VoiceServerCapabilities): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.setItem(VOICE_CAPS_STORAGE_KEY, JSON.stringify(caps));
  } catch {
    // Ignore sessionStorage restrictions in private mode
  }
}

export function resetVoiceCapabilitiesForTests(): void {
  cachedCapabilities = null;
  capabilitiesPromise = null;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage?.removeItem(VOICE_CAPS_STORAGE_KEY);
    } catch {
      // Ignore storage errors in tests
    }
  }
}

export async function fetchVoiceCapabilities(
  forceRefresh = false,
): Promise<VoiceServerCapabilities> {
  if (typeof window === "undefined") return DEFAULT_CAPABILITIES;
  if (!forceRefresh && cachedCapabilities) return cachedCapabilities;

  const stored = !forceRefresh ? readStoredVoiceCapabilities() : null;
  if (stored) {
    cachedCapabilities = stored;
  }

  if (!capabilitiesPromise) {
    capabilitiesPromise = (async () => {
      try {
        const response = await fetch("/api/v1/voice/status", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return cachedCapabilities ?? DEFAULT_CAPABILITIES;
        const json = (await response.json()) as {
          data?: Partial<VoiceServerCapabilities>;
        };
        const next: VoiceServerCapabilities = {
          lugandaTts: Boolean(json.data?.lugandaTts),
          lugandaStt: Boolean(json.data?.lugandaStt),
          lugandaTranslation: Boolean(json.data?.lugandaTranslation),
          englishNeuralTts: Boolean(json.data?.englishNeuralTts),
        };
        cachedCapabilities = next;
        writeStoredVoiceCapabilities(next);
        return next;
      } catch {
        return cachedCapabilities ?? DEFAULT_CAPABILITIES;
      } finally {
        capabilitiesPromise = null;
      }
    })();
  }

  if (stored) {
    void capabilitiesPromise;
    return stored;
  }

  return capabilitiesPromise;
}

export function isSlowOrConstrainedNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (
    navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
        rtt?: number;
        downlink?: number;
      };
    }
  ).connection;
  if (!conn) return false;
  if (conn.saveData === true) return true;
  const effective = (conn.effectiveType ?? "").toLowerCase();
  if (effective === "slow-2g" || effective === "2g") return true;
  const rc = getAdvisorRemoteConfig();
  if (typeof conn.rtt === "number" && conn.rtt >= rc.voiceSlowRttMs) return true;
  if (
    typeof conn.downlink === "number" &&
    conn.downlink > 0 &&
    conn.downlink < rc.voiceSlowDownlinkMbps
  ) {
    return true;
  }
  return false;
}

interface SpeechRecognitionAlternativeLike {
  transcript?: string;
}

interface SpeechRecognitionResultLike {
  isFinal?: boolean;
  0?: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results?: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function isBrowserSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

export function isVoiceInputSupported(
  language: SupportedLocale = "en",
  capabilities?: VoiceServerCapabilities,
): boolean {
  if (language === "lg") {
    return Boolean(capabilities?.lugandaStt) && isMediaRecorderSupported();
  }
  return (isMediaRecorderSupported() && isFirebaseAiConfigured()) || getSpeechRecognitionCtor() !== null;
}

export function isVoiceOutputSupported(
  language: SupportedLocale = "en",
  capabilities?: VoiceServerCapabilities,
): boolean {
  if (language === "lg") {
    return Boolean(capabilities?.lugandaTts);
  }
  return Boolean(capabilities?.englishNeuralTts) || isBrowserSpeechSynthesisSupported();
}

export interface VoiceInputHandle {
  stop: () => void;
  abort: () => void;
}

export type VoiceInputState = "idle" | "recording" | "transcribing";

export interface SpeakerAcousticProfile {
  baselineRms: number;
  centroidHz: number;
  updatedAt: number;
}

let activeSpeakerProfile: SpeakerAcousticProfile | null = null;
let activeBargeInCleanup: (() => void) | null = null;

export function getActiveSpeakerProfileForTests(): SpeakerAcousticProfile | null {
  return activeSpeakerProfile;
}

export function resetActiveSpeakerProfileForTests(): void {
  activeSpeakerProfile = null;
}

/**
 * Verifies whether an audio frame belongs to a real human voice and matches
 * the active near-field speaker talking to the system at that moment.
 * - Rejects non-human noises (table taps, wind rumble < 100 Hz, clicks/hiss > 4 kHz).
 * - Checks human vocal formant dominance (300 Hz - 2800 Hz) and speech zero-crossing rate.
 * - When an active speaker profile is locked, verifies near-field proximity (RMS)
 *   and vocal timbre centroid consistency so distant background voices do not interrupt.
 */
export function verifyHumanSpeakerFrame({
  timeData,
  freqData,
  sampleRate = 48_000,
  profile = activeSpeakerProfile,
  enforceProfileLock = true,
}: {
  timeData: Uint8Array;
  freqData: Uint8Array;
  sampleRate?: number;
  profile?: SpeakerAcousticProfile | null;
  enforceProfileLock?: boolean;
}): {
  isHumanSpeech: boolean;
  matchesActiveSpeaker: boolean;
  rms: number;
  centroidHz: number;
  vocalBandRatio: number;
} {
  if (timeData.length === 0 || freqData.length === 0) {
    return {
      isHumanSpeech: false,
      matchesActiveSpeaker: false,
      rms: 0,
      centroidHz: 0,
      vocalBandRatio: 0,
    };
  }

  let sumSq = 0;
  let zeroCrossings = 0;
  let prevSign = timeData[0]! >= 128 ? 1 : -1;
  for (let i = 0; i < timeData.length; i += 1) {
    const sample = (timeData[i]! - 128) / 128;
    sumSq += sample * sample;
    const sign = sample >= 0 ? 1 : -1;
    if (i > 0 && sign !== prevSign) {
      zeroCrossings += 1;
    }
    prevSign = sign;
  }
  const rms = Math.sqrt(sumSq / timeData.length);
  const zcr = zeroCrossings / timeData.length;

  const nyquist = sampleRate / 2;
  const binHz = nyquist / freqData.length;
  let totalEnergy = 0;
  let lowRumbleEnergy = 0;
  let vocalBandEnergy = 0;
  let weightedFreqSum = 0;

  for (let i = 1; i < freqData.length; i += 1) {
    const mag = freqData[i]!;
    const energy = mag * mag;
    const freq = i * binHz;
    totalEnergy += energy;
    if (freq < 100) {
      lowRumbleEnergy += energy;
    }
    if (freq >= 300 && freq <= 2800) {
      vocalBandEnergy += energy;
      weightedFreqSum += freq * mag;
    }
  }

  const vocalBandRatio = totalEnergy > 0 ? vocalBandEnergy / totalEnergy : 0;
  const lowRumbleRatio = totalEnergy > 0 ? lowRumbleEnergy / totalEnergy : 1;
  let vocalMagSum = 0;
  for (let i = 1; i < freqData.length; i += 1) {
    const freq = i * binHz;
    if (freq >= 300 && freq <= 2800) {
      vocalMagSum += freqData[i]!;
    }
  }
  const centroidHz = vocalMagSum > 0 ? weightedFreqSum / vocalMagSum : 0;

  const isHumanSpeech =
    rms >= 0.038 &&
    vocalBandRatio >= 0.56 &&
    lowRumbleRatio <= 0.34 &&
    zcr >= 0.012 &&
    zcr <= 0.38 &&
    centroidHz >= 320 &&
    centroidHz <= 2650;

  if (!isHumanSpeech) {
    return {
      isHumanSpeech: false,
      matchesActiveSpeaker: false,
      rms,
      centroidHz,
      vocalBandRatio,
    };
  }

  const profileFresh =
    profile !== null && Date.now() - profile.updatedAt < 5 * 60_000;
  if (!enforceProfileLock || !profileFresh || !profile) {
    return {
      isHumanSpeech: true,
      matchesActiveSpeaker: true,
      rms,
      centroidHz,
      vocalBandRatio,
    };
  }

  const minNearFieldRms = Math.max(0.042, profile.baselineRms * 0.62);
  const centroidDrift =
    profile.centroidHz > 0
      ? Math.abs(centroidHz - profile.centroidHz) / profile.centroidHz
      : 0;
  const matchesActiveSpeaker =
    rms >= minNearFieldRms && centroidDrift <= 0.3;

  return {
    isHumanSpeech: true,
    matchesActiveSpeaker,
    rms,
    centroidHz,
    vocalBandRatio,
  };
}

function updateActiveSpeakerProfileSample(rms: number, centroidHz: number): void {
  if (rms < 0.04 || centroidHz < 320 || centroidHz > 2650) return;
  if (!activeSpeakerProfile) {
    activeSpeakerProfile = {
      baselineRms: rms,
      centroidHz,
      updatedAt: Date.now(),
    };
    return;
  }
  activeSpeakerProfile = {
    baselineRms: activeSpeakerProfile.baselineRms * 0.75 + rms * 0.25,
    centroidHz: activeSpeakerProfile.centroidHz * 0.75 + centroidHz * 0.25,
    updatedAt: Date.now(),
  };
}

function stopHumanBargeInMonitor(): void {
  if (activeBargeInCleanup) {
    const fn = activeBargeInCleanup;
    activeBargeInCleanup = null;
    fn();
  }
}

function startHumanBargeInMonitor(onVerifiedBargeIn: () => void): void {
  stopHumanBargeInMonitor();
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return;
  }
  const AudioCtxCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return;

  let cancelled = false;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let rafId: number | null = null;
  const startedAt = Date.now();

  const cleanup = () => {
    cancelled = true;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (audioCtx) {
      void audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  };

  activeBargeInCleanup = cleanup;

  void navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    .then((mediaStream) => {
      if (cancelled) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = mediaStream;
      audioCtx = new AudioCtxCtor();
      const source = audioCtx.createMediaStreamSource(mediaStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const timeData = new Uint8Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      let consecutiveHumanFrames = 0;

      const tick = () => {
        if (cancelled) return;
        // Wait 400ms after playback begins so initial speaker transient settles
        if (Date.now() - startedAt >= 400) {
          analyser.getByteTimeDomainData(timeData);
          analyser.getByteFrequencyData(freqData);
          const check = verifyHumanSpeakerFrame({
            timeData,
            freqData,
            sampleRate: audioCtx?.sampleRate ?? 48_000,
          });
          if (check.isHumanSpeech && check.matchesActiveSpeaker) {
            consecutiveHumanFrames += 1;
            updateActiveSpeakerProfileSample(check.rms, check.centroidHz);
            if (consecutiveHumanFrames >= 14) {
              stopHumanBargeInMonitor();
              onVerifiedBargeIn();
              return;
            }
          } else {
            consecutiveHumanFrames = Math.max(0, consecutiveHumanFrames - 1);
          }
        }
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    })
    .catch(() => {
      // Ignore barge-in monitor failure if microphone permission has not been granted yet
    });
}

function startRecordedVoiceInput({
  language,
  onFinal,
  onError,
  onEnd,
  onStatusChange,
  onAudioLevel,
}: {
  language: SupportedLocale;
  onFinal: (text: string) => void;
  onError?: (code: string) => void;
  onEnd?: () => void;
  onStatusChange?: (state: VoiceInputState) => void;
  onAudioLevel?: (level: number) => void;
}): VoiceInputHandle | null {
  if (!isMediaRecorderSupported()) return null;

  let aborted = false;
  let stopped = false;
  let recorder: MediaRecorder | null = null;
  let activeStream: MediaStream | null = null;
  let autoStopTimer: number | null = null;
  let meterRaf: number | null = null;
  let audioCtx: AudioContext | null = null;
  const uploadController = new AbortController();

  const cleanupMedia = () => {
    if (autoStopTimer !== null) {
      window.clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }
    if (meterRaf !== null) {
      window.cancelAnimationFrame(meterRaf);
      meterRaf = null;
    }
    onAudioLevel?.(0);
    if (audioCtx) {
      void audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
  };

  onStatusChange?.("recording");

  void navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    .then((stream) => {
      if (aborted || stopped) {
        stream.getTracks().forEach((track) => track.stop());
        onStatusChange?.("idle");
        if (!aborted) onEnd?.();
        return;
      }
      activeStream = stream;

      // Live microphone waveform metering + simple silence auto-stop
      try {
        const AudioCtxCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxCtor) {
          audioCtx = new AudioCtxCtor();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const freqData = new Uint8Array(analyser.frequencyBinCount);
          let hasSpoken = false;
          let silenceSince = 0;

          const tick = () => {
            if (aborted || stopped) return;
            analyser.getByteTimeDomainData(data);
            analyser.getByteFrequencyData(freqData);
            const humanCheck = verifyHumanSpeakerFrame({
              timeData: data,
              freqData,
              sampleRate: audioCtx?.sampleRate ?? 48_000,
              enforceProfileLock: false,
            });
            if (humanCheck.isHumanSpeech) {
              updateActiveSpeakerProfileSample(humanCheck.rms, humanCheck.centroidHz);
            }
            let sum = 0;
            for (let i = 0; i < data.length; i += 1) {
              const delta = (data[i]! - 128) / 128;
              sum += delta * delta;
            }
            const rms = Math.sqrt(sum / data.length);
            const normalized = Math.min(1, rms * 5.5);
            onAudioLevel?.(normalized);

            const now = Date.now();
            if (normalized > 0.12) {
              hasSpoken = true;
              silenceSince = 0;
            } else if (hasSpoken) {
              if (!silenceSince) {
                silenceSince = now;
              } else if (now - silenceSince > 2200 && recorder?.state === "recording") {
                stopped = true;
                recorder.stop();
                return;
              }
            }
            meterRaf = window.requestAnimationFrame(tick);
          };
          meterRaf = window.requestAnimationFrame(tick);
        }
      } catch {
        // Metering is optional; recording still works without Web Audio
      }

      const chunks: Blob[] = [];
      const candidateMimes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const preferredMime =
        typeof MediaRecorder.isTypeSupported === "function"
          ? candidateMimes.find((mime) => MediaRecorder.isTypeSupported(mime))
          : undefined;
      recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupMedia();
        onStatusChange?.("idle");
        onError?.("record_failed");
        onEnd?.();
      };

      recorder.onstop = () => {
        cleanupMedia();
        if (aborted || chunks.length === 0) {
          onStatusChange?.("idle");
          if (!aborted) onEnd?.();
          return;
        }
        onStatusChange?.("transcribing");
        const mimeType = recorder?.mimeType || preferredMime || "audio/webm";
        const blob = new Blob(chunks, { type: mimeType });

        const transcribePromise: Promise<string> =
          language === "lg"
            ? (async () => {
                const formData = new FormData();
                const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
                formData.append("audio", blob, `voice.${ext}`);
                const res = await fetch("/api/v1/voice/transcribe", {
                  method: "POST",
                  body: formData,
                  signal: uploadController.signal,
                });
                if (!res.ok) {
                  throw new Error(`HTTP_${res.status}`);
                }
                const json = (await res.json()) as { data?: { text?: string } };
                return json.data?.text?.trim() ?? "";
              })()
            : transcribeEnglishAudioWithFirebaseAi(blob, uploadController.signal);

        void transcribePromise
          .then((text) => {
            if (text && !aborted) {
              onFinal(text);
            } else if (!aborted) {
              onError?.("empty_transcript");
            }
          })
          .catch(() => {
            if (!aborted) {
              onError?.("transcribe_failed");
            }
          })
          .finally(() => {
            onStatusChange?.("idle");
            if (!aborted) onEnd?.();
          });
      };

      recorder.start();
      autoStopTimer = window.setTimeout(() => {
        if (recorder && recorder.state === "recording") {
          stopped = true;
          recorder.stop();
        }
      }, 12_000);
    })
    .catch(() => {
      cleanupMedia();
      onStatusChange?.("idle");
      onError?.("mic_denied");
      onEnd?.();
    });

  return {
    stop: () => {
      if (stopped || aborted) return;
      stopped = true;
      if (recorder && recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          cleanupMedia();
          onStatusChange?.("idle");
          onEnd?.();
        }
      } else {
        cleanupMedia();
        onStatusChange?.("idle");
        onEnd?.();
      }
    },
    abort: () => {
      aborted = true;
      uploadController.abort();
      if (recorder && recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          // Ignore stop errors during abort
        }
      }
      cleanupMedia();
      onStatusChange?.("idle");
    },
  };
}

export function startVoiceInput({
  language,
  capabilities,
  onTranscript,
  onFinal,
  onError,
  onEnd,
  onStatusChange,
  onAudioLevel,
  allowRecordedFallback = true,
}: {
  language: SupportedLocale;
  capabilities?: VoiceServerCapabilities;
  /** False for a listener that runs while a reply plays: recording would
      capture the reply itself and pay to transcribe the app's own voice. */
  allowRecordedFallback?: boolean;
  onTranscript: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (code: string) => void;
  onEnd?: () => void;
  onStatusChange?: (state: VoiceInputState) => void;
  onAudioLevel?: (level: number) => void;
}): VoiceInputHandle | null {
  if (!isVoiceInputSupported(language, capabilities)) return null;

  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  if (language === "lg") {
    return startRecordedVoiceInput({
      language: "lg",
      onFinal,
      onError,
      onEnd,
      onStatusChange,
      onAudioLevel,
    });
  }

  // For English, prefer real-time streaming SpeechRecognition so the user sees
  // every word appear live as they speak, with automatic fallback to
  // MediaRecorder + Firebase AI Logic multimodal audio if SpeechRecognition
  // is unavailable or hits a network/service error.
  const canFallbackToRecordedAi =
    allowRecordedFallback && isOnline && isMediaRecorderSupported() && isFirebaseAiConfigured();
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    if (canFallbackToRecordedAi) {
      return startRecordedVoiceInput({
        language: "en",
        onFinal,
        onError,
        onEnd,
        onStatusChange,
        onAudioLevel,
      });
    }
    return null;
  }

  onStatusChange?.("recording");

  const recognition = new Ctor();
  recognition.lang = "en-UG";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = "";
  let aborted = false;
  let deliveredFinal = false;
  let deliveredError = false;
  let fallbackHandle: VoiceInputHandle | null = null;
  let switchedToFallback = false;

  const trySwitchToFallback = (): boolean => {
    if (aborted || switchedToFallback || deliveredFinal || finalText.trim().length > 0 || !canFallbackToRecordedAi) {
      return false;
    }
    switchedToFallback = true;
    try {
      recognition.abort();
    } catch {
      // Ignore abort errors
    }
    fallbackHandle = startRecordedVoiceInput({
      language: "en",
      onFinal,
      onError,
      onEnd,
      onStatusChange,
      onAudioLevel,
    });
    return fallbackHandle !== null;
  };

  recognition.onresult = (event) => {
    if (aborted) return;
    const results = event.results;
    if (!results) return;
    let combined = "";
    let hasFinal = false;
    for (let i = 0; i < results.length; i += 1) {
      const item = results[i];
      const part = item?.[0]?.transcript?.trim() ?? "";
      if (part) {
        combined = combined ? `${combined} ${part}` : part;
      }
      if (item?.isFinal) {
        hasFinal = true;
      }
    }
    if (combined) {
      finalText = combined;
      onTranscript(combined);
    }
    if (hasFinal && combined && !deliveredFinal) {
      deliveredFinal = true;
      onFinal(combined);
    }
  };

  recognition.onerror = (event) => {
    if (aborted) return;
    const errCode = (event?.error ?? "unknown").toLowerCase();
    if (
      (errCode === "network" ||
        errCode === "service-not-allowed" ||
        errCode === "language-not-supported") &&
      trySwitchToFallback()
    ) {
      return;
    }
    const mapped =
      errCode === "not-allowed" || errCode === "permission-denied"
        ? "mic_denied"
        : errCode === "no-speech"
          ? "empty_transcript"
          : errCode;
    deliveredError = true;
    onError?.(mapped);
  };

  recognition.onend = () => {
    if (aborted || switchedToFallback) return;
    if (!deliveredFinal && finalText.trim()) {
      deliveredFinal = true;
      onFinal(finalText.trim());
    } else if (!deliveredFinal && !deliveredError) {
      // The listener can end with no words and no error, for example when a
      // short word like "two" was said just before it started. Report it so
      // the conversation can ask again instead of stopping without a sign.
      deliveredError = true;
      onError?.("empty_transcript");
    }
    onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    if (trySwitchToFallback()) {
      return {
        stop: () => fallbackHandle?.stop(),
        abort: () => fallbackHandle?.abort(),
      };
    }
    onError?.("start_failed");
    onEnd?.();
    return null;
  }

  return {
    stop: () => {
      if (aborted) return;
      if (fallbackHandle) {
        fallbackHandle.stop();
        return;
      }
      try {
        recognition.stop();
      } catch {
        // Ignore stop errors if already ended
      }
    },
    abort: () => {
      if (aborted) return;
      aborted = true;
      deliveredFinal = true;
      if (fallbackHandle) {
        fallbackHandle.abort();
        return;
      }
      try {
        recognition.abort();
      } catch {
        // Ignore abort errors if already ended
      }
      onStatusChange?.("idle");
    },
  };
}

const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

const audioClipCache = new Map<string, Blob>();
const inflightPrefetches = new Map<string, Promise<Blob | null>>();
const inflightPrefetchControllers = new Map<string, AbortController>();

function readClientVoiceInt(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function getClientVoiceLimits() {
  return {
    maxTextChars: readClientVoiceInt(
      process.env.NEXT_PUBLIC_VOICE_MAX_TEXT_CHARS,
      200,
      3_000,
      1_600,
    ),
    maxChunks: readClientVoiceInt(process.env.NEXT_PUBLIC_VOICE_MAX_CHUNKS, 2, 24, 8),
    minFirstChunkChars: readClientVoiceInt(
      process.env.NEXT_PUBLIC_VOICE_MIN_FIRST_CHUNK_CHARS,
      12,
      100,
      28,
    ),
    browserChunkChars: readClientVoiceInt(
      process.env.NEXT_PUBLIC_VOICE_BROWSER_CHUNK_CHARS,
      80,
      400,
      180,
    ),
    maxCachedClips: readClientVoiceInt(
      process.env.NEXT_PUBLIC_VOICE_MAX_CACHED_CLIPS,
      4,
      100,
      12,
    ),
  };
}

function abortInflightPrefetches(): void {
  for (const ctrl of inflightPrefetchControllers.values()) {
    try {
      ctrl.abort();
    } catch {
      // Ignore abort errors
    }
  }
  inflightPrefetchControllers.clear();
  inflightPrefetches.clear();
}

export function clearVoiceAudioCacheForTests(): void {
  audioClipCache.clear();
  abortInflightPrefetches();
}

function clampSpeechTextOnSentenceBoundary(
  input: string,
  maxChars = getClientVoiceLimits().maxTextChars,
): string {
  const cleaned = input.trim();
  if (cleaned.length <= maxChars) return cleaned;
  const slice = cleaned.slice(0, maxChars);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (lastSentenceEnd >= Math.floor(maxChars * 0.5)) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
}

/**
 * Splits longer spoken briefings into short natural sentence chunks (~120-180
 * chars) so neural TTS can start speaking the first sentence in 2-3 seconds
 * while synthesizing the next sentences concurrently in the background.
 */
export function splitTextForPipelinedSpeech(
  input: string,
  maxChunkChars = getAdvisorRemoteConfig().ttsChunkMaxChars,
  maxChunks = getClientVoiceLimits().maxChunks,
): string[] {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const firstChunkMax = Math.min(getAdvisorRemoteConfig().ttsFirstChunkMaxChars, maxChunkChars);
  const minFirstChunkChars = getClientVoiceLimits().minFirstChunkChars;
  if (cleaned.length <= firstChunkMax) return [cleaned];

  const rawSentences = cleaned
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  for (const sentence of rawSentences) {
    if (chunks.length >= maxChunks) break;
    const isOpeningSentence = chunks.length === 0 && !current;
    const clauseThreshold = isOpeningSentence ? firstChunkMax : maxChunkChars;
    if (sentence.length > clauseThreshold) {
      const clauses = sentence.replace(/([,;:])\s+/g, "$1\n").split("\n");
      if (sentence.length > maxChunkChars || clauses.length > 1) {
        pushCurrent();
        for (const clause of clauses) {
          if (chunks.length >= maxChunks) break;
          const activeLimit = chunks.length === 0 ? firstChunkMax : maxChunkChars;
          if (current && current.length + 1 + clause.length <= activeLimit) {
            current = `${current} ${clause}`;
          } else {
            pushCurrent();
            if (clause.length <= maxChunkChars) {
              current = clause;
              if (chunks.length === 0 && current.length >= minFirstChunkChars) {
                pushCurrent();
              }
            } else {
              chunks.push(clampSpeechTextOnSentenceBoundary(clause, maxChunkChars));
            }
          }
        }
        pushCurrent();
        continue;
      }
    }

    const targetMax = chunks.length === 0 ? firstChunkMax : maxChunkChars;
    if (!current) {
      current = sentence;
    } else if (
      (chunks.length > 0 || current.length < minFirstChunkChars) &&
      current.length + 1 + sentence.length <= targetMax
    ) {
      current = `${current} ${sentence}`;
    } else if (
      chunks.length === 0 &&
      current.length + 1 + sentence.length <= firstChunkMax
    ) {
      current = `${current} ${sentence}`;
    } else {
      pushCurrent();
      current = sentence;
    }
  }
  pushCurrent();
  return chunks.slice(0, maxChunks);
}

/** Splits only once, and never drops words: part one is the opening phrase
    (up to the Remote Config opening chunk limit, cut cleanly at a sentence,
    clause, or word boundary), and part two is everything after it. */
export function twoPartSpeech(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const firstPartMaxChars = getAdvisorRemoteConfig().ttsFirstChunkMaxChars + 5;
  const minFirstPartChars = getClientVoiceLimits().minFirstChunkChars;

  let cut = -1;
  let firstShortSentenceCut = -1;
  const sentenceRe = /[.!?](?=\s|$)/g;
  for (let match = sentenceRe.exec(trimmed); match !== null; match = sentenceRe.exec(trimmed)) {
    const endIdx = match.index + 1;
    if (endIdx > firstPartMaxChars) break;
    if (firstShortSentenceCut < 0) firstShortSentenceCut = endIdx;
    if (endIdx >= minFirstPartChars) {
      cut = endIdx;
      break;
    }
  }

  if (cut < 0 && trimmed.length <= firstPartMaxChars) {
    if (firstShortSentenceCut >= 12 && firstShortSentenceCut < trimmed.length) {
      cut = firstShortSentenceCut;
    } else {
      return [trimmed];
    }
  }

  if (cut < 0) {
    const clauseRe = /[,;:](?=\s)/g;
    for (let match = clauseRe.exec(trimmed); match !== null; match = clauseRe.exec(trimmed)) {
      const endIdx = match.index + 1;
      if (endIdx > firstPartMaxChars) break;
      if (endIdx >= minFirstPartChars) {
        cut = endIdx;
        break;
      }
    }
  }

  if (cut < 0 && firstShortSentenceCut >= 12) {
    cut = firstShortSentenceCut;
  }

  if (cut < 0) {
    const space = trimmed.lastIndexOf(" ", firstPartMaxChars);
    cut = space > 0 ? space : firstPartMaxChars;
  }

  const first = trimmed.slice(0, cut).trim();
  const rest = trimmed.slice(cut).trim();
  return rest ? [first, rest] : [first];
}

interface NeuralVoiceRoute {
  useFirebase: boolean;
  useServer: boolean;
  serverBackupForEnglish: boolean;
}

function hasStoredDailyGeminiPause(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const value = Number(window.localStorage.getItem("uw:gemini-voice-paused-until"));
    return Number.isFinite(value) && value > Date.now();
  } catch {
    return false;
  }
}

/** Picks the most natural voice available. On slow or data-saving mobile
    connections, or when Offline mode is active, English uses the device's
    built-in voice right away so reading starts with zero network wait.
    Luganda strictly uses the server neural voice chain (Gemini 3.8 Flash TTS
    streaming first, Sunbird AI Luganda backup) and never falls back to a
    robotic browser voice. */
function selectNeuralVoiceRoute(
  language: SupportedLocale,
  capabilities: VoiceServerCapabilities | undefined,
  isOnline: boolean,
  preferLocalVoice = false,
): NeuralVoiceRoute {
  if (!isOnline || preferLocalVoice) {
    return { useFirebase: false, useServer: false, serverBackupForEnglish: false };
  }
  if (language === "lg") {
    return {
      useFirebase: false,
      useServer: Boolean(capabilities?.lugandaTts),
      serverBackupForEnglish: false,
    };
  }
  if (hasStoredDailyGeminiPause() && isBrowserSpeechSynthesisSupported()) {
    return { useFirebase: false, useServer: false, serverBackupForEnglish: false };
  }
  if (isSlowOrConstrainedNetwork() && isBrowserSpeechSynthesisSupported()) {
    return { useFirebase: false, useServer: false, serverBackupForEnglish: false };
  }
  const englishServerReady = Boolean(capabilities?.englishNeuralTts);
  const useFirebase = isFirebaseNeuralTtsAvailable();
  return {
    useFirebase,
    useServer: !useFirebase && englishServerReady,
    serverBackupForEnglish: useFirebase && englishServerReady,
  };
}

export function prefetchVoiceClip({
  text,
  language,
  sourceLanguage,
  capabilities,
}: {
  text: string;
  language: SupportedLocale;
  sourceLanguage?: SupportedLocale;
  capabilities?: VoiceServerCapabilities;
}): void {
  if (typeof window === "undefined") return;
  // When Web Audio PCM streaming is available, clicking Listen streams the first
  // audio frames in ~0.8s-1.2s directly; firing a full unary synthesis on hover
  // would waste voice quota and queue a slow non-streaming call behind the cursor.
  if (isWebAudioStreamSupported()) return;
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  if (!isOnline) return;
  if (isSlowOrConstrainedNetwork()) return;

  const route = selectNeuralVoiceRoute(language, capabilities, true, false);
  const shouldUseServer = route.useServer;
  const shouldUseFirebaseNeuralTts = route.useFirebase;
  if (!shouldUseServer && !shouldUseFirebaseNeuralTts) return;

  const cleaned = text.trim();
  if (!cleaned) return;
  const limits = getClientVoiceLimits();
  if (inflightPrefetches.size >= limits.maxCachedClips) return;

  const payloadText = clampSpeechTextOnSentenceBoundary(
    language === "en" ? formatTextForSpeech(cleaned) : cleaned,
    limits.maxTextChars,
  );
  const cacheKey = `${shouldUseFirebaseNeuralTts ? "fb-tts" : (sourceLanguage ?? language)}:${language}:${payloadText}`;
  if (audioClipCache.has(cacheKey) || inflightPrefetches.has(cacheKey)) return;

  const prefetchController = new AbortController();
  inflightPrefetchControllers.set(cacheKey, prefetchController);

  const work: Promise<Blob | null> = (
    shouldUseFirebaseNeuralTts
      ? synthesizeSpeechWithFirebaseAi({
          text: payloadText,
          isPrefetch: true,
          signal: prefetchController.signal,
        })
      : fetch("/api/v1/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: payloadText, language, sourceLanguage }),
          signal: prefetchController.signal,
        }).then(async (res) => {
          if (!res.ok) return null;
          const blob = await res.blob();
          return blob.size > 0 ? blob : null;
        })
  )
    .then((blob) => {
      if (blob && blob.size > 0) {
        rememberAudioClip(cacheKey, blob);
        return blob;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      inflightPrefetches.delete(cacheKey);
      inflightPrefetchControllers.delete(cacheKey);
    });

  inflightPrefetches.set(cacheKey, work);
  void work;
}

let speakGeneration = 0;
let activeSpeakAbort: AbortController | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeSpeakOnStateChange: ((state: VoicePlaybackState) => void) | null = null;
let activeSpeakOnEnd: (() => void) | null = null;
const activeUtterances = new Set<SpeechSynthesisUtterance>();

function getOrCreateSharedAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
    (sharedAudio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    try {
      sharedAudio.setAttribute("playsinline", "");
      sharedAudio.setAttribute("webkit-playsinline", "");
    } catch {
      // Ignore attribute errors in test environments
    }
  }
  return sharedAudio;
}

function primeSharedAudioForGesture(): HTMLAudioElement | null {
  const audio = getOrCreateSharedAudio();
  if (!audio) return null;
  try {
    // Play the 44-byte silent PCM WAV unmuted inside the synchronous click/tap
    // handler so iOS Safari and Android Chrome unlock unmuted audio playback
    // for subsequent async neural TTS chunks.
    audio.muted = false;
    audio.onended = null;
    audio.onerror = null;
    audio.onplay = null;
    audio.src = SILENT_WAV_DATA_URI;
    void audio.play().catch(() => {
      // Ignore silent prime rejections on environments without audio output
    });
  } catch {
    // Ignore audio prime errors
  }
  return audio;
}

export function primeVoicePlaybackForGesture(): void {
  primeSharedAudioForGesture();
  primePcmStreamAudioForGesture();
}

function revokeActiveAudioUrl(): void {
  if (activeAudioUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    try {
      URL.revokeObjectURL(activeAudioUrl);
    } catch {
      // Ignore revoke errors
    }
    activeAudioUrl = null;
  }
}

function releaseActiveAudio(): void {
  stopActivePcmStream();
  if (sharedAudio) {
    try {
      sharedAudio.onended = null;
      sharedAudio.onerror = null;
      sharedAudio.onplay = null;
      sharedAudio.pause();
      sharedAudio.muted = false;
    } catch {
      // Ignore cleanup errors
    }
  }
  revokeActiveAudioUrl();
}

function rememberAudioClip(key: string, blob: Blob): void {
  const { maxCachedClips } = getClientVoiceLimits();
  if (audioClipCache.size >= maxCachedClips) {
    const oldestKey = audioClipCache.keys().next().value;
    if (oldestKey) audioClipCache.delete(oldestKey);
  }
  audioClipCache.set(key, blob);
}

function stopVoiceOutputInternal(skipIdleSpeechCancel: boolean): void {
  speakGeneration += 1;
  stopHumanBargeInMonitor();
  activeSpeakAbort?.abort();
  activeSpeakAbort = null;
  if (!skipIdleSpeechCancel) {
    abortInflightPrefetches();
  }
  releaseActiveAudio();
  activeUtterances.clear();
  if (isBrowserSpeechSynthesisSupported()) {
    try {
      const synth = window.speechSynthesis;
      const isIdle = synth.speaking === false && synth.pending === false;
      if (!skipIdleSpeechCancel || !isIdle) {
        synth.cancel();
      }
    } catch {
      // Ignore synthesis cancel errors
    }
  }
  const prevStateCb = activeSpeakOnStateChange;
  const prevEndCb = activeSpeakOnEnd;
  activeSpeakOnStateChange = null;
  activeSpeakOnEnd = null;
  prevStateCb?.("idle");
  prevEndCb?.();
}

export function stopVoiceOutput(): void {
  stopVoiceOutputInternal(false);
}

export function formatTextForSpeech(text: string): string {
  return text
    .replace(/(\d+)\s*°\s*\/\s*(\d+)\s*°/g, "$1 to $2 degrees")
    .replace(/(\d+)\s*°\s*C\b/gi, "$1 degrees Celsius")
    .replace(/(\d+)\s*°\s*F\b/gi, "$1 degrees Fahrenheit")
    .replace(/(\d+)\s*°/g, "$1 degrees")
    .replace(/\bkm\/h\b/gi, "kilometers per hour")
    .replace(/\bmm\/h\b/gi, "millimeters per hour")
    .replace(/(\d+(?:\.\d+)?)\s*mb\b/gi, "$1 millibars")
    .replace(/(\d+(?:\.\d+)?)\s*hPa\b/gi, "$1 millibars")
    .replace(/\bAQI\s+(\d+)\b/g, "air quality index $1")
    .replace(/\bEAT\b/g, "East Africa Time")
    .replace(/(\d+)\s*%/g, "$1 percent")
    .replace(/\s+/g, " ")
    .trim();
}

export type HandsFreeVoiceCommand =
  | { kind: "stop" }
  | { kind: "followup"; index: number; prompt: string }
  | { kind: "message"; prompt: string };

const STOP_VOICE_SESSION_RE =
  /^(stop|terminate|end|exit|cancel|quit|goodbye|bye|stop\s+talking|stop\s+listening|end\s+conversation|that\s+is\s+all|that's\s+all|nothing\s+else|no\s+more|thank\s+you\s+stop|thanks\s+stop|no\s+thank\s+you|no\s+thanks|lekera\s+awo|komya\s+awo|kimala|mala|lekera|siriikirira|weeraba|weebale\s+lekera\s+awo)$/i;

const CHOICE_ONE_RE =
  /^(1|one|number\s+one|number\s+1|option\s+one|option\s+1|first|the\s+first(\s+one)?|first\s+one|first\s+question|choice\s+one|choice\s+1|emu|namba\s+emu|ekisooka|ekibuuzo\s+ekisooka)$/i;

const CHOICE_TWO_RE =
  /^(2|two|to|too|number\s+two|number\s+2|option\s+two|option\s+2|second|the\s+second(\s+one)?|second\s+one|second\s+question|choice\s+two|choice\s+2|bbiri|namba\s+bbiri|ekyokubiri|ekibuuzo\s+ekyokubiri)$/i;

const CHOICE_THREE_RE =
  /^(3|three|number\s+three|number\s+3|option\s+three|option\s+3|third|the\s+third(\s+one)?|third\s+one|third\s+question|choice\s+three|choice\s+3|ssatu|namba\s+ssatu|ekyokusatu|ekibuuzo\s+ekyokusatu)$/i;

function tokenizeWords(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9'\s]+/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/**
 * Resolves a user's spoken utterance during a continuous hands-free conversation:
 * - Detects stop/termination commands ("stop", "terminate", "lekera awo", "kimala")
 * - Detects spoken recommendation choices ("one", "two", "emu", "bbiri", or reading out the recommendation text)
 * - Passes through any other spoken question as a natural conversation turn
 */
export function resolveHandsFreeVoiceCommand(
  transcript: string,
  followUps: readonly string[] = [],
): HandsFreeVoiceCommand {
  const cleaned = transcript
    .replace(/[!?.:,;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const lower = cleaned.toLowerCase();

  if (STOP_VOICE_SESSION_RE.test(lower)) {
    return { kind: "stop" };
  }

  if (followUps[0] && CHOICE_ONE_RE.test(lower)) {
    return { kind: "followup", index: 0, prompt: followUps[0] };
  }

  if (followUps[1] && CHOICE_TWO_RE.test(lower)) {
    return { kind: "followup", index: 1, prompt: followUps[1] };
  }

  if (followUps[2] && CHOICE_THREE_RE.test(lower)) {
    return { kind: "followup", index: 2, prompt: followUps[2] };
  }

  // Also check if the user read out one of the recommended follow up questions,
  // requiring high two way word overlap so extra place or time words ("in Gulu",
  // "tomorrow") are never rewritten to a different question.
  const spokenWords = tokenizeWords(lower);
  if (spokenWords.length >= 2 && followUps.length > 0) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < followUps.length; i += 1) {
      const candidate = followUps[i]!;
      const candidateLower = candidate.replace(/[!?.:,;]+$/g, "").trim().toLowerCase();
      if (candidateLower === lower) {
        return { kind: "followup", index: i, prompt: candidate };
      }
      const candidateWords = tokenizeWords(candidateLower);
      if (candidateWords.length === 0) continue;
      const matches = candidateWords.filter((w) => spokenWords.includes(w)).length;
      const candidateCoverage = matches / candidateWords.length;
      const spokenMatches = spokenWords.filter((w) => candidateWords.includes(w)).length;
      const spokenCoverage = spokenMatches / spokenWords.length;
      const score = Math.min(candidateCoverage, spokenCoverage);
      if (candidateCoverage === 1 && spokenCoverage === 1 && score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && followUps[bestIdx]) {
      return { kind: "followup", index: bestIdx, prompt: followUps[bestIdx]! };
    }
  }

  return { kind: "message", prompt: transcript.trim() };
}

/** True only for a short choice ("one", "two", "2", "three") or "stop"
    that may cut in while a reply is still being read out. Full sentences are
    not cut ins, so the app reading its own follow up options aloud can never
    interrupt itself. */
export function isHandsFreeCutInCommand(
  transcript: string,
  followUps: readonly string[] = [],
): boolean {
  const cleaned = transcript
    .replace(/[!?.:,;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) return false;
  if (STOP_VOICE_SESSION_RE.test(cleaned)) return true;
  if (followUps[0] && CHOICE_ONE_RE.test(cleaned)) return true;
  if (followUps[1] && CHOICE_TWO_RE.test(cleaned)) return true;
  if (followUps[2] && CHOICE_THREE_RE.test(cleaned)) return true;
  return false;
}

const PAUSE_OR_WAIT_CUT_IN_RE =
  /^(wait|hold\s+on|hang\s+on|pause|quiet|silence|enough|excuse\s+me|lindako|siriikirira)$/i;

const INTERIM_QUESTION_OPENER_RE =
  /^(what|what's|how|how's|when|where|will|can|could|should|is\s+it|are\s+there|tell\s+me|check|that\s+of|that\s+in|that\s+for|and\s+what|and\s+in|weather\s+in|weather\s+for|forecast\s+for|wait\b|hold\s+on|actually\b)/i;

const TELEMETRY_READOUT_ECHO_RE =
  /\b(degrees\s+celsius|degrees\s+fahrenheit|kilometers\s+per\s+hour|millimeters|millibars|saved\s+forecast|made\s+from\s+the\s+saved\s+numbers|without\s+ai|next,?\s+you\s+can\s+say\s+one)\b/i;

export function isPauseOnlyVoiceCommand(transcript: string): boolean {
  const cleaned = transcript
    .replace(/[!?.:,;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return PAUSE_OR_WAIT_CUT_IN_RE.test(cleaned);
}

/**
 * Determines whether speech heard while a reply is playing is a real human
 * interruption (barge-in) rather than speaker echo of the Advisor's own voice.
 * - `isFinal === false` (interim): triggers early barge-in as soon as the user
 *   says a clear stop/choice/pause command (excluding ambiguous single-word "to")
 *   or starts a non-echo question ("What about...", "That of..."), silencing
 *   playback immediately while the user finishes speaking.
 * - `isFinal === true`: accepts choices, stop/pause commands, and any non-echo,
 *   non-telemetry user question or place query.
 */
export function isHumanBargeInUtterance({
  transcript,
  spokenReply,
  followUps = [],
  isFinal,
}: {
  transcript: string;
  spokenReply: string;
  followUps?: readonly string[];
  isFinal: boolean;
}): boolean {
  const cleaned = transcript
    .replace(/[!?.:,;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return false;
  const lower = cleaned.toLowerCase();

  if (PAUSE_OR_WAIT_CUT_IN_RE.test(lower)) {
    return true;
  }

  if (isHandsFreeCutInCommand(cleaned, followUps)) {
    // A reply sentence starting with "To ..." emits interim "To" first; wait
    // for finalization on bare "to"/"too" so the speaker never cuts itself off.
    if (!isFinal && /^(to|too)$/i.test(lower)) {
      return false;
    }
    return true;
  }

  if (isEchoOfSpokenReply(cleaned, spokenReply)) {
    return false;
  }

  const words = lower.split(/\s+/).filter(Boolean);
  const hasQuestionOpener = INTERIM_QUESTION_OPENER_RE.test(lower) || transcript.includes("?");

  if (TELEMETRY_READOUT_ECHO_RE.test(lower) && !hasQuestionOpener) {
    return false;
  }

  if (!isFinal) {
    return (hasQuestionOpener && words.length >= 2) || words.length >= 4;
  }

  return words.length >= 2 || hasQuestionOpener;
}
/** Hands free voice (listening during the reply and opening the mic again
    after it) needs live speech to text, which browsers only offer for
    English. Luganda is recorded and sent to a paid service, so Luganda voice
    is tap to talk: one question, one spoken answer, mic off. */
export function supportsHandsFreeVoice(language: SupportedLocale): boolean {
  return language === "en" && getSpeechRecognitionCtor() !== null;
}

const ECHO_FILLER_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "what",
  "how",
  "can",
  "you",
  "will",
  "this",
  "that",
  "with",
  "from",
  "have",
  "any",
]);

/** While the reply plays, the microphone can pick up the app's own voice.
    Heard words that mostly repeat the reply are treated as that echo, so the
    app never interrupts itself. A spoken choice or "stop" is never echo. */
export function isEchoOfSpokenReply(heard: string, spokenReply: string): boolean {
  // Choices and "stop" first: "2" or "to" are too short for the word check.
  if (isHandsFreeCutInCommand(heard, ["_", "_", "_"])) return false;
  const allHeardWords = tokenizeWords(heard.toLowerCase());
  if (allHeardWords.length === 0) return true;
  const contentWords = allHeardWords.filter((word) => !ECHO_FILLER_WORDS.has(word));
  const heardWords = contentWords.length >= 2 ? contentWords : allHeardWords;
  // The speaker says "24 degrees Celsius" where the text has "24°C", so both
  // forms count as the reply's own words.
  const replyWords = new Set([
    ...tokenizeWords(spokenReply.toLowerCase()),
    ...tokenizeWords(formatTextForSpeech(spokenReply).toLowerCase()),
  ]);
  if (replyWords.size === 0) return false;
  const repeated = heardWords.filter((word) => replyWords.has(word)).length;
  return repeated / heardWords.length >= 0.6;
}

export function buildSpokenAdvisorTurnText(
  text: string,
  followUps: readonly string[] | undefined,
  language: SupportedLocale,
  isHandsFree: boolean,
): string {
  const base = text.trim();
  if (!base || !isHandsFree || !followUps || followUps.length === 0) {
    return base;
  }
  const first = followUps[0]?.trim();
  const second = followUps[1]?.trim();
  if (!first) return base;

  if (language === "lg") {
    const secondPart = second ? `, oba yogera nti bbiri okubuuza: ${second}` : "";
    return `${base} Kati oyinza okwogera nti emu okubuuza: ${first}${secondPart}, oba buuza ekibuuzo ekirala, oba yogera nti lekera awo okukomya.`;
  }

  const secondPart = second ? `, or say two for: ${second}` : "";
  return `${base} Next, you can say one for: ${first}${secondPart}, or ask another question, or say stop to end.`;
}

export function selectPreferredVoice(
  voices: readonly SpeechSynthesisVoice[],
  language: SupportedLocale,
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const isTargetLang = (voice: SpeechSynthesisVoice): boolean => {
    const lang = (voice.lang || "").toLowerCase();
    if (language === "lg") {
      return lang === "lg" || lang.startsWith("lg-") || lang === "lug" || lang.startsWith("lug-");
    }
    return lang === "en" || lang.startsWith("en-");
  };

  const candidates = voices.filter(isTargetLang);
  if (!candidates.length) return null;

  const scoreVoice = (voice: SpeechSynthesisVoice): number => {
    const name = (voice.name || "").toLowerCase();
    const lang = (voice.lang || "").toLowerCase();
    let score = 0;

    if (/(natural|neural|wavenet|studio)/.test(name)) score += 60;
    if (/(enhanced|premium|online)/.test(name)) score += 45;
    // Chrome's "Google ..." voices are streamed and sound far more natural
    // than the basic voices built into many entry level phones.
    if (/\bgoogle\b/.test(name)) score += 30;
    if (!voice.localService) score += 20;

    if (language === "en") {
      if (lang === "en-ug" || lang === "en-ke") score += 25;
      else if (lang === "en-gb" || lang === "en-us") score += 15;
      if (/(asilia|ava|aria|jenny|sonia|serena|samantha|daniel|karen)/.test(name)) score += 12;
    }

    if (/(compact|espeak|festival|eloquence|albert|bad news|bahh|bells|boing|bubbles|cellos|fred|good news|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|wobble|zarvox)/.test(name)) {
      score -= 80;
    }

    return score;
  };

  return [...candidates].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}

function speakWithBrowserVoice({
  text,
  language,
  generation,
  onEnd,
}: {
  text: string;
  language: SupportedLocale;
  generation: number;
  onEnd?: () => void;
}): boolean {
  if (language !== "en" || !isBrowserSpeechSynthesisSupported()) return false;
  try {
    const limits = getClientVoiceLimits();
    const spokenText = formatTextForSpeech(text);
    const chunks = splitTextForPipelinedSpeech(
      spokenText,
      limits.browserChunkChars,
      Math.max(12, limits.maxChunks),
    );
    if (chunks.length === 0) return false;

    const synth = window.speechSynthesis;
    if (synth.paused) {
      try {
        synth.resume();
      } catch {
        // Ignore resume errors
      }
    }

    const voices = synth.getVoices?.() ?? [];
    const chosenVoice = selectPreferredVoice(voices, language);

    const speakChunkAt = (index: number) => {
      if (generation !== speakGeneration) return;
      const chunk = chunks[index];
      if (!chunk) {
        onEnd?.();
        return;
      }

      const utterance = new window.SpeechSynthesisUtterance(chunk);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang;
      } else {
        // Use widely supported en-GB fallback when mobile getVoices() is empty on first tap
        utterance.lang = "en-GB";
      }
      utterance.rate = 0.98;
      utterance.pitch = 1;

      // Retain utterance reference so mobile browsers do not GC it mid-speech
      activeUtterances.add(utterance);
      const finalizeChunk = (shouldContinue: boolean) => {
        activeUtterances.delete(utterance);
        if (generation !== speakGeneration) return;
        if (shouldContinue && index + 1 < chunks.length) {
          speakChunkAt(index + 1);
        } else {
          onEnd?.();
        }
      };

      utterance.onend = () => finalizeChunk(true);
      utterance.onerror = () => finalizeChunk(false);
      synth.speak(utterance);
    };

    speakChunkAt(0);
    return true;
  } catch {
    activeUtterances.clear();
    onEnd?.();
    return false;
  }
}

export type VoicePlaybackState = "idle" | "loading" | "playing";

export function speakAdvisorReply({
  text,
  language,
  sourceLanguage,
  capabilities,
  preferLocalVoice = false,
  onStateChange,
  onEnd,
  onError,
  onInterrupted,
}: {
  text: string;
  language: SupportedLocale;
  sourceLanguage?: SupportedLocale;
  capabilities?: VoiceServerCapabilities;
  preferLocalVoice?: boolean;
  onStateChange?: (state: VoicePlaybackState) => void;
  onEnd?: () => void;
  onError?: () => void;
  onInterrupted?: () => void;
}): boolean {
  const cleaned = text.trim();
  if (!cleaned || !isVoiceOutputSupported(language, capabilities)) return false;

  stopVoiceOutputInternal(true);
  const generation = speakGeneration;
  activeSpeakOnStateChange = onStateChange ?? null;
  activeSpeakOnEnd = onEnd ?? null;

  const notifyFinished = () => {
    if (generation !== speakGeneration) return;
    stopHumanBargeInMonitor();
    const stateCb = activeSpeakOnStateChange;
    const endCb = activeSpeakOnEnd;
    activeSpeakOnStateChange = null;
    activeSpeakOnEnd = null;
    stateCb?.("idle");
    endCb?.();
  };

  if (onInterrupted) {
    startHumanBargeInMonitor(() => {
      if (generation !== speakGeneration) return;
      activeSpeakOnEnd = null;
      stopVoiceOutput();
      onInterrupted();
    });
  }

  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  const route = selectNeuralVoiceRoute(language, capabilities, isOnline, preferLocalVoice);
  const shouldUseServer = route.useServer;
  const shouldUseFirebaseNeuralTts = route.useFirebase;

  if (!shouldUseServer && !shouldUseFirebaseNeuralTts) {
    onStateChange?.("playing");
    const started = speakWithBrowserVoice({
      text: cleaned,
      language,
      generation,
      onEnd: notifyFinished,
    });
    if (!started) {
      notifyFinished();
      onError?.();
    }
    return started;
  }

  // Unlock shared HTMLAudioElement + Web Audio synchronously inside the user gesture
  // so streamed neural audio plays unmuted on iOS Safari and Android Chrome.
  const audio = primeSharedAudioForGesture();
  primePcmStreamAudioForGesture();
  const payloadText = clampSpeechTextOnSentenceBoundary(
    language === "en" ? formatTextForSpeech(cleaned) : cleaned,
    getClientVoiceLimits().maxTextChars,
  );

  // Send the entire English or Luganda text in one single Gemini request so
  // streaming starts in ~0.6s-1.4s with seamless prosody and 1 RPM call.
  const chunks = [payloadText];

  const makeCacheKey = (chunkText: string) =>
    `${shouldUseFirebaseNeuralTts ? "fb-tts" : (sourceLanguage ?? language)}:${language}:${chunkText}`;
  const fullKey = makeCacheKey(payloadText);
  const serverKey = `${sourceLanguage ?? language}:${language}:${payloadText}`;

  const playBlobOnce = (blob: Blob): Promise<void> =>
    new Promise((resolve, reject) => {
      if (generation !== speakGeneration) {
        resolve();
        return;
      }
      if (!audio || typeof URL.createObjectURL !== "function") {
        reject(new Error("AUDIO_UNSUPPORTED"));
        return;
      }
      // Guarantee browser speechSynthesis can never talk over neural audio
      if (isBrowserSpeechSynthesisSupported()) {
        try {
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
          }
        } catch {
          // Ignore cancel errors
        }
      }
      revokeActiveAudioUrl();
      const objectUrl = URL.createObjectURL(blob);
      activeAudioUrl = objectUrl;
      audio.muted = false;
      audio.onended = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.onplay = null;
        if (generation === speakGeneration) {
          revokeActiveAudioUrl();
        }
        resolve();
      };
      audio.onerror = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.onplay = null;
        if (generation === speakGeneration) {
          revokeActiveAudioUrl();
        }
        reject(new Error("AUDIO_PLAY_ERROR"));
      };
      audio.onplay = () => {
        if (generation === speakGeneration) {
          onStateChange?.("playing");
        }
      };
      audio.src = objectUrl;
      onStateChange?.("playing");
      void audio.play().catch((err) => {
        audio.onended = null;
        audio.onerror = null;
        audio.onplay = null;
        if (generation === speakGeneration) {
          revokeActiveAudioUrl();
        }
        reject(err);
      });
    });

  const controller = new AbortController();
  activeSpeakAbort = controller;
  const rc = getAdvisorRemoteConfig();
  const FIRST_CHUNK_TIMEOUT_MS = rc.ttsFirstChunkTimeoutMs;
  const SKIP_BACKUP_AFTER_MS = Math.max(800, Math.round(FIRST_CHUNK_TIMEOUT_MS / 3));
  const canFallbackToBrowser = language === "en" && isBrowserSpeechSynthesisSupported();

  const fetchChunkBlob = async (chunkText: string, chunkIndex: number): Promise<Blob> => {
    const key = makeCacheKey(chunkText);
    const cached = audioClipCache.get(key);
    if (cached) return cached;

    const useFastFirstChunkGuard = chunkIndex === 0 && canFallbackToBrowser;
    const deadlineAt = useFastFirstChunkGuard ? Date.now() + FIRST_CHUNK_TIMEOUT_MS : Infinity;

    const raceWithDeadline = async <T>(
      work: Promise<T>,
      onCancel?: () => void,
    ): Promise<T> => {
      if (!useFastFirstChunkGuard) {
        return work;
      }
      const remainingMs = Math.max(0, deadlineAt - Date.now());
      if (remainingMs === 0 || controller.signal.aborted) {
        onCancel?.();
        throw new Error("FIRST_CHUNK_TIMEOUT");
      }
      let timer: ReturnType<typeof setTimeout> | null = null;
      let abortListener: (() => void) | null = null;
      try {
        return await Promise.race<T>([
          work,
          new Promise<never>((_, reject) => {
            abortListener = () => {
              onCancel?.();
              reject(new Error("FIRST_CHUNK_TIMEOUT"));
            };
            controller.signal.addEventListener("abort", abortListener, { once: true });
            timer = setTimeout(() => {
              onCancel?.();
              reject(new Error("FIRST_CHUNK_TIMEOUT"));
            }, remainingMs);
          }),
        ]);
      } finally {
        if (timer !== null) clearTimeout(timer);
        if (abortListener) {
          controller.signal.removeEventListener("abort", abortListener);
        }
      }
    };

    // Deduplicate against any in-flight background prefetch for this exact chunk,
    // while still enforcing the fast first-chunk timeout so pointerdown prefetches
    // on stalled mobile networks cannot bypass the fallback timer.
    const inflight = inflightPrefetches.get(key);
    if (inflight) {
      const prefetchedBlob = await raceWithDeadline(inflight, () => {
        inflightPrefetchControllers.get(key)?.abort();
        inflightPrefetchControllers.delete(key);
        inflightPrefetches.delete(key);
      });
      if (prefetchedBlob && prefetchedBlob.size > 0) {
        return prefetchedBlob;
      }
    }

    const chunkController = useFastFirstChunkGuard ? new AbortController() : null;
    const onParentAbort = () => chunkController?.abort();
    if (chunkController) {
      if (controller.signal.aborted) {
        chunkController.abort();
      } else {
        controller.signal.addEventListener("abort", onParentAbort, { once: true });
      }
    }

    const activeSignal = chunkController ? chunkController.signal : controller.signal;

    const fetchServerBlob = () =>
      fetch("/api/v1/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunkText, language, sourceLanguage }),
        signal: activeSignal,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }
        return response.blob();
      });

    const synthesizeNetworkBlob = async (): Promise<Blob> => {
      let blob: Blob;
      if (shouldUseFirebaseNeuralTts) {
        const startedAt = Date.now();
        const firebaseBlob = await synthesizeSpeechWithFirebaseAi({
          text: chunkText,
          signal: activeSignal,
        });
        const allowBackupAttempt =
          route.serverBackupForEnglish &&
          !activeSignal.aborted &&
          (!useFastFirstChunkGuard || Date.now() - startedAt < SKIP_BACKUP_AFTER_MS);
        if (firebaseBlob) {
          blob = firebaseBlob;
        } else if (allowBackupAttempt) {
          blob = await fetchServerBlob();
        } else {
          throw new Error("FIREBASE_TTS_EMPTY");
        }
      } else {
        blob = await fetchServerBlob();
      }

      rememberAudioClip(key, blob);
      return blob;
    };

    try {
      const task = synthesizeNetworkBlob();
      void task.catch(() => {});
      return await raceWithDeadline(task, () => chunkController?.abort());
    } finally {
      if (chunkController) {
        controller.signal.removeEventListener("abort", onParentAbort);
      }
    }
  };

  const cachedImmediate = audioClipCache.get(fullKey) ?? audioClipCache.get(serverKey);
  const streamFirebaseFn = shouldUseFirebaseNeuralTts ? getStreamSpeechWithFirebaseAi() : null;
  const canStreamWebAudio =
    !cachedImmediate &&
    isWebAudioStreamSupported() &&
    (Boolean(streamFirebaseFn) || shouldUseServer || route.serverBackupForEnglish);

  if (!cachedImmediate) {
    onStateChange?.("loading");
  }

  if (canStreamWebAudio) {
    // Cancel any unfinished unary hover prefetch for this sentence so streaming
    // starts immediately without competing for bandwidth or quota.
    for (const k of [fullKey, serverKey]) {
      const pendingCtrl = inflightPrefetchControllers.get(k);
      if (pendingCtrl) {
        pendingCtrl.abort();
        inflightPrefetchControllers.delete(k);
        inflightPrefetches.delete(k);
      }
    }

    void (async () => {
      let firstAudioTimer: ReturnType<typeof setTimeout> | null = null;
      const clearFirstAudioTimer = () => {
        if (firstAudioTimer !== null) {
          clearTimeout(firstAudioTimer);
          firstAudioTimer = null;
        }
      };

      const pcmSession = createPcmStreamSession({
        onFirstPlay: () => {
          clearFirstAudioTimer();
          if (generation === speakGeneration) {
            onStateChange?.("playing");
          }
        },
      });

      if (!pcmSession) {
        onError?.();
        notifyFinished();
        return;
      }

      if (isBrowserSpeechSynthesisSupported()) {
        try {
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
          }
        } catch {
          // Ignore cancel errors
        }
      }

      if (canFallbackToBrowser) {
        firstAudioTimer = setTimeout(() => {
          firstAudioTimer = null;
          if (!pcmSession.hasStartedPlayback()) {
            controller.abort();
          }
        }, FIRST_CHUNK_TIMEOUT_MS);
      }

      try {
        if (shouldUseFirebaseNeuralTts && streamFirebaseFn) {
          const startedAt = Date.now();
          const streamed = await streamFirebaseFn({
            text: payloadText,
            signal: controller.signal,
            onPcmChunk: (bytes, rate) => {
              clearFirstAudioTimer();
              pcmSession.pushPcm16(bytes, rate);
            },
          });

          if (streamed) {
            clearFirstAudioTimer();
            const wavBlob = await pcmSession.finish();
            if (wavBlob && wavBlob.size > 0) {
              rememberAudioClip(fullKey, wavBlob);
            }
            if (generation === speakGeneration) {
              notifyFinished();
            }
            return;
          }

          const allowBackupAttempt =
            route.serverBackupForEnglish &&
            !controller.signal.aborted &&
            !pcmSession.hasStartedPlayback() &&
            (!canFallbackToBrowser || Date.now() - startedAt < SKIP_BACKUP_AFTER_MS);
          if (!allowBackupAttempt) {
            throw new Error("FIREBASE_STREAM_EMPTY");
          }
        }

        const response = await fetch("/api/v1/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: payloadText, language, sourceLanguage, stream: true }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const contentType = (response.headers?.get?.("content-type") ?? "").toLowerCase();
        if (
          (contentType.includes("audio/l16") || contentType.includes("audio/pcm")) &&
          response.body
        ) {
          const rateMatch = /rate=(\d+)/i.exec(contentType);
          const sampleRate = rateMatch ? Number(rateMatch[1]) || 24_000 : 24_000;
          const reader = response.body.getReader();
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (generation !== speakGeneration) {
                pcmSession.abort();
                return;
              }
              if (value && value.byteLength > 0) {
                clearFirstAudioTimer();
                pcmSession.pushPcm16(value, sampleRate);
              }
            }
          } finally {
            try {
              reader.releaseLock();
            } catch {
              // Ignore reader release errors
            }
          }

          clearFirstAudioTimer();
          const wavBlob = await pcmSession.finish();
          if (wavBlob && wavBlob.size > 0) {
            rememberAudioClip(serverKey, wavBlob);
            rememberAudioClip(fullKey, wavBlob);
          }
          if (generation === speakGeneration) {
            notifyFinished();
          }
          return;
        }

        // Cached WAV hit or Sunbird WAV/MP3 fallback response
        clearFirstAudioTimer();
        pcmSession.abort();
        const blob = await response.blob();
        if (generation !== speakGeneration) return;
        rememberAudioClip(serverKey, blob);
        rememberAudioClip(fullKey, blob);
        await playBlobOnce(blob);
        if (generation === speakGeneration) {
          notifyFinished();
        }
      } catch {
        clearFirstAudioTimer();
        const hadStarted = pcmSession.hasStartedPlayback();
        pcmSession.abort();
        if (generation !== speakGeneration) return;
        controller.abort();
        releaseActiveAudio();
        if (isBrowserSpeechSynthesisSupported()) {
          try {
            window.speechSynthesis.cancel();
          } catch {
            // Ignore cancel errors
          }
        }
        const fellBack =
          !hadStarted && canFallbackToBrowser
            ? speakWithBrowserVoice({
                text: cleaned,
                language,
                generation,
                onEnd: notifyFinished,
              })
            : false;
        if (fellBack) {
          onStateChange?.("playing");
        } else {
          notifyFinished();
          onError?.();
        }
      }
    })();

    return true;
  }

  // Fallback blob playback path (cached clips and environments without Web Audio)
  void (async () => {
    let currentChunkIndex = 0;
    try {
      let nextPromise: Promise<Blob> | null = chunks[0] ? fetchChunkBlob(chunks[0], 0) : null;
      for (let i = 0; i < chunks.length; i += 1) {
        currentChunkIndex = i;
        if (generation !== speakGeneration || !nextPromise) return;
        const currentPromise = nextPromise;
        const blob = await currentPromise;
        if (generation !== speakGeneration) return;

        nextPromise = i + 1 < chunks.length ? fetchChunkBlob(chunks[i + 1]!, i + 1) : null;
        if (nextPromise) void nextPromise.catch(() => {});

        await playBlobOnce(blob);
      }
      if (generation === speakGeneration) {
        notifyFinished();
      }
    } catch {
      if (generation !== speakGeneration) return;
      // Abort any remaining in-flight neural chunk requests before fallback so
      // two voices can never overlap.
      controller.abort();
      releaseActiveAudio();
      if (isBrowserSpeechSynthesisSupported()) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore cancel errors
        }
      }
      // Only fall back on remaining unspoken chunks so we never re-read from the start
      const remainingText =
        currentChunkIndex === 0 ? cleaned : chunks.slice(currentChunkIndex).join(" ").trim();
      const fellBack = remainingText
        ? speakWithBrowserVoice({
            text: remainingText,
            language,
            generation,
            onEnd: notifyFinished,
          })
        : false;
      if (fellBack) {
        onStateChange?.("playing");
      } else {
        notifyFinished();
        onError?.();
      }
    }
  })();

  return true;
}
