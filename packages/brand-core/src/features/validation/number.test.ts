import { describe, expect, it } from 'vitest';

import { validateNumber } from './number.js';

describe('validateNumber', () => {
  it.each(['0', '1', '-1', '0.875', '100.5'])('accepts %j', (value) => {
    expect(validateNumber(value).ok).toBe(true);
  });

  it('normalises a non-canonical spelling', () => {
    const result = validateNumber('0.50');
    expect(result.ok).toBe(true);
    expect(result.ok && result.normalized).toBe('0.5');
  });

  it.each(['NaN', 'Infinity', '1e5', '', '1,000', '1_000'])('rejects %j', (value) => {
    expect(validateNumber(value).ok).toBe(false);
  });

  it('rejects a digit string long enough to overflow to Infinity', () => {
    // Matches the regex — it's all digits — but is not a finite number.
    const huge = '9'.repeat(400);
    expect(Number.isFinite(Number(huge))).toBe(false);
    expect(validateNumber(huge).ok).toBe(false);
  });
});
