import { describe, expect, it } from 'vitest';

import { parseColor } from '../../shared/color-math/index.js';
import { absLc, clearsFloor, contrastLc } from './apca.js';
import { CONTRAST_TARGETS, targetFor } from './targets.js';

const WHITE = parseColor('#FFFFFF');
const BLACK = parseColor('#000000');

describe('contrastLc', () => {
  it('is polarity-aware: sign follows dark-on-light vs light-on-dark', () => {
    expect(contrastLc(BLACK, WHITE)).toBeGreaterThan(0);
    expect(contrastLc(WHITE, BLACK)).toBeLessThan(0);
  });

  it('is not commutative — swapping arguments is a different number, not a sign flip', () => {
    // This is the single most common way APCA gets used wrongly. Black on white
    // is ~106; white on black is ~-108. The magnitudes genuinely differ.
    const forward = contrastLc(BLACK, WHITE);
    const reverse = contrastLc(WHITE, BLACK);
    expect(Math.abs(forward)).not.toBeCloseTo(Math.abs(reverse), 1);
    expect(Math.abs(forward)).toBeCloseTo(106, 0);
    expect(Math.abs(reverse)).toBeCloseTo(107.9, 0);
  });

  it('reports no contrast for a colour against itself', () => {
    expect(absLc(WHITE, WHITE)).toBeCloseTo(0, 5);
  });
});

describe('absLc', () => {
  it('compares magnitude, which is what every floor is stated against', () => {
    expect(absLc(WHITE, BLACK)).toBe(Math.abs(contrastLc(WHITE, BLACK)));
    expect(absLc(WHITE, BLACK)).toBeGreaterThan(0);
  });
});

describe('clearsFloor', () => {
  it('passes at the floor exactly, not just above it', () => {
    const lc = absLc(BLACK, WHITE);
    expect(clearsFloor(BLACK, WHITE, lc)).toBe(true);
    expect(clearsFloor(BLACK, WHITE, lc + 0.001)).toBe(false);
  });
});

describe('the contrast target table (D5 + D11)', () => {
  it('covers every pairing the decisions record', () => {
    expect(CONTRAST_TARGETS).toHaveLength(19);
  });

  it('names distinct pairings — a duplicate row would silently mask a floor', () => {
    const keys = CONTRAST_TARGETS.map((t) => `${t.foreground}/${t.background}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('holds body text to the strictest floor', () => {
    expect(targetFor('foreground', 'background')?.minLc).toBe(90);
    expect(targetFor('card-foreground', 'card')?.minLc).toBe(90);
    expect(targetFor('sidebar-foreground', 'sidebar')?.minLc).toBe(90);
  });

  it('holds structural boundaries to the loosest', () => {
    expect(targetFor('border', 'background')?.minLc).toBe(15);
    expect(targetFor('input', 'background')?.minLc).toBe(15);
  });

  it('gives the sidebar block the same guarantee as the rest (D11)', () => {
    const sidebar = CONTRAST_TARGETS.filter((t) => t.background.startsWith('sidebar'));
    expect(sidebar).toHaveLength(5);
    for (const t of sidebar) expect(t.minLc).toBeGreaterThanOrEqual(15);
  });

  it('gives every row a rationale, so a future change is an argument not a guess', () => {
    for (const t of CONTRAST_TARGETS) expect(t.rationale.length).toBeGreaterThan(0);
  });
});
