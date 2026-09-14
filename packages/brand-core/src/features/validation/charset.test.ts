import { describe, expect, it } from 'vitest';

import { checkHardReject, MAX_VALUE_BYTES } from './charset.js';

describe('checkHardReject', () => {
  it.each(['a;b', 'a{b', 'a}b', 'a<b', 'a>b', 'a@b', 'a\\b'])(
    'rejects the forbidden character in %j',
    (value) => {
      const result = checkHardReject(value);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.reason).toMatch(/forbidden character/);
    },
  );

  it.each(['url(x)', 'URL(x)', 'expression(x)', 'EXPRESSION(x)', '/*x*/'])(
    'rejects the forbidden sequence in %j',
    (value) => {
      const result = checkHardReject(value);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.reason).toMatch(/forbidden sequence/);
    },
  );

  it('rejects a value over the byte cap', () => {
    const result = checkHardReject('a'.repeat(MAX_VALUE_BYTES + 1));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(new RegExp(`${MAX_VALUE_BYTES} bytes`));
  });

  it('accepts a value exactly at the byte cap', () => {
    expect(checkHardReject('a'.repeat(MAX_VALUE_BYTES)).ok).toBe(true);
  });

  it('rejects non-ASCII input', () => {
    const result = checkHardReject('café');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/non-ASCII/);
  });

  it('accepts a clean, short, ASCII value', () => {
    expect(checkHardReject('0.5rem').ok).toBe(true);
  });
});
