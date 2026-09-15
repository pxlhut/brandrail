/**
 * Instrumentation (§26) — an injectable callback, not a metrics vendor
 * dependency. This package doesn't pick Datadog, Prometheus or CloudWatch
 * for its consumers; it emits named events and leaves the sink to whoever
 * wires one in, the same shape as `InvalidationEmitter` (`events/`).
 * Defaults to a no-op so nothing here requires a metrics backend to run
 * standalone.
 *
 * §26's list has six names. Four are wired into this package's own code,
 * at the place the thing being measured actually happens
 * (`publishing/index.ts`):
 *
 * - `publish_latency_ms` — timed around the store's `publish()` call
 *   itself, since a slow adapter or lock contention is exactly what that
 *   measures.
 * - `apca_rejection_rate` — one event per rejected publish; a rising rate
 *   is an owner-facing UX problem, not validation doing its job, per the
 *   guideline's own framing.
 * - `publish_rate_limit_hits` — one event per limiter rejection, tagged by
 *   which limiter (`scope: 'site' | 'account'`).
 * - `store_adapter_error_rate` — one event per failed `store.publish()`
 *   call, tagged by the adapter's constructor name.
 *
 * The other two need a layer step 15 deliberately does not build yet (§4):
 * `edge_cache_hit_ratio` needs a cache in front of the read path, and
 * `snapshot_row_count` needs something actually counting rows per site —
 * neither exists in v0.1. A consumer that adds either layer emits these
 * itself through the same `MetricEvent` shape once it exists, rather than
 * this package guessing at a cache it doesn't implement.
 */

export interface MetricEvent {
  name:
    | 'publish_latency_ms'
    | 'apca_rejection_rate'
    | 'publish_rate_limit_hits'
    | 'store_adapter_error_rate'
    | 'edge_cache_hit_ratio'
    | 'snapshot_row_count';
  value: number;
  tags?: Record<string, string>;
}

export type MetricsEmitter = (event: MetricEvent) => void | Promise<void>;

/** The default — see the module doc comment. */
export const noopMetricsEmitter: MetricsEmitter = () => {
  // Intentionally empty.
};
