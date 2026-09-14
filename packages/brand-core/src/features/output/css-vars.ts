/**
 * `toCssVars` — the escape hatch (§37).
 *
 * Raw custom properties, no assumptions about consumer naming beyond an
 * optional prefix. Deliberately the simplest of the three: no shadcn-specific
 * variable set, no font-loading strategy, no framework config shape.
 */

import type { TokenTree } from '../../shared/types/index.js';
import { CHART_ROLE_ORDER, COLOR_ROLE_ORDER } from './roles.js';
import { declaration, resolveMode, wrapDarkRule, type DarkModeStrategy } from './shared.js';

export interface CssVarOpts {
  /** Prepended to every property name, e.g. `'tw-'` → `--tw-background`. @default '' */
  prefix?: string;
  /** @default 'attribute' */
  darkMode?: DarkModeStrategy;
  /** @default ':root' */
  selector?: string;
  /** Strips the newline between the light and dark blocks. @default false */
  minify?: boolean;
}

function block(tree: TokenTree, scheme: 'light' | 'dark', prefix: string, includeShapeAndType: boolean): string {
  const decls: string[] = [];
  for (const role of COLOR_ROLE_ORDER) decls.push(declaration(`${prefix}${role}`, resolveMode(tree.color[role], scheme)));
  for (const role of CHART_ROLE_ORDER) decls.push(declaration(`${prefix}${role}`, resolveMode(tree.chart[role], scheme)));

  if (includeShapeAndType) {
    decls.push(
      declaration(`${prefix}radius`, resolveMode(tree.shape.radius, scheme)),
      declaration(`${prefix}border-width`, resolveMode(tree.shape.borderWidth, scheme)),
      declaration(`${prefix}density-scale`, resolveMode(tree.shape.densityScale, scheme)),
      declaration(`${prefix}shadow-strength`, resolveMode(tree.shape.shadowStrength, scheme)),
      declaration(`${prefix}font-heading`, resolveMode(tree.typography.headingFont, scheme)),
      declaration(`${prefix}font-body`, resolveMode(tree.typography.bodyFont, scheme)),
    );
  }

  return decls.join('');
}

export function toCssVars(tree: TokenTree, opts: CssVarOpts = {}): string {
  const prefix = opts.prefix ?? '';
  const selector = opts.selector ?? ':root';
  const darkMode = opts.darkMode ?? 'attribute';
  const minify = opts.minify ?? false;

  // Shape and typography aren't per-mode (§32) — declared once, in the light
  // block, and inherited by the dark block through the normal cascade.
  const lightRule = `${selector}{${block(tree, 'light', prefix, true)}}`;
  const darkRule = wrapDarkRule(selector, darkMode, block(tree, 'dark', prefix, false));

  return `${lightRule}${minify ? '' : '\n'}${darkRule}`;
}
