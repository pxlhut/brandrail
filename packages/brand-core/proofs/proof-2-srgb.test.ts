/**
 * Proof 2 — everything lands inside sRGB (step 09, D3).
 *
 * This is the guarantee that prevents "the brand looks different on my
 * monitor" reports: every colour this package emits must round-trip through
 * sRGB unchanged, for the same 1,000 seeded random brand colours proof 1
 * uses.
 */

import fc from 'fast-check';
import { describe, it } from 'vitest';

import { generateTheme, isInSrgb, parseColor } from '../src/index.js';
import type { ColorScheme, TokenTree, TokenValue } from '../src/index.js';

const SEED = 20260914;
const NUM_RUNS = 1000;

const hexColor = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `#${n.toString(16).padStart(6, '0')}`);

function resolve(value: TokenValue, scheme: ColorScheme): string {
  return typeof value === 'string' ? value : value[scheme];
}

/** Every colour token in the tree, tagged with where it came from for a useful failure message. */
function everyColorToken(tokens: TokenTree, scheme: ColorScheme): Array<{ label: string; css: string }> {
  const out: Array<{ label: string; css: string }> = [];
  for (const role of Object.keys(tokens.color) as Array<keyof TokenTree['color']>) {
    out.push({ label: `color.${role}`, css: resolve(tokens.color[role], scheme) });
  }
  for (const role of Object.keys(tokens.chart) as Array<keyof TokenTree['chart']>) {
    out.push({ label: `chart.${role}`, css: resolve(tokens.chart[role], scheme) });
  }
  return out;
}

describe('proof 2 — sRGB', () => {
  it('every emitted colour is in-gamut, for 1000 seeded random brand colours', () => {
    fc.assert(
      fc.property(hexColor, (hex) => {
        const result = generateTheme({ brandColor: hex });

        for (const scheme of ['light', 'dark'] as const) {
          for (const { label, css } of everyColorToken(result.tokens, scheme)) {
            const parsed = parseColor(css, label);
            if (!isInSrgb(parsed)) {
              throw new Error(
                `brandColor ${hex}, ${scheme} ${label} = ${css} is outside sRGB`,
              );
            }
          }
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
