/**
 * Ramp generation — the brand ramp and the neutral ramp.
 *
 * Both are twelve fixed lightness stops (D4), generated independently for
 * light and dark (D6), every step clamped into sRGB (D3).
 */

import { finalize, type Oklch } from '../../shared/color-math/index.js';
import {
  ACHROMATIC_FALLBACK_HUE,
  ACHROMATIC_THRESHOLD,
  CHROMA_ENVELOPE,
  DARK_L,
  LIGHT_L,
  NEUTRAL_CHROMA,
  NEUTRAL_HUE,
  RAMP_STEPS,
  type NeutralTone,
} from './stops.js';
import type { ColorScheme } from '../../shared/types/index.js';

/** Twelve steps: index 0 is the app background, index 11 the strongest text. */
export type Ramp = readonly Oklch[];

export interface RampPair {
  light: Ramp;
  dark: Ramp;
}

export interface BrandRamps extends RampPair {
  /**
   * True when the input had effectively no chroma, so its hue carried no
   * information and a fallback was substituted for the trace tint.
   */
  isAchromatic: boolean;
  /** The hue actually used, after the achromatic fallback. */
  hue: number;
  /** The input's own chroma, which scales the whole envelope. */
  sourceChroma: number;
}

function stopsFor(scheme: ColorScheme): readonly number[] {
  return scheme === 'light' ? LIGHT_L : DARK_L;
}

/**
 * Resolve hue for a brand colour, substituting a fallback when the input is
 * achromatic.
 *
 * culori reports `h` as undefined at chroma 0, and hue is genuinely
 * meaningless there — but the ramp still needs *a* number to build the trace
 * tint from, and picking one silently would make `#808080` and `#000000`
 * behave differently for no reason a caller could see.
 */
export function resolveHue(color: Oklch): { hue: number; isAchromatic: boolean } {
  const isAchromatic = color.c < ACHROMATIC_THRESHOLD || color.h === undefined;
  return {
    hue: isAchromatic ? ACHROMATIC_FALLBACK_HUE : (color.h as number),
    isAchromatic,
  };
}

/**
 * Build one ramp at the given scheme's lightness stops.
 *
 * Chroma at each step is the envelope multiplier times the source chroma, so a
 * muted brand produces a muted ramp and a vivid one produces a vivid ramp —
 * the property §34 depends on when it says a bold brand colour should produce
 * a bold error red.
 */
export function buildRamp(
  scheme: ColorScheme,
  hue: number,
  sourceChroma: number,
): Ramp {
  const stops = stopsFor(scheme);
  const out: Oklch[] = [];
  for (let i = 0; i < RAMP_STEPS; i += 1) {
    const l = stops[i] as number;
    const chroma = (CHROMA_ENVELOPE[i] as number) * sourceChroma;
    out.push(finalize({ l, c: chroma, h: chroma === 0 ? undefined : hue }));
  }
  return out;
}

/** The brand ramp, light and dark, from one input colour. */
export function buildBrandRamps(brand: Oklch): BrandRamps {
  const { hue, isAchromatic } = resolveHue(brand);
  // An achromatic input produces an honestly grey ramp rather than a ramp
  // tinted with a hue the owner never chose.
  const sourceChroma = isAchromatic ? 0 : brand.c;
  return {
    light: buildRamp('light', hue, sourceChroma),
    dark: buildRamp('dark', hue, sourceChroma),
    isAchromatic,
    hue,
    sourceChroma,
  };
}

/**
 * The neutral ramp — `background`, `card`, `border`, `input`, `muted` come
 * from here, not from the brand ramp.
 *
 * Its chroma is absolute rather than scaled by the brand, because §33 defines
 * `neutralTone` as changing the feel of every border and background *without
 * touching brand colour*.
 */
export function buildNeutralRamps(tone: NeutralTone): RampPair {
  const hue = NEUTRAL_HUE[tone];
  const build = (scheme: ColorScheme): Ramp => {
    const stops = stopsFor(scheme);
    const out: Oklch[] = [];
    for (let i = 0; i < RAMP_STEPS; i += 1) {
      out.push(
        finalize({ l: stops[i] as number, c: NEUTRAL_CHROMA[i] as number, h: hue }),
      );
    }
    return out;
  };
  return { light: build('light'), dark: build('dark') };
}
