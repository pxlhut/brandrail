/**
 * Semantic and chart colour generation.
 *
 * Short on purpose: this runs the *same* ramp builder and the *same* contrast
 * solver as the brand colour, with the hue substituted. If this file grows, it
 * is reimplementing step 04 rather than reusing it.
 */

import { finalize, type Oklch } from '../../shared/color-math/index.js';
import { LC_LARGE_TEXT, pickForRole, type RolePick } from '../contrast/index.js';
import { buildRamp, SOLID_INDEX, type Ramp } from '../palette/index.js';
import type { ChartRole, ColorScheme } from '../../shared/types/index.js';
import {
  CHART_L,
  CHART_MIN_CHROMA,
  chartHues,
  SEMANTIC_HUES,
  SEMANTIC_NAMES,
  type SemanticName,
} from './hues.js';

export interface SemanticPair {
  /** The solid surface — what `--destructive` becomes. */
  surface: Oklch;
  /** Legible on it — what `--destructive-foreground` becomes. */
  foreground: Oklch;
  /** Absolute Lc achieved. */
  lc: number;
  /** Set only when the Lc 75 floor could not be met at all. */
  shortfall?: RolePick['shortfall'];
}

export type Semantics = Record<SemanticName, SemanticPair>;

/**
 * Build one semantic pair: the solid at the ramp's solid step, plus a
 * foreground drawn from the same ramp so it stays tinted rather than reverting
 * to flat white.
 */
function buildPair(hue: number, sourceChroma: number, scheme: ColorScheme): SemanticPair {
  const ramp: Ramp = buildRamp(scheme, hue, sourceChroma);
  const surface = ramp[SOLID_INDEX] as Oklch;
  const pick = pickForRole(ramp, surface, LC_LARGE_TEXT);
  return pick.shortfall === undefined
    ? { surface, foreground: pick.color, lc: pick.lc }
    : { surface, foreground: pick.color, lc: pick.lc, shortfall: pick.shortfall };
}

/**
 * `success` / `warning` / `destructive` / `info`, for one mode.
 *
 * @param sourceChroma the brand colour's own chroma — this is what carries the
 *   brand's character across into the semantics (§34)
 */
export function buildSemantics(sourceChroma: number, scheme: ColorScheme): Semantics {
  const out = {} as Record<SemanticName, SemanticPair>;
  for (const name of SEMANTIC_NAMES) {
    out[name] = buildPair(SEMANTIC_HUES[name], sourceChroma, scheme);
  }
  return out;
}

/**
 * Five categorical series colours, spread from the brand hue at matched
 * lightness and chroma so no series visually dominates another.
 *
 * Chroma is floored (see `CHART_MIN_CHROMA`): a grey brand must not produce
 * five indistinguishable grey series.
 */
export function buildChartColors(
  brandHue: number,
  sourceChroma: number,
  scheme: ColorScheme,
): Record<ChartRole, Oklch> {
  const l = CHART_L[scheme];
  const c = Math.max(sourceChroma, CHART_MIN_CHROMA);
  const hues = chartHues(brandHue);
  const out = {} as Record<ChartRole, Oklch>;
  hues.forEach((h, i) => {
    out[`chart-${(i + 1) as 1 | 2 | 3 | 4 | 5}`] = finalize({ l, c, h });
  });
  return out;
}
