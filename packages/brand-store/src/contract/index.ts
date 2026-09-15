/**
 * The store contract (step 10) — guideline §12's key architectural move.
 *
 * §2–§11 assume Postgres with a specific table shape, but the actual
 * requirement is narrower: config writes and published reads are separate,
 * publish is atomic, versions are monotonic, checksums dedupe. Expressed as
 * an interface with zero database dependency, any database or ORM can
 * satisfy it its own way — that's "bring your own stack", and it's why this
 * package doesn't ship seven adapters (`DECISIONS.md` D10).
 *
 * The seven numbered rules referenced below are written in full, with the
 * reasoning behind each, in `rules.md` — that file and this one are the
 * spec an adapter author reads; each rule becomes at least one conformance
 * test in step 11.
 */

import type { BrandConfig, Preview, Snapshot, TokenTree } from '@pxlhut/brand-core';

import type { StoreCapabilities } from './capabilities.js';
import { NotSupportedError } from './errors.js';

export type { StoreCapabilities } from './capabilities.js';
export {
  StoreError,
  ConflictError,
  NotFoundError,
  VersionConflictError,
  NotSupportedError,
} from './errors.js';

/**
 * What `publish()` writes. `checksum` and `cssSha256` are different hashes
 * of different things and both belong on the resulting snapshot — see the
 * doc comments below; conflating them produces a CSP header that doesn't
 * match the served CSS, which fails closed and is confusing to debug.
 */
export interface PublishInput {
  tokens: TokenTree;
  cssText: string;
  /** Hash of `tokens`. Drives publish dedupe (rule 3) and cache invalidation (§8). */
  checksum: string;
  /** SHA-256 of `cssText`, emitted as `style-src 'sha256-...'` (D7). Computed in the service layer — this package has no crypto either. */
  cssSha256: string;
  publishedBy?: string;
}

/**
 * What `createPreview()` writes.
 *
 * `expiresAt` is a real `Date`, not the ISO string {@link Preview.expiresAt}
 * stores — the no-clock purity rule belongs to `@pxlhut/brand-core`
 * (guideline §39), not to this package. The adapter converts to ISO at its
 * own boundary when it writes the `Preview` row.
 */
export interface PreviewInput {
  tokens: TokenTree;
  cssText: string;
  expiresAt: Date;
  createdBy?: string;
}

/**
 * The persistence contract every store adapter implements.
 *
 * `readonly capabilities` is required, not optional (D9) — a caller that
 * needs to know what it's getting can always ask, and an adapter that
 * hasn't decided is not a finished adapter.
 */
export interface BrandThemeStore {
  readonly capabilities: StoreCapabilities;

  /** `null` for an unknown site — never throws (rule 5). */
  getConfig(siteId: string): Promise<BrandConfig | null>;

  /**
   * §22's optimistic concurrency. Rule 4: a stale `expectedVersion` throws
   * {@link ConflictError} and writes nothing.
   *
   * This interface has no separate "provision a site" method — a site's
   * very first `saveConfig` call *is* how its `BrandConfig` row comes into
   * existence. Pass `expectedVersion: 0` for that first call, meaning "no
   * config exists yet for this site"; the adapter creates one at version 1.
   * `0` is never a real config's version (versions start at 1, same as
   * `Snapshot.version` — rule 2), so it can't collide with an actual stale
   * read the way e.g. `undefined` could.
   */
  saveConfig(
    siteId: string,
    patch: Partial<BrandConfig>,
    expectedVersion: number,
  ): Promise<BrandConfig>;

