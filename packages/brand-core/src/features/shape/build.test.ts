import { describe, expect, it } from 'vitest';

import { RADIUS_OPTIONS, DENSITY_OPTIONS } from '../../shared/fields/index.js';
import {
  buildShape,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_DENSITY,
  DEFAULT_RADIUS,
  MAX_SHADOW_ALPHA,
  normalizeButtonStyle,
  shadowStrengthFor,
} from './build.js';

describe('buildShape', () => {
  it('is a pure lookup with no colour dependency', () => {
    // §32: radius, border width and density are not colour. They never run
    // through OKLCH and never get a contrast check.
    expect(buildShape({ radius: '1rem', density: '0.875', elevation: 0 })).toEqual({
      radius: '1rem',
      borderWidth: DEFAULT_BORDER_WIDTH,
      densityScale: '0.875',
      shadowStrength: '0',
    });
  });

  it('falls back to sensible defaults for an empty input', () => {
    const shape = buildShape();
    expect(shape.radius).toBe(DEFAULT_RADIUS);
    expect(shape.densityScale).toBe(DEFAULT_DENSITY);
    expect(shape.borderWidth).toBe(DEFAULT_BORDER_WIDTH);
  });

  it('accepts every §32 radius preset the registry offers', () => {
    for (const option of RADIUS_OPTIONS) {
      expect(buildShape({ radius: option.value }).radius).toBe(option.value);
    }
  });

  it('accepts every density preset the registry offers', () => {
    for (const option of DENSITY_OPTIONS) {
      expect(buildShape({ density: option.value }).densityScale).toBe(option.value);
    }
  });

  it('passes a Direct-tier length straight through', () => {
    // Direct tier may supply any valid length. Syntax is step 07's job — §32 is
    // explicit that the injection risk applies to every raw-writable field, not
    // only colour, so shape does not get to assume its input is safe.
    expect(buildShape({ radius: '3px' }).radius).toBe('3px');
  });

  it('does not mutate its input', () => {
    const input = { radius: '1rem', elevation: 50 };
    const copy = { ...input };
    buildShape(input);
    expect(input).toEqual(copy);
  });
});

describe('shadowStrengthFor', () => {
  it('maps the 0–100 slider onto an alpha', () => {
    expect(shadowStrengthFor(0)).toBe('0');
    expect(Number(shadowStrengthFor(100))).toBeCloseTo(MAX_SHADOW_ALPHA, 3);
    expect(Number(shadowStrengthFor(50))).toBeCloseTo(MAX_SHADOW_ALPHA / 2, 3);
  });

  it('rises monotonically with elevation', () => {
    let previous = -1;
    for (let e = 0; e <= 100; e += 10) {
      const current = Number(shadowStrengthFor(e));
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it('clamps out-of-range input rather than trusting the caller', () => {
    expect(shadowStrengthFor(-50)).toBe('0');
    expect(Number(shadowStrengthFor(9999))).toBeCloseTo(MAX_SHADOW_ALPHA, 3);
  });

  it('survives a non-finite value', () => {
    expect(Number.isNaN(Number(shadowStrengthFor(Number.NaN)))).toBe(false);
  });

  it('emits a strength, never a composed box-shadow string', () => {
    // A composed shadow is a far larger injection surface for step 07 —
    // offsets, blur radii, colour, `inset`, arbitrary comma-separated layers —
    // and buys nothing the component library cannot do with an alpha.
    const value = shadowStrengthFor(75);
    expect(value).toMatch(/^[0-9.]+$/);
    expect(value).not.toContain('px');
    expect(value).not.toContain('rgb');
  });
});

describe('buttonStyle', () => {
  it('is not a colour token', () => {
    // "Outline" cannot be expressed as a set of colour values; trying produces
    // a second parallel palette that drifts from the first.
    const shape = buildShape({ radius: '1rem' });
    expect(Object.keys(shape).sort()).toEqual([
      'borderWidth',
      'densityScale',
      'radius',
      'shadowStrength',
    ]);
  });

  it('normalises to solid unless outline is asked for explicitly', () => {
    expect(normalizeButtonStyle('outline')).toBe('outline');
    expect(normalizeButtonStyle('solid')).toBe('solid');
    expect(normalizeButtonStyle(undefined)).toBe('solid');
    expect(normalizeButtonStyle('nonsense')).toBe('solid');
  });
});
