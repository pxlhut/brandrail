/**
 * Layer 1 for `color` — parse with culori, re-emit the normalised form.
 *
 * Normalising is what makes this airtight: `#fff` in, `oklch(…)` out, and
 * nothing the attacker wrote survives to the output.
 *
 * Also runs the result through `finalize()` — the same sRGB gamut clamp every
 * generated colour in this package goes through (D3, "no exceptions"). A raw
 * override is the one place a colour reaches the token tree without having
 * passed through the generator, so this is where D3's rule would otherwise
 * have a silent exception.
 */

import { finalize, parseColor, toCss } from '../../shared/color-math/index.js';
import type { ValidationResult } from './types.js';

export function validateColor(value: string): ValidationResult {
  let parsed;
  try {
    parsed = parseColor(value, 'value');
  } catch {
    return { ok: false, reason: 'not a valid CSS colour' };
  }
  return { ok: true, normalized: toCss(finalize(parsed)) };
}
