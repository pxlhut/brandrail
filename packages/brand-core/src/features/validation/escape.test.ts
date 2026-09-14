import { describe, expect, it } from 'vitest';

import { escapeForHtml } from './escape.js';

describe('escapeForHtml', () => {
  it('escapes the exact bytes that break out of a <style> block', () => {
    expect(escapeForHtml('</style><script>alert(1)</script>')).toBe(
      '&lt;/style>&lt;script>alert(1)&lt;/script>',
    );
  });

  it('escapes & and < only, leaving other characters untouched', () => {
    expect(escapeForHtml('a & b < c > d')).toBe('a &amp; b &lt; c > d');
  });

  it('does not double-escape the & introduced by escaping <', () => {
    expect(escapeForHtml('<')).toBe('&lt;');
  });

  it('is a no-op on a value with neither character', () => {
    expect(escapeForHtml('oklch(0.5 0.1 30)')).toBe('oklch(0.5 0.1 30)');
  });
});
