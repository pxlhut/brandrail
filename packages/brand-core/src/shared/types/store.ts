/**
 * Store-facing shapes, defined here so `@pxlhut/brand-store` re-exports them
 * rather than redefining them. Two packages guessing at the same shape is how
 * a contract rots.
 *
 * Guideline §2 (the reference schema), §22 (optimistic concurrency), §11
 * (previews). D1 (`siteId`), D7 (two hashes), D8 (`sourceConfigVersion`).
 */

import type { ControlConfig, FieldId } from './control.js';
import type { TokenTree } from './tokens.js';

/**
 * The mutable draft a business owner is currently editing. One row per site.
 *
 * A slider drag writes here constantly; that churn must never touch the table
 * production traffic reads from (§2).
 */
export interface BrandConfig {
  siteId: string;
  /** The one true input. Most colour output derives from this (§33). */
  brandColor: string;
  /** This site's own config, copied from a profile at provisioning (§17). */
  controlConfig: ControlConfig;
  /**
   * The current value of every field that maps to a single scalar generator
   * input — `headingFont`, `bodyFont`, `radius`, `density`, `neutralTone`,
   * `buttonStyle`, `elevation` (as a string, e.g. `'72'`) — keyed by
   * `FieldId`, regardless of whether the field's current tier is `locked`
   * or `guided` or `direct`. A locked field with no owner-set value falls
   * back to its `controlConfig` entry's own `value`; `brandColor` has its
   * own top-level slot above instead, being "the one true input"; raw-tier
   * and passthrough fields use `rawOverrides`/`passthrough` instead, since
   * their values aren't single scalars.
   */
  fieldValues: Partial<Record<FieldId, string>>;
  /**
   * Token-path-keyed overrides (e.g. `"color.primary"`, `"shape.radius"`) —
   * still validated regardless (§19) — for any field whose value is not a
   * single scalar: `advancedTokens`, always (that's its whole purpose), and
   * `semanticColors` whenever its tier is `direct` or `raw` rather than
   * `locked` (overriding "what colour is error" is inherently a set of
   * colour-role overrides, not one value).
   */
  rawOverrides: Record<string, string>;
  /** Fields that never reach `generateTheme()` — logo URL, company name (§36). */
  passthrough: Record<string, string>;
  /** Which generation algorithm this draft targets (§6). */
  schemaVersion: number;
  /**
   * Optimistic concurrency (§22). `saveConfig` takes the version the client
   * last saw; a stale value means someone else edited first, and the write is
   * rejected rather than silently overwriting them.
   */
  version: number;
  updatedAt: string;
  updatedBy?: string;
}

/**
 * Immutable published output. Append-only — never updated, only inserted.
 *
 * This is what production serves. The read path looks it up and inlines
 * `cssText`; it never runs `generateTheme()` (§3).
 */
export interface Snapshot {
  id: string;
  siteId: string;
  /** Monotonic per site, starting at 1, no gaps (§7). */
  version: number;
  tokens: TokenTree;
  /** Precompiled CSS, ready to inline. */
  cssText: string;
  /**
   * Hash of `tokens`. Drives publish dedupe (§7 step 3) and cache
   * invalidation (§8). **Not** the CSP hash — see `cssSha256`.
   */
  checksum: string;
  /**
   * SHA-256 of `cssText`, emitted as `style-src 'sha256-...'` (D7).
   * **Not** the dedupe hash — conflating the two produces a CSP header that
   * does not match the served bytes, which fails closed.
   */
  cssSha256: string;
  /** The `BrandConfig.version` this was built from (D8). */
  sourceConfigVersion: number;
  schemaVersion: number;
  publishedAt: string;
  publishedBy?: string;
}

/**
 * A shareable "preview before publish" link (§11).
 *
 * Deliberately a separate shape from `Snapshot`: a preview is never wired into
 * the active pointer. "Promote this preview" re-runs the full publish pipeline
 * so a forgotten link cannot quietly become the live theme.
 */
export interface Preview {
  id: string;
  siteId: string;
  tokens: TokenTree;
  cssText: string;
  /** Defaults to 7 days from creation (§11). */
  expiresAt: string;
  createdBy?: string;
}
