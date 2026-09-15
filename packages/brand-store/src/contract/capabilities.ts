/**
 * D9 — every adapter declares, honestly, the concurrency guarantee its
 * `publish()` provides. Required, not optional: a conformance suite that
 * assumed one universal atomicity level either couldn't run against every
 * store (SQLite, an in-memory map) or passed vacuously against them, and a
 * vacuous conformance suite is worse than none — it confers false
 * confidence. The suite (step 11) runs a different concurrency test per
 * declared level, and **fails an adapter that claims more than it
 * delivers**: an adapter can't earn `'transactional'` by writing the word
 * in a config object.
 */
export interface StoreCapabilities {
  /**
   * | Declared | The conformance suite runs |
   * |---|---|
   * | `'transactional'` | Full concurrency: N parallel publishes to one site, exactly one wins per intent, no torn state — the version bump, the snapshot insert, and the active-pointer flip commit or roll back together. |
   * | `'serialized'` | Sequential ordering only; parallel assertions are skipped. The three writes above are not one database transaction, but the adapter itself serializes concurrent publishes for a site (an app-level lock or mutex) so they still cannot interleave. |
   * | `'none'` | Only that the adapter documents the limitation; fails if it claims otherwise. Concurrent publishes to the same site can race. |
   */
  atomicPublish: 'transactional' | 'serialized' | 'none';
}
