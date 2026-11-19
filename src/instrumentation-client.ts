const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Dynamic import, not a static one: with no DSN this whole block is dead
// code after build-time inlining, and Next's minifier drops it — the
// @sentry/nextjs client SDK (~80KB) never enters the bundle at all for
// contributors/deploys that haven't set one up. A static top-level import
// would ship that weight unconditionally regardless of whether Sentry is
// actually enabled, which matters for this app's low-bandwidth audience.
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",
      tracesSampleRate: 0.2,
      // No user accounts exist in this app (see ADR-006), so there is no
      // legitimate user context to attach. Explicit rather than relying
      // on the SDK default.
      sendDefaultPii: false,
      // Session Replay is off by default: it can capture form input outside
      // the scope of this app's existing cookie-consent banner. Only turn on
      // replayIntegration() if that's explicitly extended to cover it.
    });
  });
}

export function onRouterTransitionStart(href: string, navigationType: string) {
  if (!dsn) return;
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureRouterTransitionStart(href, navigationType);
  });
}
