import { describe, expect, it } from 'vitest';

import { declaration, resolveMode, wrapDarkRule } from './shared.js';

describe('resolveMode', () => {
  it('returns a plain string for both modes', () => {
    expect(resolveMode('0.5rem', 'light')).toBe('0.5rem');
    expect(resolveMode('0.5rem', 'dark')).toBe('0.5rem');
  });

  it('picks the named mode out of a light/dark pair', () => {
    const pair = { light: '#fff', dark: '#000' };
    expect(resolveMode(pair, 'light')).toBe('#fff');
    expect(resolveMode(pair, 'dark')).toBe('#000');
  });
});

describe('declaration', () => {
  it('formats a custom property, no surrounding whitespace', () => {
    expect(declaration('background', 'oklch(0.99 0 0)')).toBe('--background:oklch(0.99 0 0);');
  });

  it('escapes the value — every value on the way out, no exceptions (§19)', () => {
    expect(declaration('x', '</style>')).toBe('--x:&lt;/style>;');
  });
});

describe('wrapDarkRule', () => {
  it('attribute (default): matches guideline §3\'s worked example', () => {
    expect(wrapDarkRule(':root', 'attribute', '--x:1;')).toBe(':root[data-theme="dark"]{--x:1;}');
  });

  it('class: appends .dark to the selector', () => {
    expect(wrapDarkRule(':root', 'class', '--x:1;')).toBe(':root.dark{--x:1;}');
  });

  it('media: wraps the selector in a prefers-color-scheme query', () => {
    expect(wrapDarkRule(':root', 'media', '--x:1;')).toBe(
      '@media (prefers-color-scheme:dark){:root{--x:1;}}',
    );
  });

  it('honours a custom selector, for the §5 preview container', () => {
    expect(wrapDarkRule('[data-site-theme]', 'attribute', '--x:1;')).toBe(
      '[data-site-theme][data-theme="dark"]{--x:1;}',
    );
  });
});
