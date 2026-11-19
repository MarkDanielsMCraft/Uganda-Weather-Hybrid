"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { EDWARD_CONFIG } from "@/lib/marine/lake-conditions";

function LakeEdwardPageContent() {
  const searchParams = useSearchParams();
  const shoreParam = searchParams.get("shore");
  const isShore = shoreParam && EDWARD_CONFIG.shorelineDistricts.some((shore) => shore.slug === shoreParam);
  return (
    <HomeScreen
      autoOpenTileId="lake-edward"
      lakeShoreOverride={isShore ? shoreParam : "rubirizi"}
    />
  );
}

export function LakeEdwardPageClient() {
  return (
    <Suspense fallback={<HomeScreen autoOpenTileId="lake-edward" lakeShoreOverride="rubirizi" />}>
      <LakeEdwardPageContent />
    </Suspense>
  );
}
