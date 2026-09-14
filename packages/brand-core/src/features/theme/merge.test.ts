import { describe, expect, it } from 'vitest';

import type { TokenTree } from '../../shared/types/index.js';
import { mergeLayer, mergeLayers, mergeTokenValue } from './merge.js';

function tree(overrides: Partial<TokenTree> = {}): TokenTree {
  return {
    color: { primary: 'oklch(0.52 0.2 280)' } as TokenTree['color'],
    chart: {} as TokenTree['chart'],
    shape: {
      radius: '0.5rem',
      borderWidth: '1px',
      densityScale: '1',
      shadowStrength: '0.096',
    },
    typography: { headingFont: 'Inter', bodyFont: 'Inter' },
    meta: { sourceBrandColor: 'oklch(0.62 0.21 283)', schemaVersion: 1 },
    ...overrides,
  };
}

describe('mergeTokenValue', () => {
  it('keeps the base when there is no override', () => {
    expect(mergeTokenValue('a', undefined)).toBe('a');
    expect(mergeTokenValue({ light: 'a', dark: 'b' }, undefined)).toEqual({
      light: 'a',
      dark: 'b',
    });
  });

  it('lets a plain string replace outright', () => {
    expect(mergeTokenValue({ light: 'a', dark: 'b' }, 'c')).toBe('c');
  });

  it('merges per mode, so a light-only override leaves dark alone', () => {
    // The bug this exists to prevent: a light-mode tweak silently blanking dark
    // mode, which the owner finds out about from a customer.
    expect(mergeTokenValue({ light: 'a', dark: 'b' }, { light: 'c' })).toEqual({
      light: 'c',
      dark: 'b',
    });
    expect(mergeTokenValue({ light: 'a', dark: 'b' }, { dark: 'c' })).toEqual({
      light: 'a',
      dark: 'c',
    });
  });

  it('expands a string base into both modes before overriding one', () => {
    expect(mergeTokenValue('a', { light: 'c' })).toEqual({ light: 'c', dark: 'a' });
  });

  it('collapses back to a string when both modes end up equal', () => {
    expect(mergeTokenValue({ light: 'a', dark: 'b' }, { light: 'b' })).toBe('b');
  });

  it('ignores an empty override object', () => {
    expect(mergeTokenValue({ light: 'a', dark: 'b' }, {})).toEqual({ light: 'a', dark: 'b' });
  });
});

describe('mergeLayer', () => {
  it('returns the base untouched when the layer is absent', () => {
    const base = tree();
    expect(mergeLayer(base, undefined)).toBe(base);
  });

  it('does not mutate the base', () => {
    const base = tree();
    const snapshot = JSON.parse(JSON.stringify(base)) as TokenTree;
    mergeLayer(base, { shape: { radius: '1rem' } });
    expect(base).toEqual(snapshot);
  });

  it('never lets a layer rewrite meta', () => {
    // meta records what the tree was generated *from*. An override layer that
    // could rewrite it would make sourceBrandColor a lie.
    const merged = mergeLayer(tree(), { shape: { radius: '1rem' } });
    expect(merged.meta).toEqual(tree().meta);
  });

  it('leaves untouched branches alone', () => {
    const merged = mergeLayer(tree(), { shape: { radius: '1rem' } });
    expect(merged.typography).toEqual(tree().typography);
    expect(merged.shape.borderWidth).toBe('1px');
  });
});

describe('mergeLayers precedence (§18)', () => {
  it('applies base < guided < direct < raw', () => {
    const merged = mergeLayers(tree(), {
      guided: { shape: { radius: 'guided' } },
      direct: { shape: { radius: 'direct' } },
      raw: { shape: { radius: 'raw' } },
    });
    expect(merged.shape.radius).toBe('raw');
  });

  it('lets direct beat guided when raw is silent', () => {
    const merged = mergeLayers(tree(), {
      guided: { shape: { radius: 'guided' } },
      direct: { shape: { radius: 'direct' } },
    });
    expect(merged.shape.radius).toBe('direct');
  });

  it('lets guided beat the base when nothing above it speaks', () => {
    const merged = mergeLayers(tree(), { guided: { shape: { radius: 'guided' } } });
    expect(merged.shape.radius).toBe('guided');
  });

  it('lets a higher layer override one mode of a lower one', () => {
    const merged = mergeLayers(tree(), {
      guided: { color: { primary: { light: 'g-light', dark: 'g-dark' } } },
      direct: { color: { primary: { light: 'd-light' } } },
    });
    expect(merged.color.primary).toEqual({ light: 'd-light', dark: 'g-dark' });
  });

  it('is a no-op with no layers at all', () => {
    const base = tree();
    expect(mergeLayers(base, {})).toBe(base);
  });
});
