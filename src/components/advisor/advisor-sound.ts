/** Plays a crisp, pleasant two-note chime using Web Audio when the advisor
    pop-up appears. Resolves true if audio played, or false if the browser
    blocked autoplay before a user gesture (never throws). */
export async function playAdvisorPopSound(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const AudioCtx =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return false;

  try {
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        void ctx.close().catch(() => {});
        return false;
      }
    }

    if (ctx.state !== "running") {
      void ctx.close().catch(() => {});
      return false;
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.0, now + 0.08); // A5
    osc.connect(gain);

    osc.start(now);
    osc.stop(now + 0.29);

    osc.onended = () => {
      void ctx.close().catch(() => {});
    };

    return true;
  } catch {
    return false;
  }
}
