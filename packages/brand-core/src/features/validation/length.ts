/**
 * Layer 1 for `length` — a regex, not a parser.
 *
 * The grammar is tiny enough that a regex is the correct tool; reaching for a
 * real CSS parser here would be solving a problem this type doesn't have.
 */

import type { ValidationResult } from './types.js';

const LENGTH_PATTERN = /^-?\d+(\.\d+)?(px|rem|em|%)$/;

export function validateLength(value: string): ValidationResult {
  if (!LENGTH_PATTERN.test(value)) {
    return {
      ok: false,
      reason: 'not a valid length (expected a number followed by px, rem, em or %)',
    };
  }
  return { ok: true, normalized: value };
}
