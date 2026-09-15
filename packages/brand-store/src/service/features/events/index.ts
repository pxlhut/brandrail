/**
 * Cache invalidation (§8) — an injectable emitter, not a hard dependency.
 * Postgres `LISTEN`/`NOTIFY` at moderate scale, a real queue once pushing to
 * edge KV (queues survive a worker restart; `NOTIFY` doesn't). Defaults to a
 * no-op so the service works standalone with nothing wired up.
 *
 * Best-effort by design (§8): treat a dropped event as survivable, and keep
 * a short TTL — even 60 s — wherever the event feeds a cache, so a dropped
 * event self-heals within a minute rather than leaving a site on stale
 * branding indefinitely. That TTL lives at the cache the event feeds, not
 * here.
 */

export interface InvalidationEvent {
  siteId: string;
  snapshotId: string;
  checksum: string;
}

export type InvalidationEmitter = (event: InvalidationEvent) => void | Promise<void>;

export const noopInvalidationEmitter: InvalidationEmitter = () => {
  // Intentionally empty — see the module doc comment.
};
