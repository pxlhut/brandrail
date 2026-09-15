import { defaultControlConfig, FIELD_IDS } from '@pxlhut/brand-core';
import type { BrandConfig } from '@pxlhut/brand-core';
import { describe, expect, it, vi } from 'vitest';

import { buildFieldStates, FIELD_STATE_ORDER } from './index.js';

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

describe('buildFieldStates', () => {
  it('renders state for every §33 field', () => {
    const draft = fixtureDraft();
    const states = buildFieldStates({
      controlConfig: draft.controlConfig,
      draft,
      errors: {},
      dirty: new Set(),
      onChange: () => {},
    });

    expect(FIELD_STATE_ORDER).toHaveLength(FIELD_IDS.length);
    for (const id of FIELD_IDS) {
      expect(states[id].id).toBe(id);
      expect(states[id].control).toEqual(draft.controlConfig[id]);
    }
  });

  it('a locked field is disabled and its setValue is a no-op', () => {
    const draft = fixtureDraft();
    // semanticColors is locked by default (§34).
    expect(draft.controlConfig.semanticColors.tier).toBe('locked');

    const onChange = vi.fn();
    const states = buildFieldStates({
      controlConfig: draft.controlConfig,
      draft,
      errors: {},
      dirty: new Set(),
      onChange,
    });

    expect(states.semanticColors.disabled).toBe(true);
    states.semanticColors.setValue({ destructive: '#ff0000' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('guided select and guided slider are distinguishable controls (§31)', () => {
    const draft = fixtureDraft();
    const states = buildFieldStates({
      controlConfig: draft.controlConfig,
      draft,
      errors: {},
      dirty: new Set(),
      onChange: () => {},
    });

    expect(states.radius.control).toMatchObject({ tier: 'guided', type: 'select' });
    expect(states.elevation.control).toMatchObject({ tier: 'guided', type: 'slider' });
  });

  it('changing controlConfig alone reshapes the returned state — no other code change (acceptance criterion 4)', () => {
    const draft = fixtureDraft();
    const locked = buildFieldStates({
      controlConfig: draft.controlConfig,
      draft,
      errors: {},
      dirty: new Set(),
      onChange: () => {},
    });
    expect(locked.semanticColors.tier).toBe('locked');
    expect(locked.semanticColors.disabled).toBe(true);

    const unlockedConfig = { ...draft.controlConfig, semanticColors: { tier: 'direct' as const, type: 'color' as const } };
    const unlocked = buildFieldStates({
      controlConfig: unlockedConfig,
      draft,
      errors: {},
      dirty: new Set(),
      onChange: () => {},
    });
    expect(unlocked.semanticColors.tier).toBe('direct');
    expect(unlocked.semanticColors.disabled).toBe(false);
  });

  it('surfaces a per-field error and dirty flag', () => {
    const draft = fixtureDraft();
    const states = buildFieldStates({
      controlConfig: draft.controlConfig,
      draft,
      errors: { brandColor: 'not a valid colour' },
      dirty: new Set(['brandColor']),
      onChange: () => {},
    });

    expect(states.brandColor.error).toBe('not a valid colour');
    expect(states.brandColor.dirty).toBe(true);
    expect(states.companyName.error).toBeNull();
    expect(states.companyName.dirty).toBe(false);
  });

  it('reads semanticColors and advancedTokens out of the same rawOverrides bag without double-counting', () => {
    const draft = fixtureDraft({
      controlConfig: { ...defaultControlConfig(), semanticColors: { tier: 'direct', type: 'color' } },
      rawOverrides: { 'color.destructive': '#ff0000', 'shape.radius': '0.5rem' },
    });
    const states = buildFieldStates({
      controlConfig: draft.controlConfig,
      draft,
      errors: {},
      dirty: new Set(),
      onChange: () => {},
    });

    expect(states.semanticColors.value).toEqual({ destructive: '#ff0000' });
    expect(states.advancedTokens.value).toEqual({ 'shape.radius': '0.5rem' });
  });

  it('reads the logo variant pair from passthrough', () => {
    const draft = fixtureDraft({ passthrough: { logoLight: 'https://cdn/light.svg', logoDark: 'https://cdn/dark.svg' } });
    const states = buildFieldStates({
      controlConfig: draft.controlConfig,
      draft,
      errors: {},
      dirty: new Set(),
      onChange: () => {},
    });

    expect(states.logo.value).toEqual({ light: 'https://cdn/light.svg', dark: 'https://cdn/dark.svg' });
  });
});