  /**
   * §7's publish transaction. MUST be atomic: serialize per site, assign
   * the next version, write the snapshot and flip the active pointer as one
   * unit — or reject entirely. Every guarantee in §7 lives in this one
   * method:
   *
   * - **Rule 1 — atomic.** Either the snapshot row and the active pointer
   *   both exist afterward, or neither does. Never an inserted snapshot
   *   without an active pointer; never a pointer into a rolled-back
   *   transaction.
   * - **Rule 2 — versions are monotonic per site**, starting at 1, no gaps,
   *   no duplicates, even under concurrent publishes.
   * - **Rule 3 — identical checksum is a no-op.** If `input.checksum`
   *   equals the currently active snapshot's, return that existing
   *   snapshot successfully without writing a row.
   *
   * `opts.expectedConfigVersion` is D8's check on the *config* version —
   * distinct from rule 4's `saveConfig` check on the same field: publish
   * reads `BrandConfig.version` under its own lock and rejects with
   * {@link ConflictError} if the caller's expectation is stale, so the
   * resulting snapshot's `sourceConfigVersion` is always the config the
   * caller actually saw. `opts.idempotencyKey` lets a retried publish
   * request be recognised as the same attempt rather than a second one.
   */
  publish(
    siteId: string,
    input: PublishInput,
    opts?: { expectedConfigVersion?: number; idempotencyKey?: string },
  ): Promise<Snapshot>;

  /** `null` for a site with no active snapshot, or an unknown site — never throws (rule 5). §20 makes the former impossible in practice; the caller still must not have to special-case it. */
  getActiveSnapshot(siteId: string): Promise<Snapshot | null>;

  listSnapshots(siteId: string, opts?: { limit?: number }): Promise<Snapshot[]>;

  /**
   * Rule 6: flips the active pointer only. Never regenerates — that is the
   * entire point of §6. Rolling back must produce byte-identical CSS to
   * what was originally published, even if the generation algorithm has
   * changed since.
   */
  rollback(siteId: string, snapshotId: string): Promise<void>;

  /**
   * Rule 7: writes to a store separate from `publish()`. A preview is never
   * promotable directly — "promote this preview" re-runs the full publish
   * pipeline (step 13); it does not point the active pointer at the
   * preview's data. A preview link outliving its use must not be able to
   * become the live theme.
   */
  createPreview(siteId: string, input: PreviewInput): Promise<Preview>;

  /** `null` for an unknown or expired preview — never throws. */
  getPreview(previewId: string): Promise<Preview | null>;
}

/**
 * §23's evolution rule, in force from the first version of this contract:
 *
 * - New capabilities are added as **optional** methods here, with a default
 *   on {@link BaseBrandThemeStore} — a no-op or a `NotSupportedError`.
 *   Never a required addition to {@link BrandThemeStore}: if this interface
 *   grew a new required method, every existing adapter would break at once
 *   on upgrade.
 * - This package follows strict semver; adapters declare a `peerDependency`
 *   on it, so an incompatible pairing is an install-time warning rather
 *   than a runtime crash. The conformance suite is pinned per major
 *   version.
 *
 * Ship {@link BaseBrandThemeStore} now, even though it does almost nothing
 * yet — every one of today's eight methods is abstract, because every one
 * of them is required. Its value is that adapters extend *this* from the
 * start; adding it later would mean changing every adapter's `extends`
 * clause at once, the same breaking change the two rules above exist to
 * avoid for methods.
 */
export abstract class BaseBrandThemeStore implements BrandThemeStore {
  abstract readonly capabilities: StoreCapabilities;
  abstract getConfig(siteId: string): Promise<BrandConfig | null>;
  abstract saveConfig(
    siteId: string,
    patch: Partial<BrandConfig>,
    expectedVersion: number,
  ): Promise<BrandConfig>;
  abstract publish(
    siteId: string,
    input: PublishInput,
    opts?: { expectedConfigVersion?: number; idempotencyKey?: string },
  ): Promise<Snapshot>;
  abstract getActiveSnapshot(siteId: string): Promise<Snapshot | null>;
  abstract listSnapshots(siteId: string, opts?: { limit?: number }): Promise<Snapshot[]>;
  abstract rollback(siteId: string, snapshotId: string): Promise<void>;
  abstract createPreview(siteId: string, input: PreviewInput): Promise<Preview>;
  abstract getPreview(previewId: string): Promise<Preview | null>;

  /**
   * What a future optional method's default implementation calls. Nothing
   * uses this yet — proven correct by this package's own tests now, so the
   * first optional capability this contract grows can lean on it
   * immediately instead of every adapter inventing its own message format.
   */
  protected unsupported(feature: string): never {
    throw new NotSupportedError(`${this.constructor.name} does not support ${feature}.`);
  }
}
