import { defaultControlConfig } from '@pxlhut/brand-core';
import type { ControlConfig } from '@pxlhut/brand-core';
import { describe, expect, it } from 'vitest';

import { TierViolationError } from './errors.js';
import { enforceTiers } from './tiers.js';

function configWith(overrides: Partial<ControlConfig>): ControlConfig {
  return { ...defaultControlConfig(), ...overrides };
}

describe('enforceTiers — locked', () => {
  it('rejects a write to a locked field outright', () => {
    const config = configWith({ radius: { tier: 'locked', value: '0.5rem' } });
    expect(() => enforceTiers({ expectedVersion: 0, radius: '2rem' }, config)).toThrow(
      TierViolationError,
    );
  });

  it('rejects a locked semanticColors submission', () => {
    // Default tier (§34) — locked unless an agency profile flips it.
    expect(() =>
      enforceTiers({ expectedVersion: 0, semanticColors: { destructive: '#ff0000' } }),
    ).toThrow(TierViolationError);
  });

  it('rejects a locked advancedTokens submission', () => {
    // Default tier is 'raw' (§33) — locked has to be constructed explicitly
    // to test this branch, e.g. a platform that locks it down per-site.
    const config = configWith({ advancedTokens: { tier: 'locked' } });
    expect(() =>
      enforceTiers({ expectedVersion: 0, advancedTokens: { 'color.primary': '#112233' } }, config),
    ).toThrow(TierViolationError);
  });
});

describe('enforceTiers — guided', () => {
  it('accepts a value from the declared select enum', () => {
    const result = enforceTiers({ expectedVersion: 0, radius: '0.5rem' }); // default tier: guided select
    expect(result.fieldValues.radius).toBe('0.5rem');
  });

  it('rejects a value outside the declared select enum', () => {
    expect(() => enforceTiers({ expectedVersion: 0, radius: '17rem' })).toThrow(TierViolationError);
  });

  it('accepts a value within the declared slider range', () => {
    const result = enforceTiers({ expectedVersion: 0, elevation: '50' }); // default tier: guided slider 0-100
    expect(result.fieldValues.elevation).toBe('50');
  });

  it('rejects a value outside the declared slider range', () => {
    expect(() => enforceTiers({ expectedVersion: 0, elevation: '150' })).toThrow(TierViolationError);
  });

  it('rejects a curated-font field given an uncurated value, even though it looks plausible', () => {
    expect(() => enforceTiers({ expectedVersion: 0, headingFont: 'comic-sans' })).toThrow(
      TierViolationError,
    );
  });
});

describe('enforceTiers — direct', () => {
  const directRadius = configWith({ radius: { tier: 'direct', type: 'length' } });
  const directElevation = configWith({ elevation: { tier: 'direct', type: 'number' } });

  it('accepts and normalises a valid value', () => {
    const result = enforceTiers({ expectedVersion: 0, brandColor: '#fff' });
    expect(result.brandColor).not.toBe('#fff'); // normalised by step 07, never echoed
  });

  it('runs the step 07 validator on a direct-tier length', () => {
    expect(() => enforceTiers({ expectedVersion: 0, radius: 'not-a-length' }, directRadius)).toThrow(
      TierViolationError,
    );
    expect(enforceTiers({ expectedVersion: 0, radius: '2rem' }, directRadius).fieldValues.radius).toBe(
      '2rem',
    );
  });

  it('runs the step 07 validator on a direct-tier number', () => {
    expect(() =>
      enforceTiers({ expectedVersion: 0, elevation: 'not-a-number' }, directElevation),
    ).toThrow(TierViolationError);
  });

  it('accepts a direct-tier semanticColors submission', () => {
    const config = configWith({ semanticColors: { tier: 'direct', type: 'color' } });
    const result = enforceTiers({ expectedVersion: 0, semanticColors: { destructive: '#ff0000' } }, config);
    expect(result.rawOverrides['color.destructive']).toBeDefined();
  });
});

