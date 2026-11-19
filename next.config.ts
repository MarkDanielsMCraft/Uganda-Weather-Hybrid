import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@capacitor/core",
    "@capacitor/app",
    "@capacitor/geolocation",
    "@capacitor/push-notifications",
    "@capacitor/splash-screen",
    "@capacitor/status-bar",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.weatherapi.com",
      },
    ],
  },
};

// No DSN -> skip the Sentry build plugin entirely (no source map upload
// attempt, no extra webpack work) rather than let it run and silently no-op.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
