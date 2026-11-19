/** Convert astronomy data into canvas / shader moon rendering parameters. */
export function moonRenderParams(illumination: number, moonPhase: string) {
  const lit = Math.min(1, Math.max(0, illumination / 100));
  const phase = moonPhase.toLowerCase();
  const waning = phase.includes("waning") || phase.includes("last quarter");

  return { lit, waning };
}

/** Shader uses shadow strength — higher = thinner crescent. */
export function moonPhaseForShader(illumination: number, moonPhase: string): number {
  const { lit, waning } = moonRenderParams(illumination, moonPhase);
  if (lit >= 0.97) return 0;
  if (lit <= 0.03) return 1;
  const crescentStrength = waning ? 1 - lit : lit;
  return Math.min(1, Math.max(0.08, 1 - crescentStrength * 1.15));
}
