# Step 11 — Store: the conformance suite

| | |
|---|---|
| **Depends on** | 10 |
| **Unlocks** | 12, 14, and every future adapter |
| **Output** | `brand-store/src/conformance/suites/` → `@pxlhut/brand-store/conformance` |
| **Size** | one to two days |

## Why this step exists

Guideline §16's argument: since §7–§9's guarantees *are* the entire point
of the store, ship them as a runnable suite that takes any
`BrandThemeStore` and verifies it end to end — the same role a driver
conformance kit plays for database client libraries.

Strategically this is also what makes `DECISIONS.md` D10 safe. Cutting
from thirteen packages to four is only defensible because a Prisma adapter
becomes a weekend's work for anyone once this exists. **The suite is the
thing that lets you not write six adapters.**

## Prerequisites

Step 10 complete, including the seven contract rules as doc comments.

## Build

```ts
export function runConformanceSuite(opts: {
  name: string;
  createStore: () => Promise<BrandThemeStore>;
  reset: () => Promise<void>;
  /** Called between tests; some adapters need real clock movement. */
  teardown?: () => Promise<void>;
}): void;
```

It calls `describe`/`it` from the host test runner so an adapter author
runs it inside their own Vitest or Jest setup — no bespoke runner.

### Test groups, mapped to the contract rules

One file per contract rule under `suites/`, so a failing adapter points at
a rule rather than at a line number in a 600-line file.

**Basic round-trips** — save and read a config; publish and read the
active snapshot; list snapshots in order; create and read a preview.
Mechanical, and they catch half of all adapter bugs.

**Version monotonicity** (rule 2) — publish five different themes, assert
versions 1–5 with no gaps. Then publish concurrently and assert no
duplicate version was minted. §7 calls out the realistic trigger: a
double-click, or an auto-publish debounce firing twice.

**Checksum dedupe** (rule 3) — publish, publish again with an identical
checksum, assert exactly one row exists and the second call returned the
first snapshot successfully rather than erroring.

**Optimistic concurrency** (rule 4) — read a config at version N, save
successfully, then save again with the now-stale N and assert
`ConflictError` **and** that nothing was written. The second half matters
more than the first.

**Rollback** (rule 6) — publish v1, publish v2, roll back to v1, assert
the active pointer moved and `cssText` is byte-identical to v1's original.
This is §6's guarantee: rollback must not regenerate, so the algorithm
changing in between must not change what a rollback serves.

**Unknown site** (rule 5) — `getActiveSnapshot('does-not-exist')` returns
`null`, does not throw.

**Atomicity** (rule 1) — **gated on the declared capability (D9)**:

| Declared | Suite runs |
|---|---|
| `transactional` | Full concurrency: N parallel publishes, assert exactly one wins per intent, no torn state |
| `serialized` | Sequential ordering only; skip true-parallel assertions |
| `none` | Only assert that the adapter documents the limitation; fail if it claims otherwise |

**And fail any adapter that claims more than it delivers.** That's the
clause that makes the capability declaration meaningful rather than
decorative — an adapter can't earn a `transactional` badge by writing the
word in a config object.

**Preview isolation** (rule 7) — a preview never appears in
`listSnapshots`, and there is no code path from a preview id to
`brand_theme_active`.

### Design notes

- **No hidden state between tests.** `reset()` runs before each. An
  adapter that passes only in declaration order is a broken adapter.
- **Assert error types, never message strings.** Messages are
  implementation detail and will drift.
- **Don't test performance here.** It varies legitimately by store, and a
  flaky timing assertion will get the whole suite skipped.
- **Make failures diagnostic.** Name the contract rule in the failure
  message. Someone writing a Drizzle adapter at midnight should learn
  *which* guarantee they broke, not that assertion 34 failed.

### CI

Add the matrix to the workflow from step 02: every store adapter in the
repo runs this suite on every PR. Guideline §27's point stands — a broken
Lucid adapter should fail CI, not surface as a support ticket.

## Acceptance

- [ ] Suite is importable as `@pxlhut/brand-store/conformance` and runs under a host Vitest
- [ ] At least one test per contract rule from step 10
- [ ] Atomicity tests gate on `capabilities.atomicPublish` (D9)
- [ ] An adapter over-claiming its capability **fails** the suite — proven with a deliberately broken fixture adapter
- [ ] All assertions are on error *types*
- [ ] Failure messages name the contract rule
- [ ] `reset()` is called between every test and the suite passes in a randomised order

## Out of scope

Any real adapter — step 12 next. Tier enforcement — that's the service
layer (step 13), not the store.

## Notes for step 12

Build the in-memory adapter against this suite, red-to-green. If a test is
hard to satisfy in memory, that's usually a sign the *contract* is
ambiguous — fix step 10 rather than bending the test.
