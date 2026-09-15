/**
 * Role check — guideline §21's first of two separate questions: is this
 * user allowed to edit this site at all? Owner/editor/viewer, scoped to the
 * site. Distinct from the tier check (§9, `authoring/`), and must run
 * first — a user with no business touching a site should never learn
 * *which field* they can't edit.
 *
 * §21 suggests a `site_members(site_id, user_id, role)` table if the
 * platform doesn't already have one — but the service takes an injected
 * `authorize` callback rather than owning that table itself. The platform
 * usually already has identity and membership; duplicating it here would
 * be a second source of truth for who can do what.
 */

export type SiteRole = 'owner' | 'editor' | 'viewer';

/** Thrown by `requireWriteAccess` — never for a tier violation, which is a different question (`authoring/`'s `TierViolationError`). */
export class RoleError extends Error {
  constructor(
    public readonly siteId: string,
    public readonly userId: string,
    message: string,
  ) {
    super(message);
    this.name = 'RoleError';
  }
}

export interface AccessContext {
  userId: string;
  /** Returns the caller's role for this site, or `null` if they have none at all. Injected — see the module doc comment. */
  authorize: (siteId: string, userId: string) => Promise<SiteRole | null>;
}

/**
 * §21 check 1. A `viewer` can read but not write; `null` means no
 * relationship to this site whatsoever. Both fail the same way — the
 * distinction matters to whoever calls `authorize`, not to the caller here.
 */
export async function requireWriteAccess(siteId: string, ctx: AccessContext): Promise<SiteRole> {
  const role = await ctx.authorize(siteId, ctx.userId);
  if (role === null || role === 'viewer') {
    throw new RoleError(
      siteId,
      ctx.userId,
      `user "${ctx.userId}" may not edit site "${siteId}"`,
    );
  }
  return role;
}
