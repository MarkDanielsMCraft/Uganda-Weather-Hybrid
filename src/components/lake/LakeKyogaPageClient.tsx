"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { KYOGA_CONFIG } from "@/lib/marine/lake-conditions";

function LakeKyogaPageContent() {
  const searchParams = useSearchParams();
  const shoreParam = searchParams.get("shore");
  const isShore = shoreParam && KYOGA_CONFIG.shorelineDistricts.some((shore) => shore.slug === shoreParam);
  return (
    <HomeScreen
      autoOpenTileId="lake-kyoga"
      lakeShoreOverride={isShore ? shoreParam : "amolatar"}
    />
  );
}

export function LakeKyogaPageClient() {
  return (
    <Suspense fallback={<HomeScreen autoOpenTileId="lake-kyoga" lakeShoreOverride="amolatar" />}>
      <LakeKyogaPageContent />
    </Suspense>
  );
}
