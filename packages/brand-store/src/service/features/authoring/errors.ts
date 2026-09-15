import type { FieldId, Tier } from '@pxlhut/brand-core';

/**
 * §9's tier check failed: a locked field was written to, a guided value
 * wasn't one of the declared options, or a direct/raw value failed step 07's
 * validator. Distinct from `RoleError` (`access/`) — that's "may this user
 * touch this site at all", this is "does this specific field accept this
 * specific value".
 */
export class TierViolationError extends Error {
  constructor(
    public readonly fieldId: FieldId,
    public readonly tier: Tier,
    reason: string,
  ) {
    super(`${fieldId} (${tier}): ${reason}`);
    this.name = 'TierViolationError';
  }
}
