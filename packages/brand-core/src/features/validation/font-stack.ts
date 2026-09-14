/**
 * Layer 1 for `font-stack` — enum membership, not string inspection (§35).
 *
 * Fonts are the one token type that legitimately contains arbitrary-looking
 * strings, which makes them the sharp edge: an unlisted font name fails
 * *silently* to a system fallback, and re-serving fonts on behalf of other
 * sites is real licensing exposure. So the check here isn't "is this
 * syntactically a font stack" — it's "is this exactly one of the stacks we
 * curated and self-host" — even at raw tier.
 */

import { FONT_STACKS } from '../../shared/fields/index.js';
import type { ValidationResult } from './types.js';

const CURATED_STACKS = new Set(Object.values(FONT_STACKS));

export function validateFontStack(value: string): ValidationResult {
  if (!CURATED_STACKS.has(value)) {
    return { ok: false, reason: 'not one of the curated font stacks' };
  }
  return { ok: true, normalized: value };
}
