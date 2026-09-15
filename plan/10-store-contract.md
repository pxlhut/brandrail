# Step 10 — Store: the contract

| | |
|---|---|
| **Depends on** | 03 |
| **Unlocks** | 11, 12, 13, 14 |
| **Output** | `brand-store/src/contract/` (`index.ts`, `errors.ts`, `capabilities.ts`, `rules.md`) |
| **Size** | half a day of writing, a day of thinking |

## Why this step exists

Guideline §12 makes the key architectural argument: everything in §2–§11
assumes Postgres with a specific table shape, but the actual requirement
is narrower than "use these three tables". It is:

> *config writes and published reads are separate, publish is atomic,
> versions are monotonic, checksums dedupe.*

Express that as an interface, ship it with zero database dependency, and
let each database/ORM satisfy it its own way. That's why "bring your own
stack" is one of the four pillars — and it's the reason not to write seven
adapters (D10).

Get this interface wrong and every adapter, plus the conformance suite,
changes together.

## Prerequisites

- Guideline §12 (the interface as first drafted), §7 (what `publish` must
  guarantee), §22 (optimistic concurrency), §23 (how to evolve this
  safely), §2 (the reference schema)
- `DECISIONS.md` D1 (`site_id`), D7 (`cssSha256`), D8
  (`sourceConfigVersion`), D9 (capabilities)

## Build

Start from §12's draft and apply the decisions. Changes from the original:

```ts
export interface BrandThemeStore {
  readonly capabilities: StoreCapabilities;

  getConfig(siteId: string): Promise<BrandConfig | null>;

  // D8/§22: optimistic concurrency is not optional
  saveConfig(
    siteId: string,
    patch: Partial<BrandConfig>,
    expectedVersion: number
  ): Promise<BrandConfig>;

  // MUST be atomic: serialize per site, assign the next version, write the
  // snapshot and flip the active pointer as one unit — or reject entirely.
  // Every guarantee in §7 lives in this one method.
  publish(
    siteId: string,
    input: PublishInput,
    opts?: { expectedConfigVersion?: number; idempotencyKey?: string }
  ): Promise<Snapshot>;

  getActiveSnapshot(siteId: string): Promise<Snapshot | null>;
  listSnapshots(siteId: string, opts?: { limit?: number }): Promise<Snapshot[]>;
  rollback(siteId: string, snapshotId: string): Promise<void>;

  createPreview(siteId: string, input: PreviewInput): Promise<Preview>;
  getPreview(previewId: string): Promise<Preview | null>;
}

export interface PublishInput {
  tokens: TokenTree;
  cssText: string;
  checksum: string;        // hash of tokens — dedupe (§7 step 3)
  cssSha256: string;       // hash of cssText — the CSP header (D7)
  publishedBy?: string;
}

export interface StoreCapabilities {
  atomicPublish: 'transactional' | 'serialized' | 'none';  // D9
}
```

`checksum` and `cssSha256` are different things and both belong on the
snapshot. Anyone who conflates them will produce a CSP header that doesn't
match the served CSS, which fails closed and is confusing to debug.

### Errors — a typed hierarchy

Adapters must throw the *same* errors or callers can't handle them
portably. This is the most common way a multi-adapter contract rots.

```ts
export class ConflictError extends StoreError {}      // §22 stale version
export class NotFoundError extends StoreError {}
export class VersionConflictError extends StoreError {} // concurrent publish
export class NotSupportedError extends StoreError {}    // §23 optional method
```

The conformance suite asserts the error *type*, not a message string.

### Contract rules that aren't expressible in TypeScript

Write these as doc comments on the interface, and make each one a
conformance test in step 11. An adapter author reads this file; the
comments are the spec.

1. **`publish` is atomic.** Either the snapshot row and the active pointer
   both exist, or neither does. Never an inserted snapshot without an
   active pointer, never a pointer to a rolled-back transaction (§7 step 4).
