export async function register() {
  // No DSN configured -> Sentry stays completely out of the bundle. This
  // must be true for every contributor who hasn't set up a Sentry project.
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
