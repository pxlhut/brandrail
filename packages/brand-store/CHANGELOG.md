# @pxlhut/brand-store

## 0.1.1

### Patch Changes

- Fix broken internal dependency ranges in the published 0.1.0 packages.

  0.1.0 was published via `npm publish` for its required first-time
  interactive/2FA step, which doesn't understand pnpm's `workspace:*`
  protocol — `@pxlhut/brand-store`, `@pxlhut/brand-store-lucid` and
  `@pxlhut/brand-editor` were published with a literal, unresolvable
  `"workspace:*"` in their `dependencies`, breaking install for everyone.
  This release re-publishes through `pnpm publish` (via this repo's own
  `changeset publish`), which correctly rewrites the workspace protocol to
  a real version range before publishing.

- Updated dependencies
  - @pxlhut/brand-core@0.1.1

## 0.1.0

### Minor Changes

- Initial public release.

  - `@pxlhut/brand-core` — generate a complete, gamut-mapped, APCA-validated design-token tree from one brand colour.
  - `@pxlhut/brand-store` — the persistence contract (draft, publish, immutable snapshot, rollback), a conformance suite, and an in-memory reference adapter. Zero database dependency.
  - `@pxlhut/brand-store-lucid` — the first real store adapter, for AdonisJS/Lucid.
  - `@pxlhut/brand-editor` — a headless React hook plus a shadcn-registry settings UI that reshapes itself from a per-field control-tier config.

### Patch Changes

- Updated dependencies
  - @pxlhut/brand-core@1.0.0
