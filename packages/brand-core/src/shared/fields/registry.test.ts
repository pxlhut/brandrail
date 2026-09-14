import { describe, expect, it } from 'vitest';

import {
  applyProfile,
  defaultControlConfig,
  FIELD_IDS,
  FIELD_REGISTRY,
  FONT_OPTIONS,
  PASSTHROUGH_FIELD_IDS,
} from './registry.js';
import type { ControlConfig, FieldConfigFor, FieldId } from '../types/index.js';

describe('field registry', () => {
  it('carries every field from guideline §33', () => {
    // Thirteen table rows in the document, fourteen fields — headingFont and
    // bodyFont share a row there.
    expect(FIELD_IDS).toHaveLength(14);
    expect([...FIELD_IDS].sort()).toEqual(
      [
        'advancedTokens',
        'bodyFont',
        'brandColor',
        'buttonStyle',
        'companyName',
        'density',
        'elevation',
        'emailSenderName',
        'headingFont',
        'logo',
        'neutralTone',
        'radius',
        'semanticColors',
        'supportUrl',
      ].sort(),
    );
  });

  it('matches §33 default tiers exactly', () => {
    const tiers = Object.fromEntries(
      FIELD_IDS.map((id) => [id, FIELD_REGISTRY[id].default.tier]),
    );
    expect(tiers).toEqual({
      companyName: 'direct',
      logo: 'direct',
      brandColor: 'direct',
      semanticColors: 'locked',
      headingFont: 'guided',
      bodyFont: 'guided',
      radius: 'guided',
      density: 'guided',
      neutralTone: 'guided',
      buttonStyle: 'guided',
      elevation: 'guided',
      advancedTokens: 'raw',
      supportUrl: 'direct',
      emailSenderName: 'direct',
    });
  });

  it('locks semantic colours by default (§34)', () => {
    // An owner repainting "error" away from red breaks a learned signal, and
    // that failure is the platform's fault, not theirs.
    expect(FIELD_REGISTRY.semanticColors.default.tier).toBe('locked');
  });

  it('gives the logo light and dark variants from the start (§36)', () => {
    // Retrofitting a second logo slot later means re-touching every stored config.
    const logo = FIELD_REGISTRY.logo.default;
    expect(logo.tier).toBe('direct');
    expect(logo.tier === 'direct' && logo.variants).toEqual(['light', 'dark']);
  });

  it('marks exactly the four non-token fields as passthrough (§36)', () => {
    expect([...PASSTHROUGH_FIELD_IDS].sort()).toEqual([
      'companyName',
      'emailSenderName',
      'logo',
      'supportUrl',
    ]);
  });

  it('offers fonts only as a curated list (§35)', () => {
    for (const id of ['headingFont', 'bodyFont'] as const) {
      const cfg = FIELD_REGISTRY[id].default;
      expect(cfg.tier).toBe('guided');
      expect(cfg.tier === 'guided' && cfg.type).toBe('select');
      expect(cfg.tier === 'guided' && cfg.type === 'select' && cfg.options).toBe(FONT_OPTIONS);
    }
  });

  it('gives every select option a label and a value, never a bare string (§31)', () => {
    for (const id of FIELD_IDS) {
      const cfg = FIELD_REGISTRY[id].default;
      if (cfg.tier !== 'guided' || cfg.type !== 'select') continue;
      for (const opt of cfg.options) {
        expect(typeof opt.label).toBe('string');
        expect(typeof opt.value).toBe('string');
        expect(opt.label.length).toBeGreaterThan(0);
        expect(opt.value.length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves radius options to real CSS lengths (§32)', () => {
    const radius = FIELD_REGISTRY.radius.default;
    const values =
      radius.tier === 'guided' && radius.type === 'select'
        ? radius.options.map((o) => o.value)
        : [];
    expect(values).toEqual(['0.125rem', '0.5rem', '1rem']);
  });
});

describe('defaultControlConfig', () => {
  it('leaves no field without a tier', () => {
    // §9 needs a definite answer for every incoming write. An unset field is
    // an open question at the write boundary.
    const config = defaultControlConfig();
    for (const id of FIELD_IDS) expect(config[id]).toBeDefined();
  });
});

describe('applyProfile', () => {
  it('overrides only what the profile names', () => {
    // The agency profile from §33: same table, one tier flipped.
    const agency = applyProfile({ semanticColors: { tier: 'direct', type: 'color' } });
    expect(agency.semanticColors).toEqual({ tier: 'direct', type: 'color' });
    expect(agency.radius).toEqual(FIELD_REGISTRY.radius.default);
  });

  it('produces a copy, not a live view of the profile (§17)', () => {
    // Provisioning copies once; the two are independent afterwards. Editing a
    // profile later must not propagate to sites already created from it.
    const profile = { brandColor: { tier: 'locked' as const, value: '#7C6CFF' } };
    const config = applyProfile(profile);
    profile.brandColor.value = '#000000';
    expect((config.brandColor as { value?: string }).value).toBe('#7C6CFF');
  });

  it('does not mutate the defaults between calls', () => {
    applyProfile({ radius: { tier: 'locked', value: '0rem' } });
    expect(defaultControlConfig().radius).toEqual(FIELD_REGISTRY.radius.default);
  });
});

/**
 * Compile-time assertions. These do no work at runtime — `@ts-expect-error`
 * fails `tsc` if the line it precedes *stops* being an error, so each one is a
 * live assertion that a guideline constraint is still enforced by the types.
 */
describe('type-level constraints', () => {
  it('enforces §35, §34 and §31 at compile time', () => {
    // §35 — fonts are a curated select at every tier. Not direct...
    // @ts-expect-error headingFont must never accept a free-text direct value
    const _a: FieldConfigFor<'headingFont'> = { tier: 'direct', type: 'text' };

    // ...and not raw either, even for an agency profile.
    // @ts-expect-error bodyFont must never accept raw
    const _b: FieldConfigFor<'bodyFont'> = { tier: 'raw' };

    // §31 — select options are { label, value } pairs, never bare strings.
    // prettier-ignore
    // @ts-expect-error a string[] is not a SelectOption[]
    const _c: FieldConfigFor<'radius'> = { tier: 'guided', type: 'select', options: ['Sharp', 'Soft'] };

    // §34 — there is no meaningful slider or select for "what colour is an error".
    // @ts-expect-error semanticColors is never guided
    const _d: FieldConfigFor<'semanticColors'> = { tier: 'guided', type: 'slider', min: 0, max: 1 };

    // Identity fields are not tokens and are never guided (§36).
    // prettier-ignore
    // @ts-expect-error companyName is never guided
    const _e: FieldConfigFor<'companyName'> = { tier: 'guided', type: 'select', options: [] };

    // A config missing a field is not a ControlConfig — §9 needs every answer.
    // @ts-expect-error incomplete control config
    const _f: ControlConfig = { brandColor: { tier: 'direct', type: 'color' } };

    // Positive controls: these must all compile.
    const ok1: FieldConfigFor<'headingFont'> = { tier: 'locked', value: 'inter' };
    const ok2: FieldConfigFor<'semanticColors'> = { tier: 'raw' };
    const ok3: FieldConfigFor<'radius'> = { tier: 'direct', type: 'length' };
    const ok4: FieldConfigFor<'elevation'> = { tier: 'guided', type: 'slider', min: 0, max: 100 };
    const ok5: FieldId = 'advancedTokens';

    expect([_a, _b, _c, _d, _e, _f, ok1, ok2, ok3, ok4, ok5]).toHaveLength(11);
  });
});
