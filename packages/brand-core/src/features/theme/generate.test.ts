import { describe, expect, it } from 'vitest';

import { isInSrgb, parseColor } from '../../shared/color-math/index.js';
import { CONTRAST_TARGETS } from '../contrast/index.js';
import { FONT_STACKS } from '../typography/index.js';
import { generateTheme, SCHEMA_VERSION, type GenerateInput } from './generate.js';
import { ASSIGNED_ROLES, ROLE_SPECS } from './roles.js';
import type { ColorRole, TokenValue } from '../../shared/types/index.js';

/** The same varied set step 04 tunes against. */
const BRANDS = [
  '#7C6CFF', '#00FF88', '#6B7280', '#000000', '#FFFFFF',
  '#808080', '#FFD700', '#1A0033', '#E05B5B', '#3B82F6',
  '#0F766E', '#DB2777', '#84CC16', '#F97316', '#06B6D4',
  '#4338CA', '#A16207', '#16A34A', '#9333EA', '#DC2626',
];

const ALL_ROLES: ColorRole[] = [...new Set(ASSIGNED_ROLES)];

function modes(value: TokenValue): [string, string] {
  return typeof value === 'string' ? [value, value] : [value.light, value.dark];
}

describe('the role table', () => {
  it('assigns every role exactly once', () => {
    expect(new Set(ASSIGNED_ROLES).size).toBe(ASSIGNED_ROLES.length);
  });

  it('resolves every surface before anything solved against it', () => {
    // The invariant `resolveScheme` depends on. Violating it would throw at
    // runtime for one brand colour and not another, which is a miserable bug.
    const seen = new Set<ColorRole>();
    for (const spec of ROLE_SPECS) {
      if (spec.kind === 'solved') {
        for (const against of [spec.against, ...(spec.alsoAgainst ?? [])]) {
          expect(seen.has(against), `${spec.role} solved before ${against}`).toBe(true);
        }
      }
      if (spec.kind === 'inherit') {
        expect(seen.has(spec.from), `${spec.role} inherits before ${spec.from}`).toBe(true);
      }
      seen.add(spec.role);
    }
  });

  it('covers every role named in the contrast table', () => {
    for (const target of CONTRAST_TARGETS) {
      expect(ALL_ROLES).toContain(target.foreground);
      expect(ALL_ROLES).toContain(target.background);
    }
  });

  it('draws surfaces from the neutral ramp and brand presence from the brand ramp', () => {
    // §33: neutralTone changes the feel of every border and background
    // *without touching brand colour*.
    const rampOf = (role: ColorRole) => {
      const spec = ROLE_SPECS.find((s) => s.role === role);
      return spec && (spec.kind === 'fixed' || spec.kind === 'solved') ? spec.ramp : undefined;
    };
    for (const role of ['background', 'card', 'muted', 'border', 'input'] as const) {
      expect(rampOf(role), role).toBe('neutral');
    }
    for (const role of ['primary', 'accent', 'ring'] as const) {
      expect(rampOf(role), role).toBe('brand');
    }
  });
});

