import { describe, expect, it } from 'vitest';

import { FONT_OPTIONS } from '../../shared/fields/index.js';
import {
  buildTypography,
  CURATED_FONT_IDS,
  DEFAULT_BODY_FONT,
  DEFAULT_HEADING_FONT,
  FONT_STACKS,
  stackFor,
} from './stacks.js';

describe('font stacks (§35)', () => {
  it('has a stack for every curated option the registry offers', () => {
    // This is the assertion that keeps §35 honest. Adding a font to the picker
    // without a stack here would put a family name in the CSS that nothing
    // loads, and it would fail *silently* to a system font — exactly the
    // failure mode the curated-list rule exists to prevent.
    for (const option of FONT_OPTIONS) {
      expect(FONT_STACKS[option.value], `no stack for "${option.value}"`).toBeDefined();
    }
  });

  it('has no stack that the registry does not offer', () => {
    // The reverse direction: a stack with no picker entry is dead code that
    // reads as a supported option.
    expect(Object.keys(FONT_STACKS).sort()).toEqual([...CURATED_FONT_IDS].sort());
  });

  it('emits a full fallback stack, never a bare family name', () => {
    for (const [id, stack] of Object.entries(FONT_STACKS)) {
      expect(stack.split(',').length, `"${id}" has no fallbacks`).toBeGreaterThan(1);
      expect(stack).toMatch(/(sans-serif|serif|monospace)$/);
    }
  });

  it('quotes family names that contain spaces', () => {
    for (const stack of Object.values(FONT_STACKS)) {
      const first = stack.split(',')[0] as string;
      if (first.trim().includes(' ')) expect(first.trim()).toMatch(/^'.*'$/);
    }
  });
});

describe('stackFor', () => {
  it('resolves a curated id', () => {
    expect(stackFor('inter')).toContain('Inter');
  });

  it('throws on an unknown id rather than falling back', () => {
    // Falling back here reproduces §35's failure one layer up: the theme would
    // render in a system font and nothing would report that the owner's choice
    // was discarded.
    expect(() => stackFor('comic-sans')).toThrow(/curated list/);
    expect(() => stackFor('comic-sans')).toThrow(/inter/);
  });
});

describe('buildTypography', () => {
  it('resolves both roles to stacks', () => {
    const typography = buildTypography({ headingFont: 'space-grotesk', bodyFont: 'inter' });
    expect(typography.headingFont).toBe(FONT_STACKS['space-grotesk']);
    expect(typography.bodyFont).toBe(FONT_STACKS['inter']);
  });

  it('defaults both roles when nothing is chosen', () => {
    const typography = buildTypography();
    expect(typography.headingFont).toBe(FONT_STACKS[DEFAULT_HEADING_FONT]);
    expect(typography.bodyFont).toBe(FONT_STACKS[DEFAULT_BODY_FONT]);
  });

  it('lets heading and body differ', () => {
    const typography = buildTypography({
      headingFont: 'space-grotesk',
      bodyFont: 'source-serif-4',
    });
    expect(typography.headingFont).not.toBe(typography.bodyFont);
  });
});
