export const ATMOSPHERE_VERTEX = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const ATMOSPHERE_FRAGMENT = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_theme;
uniform float u_flash;
uniform float u_cloud_cover;
uniform float u_haze;
uniform vec2 u_sun_pos;
uniform float u_sun_strength;
uniform float u_moon_phase;
uniform float u_is_day;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.55;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.02 + vec2(17.0, 9.0);
    amplitude *= 0.5;
  }
  return value;
}

/** Domain-warped fbm: bends the sampling field through another noise field
    so cloud masses read as soft rounded lobes instead of uniform static,
    the way real cumulus silhouettes look rather than a noise texture. */
float warpedFbm(vec2 p) {
  vec2 warp = vec2(fbm(p + vec2(1.7, 9.2)), fbm(p + vec2(8.3, 2.8)));
  return fbm(p + warp * 0.9);
}

vec3 skyGradient(float y, float theme, float isDay) {
  vec3 top = vec3(0.18, 0.42, 0.72);
  vec3 mid = vec3(0.35, 0.62, 0.85);
  vec3 horizon = vec3(0.83, 0.66, 0.47);
  vec3 ground = vec3(0.29, 0.27, 0.35);

  if (isDay < 0.5) {
    if (theme > 2.5 && theme < 4.5) {
      // Night rain and thunderstorm: deep dark nocturnal midnight obsidian
      top = vec3(0.012, 0.016, 0.028);
      mid = vec3(0.028, 0.038, 0.062);
      horizon = vec3(0.052, 0.068, 0.105);
      ground = vec3(0.015, 0.018, 0.024);
    } else if (theme > 4.5 && theme < 5.5) {
      // Night fog
      top = vec3(0.035, 0.045, 0.075);
      mid = vec3(0.065, 0.085, 0.125);
      horizon = vec3(0.105, 0.125, 0.165);
      ground = vec3(0.025, 0.030, 0.045);
    } else {
      // Clear, partly cloudy, cloudy or calm night
      top = vec3(0.02, 0.04, 0.08);
      mid = vec3(0.06, 0.10, 0.16);
      horizon = vec3(0.09, 0.13, 0.22);
      ground = vec3(0.02, 0.03, 0.05);
    }
  } else if (theme < 0.5) {
    top = vec3(0.10, 0.42, 0.83);
    mid = vec3(0.26, 0.64, 0.94);
    horizon = vec3(0.62, 0.72, 0.85);
    ground = vec3(0.29, 0.27, 0.35);
  } else if (theme < 1.5) {
    top = vec3(0.18, 0.42, 0.72);
    mid = vec3(0.29, 0.56, 0.83);
    horizon = vec3(0.79, 0.66, 0.54);
    ground = vec3(0.23, 0.21, 0.28);
  } else if (theme < 2.5) {
    top = vec3(0.42, 0.46, 0.50);
    mid = vec3(0.54, 0.58, 0.61);
    horizon = vec3(0.43, 0.46, 0.49);
    ground = vec3(0.07, 0.06, 0.09);
  } else if (theme < 3.5) {
    top = vec3(0.16, 0.21, 0.27);
    mid = vec3(0.24, 0.31, 0.38);
    horizon = vec3(0.18, 0.24, 0.31);
    ground = vec3(0.05, 0.04, 0.06);
  } else if (theme < 4.5) {
    top = vec3(0.08, 0.06, 0.12);
    mid = vec3(0.16, 0.14, 0.25);
    horizon = vec3(0.21, 0.18, 0.31);
    ground = vec3(0.03, 0.02, 0.05);
  } else if (theme < 5.5) {
    top = vec3(0.48, 0.51, 0.55);
    mid = vec3(0.66, 0.69, 0.72);
    horizon = vec3(0.49, 0.53, 0.56);
    ground = vec3(0.09, 0.09, 0.11);
  } else {
    top = vec3(0.02, 0.04, 0.08);
    mid = vec3(0.06, 0.10, 0.16);
    horizon = vec3(0.09, 0.13, 0.22);
    ground = vec3(0.02, 0.03, 0.05);
  }

  float t = clamp(y, 0.0, 1.0);
  vec3 col;
  if (t < 0.35) {
    col = mix(top, mid, t / 0.35);
  } else if (t < 0.72) {
    col = mix(mid, horizon, (t - 0.35) / 0.37);
  } else {
    col = mix(horizon, ground, (t - 0.72) / 0.28);
  }
  return col;
}

