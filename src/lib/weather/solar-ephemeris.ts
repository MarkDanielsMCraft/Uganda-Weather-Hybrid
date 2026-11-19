/**
 * Equatorial solar ephemeris calibrated for Uganda (0° to 4°N).
 * East Africa Time (EAT) is UTC+3.
 *
 * In equatorial East Africa, day length is approximately 12 hours year-round.
 * The sun rises almost vertically at ~6:45 AM EAT, passes overhead near solar
 * noon (~12:45 PM EAT), and sets rapidly at ~6:45 PM EAT.
 */

export interface EquatorialSunPosition {
  /** Screen X coordinate normalized 0..1 (East 0.18 to West 0.82) */
  x: number;
  /** Screen Y coordinate normalized 0..1 in WebGL space (0.32 near horizon, up to 0.88 overhead) */
  y: number;
  /** Effective solar irradiance factor (0.0 to 1.0) */
  strength: number;
  /** Elevation angle above horizon in degrees (-90 to +90) */
  elevationDeg: number;
  /** Whether the sun is above the horizon */
  isDaylight: boolean;
}

/**
 * Calculates sun position for Uganda's equatorial coordinates.
 * @param date Optional Date instance (defaults to current system time)
 */
export function getEquatorialSunPosition(date: Date = new Date()): EquatorialSunPosition {
  // Convert UTC time to East Africa Time (EAT = UTC+3) decimal hours (0..24)
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const eatHours = (utcHours + 3) % 24;

  const sunriseHour = 6.75; // 6:45 AM EAT
  const sunsetHour = 18.75; // 6:45 PM EAT
  const daylightSpan = sunsetHour - sunriseHour; // 12.0 hours

  if (eatHours < sunriseHour || eatHours > sunsetHour) {
    const nightDuration = 24 - daylightSpan;
    const nightProgress =
      eatHours < sunriseHour
        ? (eatHours + (24 - sunsetHour)) / nightDuration
        : (eatHours - sunsetHour) / nightDuration;

    return {
      x: 0.5,
      y: -0.2,
      strength: 0,
      elevationDeg: -Math.sin(nightProgress * Math.PI) * 90,
      isDaylight: false,
    };
  }

  // Daylight progress: 0.0 at sunrise, 0.5 at solar noon, 1.0 at sunset
  const progress = (eatHours - sunriseHour) / daylightSpan;

  // In Uganda, elevation reaches near-zenith (~88° overhead) at solar noon
  const elevationDeg = Math.sin(progress * Math.PI) * 88;

  // Normalized horizontal position: 0.18 (East sunrise) -> 0.50 (Noon) -> 0.82 (West sunset)
  const x = 0.18 + progress * 0.64;

  // Normalized vertical position: 0.32 (horizon) -> 0.88 (overhead sky)
  const y = 0.32 + Math.sin(progress * Math.PI) * 0.56;

  // Rapid equatorial twilight: steep rise at dawn, steep fall at dusk
  const strength = Math.min(1, Math.sin(progress * Math.PI) * 1.35);

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    strength: Number(strength.toFixed(4)),
    elevationDeg: Number(elevationDeg.toFixed(2)),
    isDaylight: true,
  };
}

