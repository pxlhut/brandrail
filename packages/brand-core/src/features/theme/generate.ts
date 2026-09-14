/**
 * `generateTheme()` — the public entry point.
 *
 * One brand colour in, a complete contrast-validated token tree out. Pure and
 * deterministic, and callable identically in a browser for live preview (§3)
 * and on a server at publish time (§7).
 *
 * §39 depends on that purity: server-rendered CSS and anything recomputed
 * client-side cannot disagree, because there is nothing to reconcile — only a
 * lookup to repeat.
 */

import { finalize, parseColor, toCss, type Oklch } from '../../shared/color-math/index.js';
import { absLc, pickForRole, CONTRAST_TARGETS } from '../contrast/index.js';
import {
  buildBrandRamps,
  buildNeutralRamps,
  type NeutralTone,
  type Ramp,
} from '../palette/index.js';
import {
  buildChartColors,
  buildSemantics,
  collidesWithInfo,
  type Semantics,
} from '../semantics/index.js';
import { buildShape, normalizeButtonStyle, type ButtonStyle } from '../shape/index.js';
import { buildTypography } from '../typography/index.js';
import type {
  ChartRole,
  ColorRole,
  ColorScheme,
  PartialTokenTree,
  TokenTree,
  TokenValue,
} from '../../shared/types/index.js';
import { mergeLayers } from './merge.js';
import { ROLE_SPECS, type ResolvedRoles } from './roles.js';

/** Bump whenever output changes for a fixed input (§6). */
export const SCHEMA_VERSION = 1;

export interface GenerateInput {
  /** Hex or any CSS colour. The one true input; most output derives from it. */
  brandColor: string;
  neutralTone?: NeutralTone;
  /** A CSS length — a §32 preset from the registry, or any valid length at Direct tier. */
  radius?: string;
  /** Spacing-scale multiplier as a string, e.g. '0.875' or '1'. */
  density?: string;
  /** 0–100, from §33's guided slider. */
  elevation?: number;
  borderWidth?: string;
  /** Curated font ids (§35). Never a free-text family name. */
  headingFont?: string;
  bodyFont?: string;
  buttonStyle?: string;
  /** §18's layers, low to high: base < guided < direct < raw. */
  overrides?: {
    guided?: PartialTokenTree;
    direct?: PartialTokenTree;
    raw?: PartialTokenTree;
  };
  schemaVersion?: number;
}

export interface Violation {
  fg: ColorRole;
  bg: ColorRole;
  /** Absolute Lc actually achieved. */
  got: number;
  /** The floor from D5 / D11. */
  min: number;
}

export interface Adjustment {
  role: ColorRole;
  reason: string;
}

export interface GenerateResult {
  tokens: TokenTree;
  /**
   * Contrast floors the finished tree fails. Empty whenever there are no
   * Direct or Raw overrides — the generated base always satisfies its own
   * floors.
   *
   * Returned rather than thrown: §7 wants publish to reject with *field-level*
   * errors, which it can only do if it is told which pairing failed.
   */
  violations: Violation[];
  /** Roles whose value had to be pushed past the ramp to clear a floor. */
  adjustments: Adjustment[];
  /**
   * Non-fatal notes for the caller to surface. A blue brand colliding with the
   * `info` hue lands here — reported, never auto-corrected, since nudging
   * `info` off convention is as bad as the collision (§34).
   */
  advisories: string[];
  /** Not a token (§32) — a variant the component library branches on. */
  buttonStyle: ButtonStyle;
}

/** Resolve every `ColorRole` for one mode. */
function resolveScheme(
  scheme: ColorScheme,
  brand: Ramp,
  neutral: Ramp,
  semantics: Semantics,
  adjustments: Adjustment[],
): ResolvedRoles {
  const ramps: Record<'brand' | 'neutral', Ramp> = { brand, neutral };
  const out = {} as ResolvedRoles;

  for (const spec of ROLE_SPECS) {
    if (spec.kind === 'fixed') {
      out[spec.role] = ramps[spec.ramp][spec.index] as Oklch;
      continue;
    }
    if (spec.kind === 'semantic') {
      out[spec.role] = semantics[spec.name][spec.part];
      continue;
    }

    if (spec.kind === 'inherit') {
      const source = out[spec.from];
      if (source === undefined) {
        throw new Error(
          `Role "${spec.role}" inherits from "${spec.from}", which has not been resolved yet.`,
        );
      }
      out[spec.role] = source;
      continue;
    }

    // Solved: every surface it is measured against is already resolved, because
    // ROLE_SPECS lists surfaces before anything solved against them.
    const surfaces = [spec.against, ...(spec.alsoAgainst ?? [])].map((role) => {
      const surface = out[role];
      if (surface === undefined) {
        throw new Error(
          `Role "${spec.role}" is solved against "${role}", which has not been ` +
            `resolved yet. ROLE_SPECS must list every surface before its foregrounds.`,
        );
      }
      return surface;
    });

    // Take the strictest surface's answer, then keep stepping out until the
    // value clears the floor on *all* of them. Sharing one value across
    // near-identical surfaces is the point; a value that only works on one of
    // them would defeat it.
    let pick = pickForRole(ramps[spec.ramp], surfaces[0] as Oklch, spec.minLc);
    for (const surface of surfaces.slice(1)) {
      if (absLc(pick.color, surface) >= spec.minLc) continue;
      const stricter = pickForRole(ramps[spec.ramp], surface, spec.minLc);
      if (stricter.lc > pick.lc || absLc(stricter.color, surfaces[0] as Oklch) >= spec.minLc) {
        pick = stricter;
      }
    }

    out[spec.role] = pick.color;
    if (pick.source === 'escalated') {
      adjustments.push({
        role: spec.role,
        reason:
          `pushed past the ${spec.ramp} ramp to clear Lc ${spec.minLc} on ` +
          `${spec.against} (${scheme})`,
      });
    }
  }

  return out;
}

