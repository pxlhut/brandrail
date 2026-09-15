/**
 * Gamut mapping — D3.
 *
 * OKLCH expresses colours outside sRGB trivially. Take a saturated brand hex,
 * raise its lightness for a hover state, and you are routinely outside sRGB,
 * where browsers clip differently and two visitors see two different brands.
 *
 * Everything in this package that produces a colour goes through `finalize()`.
 * No exceptions — an unclamped colour reaching the serializer is the bug D3
 * exists to prevent.
 */

import { clampChroma, formatCss, inGamut, oklch, rgb } from 'culori';
import type { Oklch as CuloriOklch } from 'culori';

/** A colour in OKLCH. `h` is undefined for achromatic colours, as culori reports it. */
export interface Oklch {
  /** Perceptual lightness, 0–1. */
  l: number;
  /** Chroma. Unbounded in theory; roughly 0.37 max inside sRGB. */
  c: number;
  /** Hue in degrees, 0–360. Undefined when chroma is 0 — hue is meaningless there. */
  h?: number | undefined;
}

/**
 * culori types hue as `h?: number`, which under `exactOptionalPropertyTypes`
 * means "may be absent" but *not* "may be present and undefined". Spreading a
 * colour whose hue is undefined therefore does not typecheck. Omit the key
 * instead of setting it.
 */
function toCulori(color: Oklch): CuloriOklch {
  return color.h === undefined
    ? { mode: 'oklch', l: color.l, c: color.c }
    : { mode: 'oklch', l: color.l, c: color.c, h: color.h };
}

function fromCulori(color: CuloriOklch): Oklch {
  return { l: color.l, c: color.c, h: color.h };
}

/**
 * Output precision. Four decimals on L and C is well below the perceptual
 * threshold, two on hue likewise — and `cssText` gets inlined into every page
 * for a site, so trailing float noise is real bytes on every request.
 */
const L_PRECISION = 4;
const C_PRECISION = 4;
const H_PRECISION = 2;

function round(value: number, places: number): number {
  const factor = 10 ** places;
  // `+ 0` normalises -0 to 0, so two runs can never differ by a sign bit.
  return Math.round(value * factor) / factor + 0;
}

/**
 * A value many orders of magnitude below `C_PRECISION`'s own step (1e-4).
 * `value * factor` for a value that is already an exact multiple of
 * `1/factor` does not always land back on an integer — `0.0372 * 10000` is
 * `371.99999999999994`, not `372`, because 0.0372 has no exact binary
 * representation. Without this nudge, `Math.floor` reads that as 371 and
 * silently discards a whole precision step from an already-settled value.
 *
 * Found by step 09's property test: `finalize()` was not idempotent —
 * applying it to its own output could shift chroma down by 0.0001, which was
 * enough, right at a role's contrast floor, to turn a passing pick into a
 * violation after the `toCss` → `parseColor` → `finalize` round-trip
 * `findViolations` does. The margin this needs is the *representation*
 * error in one multiplication, not a gamut-safety margin, so it can be tiny.
 */
const FLOOR_EPSILON = 1e-9;

/** Round toward zero. Used for chroma, where rounding up can leave the gamut. */
function floorTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.floor(value * factor + FLOOR_EPSILON) / factor + 0;
}

const isInSrgbRgb = inGamut('rgb');

/** True when this colour can be displayed exactly in sRGB. */
export function isInSrgb(color: Oklch): boolean {
  return isInSrgbRgb(toCulori(color));
}

/**
 * Clamp into sRGB by reducing chroma while holding L and H — the CSS Color 4
 * algorithm (D3).
 *
 * culori's `toGamut('rgb', 'oklch')` returns an *rgb* colour whose float noise
 * can fail culori's own `inGamut` check. `clampChroma` stays in OKLCH, holds L
 * and H exactly, and round-trips cleanly, so it is what we use.
 */
export function clampToSrgb(color: Oklch): Oklch {
  return fromCulori(clampChroma(toCulori(color), 'oklch') as CuloriOklch);
}

/**
 * Round to output precision and clamp into sRGB, in the one order that cannot
 * undo itself.
 *
 * Clamping first and rounding after does not work: rounding chroma up by a
 * ten-thousandth pushes a colour that sat exactly on the gamut boundary back
 * outside it, and a second clamp-then-round has the same problem again.
 *
 * So: settle lightness and hue first, clamp chroma at *those* final
 * coordinates, then round chroma **down**. At fixed L and H the in-gamut
 * chroma range is a contiguous interval starting at zero — which is why
 * chroma-reduction gamut mapping works at all — so a value below the clamped
 * chroma is always still inside.
 *
 * Every colour this package emits is the output of this function, and contrast
 * is always measured on this result rather than on the pre-rounded value.
 * Otherwise a role could clear its floor in the solver and miss it in the
 * shipped CSS.
 */
export function finalize(color: Oklch): Oklch {
  const l = round(Math.min(1, Math.max(0, color.l)), L_PRECISION);
  const h = color.h === undefined ? undefined : round(color.h, H_PRECISION);
  const clamped = clampToSrgb({ l, c: color.c, h });
  return { l, c: floorTo(clamped.c, C_PRECISION), h };
}

/** `oklch(L C H)`, ready for a custom property. */
export function toCss(color: Oklch): string {
  return formatCss(toCulori(color));
}

/**
 * sRGB channels as 0–255 integers, for APCA.
 *
 * Rounded to 8 bits deliberately: that is what a standard display actually
 * renders, so measuring contrast at float precision would let a role clear its
 * floor in theory and miss it on screen.
 */
export function toRgb255(color: Oklch): [number, number, number] {
  const { r, g, b } = rgb(toCulori(color));
  const channel = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return [channel(r), channel(g), channel(b)];
}

/**
 * Parse a brand colour into OKLCH.
 *
 * Throws rather than defaulting. A silently-defaulted brand colour is a
 * support ticket that takes an hour to diagnose, because nothing anywhere
 * reports that the input was ignored.
 */
export function parseColor(input: string, field = 'brandColor'): Oklch {
  const parsed = oklch(input);
  if (parsed === undefined) {
    throw new Error(`${field}: "${input}" is not a colour this package can parse.`);
  }
  return { l: parsed.l, c: parsed.c, h: parsed.h };
}
