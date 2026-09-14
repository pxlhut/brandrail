import { describe, expect, it } from 'vitest';

import { isInSrgb, parseColor, toCss } from '../../shared/color-math/index.js';
import { buildBrandRamps, buildNeutralRamps, buildRamp, resolveHue } from './ramp.js';
import {
  ACHROMATIC_FALLBACK_HUE,
  CHROMA_ENVELOPE,
  DARK_L,
  LIGHT_L,
  RAMP_STEPS,
} from './stops.js';

describe('ramp stops (D4)', () => {
  it('has twelve fixed steps in both modes', () => {
    expect(LIGHT_L).toHaveLength(RAMP_STEPS);
    expect(DARK_L).toHaveLength(RAMP_STEPS);
    expect(CHROMA_ENVELOPE).toHaveLength(RAMP_STEPS);
  });

  it('runs light → dark in light mode and dark → light in dark mode', () => {
    // Index 0 is the app background in both; index 11 is the strongest text.
    // That shared meaning is what lets step 06 assign roles without branching.
    for (let i = 1; i < RAMP_STEPS; i += 1) {
      expect(LIGHT_L[i] as number).toBeLessThan(LIGHT_L[i - 1] as number);
      expect(DARK_L[i] as number).toBeGreaterThan(DARK_L[i - 1] as number);
    }
  });

  it('is not a mirror of itself across modes (D6)', () => {
    // Dark is generated with its own stops. Perceived contrast on dark grounds
    // behaves differently — which is exactly why APCA is polarity-aware.
    const mirrored = LIGHT_L.map((l) => 1 - l).reverse();
    expect(DARK_L).not.toEqual(mirrored);
  });

  it('peaks chroma across the middle, where the brand reads as itself', () => {
    const peak = Math.max(...CHROMA_ENVELOPE);
    expect(CHROMA_ENVELOPE.indexOf(peak)).toBeGreaterThanOrEqual(6);
    expect(CHROMA_ENVELOPE[0] as number).toBeLessThan(0.2);
    expect(CHROMA_ENVELOPE[RAMP_STEPS - 1] as number).toBeLessThan(peak);
  });
});

describe('buildBrandRamps', () => {
  it('produces twelve in-gamut steps per mode', () => {
    const ramps = buildBrandRamps(parseColor('#7C6CFF'));
    for (const scheme of ['light', 'dark'] as const) {
      expect(ramps[scheme]).toHaveLength(RAMP_STEPS);
      for (const step of ramps[scheme]) expect(isInSrgb(step)).toBe(true);
    }
  });

  it('keeps the brand hue at every step', () => {
    const brand = parseColor('#7C6CFF');
    const ramps = buildBrandRamps(brand);
    for (const step of ramps.light) {
      if (step.c > 0) expect(step.h).toBeCloseTo(brand.h as number, 1);
    }
  });

  it('sits every step on its fixed lightness stop', () => {
    const ramps = buildBrandRamps(parseColor('#DC2626'));
    ramps.light.forEach((step, i) => expect(step.l).toBe(LIGHT_L[i]));
    ramps.dark.forEach((step, i) => expect(step.l).toBe(DARK_L[i]));
  });

  it('keeps a muted brand muted and a vivid brand vivid', () => {
    // The property §34 depends on: a bold brand colour produces a bold error
    // red, a muted one a correspondingly muted red.
    const muted = buildBrandRamps(parseColor('#6B7280'));
    const vivid = buildBrandRamps(parseColor('#DC2626'));
    const peakOf = (r: typeof muted) => Math.max(...r.light.map((s) => s.c));
    expect(peakOf(muted)).toBeLessThan(peakOf(vivid));
  });

  it('does not let a neon brand bleed colour into the light end', () => {
    // A neon brand at uniform chroma produces light steps that look radioactive.
    const neon = buildBrandRamps(parseColor('#00FF88'));
    expect(neon.light[0]?.c as number).toBeLessThan(0.04);
  });
});