2. **Versions are monotonic per site**, starting at 1, with no gaps and no
   duplicates, even under concurrent publishes (§7 step 4).
3. **Identical checksum is a no-op.** If the incoming checksum equals the
   currently-active snapshot's, return the existing snapshot successfully
   without writing a row (§7 step 3).
4. **`saveConfig` with a stale `expectedVersion` throws `ConflictError`**
   and writes nothing (§22).
5. **`getActiveSnapshot` returns `null` for an unknown site** — never
   throws. §20 makes "provisioned site with no snapshot" impossible, but
   unknown sites (deleted, typo'd domain) are real, and the caller renders
   the platform default.
6. **`rollback` flips the pointer only.** It never regenerates — that's
   the entire point of §6. Rolling back must produce byte-identical CSS to
   what was originally published, even if the algorithm has changed since.
7. **Previews are never promotable directly.** `createPreview` writes to a
   separate store; "promote this preview" re-runs the full publish pipeline
   (§11). A preview link outliving its use must not be able to become the
   live theme.

### Evolving this later — §23's rules

You are asking outside developers to write adapters. If this interface
grows a new *required* method, every existing adapter breaks at once on
upgrade. Two rules, in the file, as comments:

- New capabilities are **optional** methods with a default on a
  `BaseBrandThemeStore` class — a no-op or a `NotSupportedError`. Never a
  required addition.
- This package follows strict semver; adapters declare a `peerDependency`
  on it, so an incompatible pairing is an install-time warning rather than
  a runtime crash. The conformance suite is pinned per major version.

Ship `BaseBrandThemeStore` in this step, even though it does almost
nothing yet. Adding it later means every adapter has to change its
`extends` clause.

## Acceptance

- [ ] Interface compiles with zero database imports — check `package.json` has no db dependency at all
- [ ] Every method uses `siteId` (D1)
- [ ] `PublishInput` carries both `checksum` and `cssSha256`, documented as distinct
- [ ] `capabilities.atomicPublish` is required, not optional (D9)
- [ ] The seven contract rules are doc comments on the relevant methods
- [ ] `BaseBrandThemeStore` exists and throws `NotSupportedError` for future optional methods
- [ ] The error hierarchy is exported and every class is distinguishable via `instanceof`

## Out of scope

Any implementation — steps 12 and 14. The conformance suite — step 11. The
service layer that calls this — step 13.

## Notes for step 11

Each of the seven contract rules becomes at least one conformance test.
Write the rules and the tests in the same sitting if you can — a rule you
can't figure out how to test is usually a rule that's ambiguous.

## Notes from step 14 — a contract ambiguity this file left implicit

`siteId: string` says nothing about *format*, and the conformance suite's
own fixtures (`freshSiteId()`) deliberately mint ids shaped
`site-<uuid>`, not bare UUIDs — proving the contract treats `siteId` as an
opaque caller-supplied string, never a value the adapter may parse,
validate, or constrain. `LucidBrandThemeStore` first typed `site_id` as a
Postgres `uuid` column with a foreign key into `sites.id` (guideline
§38's own literal DDL), and the conformance suite's atomicity test failed
immediately with `invalid input syntax for type uuid`. See `DECISIONS.md`
D12 for the fix. Written back here because every future relational
adapter will reach for the same `uuid` + FK design guideline §2/§38
suggests, and hit the same failure, unless this file says not to:

**Rule 8 (added): a site's `siteId` has no required relationship to a
`sites` table row.** `saveConfig`'s very first call for a site *is* how
its config comes into existence (§22, this file's own text above) — there
is no separate provisioning step, so an adapter cannot require a matching
`sites` row to already exist before a config or a publish can happen. Any
`sites`/`accounts` schema an adapter ships (guideline §38) is for a host
app's own site/account management; it is not load-bearing for the store
contract and must not gate `saveConfig`, `publish`, or `createPreview`
with a foreign key.
