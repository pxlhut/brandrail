/**
 * The canonical, pinned order every serializer writes tokens in.
 *
 * Hand-copied from `shared/types/tokens.ts`'s `ColorRole` union rather than
 * derived from `Object.keys(tree.color)` at runtime. Both would happen to
 * agree today, but this file is the one place that must not move if
 * `generateTheme()`'s internal construction order ever does — a serializer
 * that trusted the tree's own key order would be coupled to an
 * implementation detail of a feature it isn't even allowed to import
 * (`.dependency-cruiser.cjs`'s `layer('output', ['validation'])`).
 *
 * "Emit a stable key order so the same tree always produces the same bytes"
 * (step 08) is this file, not an accident of object insertion order.
 */

import type { ChartRole, ColorRole } from '../../shared/types/index.js';

/**
 * `success`/`warning`/`info` and their foregrounds aren't in shadcn/ui's own
 * variable set — §34 makes them first-class here regardless. Kept as its own
 * list so the shadcn acceptance test can assert the *pinned* subset without
 * these, while every serializer still emits all of them.
 */
export const EXTRA_COLOR_ROLES: readonly ColorRole[] = [
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'info',
  'info-foreground',
];

export const COLOR_ROLE_ORDER: readonly ColorRole[] = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  ...EXTRA_COLOR_ROLES,
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
];

export const CHART_ROLE_ORDER: readonly ChartRole[] = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
];

/**
 * Exactly shadcn/ui's own variable set — verified against the live
 * `:root`/`.dark` blocks in `ui.shadcn.com`'s manual-installation guide
 * (2026-09-14), not worked from memory. `--radius-sm`…`--radius-4xl` and the
 * `@theme inline { --color-*: var(--*) }` bridge are the *consumer's own*
 * Tailwind build output, generated once from their globals.css — not
 * per-tenant data, and not this package's concern.
 */
export const SHADCN_PINNED_VARS: readonly string[] = [
  ...COLOR_ROLE_ORDER.filter((role) => !EXTRA_COLOR_ROLES.includes(role)),
  ...CHART_ROLE_ORDER,
  'radius',
].map((name) => `--${name}`);
