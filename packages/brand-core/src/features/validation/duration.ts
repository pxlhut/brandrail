/**
 * Layer 1 for `duration` — a non-negative number followed by `ms` or `s`.
 *
 * No current token is a duration (§37's transition tokens, if they ever
 * land, would be); kept here because `TokenValueType` names it and a type the
 * validator doesn't cover is worse than one it covers unused.
 */

import type { ValidationResult } from './types.js';

const DURATION_PATTERN = /^\d+(\.\d+)?(ms|s)$/;

export function validateDuration(value: string): ValidationResult {
  if (!DURATION_PATTERN.test(value)) {
    return {
      ok: false,
      reason: 'not a valid duration (expected a non-negative number followed by ms or s)',
    };
  }
  return { ok: true, normalized: value };
}