vec3 sunGlare(vec2 uv, vec2 sunPos, float strength) {
  vec2 delta = uv - sunPos;
  float dist = length(delta);

  /** Graduated falloff series (tight core through wide bloom) instead of a
      big jump between two terms — a small jump reads as a flat cartoon
      disc with a visible ring; this blends smoothly into a soft corona.
      The two widest terms (outerHalo, farBloom) used to spread far enough
      to pale out most of the visible sky into a near-white wash, fighting
      the blue sky gradient underneath instead of sitting on top of it as
      a contained bright spot — tightened both so the sun reads as a
      clearly bright disc with a soft corona, not a bleach patch. */
  /** Core shrunk and made tighter (0.02/0.007 -> 0.011/0.0035): a real sun
      photographs as a small, sharply bright point, not a large soft disc —
      concentrating the brightest part into a smaller area and letting it
      sit clearly brighter than its corona reads far more like a real sun
      than a big pale circle. */
  float core = smoothstep(0.011, 0.0035, dist);
  float innerGlow = exp(-dist * dist * 240.0) * 0.62;
  float midHalo = exp(-dist * dist * 62.0) * 0.36;
  float outerHalo = exp(-dist * dist * 28.0) * 0.14;
  float farBloom = exp(-dist * dist * 9.0) * 0.05;

  /** skyGradient's own convention (small y = top-of-sky/blue, large y =
      ground) means small sunPos.y is a HIGH midday sun, not a low one —
      this used to read the inverse (1.0 - sunPos.y), the opposite sense,
      which tinted a fixed high-elevation sun with the near-horizon
      orange halo color instead of the neutral-white midday one, on
      every single "Sunny" render (the sun's y-position is currently a
      fixed constant, not a real solar-elevation calculation, so this
      wasn't a rare edge case — it fired every time). */
  vec3 coreColor = vec3(1.0, 0.98, 0.95);
  vec3 haloColor = mix(vec3(1.0, 0.97, 0.90), vec3(1.0, 0.8, 0.56), smoothstep(0.0, 0.35, sunPos.y));

  vec3 col = coreColor * core * 1.6;
  col += haloColor * (innerGlow + midHalo + outerHalo + farBloom);

  // No edge vignette here: uv in this function is the aspect-corrected
  // p-space (0..aspect.x, not 0..1), so a fixed 0.15-0.95 threshold used to
  // chronically suppress the sun on narrow mobile viewports — where
  // aspect.x rarely exceeds ~0.5 — regardless of where it was actually
  // positioned. The sun's own position is already chosen to sit inside
  // the visible frame, so it doesn't need a second safety fade on top.
  return col * strength;
}

float starField(vec2 uv, float time) {
  vec2 grid = floor(uv * vec2(180.0, 90.0));
  float n = hash(grid);
  if (n < 0.92) return 0.0;
  vec2 cell = fract(uv * vec2(180.0, 90.0)) - 0.5;
  float d = length(cell);
  float twinkle = 0.55 + 0.45 * sin(time * 0.002 + n * 40.0);
  return smoothstep(0.18, 0.0, d) * twinkle;
}

