import { describe, expect, it } from 'vitest';

import { fullTree } from './fixture.js';
import { toTailwindTheme } from './tailwind.js';

describe('toTailwindTheme — v4 (default)', () => {
  it('emits an @theme inline bridge mapping every role to var(--role)', () => {
    const css = toTailwindTheme(fullTree());
    expect(css).toContain('@theme inline{');
    expect(css).toContain('--color-primary:var(--primary);');
    expect(css).toContain('--color-sidebar-ring:var(--sidebar-ring);');
    expect(css).toContain('--radius:var(--radius);');
  });

  it('also emits the raw :root/dark value blocks', () => {
    const css = toTailwindTheme(fullTree());
    expect(css).toContain(':root{');
    expect(css).toContain(':root[data-theme="dark"]{');
    expect(css).toContain('--primary:oklch(');
  });

  it('escapes a hostile value', () => {
    const tree = fullTree();
    tree.color.foreground = '</style>';
    expect(toTailwindTheme(tree)).toContain('&lt;/style>');
  });
});

describe('toTailwindTheme — v3 (legacy)', () => {
  it('emits a tailwind.config.js fragment', () => {
    const config = toTailwindTheme(fullTree(), { version: 3 });
    expect(config).toContain('module.exports');
    expect(config).toContain("'sidebar-primary-foreground': 'var(--sidebar-primary-foreground)'");
    expect(config).toContain("borderRadius: { DEFAULT: 'var(--radius)' }");
  });

  it('does not depend on the tree\'s actual values — same output for any tree', () => {
    const a = toTailwindTheme(fullTree(), { version: 3 });
    const other = fullTree();
    other.color.background = '#000000';
    const b = toTailwindTheme(other, { version: 3 });
    expect(a).toBe(b);
  });
});
