/** Shared Uganda Weather tokens for UI consistency. Keyed by what each
    colour means rather than by what it looks like, so a colour cannot be
    reassigned without its name going obviously wrong. */
export const BRAND = {
  /** Identity: wordmark, primary action, link, selected state. */
  accent: "var(--color-brand-green)",
  /** Middle step of a status scale. Never "all clear", never brand. */
  caution: "var(--color-caution)",
  lake: "#1B8A7A",
  coral: "#E07A5F",
  forest: "#2D6A4F",
  plum: "#1a1524",
} as const;

/** Glass panel — matches GlassCard / WidgetPanel */
export const glassPanel =
  "rounded-[22px] border border-white/[0.14] bg-[rgba(28,28,30,0.42)] shadow-[0_8px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl";

export const glassPanelHover = "transition hover:bg-[rgba(36,36,38,0.52)]";