describe('achromatic inputs', () => {
  // #000, #fff and #808080 are the first things anyone types into a colour
  // picker. This case is ordinary, not exceptional.
  it.each(['#000000', '#FFFFFF', '#808080'])('handles %s', (hex) => {
    const ramps = buildBrandRamps(parseColor(hex));
    expect(ramps.isAchromatic).toBe(true);
    expect(ramps.hue).toBe(ACHROMATIC_FALLBACK_HUE);
    for (const scheme of ['light', 'dark'] as const) {
      expect(ramps[scheme]).toHaveLength(RAMP_STEPS);
      for (const step of ramps[scheme]) {
        expect(isInSrgb(step)).toBe(true);
        // An achromatic input produces an honestly grey ramp, not one tinted
        // with a hue the owner never chose.
        expect(step.c).toBe(0);
      }
    }
  });

  it('treats a trace-chroma input as achromatic', () => {
    const traced = { l: 0.5, c: 0.005, h: 30 };
    expect(resolveHue(traced).isAchromatic).toBe(true);
    expect(buildBrandRamps(traced).sourceChroma).toBe(0);
  });

  it('keeps hue for a colour just above the threshold', () => {
    const faint = { l: 0.5, c: 0.02, h: 30 };
    const resolved = resolveHue(faint);
    expect(resolved.isAchromatic).toBe(false);
    expect(resolved.hue).toBe(30);
  });
});

describe('buildNeutralRamps', () => {
  it('shifts hue between warm and cool', () => {
    const warm = buildNeutralRamps('warm');
    const cool = buildNeutralRamps('cool');
    expect(warm.light[6]?.h).not.toBe(cool.light[6]?.h);
  });

  it('stays under chroma 0.02, so these read as greys', () => {
    for (const tone of ['warm', 'cool'] as const) {
      const ramps = buildNeutralRamps(tone);
      for (const scheme of ['light', 'dark'] as const) {
        for (const step of ramps[scheme]) expect(step.c).toBeLessThan(0.02);
      }
    }
  });

  it('does not vary with the brand colour', () => {
    // §33: neutralTone changes the feel of every border and background
    // *without touching brand colour*.
    expect(buildNeutralRamps('cool')).toEqual(buildNeutralRamps('cool'));
  });
});

describe('determinism', () => {
  it('produces identical output for identical input, in-process', () => {
    for (const hex of ['#7C6CFF', '#00FF88', '#808080']) {
      expect(buildBrandRamps(parseColor(hex))).toEqual(buildBrandRamps(parseColor(hex)));
    }
  });

  it('produces these exact values, across processes', () => {
    // Committed expected values, compared on every run in a fresh process. When
    // this changes, the generation algorithm has changed — which is exactly the
    // moment to bump schemaVersion (§6), not three commits later.
    //
    // Note how far the light end falls below the chroma envelope: step 0 asks
    // for 0.0168 and gets 0.0047, because that is all the gamut allows at
    // L 0.99 on this hue. The envelope proposes; the clamp disposes. This is
    // why every step is clamped individually rather than the ramp being scaled
    // once at the end.
    expect(buildRamp('light', 283.39, 0.2103).map(toCss)).toEqual([
      'oklch(0.99 0.0047 283.39)',
      'oklch(0.975 0.0121 283.39)',
      'oklch(0.95 0.0244 283.39)',
      'oklch(0.92 0.0396 283.39)',
      'oklch(0.89 0.0551 283.39)',
      'oklch(0.85 0.0764 283.39)',
      'oklch(0.79 0.1097 283.39)',
      'oklch(0.68 0.1748 283.39)',
      'oklch(0.52 0.2103 283.39)',
      'oklch(0.45 0.1934 283.39)',
      'oklch(0.37 0.164 283.39)',
      'oklch(0.21 0.1009 283.39)',
    ]);
  });

  it('does not mutate its input', () => {
    const input = parseColor('#7C6CFF');
    const copy = { ...input };
    buildBrandRamps(input);
    expect(input).toEqual(copy);
  });
});