function pair(light: Oklch, dark: Oklch): TokenValue {
  const l = toCss(light);
  const d = toCss(dark);
  return l === d ? l : { light: l, dark: d };
}

/** Read a merged token back as a colour, for post-merge re-validation. */
function readMode(value: TokenValue | undefined, scheme: ColorScheme): Oklch | undefined {
  if (value === undefined) return undefined;
  const raw = typeof value === 'string' ? value : value[scheme];
  try {
    return finalize(parseColor(raw, 'token'));
  } catch {
    // An unparseable value is step 07's problem, not this one. Contrast and
    // syntax are different checks; both run, and neither swallows the other.
    return undefined;
  }
}

/**
 * Re-check every D5/D11 floor against the **merged** tree.
 *
 * Easy to skip and important not to: a Direct-tier edit can break a floor the
 * generated base satisfied, and nothing before this point would notice.
 */
function findViolations(tokens: TokenTree): Violation[] {
  const violations: Violation[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    for (const target of CONTRAST_TARGETS) {
      const fg = readMode(tokens.color[target.foreground], scheme);
      const bg = readMode(tokens.color[target.background], scheme);
      if (fg === undefined || bg === undefined) continue;
      const got = absLc(fg, bg);
      if (got < target.minLc) {
        violations.push({
          fg: target.foreground,
          bg: target.background,
          got: Math.round(got * 10) / 10,
          min: target.minLc,
        });
      }
    }
  }
  return violations;
}

export function generateTheme(input: GenerateInput): GenerateResult {
  // 1. Parse, loudly. A silently-defaulted brand colour is a support ticket
  //    that takes an hour to diagnose, because nothing reports the input was
  //    ignored.
  const brandColor = parseColor(input.brandColor);

  // 2. Ramps, generated independently per mode (D6).
  const brandRamps = buildBrandRamps(brandColor);
  const neutralRamps = buildNeutralRamps(input.neutralTone ?? 'cool');

  // 3–4. Semantics and charts reuse the same envelope and solver (§34).
  const chroma = brandRamps.sourceChroma;
  const adjustments: Adjustment[] = [];
  const resolved = {
    light: resolveScheme(
      'light',
      brandRamps.light,
      neutralRamps.light,
      buildSemantics(chroma, 'light'),
      adjustments,
    ),
    dark: resolveScheme(
      'dark',
      brandRamps.dark,
      neutralRamps.dark,
      buildSemantics(chroma, 'dark'),
      adjustments,
    ),
  };

  const charts = {
    light: buildChartColors(brandRamps.hue, chroma, 'light'),
    dark: buildChartColors(brandRamps.hue, chroma, 'dark'),
  };

  const color = {} as Record<ColorRole, TokenValue>;
  for (const spec of ROLE_SPECS) {
    color[spec.role] = pair(resolved.light[spec.role], resolved.dark[spec.role]);
  }

  const chart = {} as Record<ChartRole, TokenValue>;
  for (const key of Object.keys(charts.light) as ChartRole[]) {
    chart[key] = pair(charts.light[key], charts.dark[key]);
  }

  // 5. Shape and typography — no colour maths, no contrast check (§32).
  const base: TokenTree = {
    color,
    chart,
    shape: buildShape({
      ...(input.radius !== undefined ? { radius: input.radius } : {}),
      ...(input.density !== undefined ? { density: input.density } : {}),
      ...(input.elevation !== undefined ? { elevation: input.elevation } : {}),
      ...(input.borderWidth !== undefined ? { borderWidth: input.borderWidth } : {}),
    }),
    typography: buildTypography({
      ...(input.headingFont !== undefined ? { headingFont: input.headingFont } : {}),
      ...(input.bodyFont !== undefined ? { bodyFont: input.bodyFont } : {}),
    }),
    meta: {
      sourceBrandColor: toCss(finalize(brandColor)),
      schemaVersion: input.schemaVersion ?? SCHEMA_VERSION,
    },
  };

  // 6. §18's merge, exactly once, before anything is hashed.
  const tokens = mergeLayers(base, input.overrides ?? {});

  // 7. Re-validate against the merged result, not the base.
  const violations = findViolations(tokens);

  const advisories: string[] = [];
  if (!brandRamps.isAchromatic && collidesWithInfo(brandRamps.hue)) {
    advisories.push(
      `Brand hue ${brandRamps.hue.toFixed(0)}° sits close to the "info" hue; the two ` +
        `may not read as distinct. Not auto-corrected — moving "info" off convention ` +
        `is as bad as the collision.`,
    );
  }

  return {
    tokens,
    violations,
    adjustments,
    advisories,
    buttonStyle: normalizeButtonStyle(input.buttonStyle),
  };
}
