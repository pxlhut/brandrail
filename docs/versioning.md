# Migration and versioning

Two different "version" concepts show up in this package, and they solve
different problems. Worth being precise about which is which.

## `schemaVersion` — the token-generation algorithm

`generateTheme()`'s output carries `tokens.meta.schemaVersion`
(`@pxlhut/brand-core`'s current `SCHEMA_VERSION`), and every stored
`BrandConfig`/`Snapshot` records the `schemaVersion` it was generated
under. This is what lets the colour engine improve — a better gamut-mapping
step, a revised APCA target, a new semantic hue — **without silently
rewriting history.**

The mechanism is simple because publishing already works this way: a
`Snapshot` stores its finished `cssText` at publish time and never calls
`generateTheme()` again to serve it. Bumping `SCHEMA_VERSION` changes what
a *future* `publish()` produces from a site's draft; every snapshot
published under the old schema keeps serving the exact CSS it always did,
byte for byte, until that site is re-published. A schema change is
opt-in per site, not a flag day for every tenant on the platform at once.

If you ever need to reproduce an *old* algorithm version deliberately
(auditing a historical snapshot, say), `generateTheme()` accepts an
explicit `schemaVersion` in its input rather than always assuming the
current one.

## Package versions — semver, for humans integrating this

The four packages (`@pxlhut/brand-core`, `brand-store`, `brand-store-lucid`,
`brand-editor`) are versioned together via
[Changesets](https://github.com/changesets/changesets), bumped as one
group so a compatible set is always what you get from installing all four
at their latest tags.

**v0.1.0, deliberately, not v1.0.0.** The store contract has only been
proven against one real adapter (Lucid) plus the in-memory reference —
`@pxlhut/brand-store-lucid` is what actually exercises §23's "optional
capability" rule (`StoreCapabilities`) against a real database today.
A second real adapter is likely to teach the contract something before it
earns a 1.0 guarantee, and a 0.x version keeps that escape hatch open
without breaking a documented API. Read `CHANGELOG.md` in whichever
package you depend on before bumping across a minor version while this
is true.

## The read path's own versioning concern

If you're wiring the SSR read path yourself, the cache-invalidation
question ("did this site's theme actually change since I last cached it")
is answered by `Snapshot.checksum`, not by comparing timestamps — see
[the read path doc](../packages/brand-store/src/service/features/delivery/read-path.md)
for why that matters once you add any caching layer in front of
`getActiveSnapshot`.
