/**
 * `publishTheme` and `rollback` — guideline §7's publish pipeline, plus §6's
 * rollback guarantee. Every step matters and runs in order; see the doc
 * comment on `publishTheme` itself for the numbered pipeline.
 */

import { generateTheme, toShadcnCss } from '@pxlhut/brand-core';
import type { Snapshot, Violation } from '@pxlhut/brand-core';

import { ConflictError, NotFoundError, type BrandThemeStore } from '../../../contract/index.js';
import { requireWriteAccess, type AccessContext } from '../access/index.js';
import {
  defaultPublishAccountRateLimiter,
  defaultPublishSiteRateLimiter,
  RateLimitError,
  type RateLimiter,
} from '../limits/index.js';
import { noopInvalidationEmitter, type InvalidationEmitter } from '../events/index.js';
import { hashCssText, hashTokens } from './hash.js';
import { toGenerateInput } from './to-generate-input.js';

export { hashCssText, hashTokens } from './hash.js';
export { toGenerateInput } from './to-generate-input.js';

/**
 * Caches one publish's result against its `idempotencyKey` for §28's
 * window (typically 24h) — *not* redundant with rule 3's checksum dedupe:
 * dedupe catches "the same content published twice"; this catches "one
 * request retried by the network before the first attempt finished",
 * which can happen even when the content differs from whatever the first
 * attempt would have produced (a concurrent edit landed in between).
 */
export interface IdempotencyStore {
  get: (key: string) => Promise<Snapshot | undefined>;
  set: (key: string, value: Snapshot, ttlMs: number) => Promise<void>;
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** In-memory default — a real deployment with more than one process needs a shared store (Redis, etc.), the same caveat as the rate limiters. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, { value: Snapshot; expiresAt: number }>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async get(key: string): Promise<Snapshot | undefined> {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt < this.now().getTime()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: Snapshot, ttlMs: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: this.now().getTime() + ttlMs });
  }
}

export interface PublishContext extends AccessContext {
  store: BrandThemeStore;
  /** @default 10 publishes / 5 minutes per site (§24) */
  siteRateLimiter?: RateLimiter;
  /** @default 100 publishes / 5 minutes per account (§24, §38) — only enforced when `accountId` is given. */
  accountRateLimiter?: RateLimiter;
  /** The site's owning account, for the per-account ceiling (§38). Omit on a platform with no account concept above "site". */
  accountId?: string;
  /** @default in-memory, per-process (§28) */
  idempotency?: IdempotencyStore;
  /** @default no-op (§8) */
  emit?: InvalidationEmitter;
  publishedBy?: string;
}

export interface PublishOptions {
  expectedConfigVersion?: number;
  idempotencyKey?: string;
}

export type PublishResult = { ok: true; snapshot: Snapshot } | { ok: false; violations: Violation[] };

/**
 * §7's pipeline:
 *
 * 1. Role check (`access/`).
 * 2. Rate limit — per site, then per account if `ctx.accountId` is set (§24).
 * 3. Idempotency (§28) — a seen `idempotencyKey` returns the cached result,
 *    skipping generation entirely.
 * 4. Read the config — its `version` becomes the snapshot's
 *    `sourceConfigVersion` (D8). A stale `expectedConfigVersion` rejects.
 * 5. `generateTheme` (step 06).
 * 6. Non-empty `violations` rejects with field-level errors — never a
 *    silent auto-correct (§7 is explicit about this).
 * 7. Serialize (step 08); hash both (D7) — the crypto lives here, not core.
 * 8. Checksum dedupe (rule 3) is the *store's* job, not repeated here —
 *    `store.publish` already returns the existing snapshot for an
 *    unchanged checksum.
 * 9. `store.publish` — the store owns atomicity (rule 1).
 * 10. Emit the invalidation event **after** commit, never before: emitting
 *     first risks a consumer invalidating against a publish that then
 *     fails or rolls back.
 */
export async function publishTheme(
  siteId: string,
  ctx: PublishContext,
  opts: PublishOptions = {},
): Promise<PublishResult> {
  await requireWriteAccess(siteId, ctx);

  const siteLimiter = ctx.siteRateLimiter ?? defaultPublishSiteRateLimiter();
  if (!(await siteLimiter.consume(`publish:site:${siteId}`))) {
    throw new RateLimitError(`publish:site:${siteId}`, `publish rate limit exceeded for site ${siteId}`);
  }
  if (ctx.accountId !== undefined) {
    const accountLimiter = ctx.accountRateLimiter ?? defaultPublishAccountRateLimiter();
    if (!(await accountLimiter.consume(`publish:account:${ctx.accountId}`))) {
      throw new RateLimitError(
        `publish:account:${ctx.accountId}`,
        `publish rate limit exceeded for account ${ctx.accountId}`,
      );
    }
  }

  if (opts.idempotencyKey !== undefined) {
    const idempotency = ctx.idempotency ?? DEFAULT_IDEMPOTENCY_STORE;
    const cached = await idempotency.get(opts.idempotencyKey);
    if (cached !== undefined) return { ok: true, snapshot: cached };
  }

  const config = await ctx.store.getConfig(siteId);
  if (config === null) {
    throw new NotFoundError(`no config for site ${siteId}`);
  }
  if (opts.expectedConfigVersion !== undefined && opts.expectedConfigVersion !== config.version) {
    throw new ConflictError(
      `publish(${siteId}): expected config version ${opts.expectedConfigVersion}, current is ${config.version}`,
    );
  }

  const generated = generateTheme(toGenerateInput(config));
  if (generated.violations.length > 0) {
    return { ok: false, violations: generated.violations };
  }

  const cssText = toShadcnCss(generated.tokens);
  const snapshot = await ctx.store.publish(
    siteId,
    {
      tokens: generated.tokens,
      cssText,
      checksum: hashTokens(generated.tokens),
      cssSha256: hashCssText(cssText),
      ...(ctx.publishedBy !== undefined ? { publishedBy: ctx.publishedBy } : {}),
    },
    { expectedConfigVersion: config.version, ...(opts.idempotencyKey !== undefined ? { idempotencyKey: opts.idempotencyKey } : {}) },
  );

  if (opts.idempotencyKey !== undefined) {
    const idempotency = ctx.idempotency ?? DEFAULT_IDEMPOTENCY_STORE;
    await idempotency.set(opts.idempotencyKey, snapshot, IDEMPOTENCY_TTL_MS);
  }

  // After commit, not before (§7 step 5) — everything above this line has
  // already succeeded and been written.
  await (ctx.emit ?? noopInvalidationEmitter)({
    siteId,
    snapshotId: snapshot.id,
    checksum: snapshot.checksum,
  });

  return { ok: true, snapshot };
}

/** A shared default so repeated calls without an explicit `ctx.idempotency` still dedupe against each other within one process. */
const DEFAULT_IDEMPOTENCY_STORE: IdempotencyStore = new InMemoryIdempotencyStore();

export interface RollbackContext extends AccessContext {
  store: BrandThemeStore;
  emit?: InvalidationEmitter;
}

/** Rule 6: flips the pointer only, never regenerates (§6). Emits the same invalidation event a publish does. */
export async function rollback(siteId: string, snapshotId: string, ctx: RollbackContext): Promise<void> {
  await requireWriteAccess(siteId, ctx);
  await ctx.store.rollback(siteId, snapshotId);

  const active = await ctx.store.getActiveSnapshot(siteId);
  if (active !== null) {
    await (ctx.emit ?? noopInvalidationEmitter)({
      siteId,
      snapshotId: active.id,
      checksum: active.checksum,
    });
  }
}
