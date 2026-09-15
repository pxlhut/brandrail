import { renderHook } from '@testing-library/react';
import { defaultControlConfig } from '@pxlhut/brand-core';
import type { BrandConfig } from '@pxlhut/brand-core';
import { describe, expect, it } from 'vitest';

import { usePreview } from './index.js';

function fixtureDraft(overrides: Partial<BrandConfig> = {}): BrandConfig {
  return {
    siteId: 'site-1',
    brandColor: '#7c6cff',
    controlConfig: defaultControlConfig(),
    fieldValues: {},
    rawOverrides: {},
    passthrough: {},
    schemaVersion: 1,
    version: 1,
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe('usePreview', () => {
  it('generates tokens and scoped CSS directly from the draft, with no violations on the unmodified base', () => {
    const draft = fixtureDraft();
    const { result } = renderHook(() => usePreview({ draft, controlConfig: draft.controlConfig }));

    expect(result.current.violations).toEqual([]);
    expect(result.current.tokens.color.primary).toBeDefined();
    expect(result.current.css).toContain('[data-site-theme]');
  });

  it('updates within the same render when the draft changes — no effect, no round-trip', () => {
    const draftA = fixtureDraft({ brandColor: '#7c6cff' });
    const { result, rerender } = renderHook(({ draft }) => usePreview({ draft, controlConfig: draft.controlConfig }), {
      initialProps: { draft: draftA },
    });
    const first = result.current.tokens.color.primary;

    const draftB = fixtureDraft({ brandColor: '#00aa55' });
    rerender({ draft: draftB });

    expect(result.current.tokens.color.primary).not.toEqual(first);
  });

  it('surfaces a raw-override contrast violation and attributes it to advancedTokens', () => {
    const draft = fixtureDraft({
      rawOverrides: { 'color.primary': '#808080', 'color.primary-foreground': '#888888' },
    });
    const { result } = renderHook(() => usePreview({ draft, controlConfig: draft.controlConfig }));

    expect(result.current.violations.length).toBeGreaterThan(0);
    const violation = result.current.violations[0]!;
    expect(result.current.fieldForViolation(violation)).toBe('advancedTokens');
  });

  it('attributes a semantic-role violation to semanticColors when that field is unlocked', () => {
    const draft = fixtureDraft({
      controlConfig: { ...defaultControlConfig(), semanticColors: { tier: 'direct', type: 'color' } },
      rawOverrides: { 'color.destructive': '#808080', 'color.destructive-foreground': '#888888' },
    });
    const { result } = renderHook(() => usePreview({ draft, controlConfig: draft.controlConfig }));

    expect(result.current.violations.length).toBeGreaterThan(0);
    const violation = result.current.violations.find((v) => v.fg === 'destructive-foreground')!;
    expect(result.current.fieldForViolation(violation)).toBe('semanticColors');
  });

  it('attributes a semantic-role violation to advancedTokens when semanticColors is locked', () => {
    const draft = fixtureDraft({
      rawOverrides: { 'color.destructive': '#808080', 'color.destructive-foreground': '#888888' },
    });
    expect(draft.controlConfig.semanticColors.tier).toBe('locked');
    const { result } = renderHook(() => usePreview({ draft, controlConfig: draft.controlConfig }));

    const violation = result.current.violations.find((v) => v.fg === 'destructive-foreground')!;
    expect(result.current.fieldForViolation(violation)).toBe('advancedTokens');
  });
});
