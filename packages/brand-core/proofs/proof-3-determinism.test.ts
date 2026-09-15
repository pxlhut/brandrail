/**
 * Proof 3 — determinism (step 09, §39).
 *
 * §39's whole SSR argument rests on `generateTheme()` being pure: the same
 * input must produce the same output every time, in this process and in the
 * next one. Two forms, both needed:
 *
 * - In-process: call it twice, compare.
 * - Cross-process: a snapshot committed to the repo, compared on every CI
 *   run — vitest's own file-snapshot mechanism is exactly this, so it's used
 *   directly rather than hand-rolling a compare-to-committed-file script.
 *   When `__snapshots__/proof-3-determinism.test.ts.snap` changes, that *is*
 *   the schemaVersion tripwire (guideline §6): the algorithm changed, and
 *   that's the moment to bump `SCHEMA_VERSION`, not three commits later.
 */

import { describe, expect, it } from 'vitest';

import { generateTheme, toShadcnCss } from '../src/index.js';
import type { GenerateInput } from '../src/index.js';

/** ~20 fixed inputs, spanning brand colour, overrides, and non-default shape/typography. */
const FIXED_INPUTS: readonly GenerateInput[] = [
  { brandColor: '#7C6CFF' },
  { brandColor: '#00FF88' },
  { brandColor: '#6B7280' },
  { brandColor: '#000000' },
  { brandColor: '#FFFFFF' },
  { brandColor: '#808080' },
  { brandColor: '#FFD700' },
  { brandColor: '#1A0033' },
  { brandColor: '#E05B5B' },
  { brandColor: '#3B82F6' },
  { brandColor: '#0F766E', neutralTone: 'warm' },
  { brandColor: '#DB2777', neutralTone: 'cool' },
  { brandColor: '#84CC16', radius: '1rem', density: '0.875' },
  { brandColor: '#F97316', elevation: 80, borderWidth: '2px' },
  { brandColor: '#06B6D4', headingFont: 'space-grotesk', bodyFont: 'source-serif-4' },
  { brandColor: '#4338CA', buttonStyle: 'outline' },
  {
    brandColor: '#A16207',
    overrides: { guided: { color: { primary: '#123456' } } },
  },
  {
    brandColor: '#16A34A',
    overrides: { direct: { shape: { radius: '0.25rem' } } },
  },
  {
    brandColor: '#9333EA',
    overrides: { raw: { color: { background: { light: '#fefefe' } } } },
  },
  { brandColor: '#DC2626', schemaVersion: 1 },
];

describe('proof 3 — determinism', () => {
  it('two calls on the same input produce byte-identical serialised output (in-process)', () => {
    for (const input of FIXED_INPUTS) {
      const a = toShadcnCss(generateTheme(input).tokens);
      const b = toShadcnCss(generateTheme(input).tokens);
      expect(a).toBe(b);
    }
  });

  it('two calls on the same input produce deeply-equal token trees', () => {
    for (const input of FIXED_INPUTS) {
      expect(generateTheme(input).tokens).toEqual(generateTheme(input).tokens);
    }
  });

  it('does not mutate the input object, including nested overrides', () => {
    for (const input of FIXED_INPUTS) {
      const before = structuredClone(input);
      generateTheme(input);
      expect(input).toEqual(before);
    }
  });

  it(
    'serialises the same ~20 fixed inputs to a snapshot committed to the repo (cross-process)',
    () => {
      const serialized = FIXED_INPUTS.map(
        (input, i) => `--- input ${i}: ${JSON.stringify(input)} ---\n${toShadcnCss(generateTheme(input).tokens)}`,
      ).join('\n\n');
      expect(serialized).toMatchSnapshot();
    },
  );
});
