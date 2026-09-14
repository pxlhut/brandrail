import { describe, expect, it } from 'vitest';

import { isInSrgb, parseColor, type Oklch } from '../../shared/color-math/index.js';
import {
  absLc,
  CONTRAST_TARGETS,
  LC_LARGE_TEXT,
  pickForRole,
} from '../contrast/index.js';
import { buildBrandRamps, buildNeutralRamps, SOLID_INDEX } from './index.js';

const PURE_BLACK: Oklch = { l: 0, c: 0, h: undefined };
const PURE_WHITE: Oklch = { l: 1, c: 0, h: undefined };

/** The highest APCA contrast any foreground can reach on this surface. */
function maxAchievableLc(background: Oklch): number {
  return Math.max(absLc(PURE_BLACK, background), absLc(PURE_WHITE, background));
}

/**
 * Twenty varied brand colours: vivid, muted, achromatic, and the hues that
 * historically break contrast solvers (yellow, deep indigo, neon green).
 */
export const PROBE_COLORS = [
  '#7C6CFF', '#00FF88', '#6B7280', '#000000', '#FFFFFF',
  '#808080', '#FFD700', '#1A0033', '#E05B5B', '#3B82F6',
  '#0F766E', '#DB2777', '#84CC16', '#F97316', '#06B6D4',
  '#4338CA', '#A16207', '#16A34A', '#9333EA', '#DC2626',
] as const;

/** Every distinct floor the target table uses. */
const FLOORS = [...new Set(CONTRAST_TARGETS.map((t) => t.minLc))].sort((a, b) => a - b);

/** Ramp indices that act as surfaces: backgrounds, fills, and the solid end. */
const SURFACE_INDICES = [0, 1, 2, 7, 8, 11];

it('always returns a finalized, in-gamut colour', () => {
  const ramps = buildBrandRamps(parseColor('#00FF88'));
  for (const scheme of ['light', 'dark'] as const) {
    const ramp = ramps[scheme];
    for (const floor of FLOORS) {
      expect(isInSrgb(pickForRole(ramp, ramp[0] as Oklch, floor).color)).toBe(true);
    }
  }
});

describe('pickForRole across 20 varied brand colours', () => {
  /**
   * The solver's contract: for any surface drawn from a generated ramp, and any
   * floor in the table, it either clears the floor or says why it could not.
   *
   * Role *assignment* — which ramp index becomes `primary` — is step 06's job,
   * and the full 1,000-input property test is step 09's. This proves the piece
   * step 04 owns, across the real ramps rather than synthetic ones.
   */
  it('clears every floor that is physically achievable on that surface', () => {
    // APCA contrast against a surface is bounded by what pure black or pure
    // white achieve on it. Demanding more than that ceiling would be demanding
    // the impossible, so the contract is: clear the floor whenever the ceiling
    // allows it, and report a shortfall — never a silent miss — when it does not.
    const failures: string[] = [];

    for (const hex of PROBE_COLORS) {
      const brand = buildBrandRamps(parseColor(hex));
      const neutral = buildNeutralRamps('cool');

      for (const scheme of ['light', 'dark'] as const) {
        for (const [name, ramp] of [
          ['brand', brand[scheme]],
          ['neutral', neutral[scheme]],
        ] as const) {
          for (const surfaceIndex of SURFACE_INDICES) {
            const background = ramp[surfaceIndex] as Oklch;
            const ceiling = maxAchievableLc(background);

            for (const floor of FLOORS) {
              const pick = pickForRole(ramp, background, floor);
              const measured = absLc(pick.color, background);
              const where = `${hex} ${scheme} ${name}[${surfaceIndex}] Lc${floor}`;

              if (floor <= ceiling) {
                if (pick.shortfall !== undefined) {
                  failures.push(
                    `${where}: gave up at ${measured.toFixed(1)} though ` +
                      `${ceiling.toFixed(1)} was reachable`,
                  );
                } else if (measured < floor) {
                  failures.push(
                    `${where}: claimed ${pick.lc.toFixed(1)}, measured ${measured.toFixed(1)}`,
                  );
                }
              } else if (pick.shortfall === undefined) {
                failures.push(
                  `${where}: claimed success at ${measured.toFixed(1)} but the ` +
                    `ceiling on this surface is ${ceiling.toFixed(1)}`,
                );
              }
            }
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('can always carry a button label on the solid step, in both modes', () => {
    // The constraint the ramp stops exist to satisfy: index 8 is `primary`,
    // `secondary`, `accent` and `destructive`, and D5 holds their foregrounds to
    // Lc 75. Surfaces in L ≈ [0.57, 0.84] cannot carry that with any foreground
    // at all, so the solid step has to sit outside that band.
    for (const hex of PROBE_COLORS) {
      const ramps = buildBrandRamps(parseColor(hex));
      for (const scheme of ['light', 'dark'] as const) {
        const solid = ramps[scheme][SOLID_INDEX] as Oklch;
        expect(
          maxAchievableLc(solid),
          `${hex} ${scheme} solid step cannot carry Lc 75`,
        ).toBeGreaterThanOrEqual(LC_LARGE_TEXT);
      }
    }
  });

  it('reports the Lc it actually achieved, not the one it hoped for', () => {
    // A solver that lies about its result makes step 09's property test
    // meaningless, because the assertion would be checking the lie.
    const ramps = buildBrandRamps(parseColor('#7C6CFF'));
    for (const scheme of ['light', 'dark'] as const) {
      const ramp = ramps[scheme];
      for (const floor of FLOORS) {
        const bg = ramp[0] as Oklch;
        const pick = pickForRole(ramp, bg, floor);
        expect(pick.lc).toBeCloseTo(absLc(pick.color, bg), 6);
      }
    }
  });
});
