/**
 * @pxlhut/brand-core — the public surface.
 *
 * One brand colour in, a complete contrast-validated token tree out.
 * Nothing here may import a Node built-in or reach for a clock: core runs in
 * the browser for live preview (§3), and SSR correctness depends on its
 * purity (§39).
 */

export * from './shared/types/index.js';
export * from './shared/fields/index.js';

export type { Oklch } from './shared/color-math/index.js';
export { parseColor, toCss, isInSrgb, finalize } from './shared/color-math/index.js';

export { generateTheme, SCHEMA_VERSION, mergeLayers, ROLE_SPECS } from './features/theme/index.js';
export type {
  GenerateInput,
  GenerateResult,
  Violation,
  Adjustment,
} from './features/theme/index.js';

export { CONTRAST_TARGETS, contrastLc, absLc } from './features/contrast/index.js';
export type { ContrastTarget } from './features/contrast/index.js';

export { SEMANTIC_HUES, collidesWithInfo } from './features/semantics/index.js';
export { FONT_STACKS, stackFor } from './features/typography/index.js';
export type { ButtonStyle } from './features/shape/index.js';
