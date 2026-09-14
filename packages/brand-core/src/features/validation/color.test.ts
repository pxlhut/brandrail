import { describe, expect, it } from 'vitest';

import { validateColor } from './color.js';

describe('validateColor', () => {
  it('accepts a hex colour and re-emits it normalised, not echoed', () => {
    const result = validateColor('#fff');
    expect(result.ok).toBe(true);
    expect(result.ok && result.normalized).not.toBe('#fff');
    expect(result.ok && result.normalized).toMatch(/^oklch\(/);
  });

  it('accepts a named colour', () => {
    const result = validateColor('red');
    expect(result.ok).toBe(true);
    expect(result.ok && result.normalized).toMatch(/^oklch\(/);
  });

  it('rejects a string that is not a colour', () => {
    const result = validateColor('not-a-colour');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/not a valid CSS colour/);
  });

  it('gamut-clamps a colour outside sRGB, same as every generated colour (D3)', () => {
    // A very high chroma at this L/H sits outside sRGB — culori parses it, but
    // the *un*clamped chroma must not survive to the normalised output.
    const wide = validateColor('oklch(0.6 0.5 250)');
    expect(wide.ok).toBe(true);
    const clamped = wide.ok ? /oklch\(\S+ (\S+) /.exec(wide.normalized)?.[1] : undefined;
    expect(Number(clamped)).toBeLessThan(0.5);
  });
});
