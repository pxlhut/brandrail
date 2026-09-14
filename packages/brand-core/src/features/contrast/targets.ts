/**
 * The APCA role→Lc table — DECISIONS.md D5, extended by D11.
 *
 * **This table is the accessibility guarantee.** Without it, "APCA-validated"
 * is a marketing claim with nothing behind it. Every row is asserted against
 * 1,000 seeded random brand colours in step 09's property test.
 *
 * These are floors, not targets. Overshooting is fine; undershooting fails
 * the build.
 */

import type { ColorRole } from '../../shared/types/index.js';

export interface ContrastTarget {
  /** The role that must be legible. */
  foreground: ColorRole;
  /** The surface it sits on. */
  background: ColorRole;
  /** Minimum |Lc|. */
  minLc: number;
  /** Why this floor, so a future change is an argument rather than a guess. */
  rationale: string;
}

/** APCA bands used below, named so the numbers are not bare magic. */
export const LC_BODY_TEXT = 90;
export const LC_LARGE_TEXT = 75;
export const LC_SECONDARY_TEXT = 60;
export const LC_NON_TEXT_UI = 45;
export const LC_BOUNDARY = 15;

export const CONTRAST_TARGETS: readonly ContrastTarget[] = [
  // --- D5 ---
  { foreground: 'foreground', background: 'background', minLc: LC_BODY_TEXT, rationale: 'body text' },
  { foreground: 'card-foreground', background: 'card', minLc: LC_BODY_TEXT, rationale: 'body text' },
  { foreground: 'popover-foreground', background: 'popover', minLc: LC_BODY_TEXT, rationale: 'body text' },

  { foreground: 'primary-foreground', background: 'primary', minLc: LC_LARGE_TEXT, rationale: 'button label' },
  { foreground: 'secondary-foreground', background: 'secondary', minLc: LC_LARGE_TEXT, rationale: 'button label' },
  { foreground: 'accent-foreground', background: 'accent', minLc: LC_LARGE_TEXT, rationale: 'button label' },
  { foreground: 'destructive-foreground', background: 'destructive', minLc: LC_LARGE_TEXT, rationale: 'button label' },
  { foreground: 'success-foreground', background: 'success', minLc: LC_LARGE_TEXT, rationale: 'button label' },
  { foreground: 'warning-foreground', background: 'warning', minLc: LC_LARGE_TEXT, rationale: 'button label' },
  { foreground: 'info-foreground', background: 'info', minLc: LC_LARGE_TEXT, rationale: 'button label' },

  { foreground: 'muted-foreground', background: 'background', minLc: LC_SECONDARY_TEXT, rationale: 'secondary text, non-body' },
  { foreground: 'ring', background: 'background', minLc: LC_NON_TEXT_UI, rationale: 'focus indicator, non-text UI' },
  { foreground: 'border', background: 'background', minLc: LC_BOUNDARY, rationale: 'minimum discernible boundary' },
  { foreground: 'input', background: 'background', minLc: LC_BOUNDARY, rationale: 'minimum discernible boundary' },

  // --- D11: the sidebar block. shadcn ships these; a theme that omits them
  // renders the sidebar component unstyled. Same guarantee, not a lesser tier.
  { foreground: 'sidebar-foreground', background: 'sidebar', minLc: LC_BODY_TEXT, rationale: 'body text' },
  { foreground: 'sidebar-primary-foreground', background: 'sidebar-primary', minLc: LC_LARGE_TEXT, rationale: 'button label' },
  { foreground: 'sidebar-accent-foreground', background: 'sidebar-accent', minLc: LC_LARGE_TEXT, rationale: 'button label' },
  { foreground: 'sidebar-ring', background: 'sidebar', minLc: LC_NON_TEXT_UI, rationale: 'focus indicator' },
  { foreground: 'sidebar-border', background: 'sidebar', minLc: LC_BOUNDARY, rationale: 'minimum discernible boundary' },
];

/** Look up the floor for a pairing, if one is specified. */
export function targetFor(
  foreground: ColorRole,
  background: ColorRole,
): ContrastTarget | undefined {
  return CONTRAST_TARGETS.find(
    (t) => t.foreground === foreground && t.background === background,
  );
}
