import { generateTheme, toShadcnCss } from '@pxlhut/brand-core';
import { describe, expect, it } from 'vitest';

import { hashCssText, hashTokens } from './hash.js';

describe('hashTokens', () => {
  it('is deterministic for the same tokens', () => {
    const { tokens } = generateTheme({ brandColor: '#7C6CFF' });
    expect(hashTokens(tokens)).toBe(hashTokens(tokens));
  });

  it('differs for different tokens', () => {
    const a = generateTheme({ brandColor: '#7C6CFF' }).tokens;
    const b = generateTheme({ brandColor: '#00FF88' }).tokens;
    expect(hashTokens(a)).not.toBe(hashTokens(b));
  });

  it('is a 64-character hex string (sha256)', () => {
    const { tokens } = generateTheme({ brandColor: '#7C6CFF' });
    expect(hashTokens(tokens)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hashCssText', () => {
  it('is deterministic and base64-encoded, ready for a CSP header', () => {
    const { tokens } = generateTheme({ brandColor: '#7C6CFF' });
    const cssText = toShadcnCss(tokens);
    const hash = hashCssText(cssText);
    expect(hash).toBe(hashCssText(cssText));
    expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('differs for different css text, including a single-byte change', () => {
    expect(hashCssText(':root{--a:1;}')).not.toBe(hashCssText(':root{--a:2;}'));
  });
});