describe('enforceTiers — raw', () => {
  const rawAdvanced = configWith({ advancedTokens: { tier: 'raw' } });
  const rawSemantic = configWith({ semanticColors: { tier: 'raw' } });

  it('still runs the step 07 validator — proven with entries from the hostile corpus (§19)', () => {
    // Mirrors fixtures/hostile-values.ts (step 07) without reaching across
    // the package boundary into brand-core's own fixtures directory.
    const hostile: ReadonlyArray<readonly [string, string]> = [
      ['color.primary', '#fff}'],
      ['color.primary', 'red; background: url(//evil)'],
      ['color.primary', '</style><script>alert(1)</script>'],
      ['shape.radius', 'var(--x); color: red'],
    ];

    for (const [path, value] of hostile) {
      expect(
        () => enforceTiers({ expectedVersion: 0, advancedTokens: { [path]: value } }, rawAdvanced),
        `expected "${value}" at ${path} to be rejected`,
      ).toThrow(TierViolationError);
    }
  });

  it('rejects an unrecognised token path', () => {
    expect(() =>
      enforceTiers({ expectedVersion: 0, advancedTokens: { 'not.a.real.path': '#fff' } }, rawAdvanced),
    ).toThrow(TierViolationError);
  });

  it('accepts and normalises a valid raw advancedTokens value', () => {
    const result = enforceTiers(
      { expectedVersion: 0, advancedTokens: { 'shape.radius': '1rem' } },
      rawAdvanced,
    );
    expect(result.rawOverrides['shape.radius']).toBe('1rem');
  });

  it('runs the validator on a raw-tier semanticColors submission too — raw bypasses the contrast gate, never the syntax gate', () => {
    expect(() =>
      enforceTiers({ expectedVersion: 0, semanticColors: { destructive: 'not-a-colour' } }, rawSemantic),
    ).toThrow(TierViolationError);
  });

  it('font-stack fields are never direct or raw in the first place — enforceScalar cannot even be asked', () => {
    // headingFont/bodyFont's FieldConfigFor only ever allows locked or
    // guided:select (§35) — there is no direct/raw ControlConfig shape to
    // construct here, which is itself the proof: the type system already
    // makes "raw headingFont" impossible to express, before this function
    // ever runs.
    const config = defaultControlConfig();
    expect(config.headingFont.tier).not.toBe('direct');
    expect(config.headingFont.tier).not.toBe('raw');
  });
});

describe('enforceTiers — passthrough and logo', () => {
  it('accepts a passthrough text field without running step 07 (not a token, §36)', () => {
    const result = enforceTiers({ expectedVersion: 0, companyName: '<Acme> & Co' });
    expect(result.passthrough.companyName).toBe('<Acme> & Co');
  });

  it('rejects a locked logo', () => {
    const config = configWith({ logo: { tier: 'locked' } });
    expect(() =>
      enforceTiers({ expectedVersion: 0, logo: { light: 'https://example.com/l.svg' } }, config),
    ).toThrow(TierViolationError);
  });

  it('accepts a direct-tier logo, storing each variant separately', () => {
    const result = enforceTiers({
      expectedVersion: 0,
      logo: { light: 'https://example.com/light.svg', dark: 'https://example.com/dark.svg' },
    });
    expect(result.passthrough.logoLight).toBe('https://example.com/light.svg');
    expect(result.passthrough.logoDark).toBe('https://example.com/dark.svg');
  });
});

describe('enforceTiers — merging multiple fields in one patch', () => {
  it('collects unrelated fields into their respective bags without cross-contamination', () => {
    const result = enforceTiers({
      expectedVersion: 0,
      brandColor: '#7C6CFF',
      radius: '0.5rem',
      companyName: 'Acme',
    });
    expect(result.brandColor).toBeDefined();
    expect(result.fieldValues.radius).toBe('0.5rem');
    expect(result.passthrough.companyName).toBe('Acme');
  });
});
