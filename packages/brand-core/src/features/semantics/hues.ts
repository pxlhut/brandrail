/**
 * Semantic hues — guideline §34.
 *
 * **Hue is fixed.** Never taken from the brand colour. "Error" has to read as
 * red whether the brand is blue or purple: that is a learned convention, not a
 * stylistic choice a theme should be free to override by accident. If an owner
 * could repaint error away from red, error states stop reading as errors, and
 * that failure is the platform's fault rather than theirs.
 *
 * **Everything else is derived** — lightness stops, chroma envelope and the
 * contrast approach all come from the same pipeline as the brand colour. So a
 * bold, saturated brand produces a bold, saturated error red, and a muted brand
 * produces a correspondingly muted one. That is what keeps semantic colours
 * part of the same theme without losing what makes them legible.
 */

export const SEMANTIC_HUES = {
  success: 148,
  warning: 80,
  destructive: 27,
  info: 250,
} as const;

export type SemanticName = keyof typeof SEMANTIC_HUES;

export const SEMANTIC_NAMES = Object.keys(SEMANTIC_HUES) as readonly SemanticName[];

/**
 * How close a brand hue may sit to `info` before the two read as the same
 * colour. A blue brand plus a blue "info" is a real collision, and worth
 * reporting rather than silently shipping.
 */
export const INFO_COLLISION_DEGREES = 20;

/** Shortest angular distance between two hues, 0–180. */
export function hueDistance(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360 + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

/**
 * True when the brand hue is close enough to `info` that the two will not read
 * as distinct. Surfaced rather than auto-corrected: nudging `info` away from
 * convention is as bad as the collision, so this is the platform's call.
 */
export function collidesWithInfo(brandHue: number): boolean {
  return hueDistance(brandHue, SEMANTIC_HUES.info) < INFO_COLLISION_DEGREES;
}

/**
 * Chart series hues, spread evenly around the wheel from the brand hue.
 *
 * shadcn ships `--chart-1` … `--chart-5` and charts render transparent without
 * them, so their absence is noticed immediately.
 */
export const CHART_SERIES = 5;

export function chartHues(brandHue: number): number[] {
  const spacing = 360 / CHART_SERIES;
  return Array.from({ length: CHART_SERIES }, (_, i) => (brandHue + i * spacing) % 360);
}

/**
 * Chart lightness, one stop per mode. Mid-range on purpose: these are
 * categorical marks on a background, not text surfaces, so the contrast dead
 * zone that constrains the ramp's solid step does not apply.
 */
export const CHART_L = { light: 0.62, dark: 0.68 } as const;

/**
 * Chroma floor for chart series.
 *
 * Unlike every other token here, chart colours do **not** inherit the brand's
 * chroma unconditionally. A grey brand would otherwise produce five identical
 * grey series, and a chart whose categories cannot be told apart has stopped
 * doing its job. Chart colour is data encoding first and brand expression
 * second.
 */
export const CHART_MIN_CHROMA = 0.1;
