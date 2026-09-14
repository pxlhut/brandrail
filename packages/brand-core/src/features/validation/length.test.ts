import { describe, expect, it } from 'vitest';

import { validateLength } from './length.js';

describe('validateLength', () => {
  it.each(['0.5rem', '10px', '100%', '-2em', '0px'])('accepts %j', (value) => {
    const result = validateLength(value);
    expect(result.ok).toBe(true);
    expect(result.ok && result.normalized).toBe(value);
  });

  it.each(['10', '10vh', '1e2px', '10 px', 'calc(1px + 1px)', ''])('rejects %j', (value) => {
    expect(validateLength(value).ok).toBe(false);
  });

  it('matches the whole string, not a valid prefix', () => {
    // A regex that isn't anchored at both ends would accept this by matching
    // just the "10px" prefix.
    expect(validateLength('10px; color: red').ok).toBe(false);
  });
});
