import { describe, expect, it } from 'vitest';

import { parseColor, type Oklch } from '../../shared/color-math/index.js';
import { pickForRole } from './pick.js';

/**
 * Unit tests only: synthetic ramps, no palette import. `contrast` sits below
 * `palette` in the layering graph, so the sweep across real generated ramps
 * lives in `features/palette/solver.test.ts` instead.
 */
describe('pickForRole', () => {
  it('rejects an empty ramp rather than returning something arbitrary', () => {
    expect(() => pickForRole([], parseColor('#fff'), 90)).toThrow(/empty/);
  });

  it('returns the least extreme step that clears, not the most extreme available', () => {
    // Defaulting every foreground to black would pass every floor and produce a
    // theme with nothing to do with the brand.
    const ramp: Oklch[] = [
      { l: 0.95, c: 0, h: undefined },
      { l: 0.7, c: 0, h: undefined },
      { l: 0.45, c: 0, h: undefined },
      { l: 0.1, c: 0, h: undefined },
    ];
    const bg = { l: 0.99, c: 0, h: undefined };
    const pick = pickForRole(ramp, bg, 60);
    expect(pick.source).toBe('ramp');
    // The darkest step would also clear 60; the solver must not reach for it.
    expect(pick.color.l).toBeGreaterThan(0.1);
    expect(pick.lc).toBeGreaterThanOrEqual(60);
  });

  it('escalates past the ramp when nothing in it clears the floor', () => {
    const tooLight: Oklch[] = [
      { l: 0.99, c: 0, h: undefined },
      { l: 0.97, c: 0, h: undefined },
    ];
    const pick = pickForRole(tooLight, { l: 0.99, c: 0, h: undefined }, 90);
    expect(pick.source).toBe('escalated');
    expect(pick.lc).toBeGreaterThanOrEqual(90);
    expect(pick.shortfall).toBeUndefined();
  });

  it('escalates toward white when that is the better polarity', () => {
    // APCA's polarity crossover sits near L 0.70, not L 0.50. On an L 0.56
    // surface, black reaches only Lc 32 while white reaches 78 — so a solver
    // that picks its direction from `background.l > 0.5` walks the wrong way
    // and reports an impossible floor for a comfortably achievable pairing.
    const ramp: Oklch[] = [{ l: 0.56, c: 0, h: undefined }];
    const pick = pickForRole(ramp, { l: 0.56, c: 0, h: undefined }, 75);
    expect(pick.shortfall).toBeUndefined();
    expect(pick.color.l).toBeGreaterThan(0.56);
    expect(pick.lc).toBeGreaterThanOrEqual(75);
  });

  it('reports a shortfall rather than silently shipping an illegible pairing', () => {
    // Lc 90 against a mid-lightness surface is unreachable even at pure black
    // or pure white.
    const midGrey = { l: 0.68, c: 0, h: undefined };
    const pick = pickForRole([midGrey], midGrey, 90);
    expect(pick.shortfall).toBeDefined();
    expect(pick.shortfall?.minLc).toBe(90);
    expect(pick.shortfall?.achievedLc).toBeLessThan(90);
  });

  it('still returns the closest miss it found when it cannot clear the floor', () => {
    // Falling short is not licence to return something arbitrary — the caller
    // ships a colour either way, so it should be the best one available.
    const midGrey = { l: 0.68, c: 0, h: undefined };
    const pick = pickForRole([midGrey], midGrey, 90);
    expect(pick.lc).toBe(pick.shortfall?.achievedLc);
    expect(pick.lc).toBeGreaterThan(50);
  });
});
