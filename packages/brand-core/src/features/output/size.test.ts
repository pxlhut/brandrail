import { describe, expect, it } from 'vitest';

import { fullTree } from './fixture.js';
import { toShadcnCss } from './shadcn.js';

describe('toShadcnCss output size', () => {
  it('is under ~4 KB unminified for a typical tree — it gets inlined into every page', () => {
    const css = toShadcnCss(fullTree());
    // `.length` rather than a UTF-8 byte count: every character this
    // serializer ever emits is ASCII (oklch triplets, lengths, curated font
    // stacks, escaped markup), so the two counts are identical here.
    expect(css.length).toBeLessThan(4096);
  });
});
