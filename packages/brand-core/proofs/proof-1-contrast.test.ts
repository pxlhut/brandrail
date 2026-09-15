/**
 * Proof 1 — contrast holds for a thousand inputs (step 09).
 *
 * "APCA-validated" means nothing if it only holds for the three brand
 * colours someone happened to test. This is the headline claim, checked
 * against 1,000 seeded random hex colours rather than a curated set.
 *
 * Seeded, not left to fast-check's default randomness: a flaky unseeded
 * property test gets deleted within a month, and a failure here needs to be
 * reproducible so it can actually get fixed.
 */

import fc from 'fast-check';
import { describe, it } from 'vitest';

import { generateTheme } from '../src/index.js';

const SEED = 20260914;
const NUM_RUNS = 1000;

/** Any 24-bit RGB hex colour — the full space, not a curated subset. */
const hexColor = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `#${n.toString(16).padStart(6, '0')}`);

describe('proof 1 — contrast', () => {
  it('every D5/D11 floor clears, light and dark, for 1000 seeded random brand colours', () => {
    fc.assert(
      fc.property(hexColor, (hex) => {
        const result = generateTheme({ brandColor: hex });
        if (result.violations.length === 0) return;

        // Fail with the input, the role pair, the Lc achieved, and the floor
        // — a bare "expected true to be false" costs an hour of bisecting.
        const detail = result.violations
          .map((v) => `${v.fg} on ${v.bg}: got Lc ${v.got}, needs ${v.min}`)
          .join('; ');
        throw new Error(`brandColor ${hex} failed ${result.violations.length} floor(s): ${detail}`);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
