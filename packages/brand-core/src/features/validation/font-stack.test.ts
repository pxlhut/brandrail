import { describe, expect, it } from 'vitest';

import { FONT_STACKS } from '../../shared/fields/index.js';
import { validateFontStack } from './font-stack.js';

describe('validateFontStack', () => {
  it('accepts every curated stack, exactly', () => {
    for (const stack of Object.values(FONT_STACKS)) {
      const result = validateFontStack(stack);
      expect(result.ok).toBe(true);
      expect(result.ok && result.normalized).toBe(stack);
    }
  });

  it('rejects a real, curated font named bare rather than as its exact stack', () => {
    // §35: enum membership, not string inspection. "Inter" names a font this
    // platform genuinely curates, but it is not the stored token value.
    const result = validateFontStack('Inter');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/curated font stacks/);
  });

  it('rejects an unlisted font, even one that sounds plausible', () => {
    expect(validateFontStack("'Comic Sans MS', cursive").ok).toBe(false);
  });

  it('rejects a curated stack with any deviation', () => {
    const stack = FONT_STACKS['inter'] as string;
    expect(validateFontStack(`${stack} `).ok).toBe(false);
    expect(validateFontStack(stack.toUpperCase()).ok).toBe(false);
  });
});
