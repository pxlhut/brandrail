/**
 * The service layer (step 13) — plain async functions taking a `siteId` and
 * plain data. No framework types: the moment this imported Express,
 * Fastify, Adonis or NestJS request/response or DI types, it would stop
 * being backend-agnostic (guideline §15). Each framework's controller is a
 * thin caller of what's exported here.
 *
 * This is where the control-tier model — the pillar no other npm package in
 * this space attempts — becomes enforcement rather than a data shape: §9,
 * §18, §21, §24 and §28 all meet here, on top of §7's publish pipeline and
 * D7/D8's hashing and version-pinning.
 */

export {
  saveDraft,
  enforceTiers,
  TierViolationError,
  TOKEN_PATH_TYPE,
  SEMANTIC_COLOR_ROLES,
  applyTokenPathOverride,
} from './features/authoring/index.js';
export type {
  AuthoringContext,
  DraftPatch,
  EnforcedPatch,
  SemanticColorRole,
} from './features/authoring/index.js';

export { publishTheme, rollback, hashTokens, hashCssText, toGenerateInput, InMemoryIdempotencyStore } from './features/publishing/index.js';
export type {
  PublishContext,
  PublishOptions,
  PublishResult,
  RollbackContext,
  IdempotencyStore,
} from './features/publishing/index.js';

export { provisionSite } from './features/provisioning/index.js';
export type { ProvisioningContext, ProvisionSiteInput } from './features/provisioning/index.js';

export { requireWriteAccess, RoleError } from './features/access/index.js';
export type { AccessContext, SiteRole } from './features/access/index.js';

export {
  InMemoryRateLimiter,
  RateLimitError,
  defaultDraftRateLimiter,
  defaultPublishSiteRateLimiter,
  defaultPublishAccountRateLimiter,
} from './features/limits/index.js';
export type { RateLimiter } from './features/limits/index.js';

export { noopInvalidationEmitter } from './features/events/index.js';
export type { InvalidationEmitter, InvalidationEvent } from './features/events/index.js';

export { noopMetricsEmitter } from './features/metrics/index.js';
export type { MetricEvent, MetricsEmitter } from './features/metrics/index.js';

export { renderThemeStyle } from './features/delivery/index.js';
export type { ThemeStyleSource, RenderedThemeStyle } from './features/delivery/index.js';
