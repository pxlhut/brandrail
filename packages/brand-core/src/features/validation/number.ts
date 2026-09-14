/** Layer 1 for `number` — finite, and re-emitted in canonical form. */

import type { ValidationResult } from './types.js';

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

export function validateNumber(value: string): ValidationResult {
  if (!NUMBER_PATTERN.test(value)) {
    return { ok: false, reason: 'not a finite number' };
  }
  const parsed = Number(value);
  // The regex accepts any run of digits, including one long enough to
  // overflow to Infinity — a 400-digit string is not a finite number even
  // though it matches the grammar.
  if (!Number.isFinite(parsed)) {
    return { ok: false, reason: 'not a finite number' };
  }
  // Strips non-canonical spellings like a leading zero or a trailing ".50".
  return { ok: true, normalized: String(parsed) };
}
