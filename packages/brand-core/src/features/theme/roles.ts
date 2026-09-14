/**
 * Role assignment — which ramp step becomes which `ColorRole`.
 *
 * Written as an ordered table rather than imperative code so the mapping is
 * readable and testable on its own. Order matters: every surface is resolved
 * before anything solved *against* it.
 *
 * The same table serves both modes. Step 04's stops were chosen so index
 * semantics hold across light and dark — index 0 is the app background in
 * both, index 8 is the solid step in both — which is what keeps this free of
 * mode branching.
 */

import type { Oklch } from '../../shared/color-math/index.js';
import {
  LC_BODY_TEXT,
  LC_BOUNDARY,
  LC_LARGE_TEXT,
  LC_NON_TEXT_UI,
  LC_SECONDARY_TEXT,
} from '../contrast/index.js';
import { SOLID_INDEX } from '../palette/index.js';
import type { ColorRole } from '../../shared/types/index.js';
import type { SemanticName } from '../semantics/index.js';

export type RampName = 'brand' | 'neutral';

/** Take a fixed step from a ramp. */
export interface FixedSpec {
  kind: 'fixed';
  role: ColorRole;
  ramp: RampName;
  index: number;
}

/** Solve against an already-resolved surface, to a floor from D5/D11. */
export interface SolvedSpec {
  kind: 'solved';
  role: ColorRole;
  ramp: RampName;
  against: ColorRole;
  minLc: number;
  /**
   * Additional surfaces this value must also clear.
   *
   * Body text sits on several near-identical surfaces — `background`, `card`,
   * `popover`, `sidebar` — that differ by a hundredth of a lightness step. Solved
   * independently, they land on *different* ramp steps, and the sidebar's text
   * comes out visibly darker than the main content's for no reason a reader
   * could explain. Solving once against the hardest of them, and sharing the
   * result, is what shadcn's own default does.
   */
  alsoAgainst?: readonly ColorRole[];
}

/**
 * Reuse another role's resolved value verbatim.
 *
 * Not an optimisation — a consistency guarantee. The post-merge check in
 * `generate` still validates the inherited value against this role's own
 * surface, so a bad inheritance surfaces as a violation rather than shipping.
 */
export interface InheritSpec {
  kind: 'inherit';
  role: ColorRole;
  from: ColorRole;
}

/** Take a pre-solved semantic pairing from step 05. */
export interface SemanticSpec {
  kind: 'semantic';
  role: ColorRole;
  name: SemanticName;
  part: 'surface' | 'foreground';
}

export type RoleSpec = FixedSpec | SolvedSpec | SemanticSpec | InheritSpec;

/**
 * Surfaces come from the neutral ramp; anything that should read as the brand
 * comes from the brand ramp.
 *
 * §33: `neutralTone` changes the feel of every border and background *without
 * touching brand colour*, which is why `background`, `card`, `muted`, `border`
 * and `input` are all neutral. `primary`, `accent` and `ring` are where the
 * brand actually shows.
 */
export const ROLE_SPECS: readonly RoleSpec[] = [
  // --- base surfaces. shadcn's own default has card and popover equal to
  // background, separated by --border rather than by fill.
  { kind: 'fixed', role: 'background', ramp: 'neutral', index: 0 },
  { kind: 'fixed', role: 'card', ramp: 'neutral', index: 0 },
  { kind: 'fixed', role: 'popover', ramp: 'neutral', index: 0 },
  { kind: 'fixed', role: 'muted', ramp: 'neutral', index: 2 },
  { kind: 'fixed', role: 'secondary', ramp: 'neutral', index: 2 },
  { kind: 'fixed', role: 'accent', ramp: 'brand', index: 2 },

  // --- the solid step. D5 holds its foreground to Lc 75, which is why step 04
  // pins index 8 outside the contrast dead zone.
  { kind: 'fixed', role: 'primary', ramp: 'brand', index: SOLID_INDEX },

  // --- semantics: fixed hues, brand-derived everything else (§34)
  { kind: 'semantic', role: 'destructive', name: 'destructive', part: 'surface' },
  { kind: 'semantic', role: 'success', name: 'success', part: 'surface' },
  { kind: 'semantic', role: 'warning', name: 'warning', part: 'surface' },
  { kind: 'semantic', role: 'info', name: 'info', part: 'surface' },

  // --- sidebar (D11). A small neutral offset from background, so it reads as a
  // distinct surface without becoming a second accent.
  { kind: 'fixed', role: 'sidebar', ramp: 'neutral', index: 1 },
  { kind: 'fixed', role: 'sidebar-primary', ramp: 'brand', index: SOLID_INDEX },
  { kind: 'fixed', role: 'sidebar-accent', ramp: 'neutral', index: 3 },

  // --- foregrounds, solved against the surfaces above
  // Solved once against the hardest of the surfaces body text sits on, then
  // shared. See `SolvedSpec.alsoAgainst`.
  {
    kind: 'solved',
    role: 'foreground',
    ramp: 'neutral',
    against: 'background',
    alsoAgainst: ['card', 'popover', 'sidebar'],
    minLc: LC_BODY_TEXT,
  },
  { kind: 'inherit', role: 'card-foreground', from: 'foreground' },
  { kind: 'inherit', role: 'popover-foreground', from: 'foreground' },
  { kind: 'solved', role: 'primary-foreground', ramp: 'brand', against: 'primary', minLc: LC_LARGE_TEXT },
  { kind: 'solved', role: 'secondary-foreground', ramp: 'neutral', against: 'secondary', minLc: LC_LARGE_TEXT },
  { kind: 'solved', role: 'accent-foreground', ramp: 'brand', against: 'accent', minLc: LC_LARGE_TEXT },
  { kind: 'solved', role: 'muted-foreground', ramp: 'neutral', against: 'background', minLc: LC_SECONDARY_TEXT },

  { kind: 'semantic', role: 'destructive-foreground', name: 'destructive', part: 'foreground' },
  { kind: 'semantic', role: 'success-foreground', name: 'success', part: 'foreground' },
  { kind: 'semantic', role: 'warning-foreground', name: 'warning', part: 'foreground' },
  { kind: 'semantic', role: 'info-foreground', name: 'info', part: 'foreground' },

  { kind: 'inherit', role: 'sidebar-foreground', from: 'foreground' },
  { kind: 'solved', role: 'sidebar-primary-foreground', ramp: 'brand', against: 'sidebar-primary', minLc: LC_LARGE_TEXT },
  { kind: 'solved', role: 'sidebar-accent-foreground', ramp: 'neutral', against: 'sidebar-accent', minLc: LC_LARGE_TEXT },

  // --- structural. `ring` comes from the brand ramp because a focus ring is
  // one of the few non-text places the brand should be visible.
  { kind: 'solved', role: 'ring', ramp: 'brand', against: 'background', minLc: LC_NON_TEXT_UI },
  { kind: 'solved', role: 'border', ramp: 'neutral', against: 'background', minLc: LC_BOUNDARY },
  { kind: 'solved', role: 'input', ramp: 'neutral', against: 'background', minLc: LC_BOUNDARY },
  { kind: 'solved', role: 'sidebar-border', ramp: 'neutral', against: 'sidebar', minLc: LC_BOUNDARY },
  { kind: 'solved', role: 'sidebar-ring', ramp: 'brand', against: 'sidebar', minLc: LC_NON_TEXT_UI },
];

/** Every role the table assigns, for the completeness check in `generate`. */
export const ASSIGNED_ROLES: readonly ColorRole[] = ROLE_SPECS.map((s) => s.role);

export type ResolvedRoles = Record<ColorRole, Oklch>;