vec3 renderMoon(vec2 uv, vec2 moonPos, float phase) {
  float dist = length(uv - moonPos);
  float disc = smoothstep(0.028, 0.022, dist);
  float shadow = smoothstep(0.026, 0.02, length(uv - moonPos - vec2(0.012, -0.002)));
  float crescent = disc * (1.0 - shadow * phase);
  vec3 moonCol = mix(vec3(0.78, 0.82, 0.92), vec3(0.95, 0.96, 1.0), 0.6);

  // Soft atmospheric lunar corona and halo
  float glow = exp(-dist * dist * 280.0) * 0.35 + exp(-dist * dist * 42.0) * 0.12;
  vec3 haloCol = vec3(0.65, 0.75, 0.92) * glow * (1.0 - phase * 0.45);

  return moonCol * crescent + haloCol;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect.x, uv.y);

  vec3 col = skyGradient(uv.y, u_theme, u_is_day);

  if (u_is_day < 0.5) {
    // Nocturnal sky: stars modulated by cloud cover, plus moon
    float starIntensity = clamp(1.0 - u_cloud_cover * 1.15, 0.0, 1.0);
    if (starIntensity > 0.01) {
      float stars = starField(uv, u_time);
      col += vec3(0.85, 0.9, 1.0) * stars * (0.55 * starIntensity);
    }
    vec2 moonPos = vec2(0.72 * aspect.x, 0.82);
    col += renderMoon(p, moonPos, u_moon_phase);
  } else if (u_sun_strength > 0.01) {
    vec2 sunUv = vec2(u_sun_pos.x * aspect.x, u_sun_pos.y);
    col += sunGlare(vec2(p.x, p.y), sunUv, u_sun_strength);
  }

  vec2 sunUvForShade = vec2(u_sun_pos.x * aspect.x, u_sun_pos.y);
  vec3 cloudAccum = vec3(0.0);
  float cloudAlpha = 0.0;

  /** Fewer, larger domain-warped masses read as soft cumulus/stratus lobes
      instead of a fine noise texture — closer to photographed sky than a
      procedural pattern. Overcast themes widen coverage to a full mottled
      layer; clear/partly-cloudy keep isolated puffs. */
  const int LAYER_COUNT = 4;
  float layers = float(LAYER_COUNT);
  for (int i = 0; i < LAYER_COUNT; i++) {
    float layer = float(i) / layers;
    /** uv.y follows GL convention: 0 = bottom of the canvas, 1 = top (see
        the moon position below, which already relies on this). Keep every
        layer inside the band that's actually visible above the forecast
        card — roughly the top 45% of the viewport, i.e. uv.y from ~0.55
        to 1.0 — clouds placed below that are wasted render work hidden
        behind UI chrome. */
    float height = 0.55 + layer * 0.13;
    float bandSoftness = mix(0.2, 0.3, u_cloud_cover);
    /** Ascending edges: mask is ~1 for uv.y above the height cutoff (near
        the top of the screen) and fades to 0 below it. */
    float layerMask = smoothstep(height - bandSoftness, height + bandSoftness * 0.6, uv.y);
    if (layerMask < 0.001) continue;

    float scale = 1.5 + layer * 0.9;
    vec2 wind = vec2(u_time * 0.000085 * (1.0 + layer * 1.4), u_time * 0.000006);
    vec2 sampleUv = vec2(p.x * (0.9 + layer * 0.22), p.y * (0.7 + layer * 0.16)) * scale
      + wind + vec2(layer * 11.0, layer * 5.0);

    float mass = warpedFbm(sampleUv);
    /** Raised the clear-sky end from 0.62 to 0.7: at 0.62, "clear"
        (u_cloud_cover 0.18) still classified a large fraction of the sky
        as some-cloud, just at low opacity — pervasive faint haze rather
        than a mostly open sky with a few genuine wisps. The higher bar
        means noise has to peak more sharply before it counts as cloud at
        all. Overcast themes (cloud_cover >= ~0.8) barely move. */
    float threshold = mix(0.7, 0.3, u_cloud_cover);
    float softEdge = mix(0.16, 0.3, u_cloud_cover);
    float density = smoothstep(threshold, threshold + softEdge, mass);
    density *= layerMask;
    if (density < 0.001) continue;

    /** Shade from the same mass field the silhouette came from (not an
        independent resample) so brightness stays spatially locked to the
        shape: the thick "core" of a lobe reads bright/sunlit, the thin
        edges fade toward shadow, with no disconnected dark blotches. At
        high coverage the mass value keeps varying continuously even where
        density has saturated to fully opaque, so overcast layers still
        show internal mottling instead of flattening into a solid tint.
        The upper bound used to be threshold+0.55 — a bar high enough that
        only a small, deep core of each lobe ever reached full brightness,
        so most of a cloud's visible area (everything short of that core)
        sat in the darker half of the range. For clear/partly-cloudy that
        read as dark, storm-like (nimbus) clouds against a bright blue sky
        instead of light fair-weather ones. Narrowed and shifted earlier so
        most of a cloud's silhouette reads bright, reserving the dark tail
        for genuinely dense cores — which is what the darker overcast/
        storm themes lean on via their own base palette anyway. */
    float shade = smoothstep(threshold - 0.30, threshold + 0.16, mass);
    float detail = noise(sampleUv * 5.0 + u_time * 0.00004) - 0.5;
    shade = clamp(shade + detail * 0.12, 0.0, 1.0);

    /** Boundaries match THEME_INDEX exactly (clear=0, partly_cloudy=1,
        cloudy=2, rain=3, thunder=4, fog=5, night=6). This previously used
        a 2.5 / 4.5 split, which put cloudy (2) in the bright sunlit-cloud
        branch meant for clear/partly_cloudy instead of the gray overcast
        branch, combined with cloudy's high coverage, the sky washed out
        to a solid white frame instead of a gray overcast layer. */
    vec3 cloudRgb;
    if (u_is_day < 0.5) {
      vec3 nightBase = (u_theme > 2.5 && u_theme < 4.5)
        ? vec3(0.04, 0.05, 0.08)
        : vec3(0.08, 0.10, 0.15);
      vec3 moonTint = vec3(0.18, 0.22, 0.32);
      cloudRgb = mix(nightBase, moonTint, shade * 0.45) * shade;
    } else if (u_theme > 4.5) {
      cloudRgb = vec3(0.30, 0.32, 0.39) * shade;
    } else if (u_theme > 1.5) {
      cloudRgb = mix(vec3(0.46, 0.49, 0.54), vec3(0.68, 0.70, 0.74), shade * 0.7) * shade;
    } else {
      vec3 shadowTone = vec3(0.62, 0.66, 0.76);
      vec3 litTone = vec3(1.0, 0.97, 0.9);
      cloudRgb = mix(shadowTone, litTone, clamp(shade, 0.0, 1.0));
    }

    /** Warm rim light on the sun-facing edge of each cloud, the glowing
        highlight that reads as "sunlit puffy cloud" in real photography. */
    if (u_sun_strength > 0.01) {
      float rim = (1.0 - density) * layerMask * smoothstep(0.35, 0.85, mass);
      float sunProximity = exp(-length(p - sunUvForShade) * 1.6);
      cloudRgb += vec3(1.0, 0.82, 0.55) * rim * sunProximity * u_sun_strength * 0.5;
    }

    /** The per-layer base alpha below is tuned for overcast themes (cloudy/
        rain/thunder) to read as properly dense. Without an explicit
        coverage scale, "clear" (u_cloud_cover 0.18) got the same opacity
        per visible wisp as "cloudy" (0.82) — a "Sunny" sky ended up
        looking cloud-choked instead of mostly open, because the sparse
        patches that did cross the density threshold were just as opaque
        as an overcast layer's. Scaling alpha by coverage keeps clear/
        partly-cloudy skies genuinely thin and wispy while leaving the
        already-correct overcast themes untouched (clamped to 1 above
        their natural coverage so they don't change). */
    float coverageAlphaScale = clamp(u_cloud_cover * 1.7, 0.22, 1.0);
    float layerAlpha = density * (0.4 + layer * 0.12) * coverageAlphaScale;
    cloudAccum = mix(cloudAccum, cloudRgb, layerAlpha * (1.0 - cloudAlpha));
    cloudAlpha = cloudAlpha + layerAlpha * (1.0 - cloudAlpha);
  }

  col = mix(col, cloudAccum, clamp(cloudAlpha, 0.0, 1.0));

  if (u_theme > 4.5 && u_theme < 5.5) {
    float fogBand = 0.0;
    for (int f = 0; f < 4; f++) {
      float band = 0.22 + float(f) * 0.14;
      float drift = sin(u_time * 0.00025 + float(f)) * 0.03;
      fogBand += smoothstep(band + 0.06, band - 0.04, abs(uv.y - band - drift)) * 0.12;
    }
    vec3 fogCol = u_is_day < 0.5 ? vec3(0.08, 0.11, 0.18) : vec3(0.88, 0.91, 0.94);
    col = mix(col, fogCol, clamp(fogBand, 0.0, 0.55));
  }

  col += vec3(0.75, 0.82, 1.0) * u_flash * (0.35 + cloudAlpha * 0.65);

  float vignette = smoothstep(1.2, 0.2, length(uv - vec2(0.5, 0.45)));
  col *= mix(0.88, 1.0, vignette);

  col = mix(col, col * (1.0 - u_haze * 0.15), u_haze);

  gl_FragColor = vec4(col, 1.0);
}
`;

export const RAIN_VERTEX = `
attribute vec2 a_position;
uniform vec2 u_resolution;
void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

export const RAIN_FRAGMENT = `
precision mediump float;
uniform float u_opacity;
void main() {
  gl_FragColor = vec4(0.75, 0.85, 0.95, u_opacity);
}
`;

export const LIGHTNING_VERTEX = RAIN_VERTEX;

export const LIGHTNING_FRAGMENT = `
precision mediump float;
uniform float u_alpha;
void main() {
  gl_FragColor = vec4(0.94, 0.97, 1.0, u_alpha);
}
`;
