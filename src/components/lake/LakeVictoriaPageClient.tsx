"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HomeScreen } from "@/components/weather/HomeScreen";
import { isLakeShoreSlug } from "@/lib/places/share";

function LakeVictoriaPageContent() {
  const searchParams = useSearchParams();
  const shoreParam = searchParams.get("shore");
  return (
    <HomeScreen
      autoOpenTileId="lake-victoria"
      lakeShoreOverride={isLakeShoreSlug(shoreParam) ? shoreParam : "kalangala"}
    />
  );
}

export function LakeVictoriaPageClient() {
  return (
    <Suspense fallback={<HomeScreen autoOpenTileId="lake-victoria" lakeShoreOverride="kalangala" />}>
      <LakeVictoriaPageContent />
    </Suspense>
  );
}
