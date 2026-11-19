import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";

export const DEFAULT_CLOUD_MODEL = "gemini-3.5-flash-lite";

interface FirebaseClientEnv {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  model?: string;
  recaptchaEnterpriseSiteKey?: string;
  appCheckDebugToken?: string;
}

function readFirebaseClientEnv(): FirebaseClientEnv {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || undefined,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || undefined,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || undefined,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || undefined,
    model: process.env.NEXT_PUBLIC_FIREBASE_AI_MODEL?.trim() || undefined,
    recaptchaEnterpriseSiteKey:
      process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY?.trim() || undefined,
    appCheckDebugToken: process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim() || undefined,
  };
}

function buildFirebaseOptions(env: FirebaseClientEnv): FirebaseOptions | null {
  if (!env.apiKey || !env.projectId || !env.appId) {
    return null;
  }
  return {
    apiKey: env.apiKey,
    authDomain: env.authDomain,
    projectId: env.projectId,
    storageBucket: env.storageBucket,
    messagingSenderId: env.messagingSenderId,
    appId: env.appId,
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedAppCheck: AppCheck | null = null;
let cachedAi: AI | null = null;

export function isFirebaseAiConfigured(): boolean {
  return buildFirebaseOptions(readFirebaseClientEnv()) !== null;
}

export function getConfiguredCloudModel(): string {
  return readFirebaseClientEnv().model || DEFAULT_CLOUD_MODEL;
}

function configureAppCheckIfPresent(app: FirebaseApp, env: FirebaseClientEnv): void {
  if (typeof window === "undefined" || cachedAppCheck) return;

  const debugToken = env.appCheckDebugToken;
  if (debugToken) {
    const scope = globalThis as typeof globalThis & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
    };
    scope.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === "true" ? true : debugToken;
  }

  if (!env.recaptchaEnterpriseSiteKey) return;

  try {
    cachedAppCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(env.recaptchaEnterpriseSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.warn("[ai-advisor] app check initialization skipped:", error);
  }
}

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (cachedApp) return cachedApp;

  const env = readFirebaseClientEnv();
  const options = buildFirebaseOptions(env);
  if (!options) return null;

  const app = getApps().length > 0 ? getApp() : initializeApp(options);
  cachedApp = app;
  configureAppCheckIfPresent(app, env);
  return app;
}

export function isAppCheckActive(): boolean {
  return cachedAppCheck !== null;
}

export function getFirebaseAiClient(): AI | null {
  if (typeof window === "undefined") return null;
  if (cachedAi) return cachedAi;

  const app = getFirebaseApp();
  if (!app) return null;

  cachedAi = getAI(app, {
    backend: new GoogleAIBackend(),
    useLimitedUseAppCheckTokens: isAppCheckActive(),
  });
  return cachedAi;
}

export function resetFirebaseAiClientForTests(): void {
  cachedApp = null;
  cachedAppCheck = null;
  cachedAi = null;
}
