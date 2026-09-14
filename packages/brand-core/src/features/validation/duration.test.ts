import { describe, expect, it } from 'vitest';

import { validateDuration } from './duration.js';

describe('validateDuration', () => {
  it.each(['200ms', '0.3s', '0ms'])('accepts %j', (value) => {
    expect(validateDuration(value).ok).toBe(true);
  });

  it.each(['-200ms', '200', '200 ms', '200S', ''])('rejects %j', (value) => {
    expect(validateDuration(value).ok).toBe(false);
  });
});
