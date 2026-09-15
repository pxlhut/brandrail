/**
 * Proof 7 — the edge cases, explicitly (step 09).
 *
 * Not random: named. Each gets its own test, so a regression names the case
 * instead of reporting "property failed after 37 runs". Proof 1's 1,000
 * random inputs are what give broad coverage; these are the specific,
 * previously-known-hard cases worth pinning down by name regardless of what
 * random sampling happens to hit.
 *
 * The plan text lists eight cases in prose but titles the section "seven" —
 * off by one, the same kind of miscount D-something documents elsewhere in
 * this project. All eight are implemented; each is a real, distinct edge,
 * and dropping one to match the count would be worse than the discrepancy.
 */

import { describe, expect, it } from 'vitest';

import { generateTheme, parseColor } from '../src/index.js';

function expectNoViolations(hex: string) {
  const result = generateTheme({ brandColor: hex });
  if (result.violations.length > 0) {
    const detail = result.violations
      .map((v) => `${v.fg} on ${v.bg}: got Lc ${v.got}, needs ${v.min}`)
      .join('; ');
    throw new Error(`${hex} failed ${result.violations.length} floor(s): ${detail}`);
  }
}

describe('proof 7 — named edge cases', () => {
  it('#000000 — pure black, achromatic (h undefined)', () => {
    expect(parseColor('#000000').h).toBeUndefined();
    expectNoViolations('#000000');
  });

  it('#FFFFFF — pure white, achromatic (h undefined)', () => {
    expect(parseColor('#FFFFFF').h).toBeUndefined();
    expectNoViolations('#FFFFFF');
  });

  it('#808080 — mid grey, achromatic (h undefined)', () => {
    expect(parseColor('#808080').h).toBeUndefined();
    expectNoViolations('#808080');
  });

  it('#7e8184 — chroma ~0.006, below the 0.01 achromatic threshold but not exactly zero', () => {
    // Distinct from the three pure-grey cases above: this one *has* a hue
    // (culori reports one), but D4's ACHROMATIC_THRESHOLD (0.01) still
    // classifies it as achromatic — the `color.c < ACHROMATIC_THRESHOLD`
    // branch, not the `color.h === undefined` branch.
    const parsed = parseColor('#7e8184');
    expect(parsed.h).toBeDefined();
    expect(parsed.c).toBeLessThan(0.01);
    expectNoViolations('#7e8184');
  });

  it('#00FF88 — neon green, at the edge of the sRGB gamut', () => {
    expectNoViolations('#00FF88');
  });

  it('#1A0033 — dark saturated indigo', () => {
    expectNoViolations('#1A0033');
  });

  it('#FFD700 — yellow, the one that breaks contrast solvers (high L, high C)', () => {
    // §4's dead-zone tuning (D4) exists specifically because of hues like
    // this one — high lightness and chroma leave the least headroom for a
    // legible foreground.
    expectNoViolations('#FFD700');
  });

  it('#3355ee — hue within 20° of the info blue (§34), reported as an advisory, not auto-corrected', () => {
    const result = generateTheme({ brandColor: '#3355ee' });
    expect(result.advisories.length).toBeGreaterThan(0);
    expect(result.advisories[0]).toMatch(/info/i);
    // The collision is a UX note, not a contrast failure — the theme is still valid.
    expect(result.violations).toEqual([]);
  });
});
