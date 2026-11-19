export {
  checkAndRecordAdvisorRateLimit,
  isPromptInjectionOrAbuse,
  matchInstantSocialReply,
  resolveReferencedUgandaLocation,
  sanitizeUserMessage,
  type InstantReply,
  type RateLimitResult,
  type ResolvedAdvisorLocation,
} from "./advisor-guard";
export {
  AdvisorAudienceSchema,
  AdvisorQuestionSchema,
  AdvisorRequestInputSchema,
  buildAdvisorSystemInstruction,
  buildWeatherContextPrompt,
  type AdvisorAudience,
  type AdvisorTurn,
} from "./advisor-prompt";
export {
  DEFAULT_CLOUD_MODEL,
  getConfiguredCloudModel,
  getFirebaseAiClient,
  getFirebaseApp,
  isAppCheckActive,
  isFirebaseAiConfigured,
} from "./firebase-client";
export {
  getAdvisorRemoteConfig,
  syncAdvisorRemoteConfig,
  type AdvisorRemoteConfigSnapshot,
} from "./remote-config";
export {
  detectOnDeviceAvailability,
  generateHybridWeatherBriefing,
  resolveHybridReadiness,
  type BriefingInferenceSource,
  type BriefingPhase,
  type HybridRuntimeReadiness,
  type OnDeviceModelAvailability,
  type WeatherBriefingError,
  type WeatherBriefingErrorCode,
  type WeatherBriefingOutcome,
  type WeatherBriefingResult,
} from "./hybrid-advisor";
