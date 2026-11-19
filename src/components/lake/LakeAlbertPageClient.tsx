"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { ALBERT_CONFIG } from "@/lib/marine/lake-conditions";

function LakeAlbertPageContent() {
  const searchParams = useSearchParams();
  const shoreParam = searchParams.get("shore");
  const isShore = shoreParam && ALBERT_CONFIG.shorelineDistricts.some((shore) => shore.slug === shoreParam);
  return (
    <HomeScreen
      autoOpenTileId="lake-albert"
      lakeShoreOverride={isShore ? shoreParam : "buliisa"}
    />
  );
}

export function LakeAlbertPageClient() {
  return (
    <Suspense fallback={<HomeScreen autoOpenTileId="lake-albert" lakeShoreOverride="buliisa" />}>
      <LakeAlbertPageContent />
    </Suspense>
  );
}
