import { describe, expect, it } from 'vitest';

import { clampToSrgb, finalize, isInSrgb, parseColor, toCss, toRgb255 } from './gamut.js';

describe('clampToSrgb (D3)', () => {
  it('brings a wildly out-of-gamut colour inside sRGB', () => {
    const wild = { l: 0.7, c: 0.35, h: 150 };
    expect(isInSrgb(wild)).toBe(false);
    expect(isInSrgb(clampToSrgb(wild))).toBe(true);
  });

  it('holds lightness and hue exactly, reducing only chroma', () => {
    // This is what makes the clamp safe to apply after the ramp has already
    // decided lightness: it cannot move a step off its stop.
    const wild = { l: 0.7, c: 0.35, h: 150 };
    const clamped = clampToSrgb(wild);
    expect(clamped.l).toBe(0.7);
    expect(clamped.h).toBe(150);
    expect(clamped.c).toBeLessThan(0.35);
  });

  it('leaves an already in-gamut colour alone', () => {
    const fine = parseColor('#7C6CFF');
    expect(clampToSrgb(fine)).toEqual(fine);
  });

  it('round-trips through sRGB without drifting', () => {
    for (const hue of [0, 60, 150, 250, 330]) {
      const clamped = finalize({ l: 0.7, c: 0.35, h: hue });
      const back = parseColor(toCss(clamped));
      expect(back.l).toBeCloseTo(clamped.l, 6);
      expect(back.c).toBeCloseTo(clamped.c, 6);
    }
  });
});

describe('finalize', () => {
  it('produces values that are still in gamut after rounding', () => {
    // Rounding chroma up by a ten-thousandth can push a colour that sat exactly
    // on the gamut boundary just outside it, so finalize clamps twice.
    for (let h = 0; h < 360; h += 7) {
      for (const l of [0.24, 0.48, 0.62, 0.8, 0.99]) {
        expect(isInSrgb(finalize({ l, c: 0.4, h }))).toBe(true);
      }
    }
  });

  it('is idempotent', () => {
    const once = finalize({ l: 0.62, c: 0.21, h: 283.394 });
    expect(finalize(once)).toEqual(once);
  });

  it('is idempotent even when floating-point noise makes value * 10⁴ undershoot an integer', () => {
    // Found by step 09's property test, not by inspection: `0.0372 * 10000`
    // is `371.99999999999994`, not `372`, because 0.0372 has no exact binary
    // representation. `floorTo` used to read that as 371 and silently drop a
    // whole precision step — turning an already-settled chroma of 0.0372 into
    // 0.0371 on a second pass. That single ten-thousandth was enough, right at
    // a role's contrast floor, to turn a passing pick into a violation once
    // `findViolations` re-derived it from serialised CSS text.
    expect(0.0372 * 10000).not.toBe(372); // the representation error this guards against
    const once = finalize({ l: 0.95, c: 0.0372, h: 156.58 });
    expect(once.c).toBe(0.0372);
    expect(finalize(once)).toEqual(once);
    expect(finalize(parseColor(toCss(once)))).toEqual(once);
  });

  it('rounds to output precision, chroma always downward', () => {
    // Chroma rounds down so it can never cross back out of the gamut.
    const out = finalize({ l: 0.623871430674, c: 0.0123456789, h: 283.39400485 });
    expect(out.l).toBe(0.6239);
    expect(out.c).toBe(0.0123);
    expect(out.h).toBe(283.39);
    expect(finalize({ l: 0.5, c: 0.01239, h: 100 }).c).toBe(0.0123);
  });

  it('clamps lightness into 0..1', () => {
    expect(finalize({ l: 1.4, c: 0, h: undefined }).l).toBe(1);
    expect(finalize({ l: -0.2, c: 0, h: undefined }).l).toBe(0);
  });

  it('normalises negative zero, so two runs cannot differ by a sign bit', () => {
    expect(Object.is(finalize({ l: -0, c: 0, h: undefined }).l, 0)).toBe(true);
  });
});

describe('parseColor', () => {
  it('reads hex into OKLCH', () => {
    const p = parseColor('#7C6CFF');
    expect(p.l).toBeCloseTo(0.6239, 3);
    expect(p.c).toBeCloseTo(0.2103, 3);
    expect(p.h).toBeCloseTo(283.39, 1);
  });

  it('reports no hue for achromatic input, rather than inventing one', () => {
    expect(parseColor('#808080').h).toBeUndefined();
    expect(parseColor('#000000').h).toBeUndefined();
    expect(parseColor('#FFFFFF').h).toBeUndefined();
  });

  it('throws with the field name rather than silently defaulting', () => {
    // A silently-defaulted brand colour is a support ticket that takes an hour
    // to diagnose, because nothing reports that the input was ignored.
    expect(() => parseColor('not-a-colour')).toThrow(/brandColor/);
    expect(() => parseColor('#GGG', 'accentColor')).toThrow(/accentColor/);
  });
});

describe('toRgb255', () => {
  it('returns 8-bit integers, which is what a display actually renders', () => {
    const [r, g, b] = toRgb255(parseColor('#7C6CFF'));
    expect([r, g, b]).toEqual([124, 108, 255]);
    for (const channel of [r, g, b]) expect(Number.isInteger(channel)).toBe(true);
  });

  it('clamps channels into range', () => {
    const [r, g, b] = toRgb255({ l: 1, c: 0, h: undefined });
    expect([r, g, b]).toEqual([255, 255, 255]);
  });
});
