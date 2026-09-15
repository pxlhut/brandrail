/**
 * `saveDraft` — guideline §9's key move made real: `control_config` gates
 * the API that accepts owner edits, not only hides and shows controls
 * client-side. A bypassed UI or a direct API call cannot write beyond what
 * the site's own tier configuration allows, because the check lives here,
 * not in a form.
 *
 * Two checks, in this order (§21 — different questions, both must run):
 * 1. Role — is this user allowed to edit this site at all (`access/`)?
 * 2. Tier — does the site's own `controlConfig` allow *this* value for
 *    *this* field (`tiers.ts`)?
 */

import type { BrandConfig } from '@pxlhut/brand-core';

import type { BrandThemeStore } from '../../../contract/index.js';
import { requireWriteAccess, type AccessContext } from '../access/index.js';
import { defaultDraftRateLimiter, RateLimitError, type RateLimiter } from '../limits/index.js';
import { enforceTiers, type DraftPatch } from './tiers.js';

export type { DraftPatch, EnforcedPatch } from './tiers.js';
export { enforceTiers } from './tiers.js';
export { TierViolationError } from './errors.js';
export { TOKEN_PATH_TYPE, SEMANTIC_COLOR_ROLES, applyTokenPathOverride } from './token-paths.js';
export type { SemanticColorRole } from './token-paths.js';

export interface AuthoringContext extends AccessContext {
  store: BrandThemeStore;
  /** @default 1 write/second per site (§24) */
  rateLimiter?: RateLimiter;
}

/**
 * Save one edit to a site's draft config. Rejects at the tier check with a
 * store that would otherwise have accepted the write — the UI is not the
 * enforcement (§9).
 *
 * `patch.expectedVersion` flows straight to `store.saveConfig`, which is
 * what actually enforces §22's optimistic concurrency (rule 4) — this
 * function doesn't duplicate that check, only surfaces whatever
 * `ConflictError` the store throws.
 */
export async function saveDraft(
  siteId: string,
  patch: DraftPatch,
  ctx: AuthoringContext,
): Promise<BrandConfig> {
  await requireWriteAccess(siteId, ctx);

  const limiter = ctx.rateLimiter ?? defaultDraftRateLimiter();
  const allowed = await limiter.consume(`saveDraft:${siteId}`);
  if (!allowed) {
    throw new RateLimitError(`saveDraft:${siteId}`, `saveDraft rate limit exceeded for site ${siteId}`);
  }

  const current = await ctx.store.getConfig(siteId);
  const enforced = enforceTiers(patch, current?.controlConfig);

  return ctx.store.saveConfig(siteId, enforced, patch.expectedVersion);
}
