/**
 * `toShadcnCss` — the serializer that matters (§37, D7).
 *
 * Emits shadcn/ui's exact current variable set (`SHADCN_PINNED_VARS`, in
 * `./roles.ts`) plus §34's first-class `success`/`warning`/`info` roles under
 * their own names, in one string carrying both light and dark blocks (D6,
 * §25) — the read path is a single lookup, never a recomputation.
 */

import type { TokenTree } from '../../shared/types/index.js';
import { fontFaceBlocks, type FontStrategy } from './fonts.js';
import { CHART_ROLE_ORDER, COLOR_ROLE_ORDER, SHADCN_PINNED_VARS } from './roles.js';
import { declaration, resolveMode, wrapDarkRule, type DarkModeStrategy } from './shared.js';

export type { DarkModeStrategy, FontStrategy };
export { SHADCN_PINNED_VARS };

/**
 * Structurally identical to `features/shape`'s `ButtonStyle` — redeclared
 * rather than imported because `layer('output', ['validation'])` in
 * `.dependency-cruiser.cjs` forbids `output` from importing any other
 * feature. A caller holding a real `ButtonStyle` value passes it here fine;
 * TypeScript matches on shape, not on which file declared it.
 */
export type ButtonStyle = 'solid' | 'outline';

export interface ShadcnOpts {
  /** @default 'attribute' */
  darkMode?: DarkModeStrategy;
  /** @default ':root' — the control panel's live preview needs `[data-site-theme]` instead (§5). */
  selector?: string;
  /** Not a token (§32) — a variant the component library branches on. @default 'solid' */
  buttonStyle?: ButtonStyle;
  /** @default 'none' */
  fontStrategy?: FontStrategy;
  /** Strips the newline between blocks and any font-loading comment. @default false */
  minify?: boolean;
}

function colorDeclarations(tree: TokenTree, scheme: 'light' | 'dark'): string[] {
  const decls: string[] = [];
  for (const role of COLOR_ROLE_ORDER) decls.push(declaration(role, resolveMode(tree.color[role], scheme)));
  for (const role of CHART_ROLE_ORDER) decls.push(declaration(role, resolveMode(tree.chart[role], scheme)));
  return decls;
}

export function toShadcnCss(tree: TokenTree, opts: ShadcnOpts = {}): string {
  const selector = opts.selector ?? ':root';
  const darkMode = opts.darkMode ?? 'attribute';
  const buttonStyle = opts.buttonStyle ?? 'solid';
  const fontStrategy = opts.fontStrategy ?? 'none';
  const minify = opts.minify ?? false;

  const headingFont = resolveMode(tree.typography.headingFont, 'light');
  const bodyFont = resolveMode(tree.typography.bodyFont, 'light');

  // Shape and typography aren't per-mode (§32) — resolved once, declared only
  // in the light/root block. CSS custom properties cascade normally, so the
  // dark block inherits them without repeating the bytes.
  const lightOnlyDecls = [
    declaration('radius', resolveMode(tree.shape.radius, 'light')),
    declaration('border-width', resolveMode(tree.shape.borderWidth, 'light')),
    declaration('density-scale', resolveMode(tree.shape.densityScale, 'light')),
    declaration('shadow-strength', resolveMode(tree.shape.shadowStrength, 'light')),
    declaration('font-heading', headingFont),
    declaration('font-body', bodyFont),
    declaration('button-style', buttonStyle),
  ];

  const lightRule = `${selector}{${[...colorDeclarations(tree, 'light'), ...lightOnlyDecls].join('')}}`;
  const darkRule = wrapDarkRule(selector, darkMode, colorDeclarations(tree, 'dark').join(''));

  const faceBlocks = minify ? '' : fontFaceBlocks([headingFont, bodyFont], fontStrategy);

  const sep = minify ? '' : '\n';
  const prelude = faceBlocks ? `${faceBlocks}${sep}` : '';
  return `${prelude}${lightRule}${sep}${darkRule}`;
}