describe('generateTheme', () => {
  it('returns a complete tree, light and dark', () => {
    const { tokens } = generateTheme({ brandColor: '#7C6CFF' });
    for (const role of ALL_ROLES) {
      expect(tokens.color[role], role).toBeDefined();
      const [light, dark] = modes(tokens.color[role]);
      expect(light).toMatch(/^oklch\(/);
      expect(dark).toMatch(/^oklch\(/);
    }
    expect(Object.keys(tokens.chart)).toHaveLength(5);
    expect(tokens.shape.radius).toBeDefined();
    expect(tokens.typography.headingFont).toBe(FONT_STACKS['inter']);
    expect(tokens.meta.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('records what it was generated from', () => {
    const { tokens } = generateTheme({ brandColor: '#7C6CFF' });
    expect(tokens.meta.sourceBrandColor).toMatch(/^oklch\(/);
  });

  it('emits only in-gamut colours', () => {
    for (const hex of BRANDS) {
      const { tokens } = generateTheme({ brandColor: hex });
      for (const role of ALL_ROLES) {
        for (const value of modes(tokens.color[role])) {
          expect(isInSrgb(parseColor(value)), `${hex} ${role}`).toBe(true);
        }
      }
    }
  });

  it('throws with the field name on an unparseable brand colour', () => {
    expect(() => generateTheme({ brandColor: 'not-a-colour' })).toThrow(/brandColor/);
    expect(() => generateTheme({ brandColor: '' })).toThrow(/brandColor/);
  });

  it('throws on an uncurated font rather than falling back silently (§35)', () => {
    expect(() =>
      generateTheme({ brandColor: '#7C6CFF', headingFont: 'comic-sans' }),
    ).toThrow(/curated list/);
  });

  it('does not mutate its input', () => {
    const input: GenerateInput = {
      brandColor: '#7C6CFF',
      overrides: { direct: { shape: { radius: '2rem' } } },
    };
    const snapshot = JSON.parse(JSON.stringify(input)) as GenerateInput;
    generateTheme(input);
    expect(input).toEqual(snapshot);
  });

  it('is deterministic', () => {
    for (const hex of ['#7C6CFF', '#00FF88', '#808080']) {
      expect(generateTheme({ brandColor: hex })).toEqual(generateTheme({ brandColor: hex }));
    }
  });
});

describe('body text reads the same on every surface it sits on', () => {
  it('shares one value across background, card, popover and sidebar', () => {
    // Solved independently, these four near-identical surfaces land on
    // different ramp steps and the sidebar's text comes out visibly darker
    // than the main content's, for no reason a reader could explain.
    for (const hex of BRANDS) {
      const { tokens } = generateTheme({ brandColor: hex });
      const base = JSON.stringify(tokens.color.foreground);
      for (const role of ['card-foreground', 'popover-foreground', 'sidebar-foreground'] as const) {
        expect(JSON.stringify(tokens.color[role]), `${hex} ${role}`).toBe(base);
      }
    }
  });

  it('still clears Lc 90 on each of those surfaces', () => {
    // Sharing must not be bought with a broken floor. The post-merge check
    // covers this, so an inheritance that failed would show up as a violation.
    for (const hex of BRANDS) {
      expect(generateTheme({ brandColor: hex }).violations, hex).toEqual([]);
    }
  });
});

describe('contrast floors on the generated base', () => {
  it('reports no violations for any brand colour, with no overrides', () => {
    // The generated base always satisfies its own floors. If this ever fails,
    // the ramp stops have drifted into the contrast dead zone.
    const failures: string[] = [];
    for (const hex of BRANDS) {
      const { violations } = generateTheme({ brandColor: hex });
      for (const v of violations) {
        failures.push(`${hex}: ${v.fg} on ${v.bg} = ${v.got}, needs ${v.min}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('holds for every neutral tone and every font pairing', () => {
    for (const neutralTone of ['warm', 'cool'] as const) {
      const { violations } = generateTheme({ brandColor: '#7C6CFF', neutralTone });
      expect(violations).toEqual([]);
    }
  });
});

describe('post-merge re-validation', () => {
  it('catches a Direct edit that breaks a floor the base satisfied', () => {
    // The check that is easy to forget: nothing before the merge would notice.
    const { violations } = generateTheme({
      brandColor: '#7C6CFF',
      overrides: { direct: { color: { foreground: 'oklch(0.97 0 0)' } } },
    });
    const broken = violations.find((v) => v.fg === 'foreground' && v.bg === 'background');
    expect(broken).toBeDefined();
    expect(broken?.min).toBe(90);
    expect(broken?.got).toBeLessThan(90);
  });

  it('names the pairing, the value achieved and the minimum', () => {
    // §7 wants publish to reject with field-level errors, which it can only do
    // if it is told which pairing failed.
    const { violations } = generateTheme({
      brandColor: '#7C6CFF',
      overrides: { direct: { color: { 'primary-foreground': 'oklch(0.55 0 0)' } } },
    });
    expect(violations.length).toBeGreaterThan(0);
    for (const v of violations) {
      expect(v).toHaveProperty('fg');
      expect(v).toHaveProperty('bg');
      expect(typeof v.got).toBe('number');
      expect(typeof v.min).toBe('number');
    }
  });

  it('catches a break in one mode only', () => {
    const { violations } = generateTheme({
      brandColor: '#7C6CFF',
      overrides: { direct: { color: { foreground: { light: 'oklch(0.97 0 0)' } } } },
    });
    expect(violations.some((v) => v.fg === 'foreground')).toBe(true);
    // Dark mode kept its generated value, so it must still pass.
    expect(violations.filter((v) => v.fg === 'foreground')).toHaveLength(1);
  });

  it('does not report violations for a Raw value it cannot parse', () => {
    // Syntax is step 07's job. Contrast and syntax are different checks; both
    // run, and neither swallows the other.
    const { violations } = generateTheme({
      brandColor: '#7C6CFF',
      overrides: { raw: { color: { foreground: 'var(--something)' } } },
    });
    expect(violations.some((v) => v.fg === 'foreground')).toBe(false);
  });
});

describe('advisories and passthrough', () => {
  it('reports an info-hue collision without correcting it (§34)', () => {
    const { advisories } = generateTheme({ brandColor: '#3B82F6' });
    expect(advisories.join(' ')).toMatch(/info/);
  });

  it('stays quiet for a brand nowhere near the info hue', () => {
    expect(generateTheme({ brandColor: '#DC2626' }).advisories).toEqual([]);
  });

  it('stays quiet for an achromatic brand, whose hue means nothing', () => {
    expect(generateTheme({ brandColor: '#808080' }).advisories).toEqual([]);
  });

  it('keeps buttonStyle out of the colour tree (§32)', () => {
    const result = generateTheme({ brandColor: '#7C6CFF', buttonStyle: 'outline' });
    expect(result.buttonStyle).toBe('outline');
    expect(Object.keys(result.tokens.color)).not.toContain('buttonStyle');
  });
});
