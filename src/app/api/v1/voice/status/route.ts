import { createMeta, jsonResponse } from "@/lib/cache";
import { isGeminiTtsConfigured } from "@/lib/voice/gemini-tts";
import { isEnglishCloudVoiceEnabled, isSunbirdConfigured } from "@/lib/voice/sunbird";

export async function GET() {
  const cloudVoiceReady = isSunbirdConfigured();
  const englishNeuralTts =
    (cloudVoiceReady && isEnglishCloudVoiceEnabled()) || isGeminiTtsConfigured();

  return jsonResponse(
    {
      lugandaTts: cloudVoiceReady,
      lugandaStt: cloudVoiceReady,
      lugandaTranslation: cloudVoiceReady,
      englishNeuralTts,
    },
    createMeta(false),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
