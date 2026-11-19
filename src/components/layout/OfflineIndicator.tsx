"use client";

import { useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

export function OfflineIndicator() {
  const { dict } = useTranslation();
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );

  if (online) return null;

  return (
    <div className="mb-3 rounded-xl border border-caution/35 bg-caution/10 px-4 py-2.5 text-center text-[13px] text-white/80">
      {dict.common.offlineMessage}
    </div>
  );
}
