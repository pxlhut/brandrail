/**
 * Token paths — how `advancedTokens` (and a `direct`/`raw` `semanticColors`)
 * name *which* token they're overriding, as a single string key
 * (`"color.primary"`, `"shape.radius"`) on `BrandConfig.rawOverrides`.
 *
 * Nothing upstream defines this format — `TokenTree`'s shape is nested,
 * `rawOverrides` is flat — so this is where it's decided, in exactly one
 * place both `authoring` (validating a submitted path) and `publishing`
 * (turning saved paths back into a `PartialTokenTree`) import from.
 */

import { CHART_ROLE_ORDER, COLOR_ROLE_ORDER } from '@pxlhut/brand-core';
import type { PartialTokenTree, TokenValueType } from '@pxlhut/brand-core';

/** Every path `advancedTokens`/`semanticColors` may name, and the type step 07 validates it as. */
export const TOKEN_PATH_TYPE: Readonly<Record<string, TokenValueType>> = Object.freeze({
  ...Object.fromEntries(COLOR_ROLE_ORDER.map((role) => [`color.${role}`, 'color'] as const)),
  ...Object.fromEntries(CHART_ROLE_ORDER.map((role) => [`chart.${role}`, 'color'] as const)),
  'shape.radius': 'length',
  'shape.borderWidth': 'length',
  'shape.densityScale': 'number',
  'shape.shadowStrength': 'number',
  'typography.headingFont': 'font-stack',
  'typography.bodyFont': 'font-stack',
});

/** The four base semantic roles `semanticColors` may override at `direct`/`raw` tier — never the derived `-foreground` half. */
export const SEMANTIC_COLOR_ROLES = ['destructive', 'success', 'warning', 'info'] as const;
export type SemanticColorRole = (typeof SEMANTIC_COLOR_ROLES)[number];

/** Writes one already-validated token-path value into a `PartialTokenTree`, mutating `tree`. Unknown paths are silently ignored — they can't have been saved in the first place without failing `TOKEN_PATH_TYPE` lookup. */
export function applyTokenPathOverride(tree: PartialTokenTree, path: string, value: string): void {
  const dot = path.indexOf('.');
  if (dot < 0) return;
  const section = path.slice(0, dot);
  const key = path.slice(dot + 1);

  switch (section) {
    case 'color':
      tree.color = { ...tree.color, [key]: value };
      return;
    case 'chart':
      tree.chart = { ...tree.chart, [key]: value };
      return;
    case 'shape':
      tree.shape = { ...tree.shape, [key]: value };
      return;
    case 'typography':
      tree.typography = { ...tree.typography, [key]: value };
      return;
    default:
      return;
  }
}
