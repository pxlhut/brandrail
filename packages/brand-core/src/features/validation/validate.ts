/**
 * Composes layers 1 and 2 (§19). Every entry point into raw or direct-tier
 * data goes through this — never a per-type validator alone.
 */

import { checkHardReject } from './charset.js';
import { validateColor } from './color.js';
import { validateDuration } from './duration.js';
import { validateFontStack } from './font-stack.js';
import { validateLength } from './length.js';
import { validateNumber } from './number.js';
import type { TokenValueType, ValidationResult } from './types.js';

function parseByType(value: string, type: TokenValueType): ValidationResult {
  switch (type) {
    case 'color':
      return validateColor(value);
    case 'length':
      return validateLength(value);
    case 'number':
      return validateNumber(value);
    case 'duration':
      return validateDuration(value);
    case 'font-stack':
      return validateFontStack(value);
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown token value type: ${String(exhaustive)}`);
    }
  }
}

/**
 * Validate one raw string against its declared type.
 *
 * The hard-reject gate runs before *and* after the type-specific parse: once
 * on the raw input (so a value the type check would reject anyway never
 * reaches a parser unnecessarily), and once on the normalised output (so a
 * bug in one type's normalisation can never hand back something the
 * character-set gate would itself have refused).
 */
export function validateTokenValue(value: string, type: TokenValueType): ValidationResult {
  const gate = checkHardReject(value);
  if (!gate.ok) return gate;

  const parsed = parseByType(value, type);
  if (!parsed.ok) return parsed;

  const recheck = checkHardReject(parsed.normalized);
  if (!recheck.ok) return recheck;

  return parsed;
}
