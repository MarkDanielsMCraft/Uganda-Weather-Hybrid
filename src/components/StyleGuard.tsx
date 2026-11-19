"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

export function StyleGuard() {
  const { dict } = useTranslation();
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const probe = document.getElementById("uw-style-probe");
    if (!probe) return;

    const { position } = getComputedStyle(probe);
    if (position !== "absolute") {
      setBroken(true);
    }
  }, []);

  if (!broken) {
    return (
      <div
        id="uw-style-probe"
        className="pointer-events-none absolute size-0 opacity-0"
        aria-hidden
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-6"
      style={{ background: "#12101a", color: "#f7f4ef" }}
    >
      <div className="max-w-md text-center">
        <h1 className="text-[22px] font-semibold">{dict.common.styleGuardTitle}</h1>
        <p className="mt-3 text-[15px] leading-relaxed opacity-80">
          {dict.common.styleGuardBodyPre}
          <code className="rounded bg-white/10 px-1">.next</code>
          {dict.common.styleGuardBodyPost}
        </p>
        <p className="mt-4 text-[14px] opacity-70">
          {dict.common.styleGuardStopServer}
        </p>
        <p className="mt-2 rounded-lg bg-white/10 px-4 py-3 font-mono text-[13px]">
          pnpm dev:clean
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-[14px] hover:bg-white/15"
        >
          {dict.common.retry}
        </button>
      </div>
    </div>
  );
}
