import { describe, expect, it } from 'vitest';

import { toCssVars } from './css-vars.js';
import { fullTree } from './fixture.js';

describe('toCssVars', () => {
  it('emits raw custom properties with no prefix by default', () => {
    const css = toCssVars(fullTree());
    expect(css).toContain('--background:');
    expect(css).toContain('--radius:0.5rem;');
  });

  it('prefixes every property when asked', () => {
    const css = toCssVars(fullTree(), { prefix: 'tw-' });
    expect(css).toContain('--tw-background:');
    expect(css).toContain('--tw-radius:');
    expect(css).not.toContain('--background:');
  });

  it('emits both light and dark blocks', () => {
    const css = toCssVars(fullTree());
    expect(css).toContain(':root{');
    expect(css).toContain(':root[data-theme="dark"]{');
  });

  it('escapes a hostile value', () => {
    const tree = fullTree();
    tree.color.foreground = '</style>';
    expect(toCssVars(tree)).toContain('&lt;/style>');
  });

  it('makes no assumption about which shadcn variables exist — no button-style, no font strategy', () => {
    const css = toCssVars(fullTree());
    expect(css).not.toContain('button-style');
  });
});
