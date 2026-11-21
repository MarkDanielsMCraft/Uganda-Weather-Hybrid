import { getGenerativeModel, InferenceMode } from "firebase/ai";
import { getFirebaseAiClient } from "@/lib/ai/firebase-client";
import { getAdvisorRemoteConfig } from "@/lib/ai/remote-config";

async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error("AUDIO_READ_FAILED"));
      reader.readAsDataURL(blob);
    });
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Transcribes a spoken English weather question using Firebase AI Logic
 * multimodal audio input (Gemini) so microphone input works across all
 * browsers without relying on browser-specific SpeechRecognition engines.
 */
export async function transcribeEnglishAudioWithFirebaseAi(
  audioBlob: Blob,
  signal?: AbortSignal,
): Promise<string> {
  const ai = getFirebaseAiClient();
  if (!ai) {
    throw new Error("FIREBASE_AI_NOT_CONFIGURED");
  }

  const base64Audio = await blobToBase64(audioBlob);
  if (!base64Audio) {
    throw new Error("EMPTY_AUDIO_CLIP");
  }

  const cleanMime = (audioBlob.type || "audio/webm").split(";")[0]?.trim() || "audio/webm";
  const model = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: getAdvisorRemoteConfig().cloudModel,
      generationConfig: {
        maxOutputTokens: 120,
        temperature: 0,
      },
    },
  });

  const result = await model.generateContent(
    [
      {
        type: "inlineData",
        inlineData: {
          mimeType: cleanMime,
          data: base64Audio,
        },
      },
      {
        type: "text",
        text: "Transcribe the spoken English weather question accurately. Output ONLY the exact transcribed text with no quotes, labels, or extra words. If no speech is audible, output an empty string.",
      },
    ],
    signal ? { signal } : undefined,
  );

  return result.response.text().trim().replace(/^["']|["']$/g, "");
}
