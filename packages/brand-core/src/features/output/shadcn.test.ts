import { describe, expect, it } from 'vitest';

import { fullTree } from './fixture.js';
import { SHADCN_PINNED_VARS } from './roles.js';
import { toShadcnCss } from './shadcn.js';

describe('toShadcnCss', () => {
  it('emits every pinned shadcn variable name', () => {
    const css = toShadcnCss(fullTree());
    for (const name of SHADCN_PINNED_VARS) {
      expect(css, `missing ${name}`).toContain(`${name}:`);
    }
  });

  it('emits both a light and a dark block, in one string', () => {
    const css = toShadcnCss(fullTree());
    expect(css).toContain(':root{');
    expect(css).toContain(':root[data-theme="dark"]{');
  });

  it('serialises the same tree byte-identically across calls', () => {
    const tree = fullTree();
    expect(toShadcnCss(tree)).toBe(toShadcnCss(tree));
    // Not just reference-equal: a fresh, independently-built tree with the
    // same content must produce the same bytes too.
    expect(toShadcnCss(fullTree())).toBe(toShadcnCss(fullTree()));
  });

  it('escapes < and & in a value, with the exact output bytes', () => {
    const tree = fullTree();
    tree.color.background = '</style><script>alert(1)</script>';
    const css = toShadcnCss(tree);
    expect(css).toContain('--background:&lt;/style>&lt;script>alert(1)&lt;/script>;');
    expect(css).not.toContain('<script>');
  });

  it('honours a custom selector, for the §5 preview container', () => {
    const css = toShadcnCss(fullTree(), { selector: '[data-site-theme]' });
    expect(css).toContain('[data-site-theme]{');
    expect(css).toContain('[data-site-theme][data-theme="dark"]{');
  });

  it('supports every dark-mode strategy', () => {
    expect(toShadcnCss(fullTree(), { darkMode: 'class' })).toContain(':root.dark{');
    expect(toShadcnCss(fullTree(), { darkMode: 'media' })).toContain(
      '@media (prefers-color-scheme:dark){:root{',
    );
  });

  it('emits success/warning/info alongside the pinned set, not in place of it', () => {
    const css = toShadcnCss(fullTree());
    expect(css).toContain('--success:');
    expect(css).toContain('--warning-foreground:');
    expect(css).toContain('--info:');
  });

  it('emits shape and typography, and the button-style variant (§32)', () => {
    const css = toShadcnCss(fullTree(), { buttonStyle: 'outline' });
    expect(css).toContain('--radius:0.5rem;');
    expect(css).toContain('--border-width:1px;');
    expect(css).toContain('--density-scale:1;');
    expect(css).toContain('--font-heading:');
    expect(css).toContain('--button-style:outline;');
  });

  it('does not repeat shape/typography in the dark block', () => {
    const css = toShadcnCss(fullTree());
    const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'));
    expect(darkBlock).not.toContain('--radius:');
    expect(darkBlock).not.toContain('--font-heading:');
  });

  it('minify strips the separating newline', () => {
    const minified = toShadcnCss(fullTree(), { minify: true });
    expect(minified).not.toContain('\n');
  });

  describe('fontStrategy', () => {
    it('"none" adds no font-loading directive', () => {
      expect(toShadcnCss(fullTree())).not.toContain('@font-face');
      expect(toShadcnCss(fullTree())).not.toContain('fonts:');
    });

    it('"fontsource" documents the package to install', () => {
      const css = toShadcnCss(fullTree(), { fontStrategy: 'fontsource' });
      expect(css).toContain('/* fonts: npm install @fontsource/inter */');
    });

    it('"inline-face" emits a real @font-face before the :root rule', () => {
      const css = toShadcnCss(fullTree(), { fontStrategy: 'inline-face' });
      expect(css.indexOf('@font-face')).toBeGreaterThanOrEqual(0);
      expect(css.indexOf('@font-face')).toBeLessThan(css.indexOf(':root{'));
    });

    it('minify drops the font-loading comment even if requested', () => {
      const css = toShadcnCss(fullTree(), { fontStrategy: 'fontsource', minify: true });
      expect(css).not.toContain('fonts:');
    });
  });
});
