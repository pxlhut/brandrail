/**
 * The typed error hierarchy every adapter must throw.
 *
 * Adapters must throw the *same* errors, or callers can't handle them
 * portably — this is the most common way a multi-adapter contract rots.
 * The conformance suite (step 11) asserts the error *type*, not a message
 * string, so a caller can safely `catch (e) { if (e instanceof
 * ConflictError) ... }` regardless of which adapter is behind the interface.
 */

/**
 * Base of every error a store adapter throws. Never thrown directly — only
 * a subclass, and `abstract` is what actually prevents `new StoreError(...)`
 * (a `protected` constructor here would do the same for this class but then
 * be inherited by every subclass that doesn't redeclare its own, which
 * would make `new ConflictError(...)` a compile error everywhere too).
 */
export abstract class StoreError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

/** Rule 4: `saveConfig` was given a stale `expectedVersion` (§22). Nothing was written. */
export class ConflictError extends StoreError {}

/** The site, config, snapshot, or preview named by the call does not exist. */
export class NotFoundError extends StoreError {}

/**
 * A concurrent `publish()` won the race for this site's next version.
 * Distinct from {@link ConflictError}: that one is about a stale
 * `BrandConfig.version` on `saveConfig`; this one is about two publishes
 * racing for the same `Snapshot.version`. Nothing was written.
 */
export class VersionConflictError extends StoreError {}

/** §23: this adapter does not implement an optional capability. */
export class NotSupportedError extends StoreError {}
