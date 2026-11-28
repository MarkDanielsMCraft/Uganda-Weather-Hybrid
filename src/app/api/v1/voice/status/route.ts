import { createMeta, jsonResponse } from "@/lib/cache";
import { isGeminiTtsConfigured } from "@/lib/voice/gemini-tts";
import { isSunbirdConfigured } from "@/lib/voice/sunbird";

export async function GET() {
  const cloudVoiceReady = isSunbirdConfigured();
  // Only a fast natural English voice counts. The Luganda service can also
  // read English, but it takes many seconds per sentence, so the browser's
  // own instant voice is the better backup when Gemini is busy.
  const englishNeuralTts = isGeminiTtsConfigured();

  return jsonResponse(
    {
      lugandaTts: cloudVoiceReady || englishNeuralTts,
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
