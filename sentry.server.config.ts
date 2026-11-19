import * as Sentry from "@sentry/nextjs";

// Only ever imported from src/instrumentation.ts when SENTRY_DSN is set —
// safe to call init() unconditionally here.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.2,
  // No user accounts exist in this app (see ADR-006), so there is no
  // legitimate user context to attach. Explicit rather than relying on
  // the SDK default, so a future SDK upgrade can never silently change
  // this app's privacy posture.
  sendDefaultPii: false,
});
