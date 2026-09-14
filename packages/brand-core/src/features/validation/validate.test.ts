import { describe, expect, it } from 'vitest';

import { HOSTILE_VALUES } from '../../../fixtures/hostile-values.js';
import { validateLength } from './length.js';
import { validateTokenValue } from './validate.js';

describe('validateTokenValue — the hostile corpus (§19)', () => {
  for (const { description, value, type, expected } of HOSTILE_VALUES) {
    it(`${expected}s: ${description} (${JSON.stringify(value.slice(0, 40))})`, () => {
      const result = validateTokenValue(value, type);
      expect(result.ok).toBe(expected === 'accept');
    });
  }
});

describe('validateTokenValue — the hard-reject layer is independent of the type parse', () => {
  it('rejects a value that the length grammar alone would accept', () => {
    const oversized = `1${'0'.repeat(600)}px`;

    // The type parse, run alone, accepts it — it is syntactically a perfectly
    // good length. `checkHardReject` is what actually stops it, proving the
    // two layers are separate gates, not one layer standing in for the other.
    expect(validateLength(oversized).ok).toBe(true);
    expect(validateTokenValue(oversized, 'length').ok).toBe(false);
  });

  it('applies the same forbidden-character check no matter which type is declared', () => {
    const value = 'oklch(0.5 0.1 30);';
    for (const type of ['color', 'length', 'number', 'duration', 'font-stack'] as const) {
      expect(validateTokenValue(value, type).ok).toBe(false);
    }
  });
});

describe('validateTokenValue — acceptance criteria', () => {
  it('never echoes the raw input for a colour — only the normalised form', () => {
    const result = validateTokenValue('#ABCDEF', 'color');
    expect(result.ok).toBe(true);
    expect(result.ok && result.normalized).not.toBe('#ABCDEF');
  });

  it('rejects an unlisted font even at the raw tier, by enum membership', () => {
    const result = validateTokenValue('Comic Sans MS', 'font-stack');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/curated font stacks/);
  });

  it('rejects values over 512 bytes', () => {
    const result = validateTokenValue('1'.repeat(513), 'number');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/512 bytes/);
  });
});
