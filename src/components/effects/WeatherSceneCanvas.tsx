"use client";

import { useEffect, useRef } from "react";
import type { WeatherTheme } from "@/types/weather";
import type { SceneConfig } from "./weather-scene-engine";
import { WeatherSceneEngine } from "./weather-scene-engine";
import { WeatherSceneGlEngine } from "./weather-scene-gl-engine";

type SceneEngine = WeatherSceneEngine | WeatherSceneGlEngine;

function scheduleIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: 500 });
    return () => window.cancelIdleCallback(handle);
  }
  // Safari has no requestIdleCallback — a short timeout still gets this
  // off the critical first-paint/hydration path.
  const timer = window.setTimeout(callback, 150);
  return () => window.clearTimeout(timer);
}

export function WeatherSceneCanvas({
  theme,
  isDay = true,
  liteMode,
  rainIntensity = 0,
  windDegree = 90,
  moonIllumination = 49,
  moonPhase = "Last Quarter",
}: {
  theme: WeatherTheme;
  isDay?: boolean;
  liteMode?: boolean;
  rainIntensity?: number;
  windDegree?: number;
  moonIllumination?: number;
  moonPhase?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SceneEngine | null>(null);
  const configRef = useRef<SceneConfig>({
    theme,
    isDay,
    liteMode,
    rainIntensity,
    windDegree,
    moonIllumination,
    moonPhase,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: SceneEngine | null = null;
    let resize = () => {};
    let onVisibility = () => {};
    let onScroll = () => {};

    // WebGL context creation + three shader-program compiles is real
    // main-thread work that otherwise runs synchronously in this effect
    // right after mount — competing with hydration of everything else on
    // the page for main-thread time during the window Lighthouse scores
    // as TBT/LCP. This is a purely decorative background, so it can
    // safely start a beat after the browser is done with more
    // time-critical work.
    const cancelIdle = scheduleIdle(() => {
      try {
        engine = new WeatherSceneGlEngine(canvas);
      } catch {
        engine = new WeatherSceneEngine(canvas);
      }
      engineRef.current = engine;
      engine.configure(configRef.current);

      const updateCardTop = () => {
        const el =
          document.querySelector<HTMLElement>('[data-tile-id="hourly"]') ||
          document.querySelector<HTMLElement>('[data-tile-id="forecast"]');
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top > 0 && rect.top < window.innerHeight) {
            engine?.setCardTop(rect.top);
            return;
          }
        }
        engine?.setCardTop(undefined);
      };
      updateCardTop();

      resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        engine?.resize(window.innerWidth, window.innerHeight, dpr);
        updateCardTop();
      };
      resize();

      let scrollRaf: number | null = null;
      onScroll = () => {
        if (scrollRaf !== null) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = null;
          updateCardTop();
        });
      };
      // Scroll events on .main-scroll do not bubble, so capture phase is required
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
      const mainScroll = document.querySelector(".main-scroll");
      mainScroll?.addEventListener("scroll", onScroll, { passive: true });

      let animationStarted = false;
      const startAnimation = () => {
        if (animationStarted) return;
        animationStarted = true;
        cleanupTriggers();
        engine?.start();
      };

      const triggers = [
        "pointerdown",
        "touchstart",
        "keydown",
        "wheel",
        "scroll",
        "mousemove",
      ] as const;

      function cleanupTriggers() {
        triggers.forEach((event) => {
          window.removeEventListener(event, startAnimation);
        });
      }

      triggers.forEach((event) => {
        window.addEventListener(event, startAnimation, { passive: true, once: true });
      });

      // Start the animated background scene once hydration is complete
      startAnimation();

      window.addEventListener("resize", resize);

      onVisibility = () => {
        if (document.hidden) {
          engine?.stop();
        } else if (animationStarted) {
          engine?.start();
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
    });

    return () => {
      cancelIdle();
      engine?.stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll, true);
      const mainScroll = document.querySelector(".main-scroll");
      mainScroll?.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const config: SceneConfig = {
      theme,
      isDay,
      liteMode,
      rainIntensity,
      windDegree,
      moonIllumination,
      moonPhase,
    };
    configRef.current = config;
    engineRef.current?.configure(config);
  }, [theme, isDay, liteMode, rainIntensity, windDegree, moonIllumination, moonPhase]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
