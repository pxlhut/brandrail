import { createHash } from 'node:crypto';

import { defaultControlConfig } from '@pxlhut/brand-core';
import { describe, expect, it } from 'vitest';

import { MemoryBrandThemeStore } from '../../../memory/index.js';
import { publishTheme, type PublishContext } from '../publishing/index.js';
import { renderThemeStyle } from './index.js';

function makeCtx(store: MemoryBrandThemeStore): PublishContext {
  return { userId: 'user-1', authorize: async () => 'owner', store };
}

describe('renderThemeStyle', () => {
  it('wraps cssText in a <style> block and formats cspSource as a CSP hash-source', () => {
    const { html, cspSource } = renderThemeStyle({
      cssText: '--primary:#7C6CFF;',
      cssSha256: 'AAAA==',
    });

    expect(html).toBe('<style>--primary:#7C6CFF;</style>');
    expect(cspSource).toBe("'sha256-AAAA=='");
  });

  it('the CSP source matches the exact published bytes, independently recomputed — not just echoed back', async () => {
    const store = new MemoryBrandThemeStore();
    await store.saveConfig(
      'site-1',
      {
        brandColor: '#7C6CFF',
        controlConfig: defaultControlConfig(),
        fieldValues: {},
        rawOverrides: {},
        passthrough: {},
        schemaVersion: 1,
      },
      0,
    );
    const result = await publishTheme('site-1', makeCtx(store));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { html, cspSource } = renderThemeStyle(result.snapshot);

    // Exactly the bytes a browser hashes when evaluating a CSP hash-source
    // — the content between the tags, nothing else.
    const inlined = html.slice('<style>'.length, html.length - '</style>'.length);
    const recomputed = `'sha256-${createHash('sha256').update(inlined, 'utf8').digest('base64')}'`;

    expect(cspSource).toBe(recomputed);
    expect(cspSource).toBe(`'sha256-${result.snapshot.cssSha256}'`);
  });

  it('regression: step 07/08 escaping survives the inline path — a hostile raw override cannot break out of the <style> block', async () => {
    const store = new MemoryBrandThemeStore();
    await store.saveConfig(
      'site-2',
      {
        brandColor: '#7C6CFF',
        controlConfig: { ...defaultControlConfig(), advancedTokens: { tier: 'raw' } },
        fieldValues: {},
        rawOverrides: { 'color.background': '</style><script>alert(1)</script>' },
        passthrough: {},
        schemaVersion: 1,
      },
      0,
    );
    const result = await publishTheme('site-2', makeCtx(store));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { html } = renderThemeStyle(result.snapshot);

    expect(html).not.toContain('<script>');
    // The only literal `</style>` left is the block's own real closing tag
    // — the hostile one had its `<` escaped to `&lt;`, so it can no longer
    // read as a tag boundary at all.
    expect(html.match(/<\/style>/g)).toHaveLength(1);
    expect(html).toContain('&lt;/style>&lt;script>alert(1)&lt;/script>');
  });
});
