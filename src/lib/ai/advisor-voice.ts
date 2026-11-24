import type { SupportedLocale } from "@/lib/i18n/types";
import { isFirebaseAiConfigured } from "@/lib/ai/firebase-client";
import { transcribeEnglishAudioWithFirebaseAi } from "@/lib/ai/firebase-audio-transcribe";
import {
  isFirebaseNeuralTtsAvailable,
  synthesizeSpeechWithFirebaseAi,
} from "@/lib/ai/firebase-tts";

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

export function resetVoiceCapabilitiesForTests(): void {
  cachedCapabilities = null;
  capabilitiesPromise = null;
}

export async function fetchVoiceCapabilities(
  forceRefresh = false,
): Promise<VoiceServerCapabilities> {
  if (typeof window === "undefined") return DEFAULT_CAPABILITIES;
  if (!forceRefresh && cachedCapabilities) return cachedCapabilities;
  if (!forceRefresh && capabilitiesPromise) return capabilitiesPromise;

  const task = (async () => {
    try {
      const response = await fetch("/api/v1/voice/status", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return DEFAULT_CAPABILITIES;
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
      return next;
    } catch {
      return cachedCapabilities ?? DEFAULT_CAPABILITIES;
    } finally {
      capabilitiesPromise = null;
    }
  })();

  capabilitiesPromise = task;
  return task;
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

function hasNativeLugandaVoice(): boolean {
  if (!isBrowserSpeechSynthesisSupported()) return false;
  try {
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    return voices.some((voice) => {
      const lang = (voice.lang || "").toLowerCase();
      return lang === "lg" || lang.startsWith("lg-") || lang === "lug" || lang.startsWith("lug-");
    });
  } catch {
    return false;
  }
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
    return Boolean(capabilities?.lugandaTts) || hasNativeLugandaVoice();
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
    .getUserMedia({ audio: true })
    .then((stream) => {
      if (aborted) {
        stream.getTracks().forEach((track) => track.stop());
        onStatusChange?.("idle");
        onEnd?.();
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
          onEnd?.();
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
            onEnd?.();
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
}: {
  language: SupportedLocale;
  capabilities?: VoiceServerCapabilities;
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
    isOnline && isMediaRecorderSupported() && isFirebaseAiConfigured();
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
  let deliveredFinal = false;
  let fallbackHandle: VoiceInputHandle | null = null;
  let switchedToFallback = false;

  const trySwitchToFallback = (): boolean => {
    if (switchedToFallback || deliveredFinal || finalText.trim().length > 0 || !canFallbackToRecordedAi) {
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
    onError?.(mapped);
  };

  recognition.onend = () => {
    if (switchedToFallback) return;
    if (!deliveredFinal && finalText.trim()) {
      deliveredFinal = true;
      onFinal(finalText.trim());
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
    },
  };
}

const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

const MAX_CACHED_AUDIO_CLIPS = 12;
const audioClipCache = new Map<string, Blob>();
const inflightPrefetches = new Map<string, Promise<Blob | null>>();

function clampSpeechTextOnSentenceBoundary(input: string, maxChars = 1500): string {
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
  maxChunkChars = 165,
  maxChunks = 8,
): string[] {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChunkChars) return [cleaned];

  const rawSentences = cleaned
    .split(/(?<=[.!?])\s+/)
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
    if (sentence.length > maxChunkChars) {
      pushCurrent();
      // Split an extra-long sentence cleanly on commas or word boundaries
      const clauses = sentence.split(/(?<=,|;)\s+/);
      for (const clause of clauses) {
        if (chunks.length >= maxChunks) break;
        if (current && current.length + 1 + clause.length <= maxChunkChars) {
          current = `${current} ${clause}`;
        } else {
          pushCurrent();
          if (clause.length <= maxChunkChars) {
            current = clause;
          } else {
            chunks.push(clampSpeechTextOnSentenceBoundary(clause, maxChunkChars));
          }
        }
      }
      pushCurrent();
      continue;
    }

    // Keep chunk 1 extra short (<= 110 chars) for fastest time-to-first-audio
    const targetMax = chunks.length === 0 ? Math.min(110, maxChunkChars) : maxChunkChars;
    if (!current) {
      current = sentence;
    } else if (current.length + 1 + sentence.length <= targetMax) {
      current = `${current} ${sentence}`;
    } else {
      pushCurrent();
      current = sentence;
    }
  }
  pushCurrent();
  return chunks.slice(0, maxChunks);
}

const FIRST_PART_MAX_CHARS = 180;

/** Splits only once, and never drops words: part one is the first sentence
    (or the first 180 characters, cut at a space), and part two is exactly
    everything after it. */
export function twoPartSpeech(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const sentenceEnd = trimmed.search(/[.!?](\s|$)/);
  let cut = sentenceEnd >= 0 && sentenceEnd < FIRST_PART_MAX_CHARS ? sentenceEnd + 1 : -1;
  if (cut < 0) {
    if (trimmed.length <= FIRST_PART_MAX_CHARS) return [trimmed];
    const space = trimmed.lastIndexOf(" ", FIRST_PART_MAX_CHARS);
    cut = space > 0 ? space : FIRST_PART_MAX_CHARS;
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

/** Picks the most natural voice available. English tries the Firebase AI
    Logic Gemini voice first, then the server voice if one is set up, and
    only then the browser voice. Luganda uses the server voice. */
function selectNeuralVoiceRoute(
  language: SupportedLocale,
  capabilities: VoiceServerCapabilities | undefined,
  isOnline: boolean,
): NeuralVoiceRoute {
  if (!isOnline) return { useFirebase: false, useServer: false, serverBackupForEnglish: false };
  if (language === "lg") {
    return {
      useFirebase: false,
      useServer: Boolean(capabilities?.lugandaTts),
      serverBackupForEnglish: false,
    };
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
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  if (!isOnline) return;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return;

  const route = selectNeuralVoiceRoute(language, capabilities, true);
  const shouldUseServer = route.useServer;
  const shouldUseFirebaseNeuralTts = route.useFirebase;
  if (!shouldUseServer && !shouldUseFirebaseNeuralTts) return;

  const cleaned = text.trim();
  if (!cleaned) return;
  const payloadText = clampSpeechTextOnSentenceBoundary(
    language === "en" ? formatTextForSpeech(cleaned) : cleaned,
    1500,
  );
  // Prefetch the first short sentence chunk so clicking Listen starts speaking instantly
  const firstChunk =
    (shouldUseFirebaseNeuralTts ? twoPartSpeech(payloadText)[0] : splitTextForPipelinedSpeech(payloadText)[0])
    ?? payloadText;
  const cacheKey = `${shouldUseFirebaseNeuralTts ? "fb-tts" : (sourceLanguage ?? language)}:${language}:${firstChunk}`;
  if (audioClipCache.has(cacheKey) || inflightPrefetches.has(cacheKey)) return;

  const work: Promise<Blob | null> = (
    shouldUseFirebaseNeuralTts
      ? synthesizeSpeechWithFirebaseAi({ text: firstChunk, isPrefetch: true })
      : fetch("/api/v1/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: firstChunk, language, sourceLanguage }),
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
  if (audioClipCache.size >= MAX_CACHED_AUDIO_CLIPS) {
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

  // Also check if the user simply read out one of the recommended follow-up questions
  const spokenWords = tokenizeWords(lower);
  if (spokenWords.length >= 2 && followUps.length > 0) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < followUps.length; i += 1) {
      const candidate = followUps[i]!;
      const candidateLower = candidate.replace(/[!?.:,;]+$/g, "").trim().toLowerCase();
      if (candidateLower === lower || candidateLower.includes(lower) || lower.includes(candidateLower)) {
        return { kind: "followup", index: i, prompt: candidate };
      }
      const candidateWords = tokenizeWords(candidateLower);
      if (candidateWords.length === 0) continue;
      const matches = candidateWords.filter((w) => spokenWords.includes(w)).length;
      const score = matches / candidateWords.length;
      if (score >= 0.55 && score > bestScore) {
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

/**
 * Formats an assistant reply for spoken output, appending numbered spoken
 * follow-up options when the user is in a continuous hands-free conversation.
 */
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
  if (!isBrowserSpeechSynthesisSupported()) return false;
  if (language === "lg" && !hasNativeLugandaVoice()) return false;
  try {
    const spokenText = language === "en" ? formatTextForSpeech(text) : text.trim();
    const chunks = splitTextForPipelinedSpeech(spokenText, 180, 12);
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
        utterance.lang = language === "lg" ? "lg-UG" : "en-GB";
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
  onStateChange,
  onEnd,
  onInterrupted,
}: {
  text: string;
  language: SupportedLocale;
  sourceLanguage?: SupportedLocale;
  capabilities?: VoiceServerCapabilities;
  onStateChange?: (state: VoicePlaybackState) => void;
  onEnd?: () => void;
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
  const route = selectNeuralVoiceRoute(language, capabilities, isOnline);
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
    }
    return started;
  }

  // Unlock the shared HTMLAudioElement synchronously inside the user gesture
  // so neural audio plays reliably even if synthesis takes several seconds.
  const audio = primeSharedAudioForGesture();
  const payloadText = clampSpeechTextOnSentenceBoundary(
    language === "en" ? formatTextForSpeech(cleaned) : cleaned,
    1500,
  );

  // The Gemini voice allows only a few requests a minute, so it gets the
  // answer in two parts at most: a short first sentence so speech starts fast,
  // then everything else in one request.
  const chunks = shouldUseFirebaseNeuralTts
    ? twoPartSpeech(payloadText)
    : shouldUseServer
      ? splitTextForPipelinedSpeech(payloadText)
      : [payloadText];

  const makeCacheKey = (chunkText: string) =>
    `${shouldUseFirebaseNeuralTts ? "fb-tts" : (sourceLanguage ?? language)}:${language}:${chunkText}`;

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

  const fetchChunkBlob = async (chunkText: string): Promise<Blob> => {
    const key = makeCacheKey(chunkText);
    const cached = audioClipCache.get(key);
    if (cached) return cached;

    // Deduplicate against any in-flight background prefetch for this exact chunk
    const inflight = inflightPrefetches.get(key);
    if (inflight) {
      const prefetchedBlob = await inflight;
      if (prefetchedBlob && prefetchedBlob.size > 0) {
        return prefetchedBlob;
      }
    }

    const fetchServerBlob = () =>
      fetch("/api/v1/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunkText, language, sourceLanguage }),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }
        return response.blob();
      });

    let blob: Blob;
    if (shouldUseFirebaseNeuralTts) {
      const firebaseBlob = await synthesizeSpeechWithFirebaseAi({
        text: chunkText,
        signal: controller.signal,
      });
      if (firebaseBlob) {
        blob = firebaseBlob;
      } else if (route.serverBackupForEnglish && !controller.signal.aborted) {
        // Firebase voice is busy or out of quota: use the server's natural
        // voice before falling back to the more robotic browser voice.
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

  if (!audioClipCache.has(makeCacheKey(chunks[0] ?? payloadText))) {
    onStateChange?.("loading");
  }

  // Pipelined neural playback: always use studio-grade neural voice (Firebase AI
  // Logic Neural TTS for English, Sunbird Neural TTS for Luganda) when online,
  // fetching chunk i+1 while chunk i plays. Browser speechSynthesis is strictly
  // an offline / error fallback and is never triggered mid-flight alongside audio.
  void (async () => {
    let currentChunkIndex = 0;
    try {
      let nextPromise: Promise<Blob> | null = chunks[0] ? fetchChunkBlob(chunks[0]) : null;
      for (let i = 0; i < chunks.length; i += 1) {
        currentChunkIndex = i;
        if (generation !== speakGeneration || !nextPromise) return;
        const currentPromise = nextPromise;
        // Kick off synthesis of the next chunk concurrently while waiting/playing current chunk
        nextPromise = i + 1 < chunks.length ? fetchChunkBlob(chunks[i + 1]!) : null;
        // Prevent unhandled rejection if aborted before next chunk is awaited
        if (nextPromise) void nextPromise.catch(() => {});

        const blob = await currentPromise;
        if (generation !== speakGeneration) return;
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
      if (!fellBack) {
        notifyFinished();
      }
    }
  })();

  return true;
}
