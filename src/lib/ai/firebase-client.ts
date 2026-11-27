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

/**
 * Adds AbortSignal.any only on older browsers (such as iOS 15 to 17.3 Safari)
 * where @firebase/ai calls AbortSignal.any() internally. Modern browsers have
 * AbortSignal.any built in and skip this completely.
 */
export function ensureAbortSignalAnyPolyfill(): void {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.any === "function") {
    return;
  }
  AbortSignal.any = function abortSignalAny(signals: Iterable<AbortSignal>): AbortSignal {
    const controller = new AbortController();
    const list = Array.from(signals);
    for (const sig of list) {
      if (sig.aborted) {
        try {
          controller.abort(sig.reason);
        } catch {
          controller.abort();
        }
        return controller.signal;
      }
    }
    const cleanups: Array<() => void> = [];
    for (const sig of list) {
      const onAbort = () => {
        for (const cleanup of cleanups) cleanup();
        cleanups.length = 0;
        try {
          controller.abort(sig.reason);
        } catch {
          controller.abort();
        }
      };
      sig.addEventListener("abort", onAbort, { once: true });
      cleanups.push(() => sig.removeEventListener("abort", onAbort));
    }
    return controller.signal;
  };
}

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

  const providerSiteKey = env.recaptchaEnterpriseSiteKey || (debugToken ? "debug" : undefined);
  if (!providerSiteKey) return;

  try {
    cachedAppCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(providerSiteKey),
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

  ensureAbortSignalAnyPolyfill();
  const app = getFirebaseApp();
  if (!app) return null;

  cachedAi = getAI(app, {
    backend: new GoogleAIBackend(),
    // Standard auto-refreshed App Check tokens avoid re-running reCAPTCHA
    // attestation on every prompt, which caused 403/24h throttling lockouts
    // for real mobile Safari users on carrier NAT networks.
    useLimitedUseAppCheckTokens: false,
  });
  return cachedAi;
}

/**
 * Warms the Firebase App and App Check token exchange in the background during
 * browser idle time (spending zero Gemini requests) so the first voice or
 * advisor request does not wait ~700ms on cold App Check initialization.
 */
export function warmFirebaseAiClient(): void {
  if (typeof window === "undefined" || cachedAi || !isFirebaseAiConfigured()) return;
  const run = () => {
    try {
      getFirebaseAiClient();
    } catch {
      // Ignore background warm-up errors
    }
  };
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(run, { timeout: 1_500 });
  } else {
    window.setTimeout(run, 350);
  }
}

export function resetFirebaseAiClientForTests(): void {
  cachedApp = null;
  cachedAppCheck = null;
  cachedAi = null;
}
