/**
 * Choosing a value for a role so that it clears its APCA floor.
 *
 * The rule is *least extreme that clears*, not *most extreme available*.
 * Defaulting every foreground to black or white would pass every floor and
 * produce a theme that has nothing to do with the brand — the whole point of
 * generating from a brand colour is that the result still looks like one.
 */

import { clampToSrgb, finalize, type Oklch } from '../../shared/color-math/index.js';
import { absLc } from './apca.js';

export interface RolePick {
  /** Already finalized: clamped into sRGB and rounded to output precision. */
  color: Oklch;
  /** Absolute Lc actually achieved against the background. */
  lc: number;
  /**
   * `ramp` — a ramp step cleared the floor, which is the normal case.
   * `escalated` — none did, so lightness was pushed past the ramp's end.
   */
  source: 'ramp' | 'escalated';
  /**
   * Set only when the floor could not be met even at pure black or white.
   * Never silently absent: step 06 surfaces this as a violation and step 09's
   * property test fails on it, which is the point — a near-miss must be loud.
   */
  shortfall?: { minLc: number; achievedLc: number };
}

/** How far lightness moves per escalation attempt. Fine enough not to overshoot visibly. */
const ESCALATION_STEP = 0.01;

/**
 * Pick the ramp step nearest the background in lightness that still clears
 * `minLc`, escalating past the ramp only if nothing in it does.
 *
 * @param ramp        candidate colours, any order — sorted internally
 * @param background  the surface this role sits on
 * @param minLc       the floor from D5 / D11
 */
export function pickForRole(
  ramp: readonly Oklch[],
  background: Oklch,
  minLc: number,
): RolePick {
  if (ramp.length === 0) {
    throw new Error('pickForRole: ramp is empty.');
  }

  // Least extreme first: closest to the background in perceptual lightness.
  const byDistance = [...ramp].sort(
    (a, b) => Math.abs(a.l - background.l) - Math.abs(b.l - background.l),
  );

  let best: { color: Oklch; lc: number } | undefined;

  for (const candidate of byDistance) {
    const color = finalize(candidate);
    const lc = absLc(color, background);
    if (lc >= minLc) return { color, lc, source: 'ramp' };
    if (best === undefined || lc > best.lc) best = { color, lc };
  }

  return escalate(ramp, background, minLc, best);
}

interface Attempt {
  color: Oklch;
  lc: number;
}

/**
 * Sweep lightness from `anchor` toward `limit`, returning the first value that
 * clears the floor plus the best value seen along the way.
 */
function sweep(
  anchor: Oklch,
  limit: 0 | 1,
  background: Oklch,
  minLc: number,
): { cleared?: Attempt; best: Attempt } {
  const direction = limit === 0 ? -ESCALATION_STEP : ESCALATION_STEP;
  const start = finalize(anchor);
  let best: Attempt = { color: start, lc: absLc(start, background) };

  for (
    let l = anchor.l;
    limit === 0 ? l >= 0 : l <= 1;
    l += direction
  ) {
    const color = finalize(
      clampToSrgb({ l: Math.min(1, Math.max(0, l)), c: anchor.c, h: anchor.h }),
    );
    const lc = absLc(color, background);
    if (lc >= minLc) return { cleared: { color, lc }, best };
    if (lc > best.lc) best = { color, lc };
  }

  // Pure black or white, with no chroma left to get in the way.
  const extreme = finalize({ l: limit, c: 0, h: undefined });
  const extremeLc = absLc(extreme, background);
  if (extremeLc >= minLc) return { cleared: { color: extreme, lc: extremeLc }, best };
  if (extremeLc > best.lc) best = { color: extreme, lc: extremeLc };

  return { best };
}

/**
 * No ramp step cleared the floor. Push lightness past the ramp's end, holding
 * hue, until the floor is met.
 *
 * **Both directions are tried**, rather than picking one from the background's
 * lightness. APCA's polarity asymmetry puts the crossover — where dark-on-light
 * starts beating light-on-dark — near L 0.70, not L 0.50. Guessing at 0.5 sends
 * the sweep toward black on an L 0.56 surface, where black reaches Lc 32 and
 * white reaches 78, and the solver reports an impossible floor for a pairing
 * that was comfortably achievable.
 *
 * Deliberately not a silent fallback to the closest miss: if neither extreme
 * clears the floor, that comes back as a `shortfall` so the caller can report
 * it rather than shipping an illegible pairing.
 */
function escalate(
  ramp: readonly Oklch[],
  background: Oklch,
  minLc: number,
  best: { color: Oklch; lc: number } | undefined,
): RolePick {
  const darkest = ramp.reduce((a, b) => (a.l <= b.l ? a : b));
  const lightest = ramp.reduce((a, b) => (a.l >= b.l ? a : b));

  const toward0 = sweep(darkest, 0, background, minLc);
  const toward1 = sweep(lightest, 1, background, minLc);

  const cleared = [toward0.cleared, toward1.cleared].filter(
    (a): a is Attempt => a !== undefined,
  );
  if (cleared.length > 0) {
    // Least extreme wins, same rule as the ramp scan above.
    const chosen = cleared.reduce((a, b) =>
      Math.abs(a.color.l - background.l) <= Math.abs(b.color.l - background.l) ? a : b,
    );
    return { color: chosen.color, lc: chosen.lc, source: 'escalated' };
  }

  const candidates = [toward0.best, toward1.best, ...(best ? [best] : [])];
  const closest = candidates.reduce((a, b) => (a.lc >= b.lc ? a : b));
  return {
    color: closest.color,
    lc: closest.lc,
    source: 'escalated',
    shortfall: { minLc, achievedLc: closest.lc },
  };
}
