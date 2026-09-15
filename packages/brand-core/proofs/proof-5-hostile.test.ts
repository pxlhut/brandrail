/**
 * Proof 5 — the hostile corpus, through the full pipeline (step 09, §19).
 *
 * Step 07's unit tests prove `validateTokenValue` rejects every entry in the
 * hostile corpus. That is necessary but not sufficient: `generateTheme` and
 * `mergeLayers` don't call the validator at all (validation happens at the
 * service layer, step 13, before core ever sees the value) — so this proves
 * the *other* half, that nothing bypasses it: even if a hostile value did
 * reach the token tree, the serializer's escaping is the backstop that keeps
 * it from becoming exploitable HTML. Every serializer, every hostile value,
 * assert the one thing that must always be true of `css_text`: no bare `<`.
 */

import { describe, expect, it } from 'vitest';

import { HOSTILE_VALUES } from '../fixtures/hostile-values.js';
import { generateTheme, toCssVars, toShadcnCss, toTailwindTheme } from '../src/index.js';
import type { PartialTokenTree } from '../src/index.js';

const BASE_INPUT = { brandColor: '#7C6CFF' } as const;

/** Where a raw override for this hostile case's declared type lands in the tree. */
function overridesFor(value: string, type: 'color' | 'length' | 'number' | 'duration' | 'font-stack'): PartialTokenTree {
  switch (type) {
    case 'color':
      return { color: { primary: value } };
    case 'length':
      return { shape: { radius: value } };
    case 'number':
      return { shape: { densityScale: value } };
    case 'duration':
      return { shape: { shadowStrength: value } };
    case 'font-stack':
      return { typography: { headingFont: value } };
  }
}

describe('proof 5 — hostile corpus through the full pipeline', () => {
  for (const { description, value, type } of HOSTILE_VALUES) {
    it(`${type} — ${description} — no bare '<' survives into any serializer's output`, () => {
      const result = generateTheme({
        ...BASE_INPUT,
        overrides: { raw: overridesFor(value, type) },
      });

      for (const serialize of [
        (t: typeof result.tokens) => toShadcnCss(t),
        (t: typeof result.tokens) => toCssVars(t),
        (t: typeof result.tokens) => toTailwindTheme(t),
        (t: typeof result.tokens) => toTailwindTheme(t, { version: 3 }),
      ]) {
        const css = serialize(result.tokens);
        expect(css, `raw value ${JSON.stringify(value)} produced: ${css}`).not.toContain('<');
      }
    });
  }
});
