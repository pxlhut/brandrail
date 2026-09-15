// @vitest-environment jsdom
/**
 * Proof 4b — purity is structural, browser half (step 09).
 *
 * The grep in `proof-4-purity-source.test.ts` is a proxy. This is the actual
 * claim guideline §3 makes — "runs in a browser for live preview" — checked
 * directly: import the *built* bundle (not the TypeScript source) into a
 * jsdom environment and generate a theme successfully.
 *
 * Imports `../dist/index.js` deliberately. This only works once `pnpm build`
 * has run — `pnpm verify` and CI both build before test for exactly this
 * reason (see `.github/workflows/ci.yml`).
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST_ENTRY = join(HERE, '../dist/index.js');

describe('proof 4b — runs in a browser', () => {
  it('the built bundle exists (run `pnpm build` first)', () => {
    expect(existsSync(DIST_ENTRY)).toBe(true);
  });

  it('imports and generates a theme successfully in a jsdom environment', async () => {
    // `window`/`document` are what a browser has and Node does not — proof
    // this is actually running in the jsdom environment, not merely
    // configured to.
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');

    const { generateTheme, toShadcnCss } = await import(/* @vite-ignore */ DIST_ENTRY);
    const result = generateTheme({ brandColor: '#7C6CFF' });
    expect(result.violations).toEqual([]);
    expect(toShadcnCss(result.tokens)).toContain('--primary:');
  });
});
