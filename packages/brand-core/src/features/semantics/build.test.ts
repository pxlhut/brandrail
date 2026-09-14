import { describe, expect, it } from 'vitest';

import { isInSrgb, parseColor } from '../../shared/color-math/index.js';
import { absLc, LC_LARGE_TEXT } from '../contrast/index.js';
import { resolveHue } from '../palette/index.js';
import { buildChartColors, buildSemantics } from './build.js';
import {
  chartHues,
  collidesWithInfo,
  hueDistance,
  SEMANTIC_HUES,
  SEMANTIC_NAMES,
} from './hues.js';

const SCHEMES = ['light', 'dark'] as const;

/** Chroma of the brand colour, which is what carries its character across (§34). */
function chromaOf(hex: string): number {
  const parsed = parseColor(hex);
  return resolveHue(parsed).isAchromatic ? 0 : parsed.c;
}

describe('semantic hues are fixed (§34)', () => {
  it.each([
    ['a blue brand', '#3B82F6'],
    ['a purple brand', '#9333EA'],
    ['a red brand', '#DC2626'],
    ['a green brand', '#16A34A'],
  ])('keeps destructive red for %s', (_label, hex) => {
    // "Error" has to read as red whatever the brand is. That is a learned
    // convention, not a stylistic choice a theme may override by accident.
    for (const scheme of SCHEMES) {
      const semantics = buildSemantics(chromaOf(hex), scheme);
      const hue = semantics.destructive.surface.h as number;
      expect(hueDistance(hue, SEMANTIC_HUES.destructive)).toBeLessThan(1);
    }
  });

  it('never takes a semantic hue from the brand', () => {
    const vividTeal = chromaOf('#0F766E');
    const semantics = buildSemantics(vividTeal, 'light');
    for (const name of SEMANTIC_NAMES) {
      expect(semantics[name].surface.h).toBeCloseTo(SEMANTIC_HUES[name], 1);
    }
  });
});

describe('everything else derives from the brand (§34)', () => {
  it('gives a muted brand visibly lower-chroma semantics than a saturated one', () => {
    // Asserted numerically rather than by eye: a bold brand produces a bold
    // error red, a muted brand a correspondingly muted one.
    const muted = buildSemantics(chromaOf('#6B7280'), 'light');
    const vivid = buildSemantics(chromaOf('#DC2626'), 'light');
    for (const name of SEMANTIC_NAMES) {
      expect(muted[name].surface.c).toBeLessThan(vivid[name].surface.c);
    }
  });

  it('produces grey semantics for a grey brand, honestly', () => {
    const semantics = buildSemantics(0, 'light');
    for (const name of SEMANTIC_NAMES) expect(semantics[name].surface.c).toBe(0);
  });
});

describe('semantic contrast floors (D5)', () => {
  const BRANDS = ['#7C6CFF', '#00FF88', '#6B7280', '#FFD700', '#1A0033', '#DC2626', '#000000'];

  it('clears Lc 75 for every pairing, in both modes', () => {
    const failures: string[] = [];
    for (const hex of BRANDS) {
      for (const scheme of SCHEMES) {
        const semantics = buildSemantics(chromaOf(hex), scheme);
        for (const name of SEMANTIC_NAMES) {
          const pair = semantics[name];
          const measured = absLc(pair.foreground, pair.surface);
          if (pair.shortfall !== undefined || measured < LC_LARGE_TEXT) {
            failures.push(`${hex} ${scheme} ${name}: ${measured.toFixed(1)}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('clears the floor for warning specifically, in both modes', () => {
    // Called out separately because it is the one that fails first: pure yellow
    // has a very low lightness ceiling in sRGB, so there is least headroom here.
    for (const hex of BRANDS) {
      for (const scheme of SCHEMES) {
        const { warning } = buildSemantics(chromaOf(hex), scheme);
        expect(
          absLc(warning.foreground, warning.surface),
          `${hex} ${scheme} warning`,
        ).toBeGreaterThanOrEqual(LC_LARGE_TEXT);
      }
    }
  });

  it('emits only in-gamut colours', () => {
    for (const scheme of SCHEMES) {
      const semantics = buildSemantics(0.21, scheme);
      for (const name of SEMANTIC_NAMES) {
        expect(isInSrgb(semantics[name].surface)).toBe(true);
        expect(isInSrgb(semantics[name].foreground)).toBe(true);
      }
    }
  });
});

describe('info / brand hue collision', () => {
  it('reports a blue brand colliding with info rather than silently shipping it', () => {
    // Nudging `info` away from convention is as bad as the collision, so this
    // is surfaced for the platform to decide, not auto-corrected.
    expect(collidesWithInfo(parseColor('#3B82F6').h as number)).toBe(true);
    expect(collidesWithInfo(parseColor('#DC2626').h as number)).toBe(false);
  });

  it('measures hue distance the short way around the wheel', () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
  });
});

describe('chart colours', () => {
  it('produces five distinct hues spread around the wheel', () => {
    const hues = chartHues(280);
    expect(hues).toHaveLength(5);
    expect(new Set(hues).size).toBe(5);
    for (let i = 1; i < hues.length; i += 1) {
      expect(hueDistance(hues[i] as number, hues[i - 1] as number)).toBeCloseTo(72, 5);
    }
  });

  it('starts from the brand hue', () => {
    expect(chartHues(283.39)[0]).toBeCloseTo(283.39, 5);
  });

  it('matches lightness across the series, so none dominates', () => {
    const charts = buildChartColors(283.39, 0.21, 'light');
    const lightnesses = Object.values(charts).map((c) => c.l);
    expect(new Set(lightnesses).size).toBe(1);
  });

  it('stays distinguishable even for a grey brand', () => {
    // Chart colour is data encoding first and brand expression second: five
    // identical grey series is a chart that has stopped doing its job.
    const charts = buildChartColors(250, 0, 'light');
    const values = Object.values(charts);
    for (const c of values) expect(c.c).toBeGreaterThan(0.05);
    expect(new Set(values.map((c) => c.h)).size).toBe(5);
  });

  it('emits all five shadcn chart roles, in gamut', () => {
    const charts = buildChartColors(283.39, 0.21, 'dark');
    expect(Object.keys(charts).sort()).toEqual([
      'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
    ]);
    for (const c of Object.values(charts)) expect(isInSrgb(c)).toBe(true);
  });
});
