# Step 12 — Store: in-memory reference adapter

| | |
|---|---|
| **Depends on** | 11 |
| **Unlocks** | 13, 16 |
| **Output** | `brand-store/src/memory/` → `@pxlhut/brand-store/memory` |
| **Size** | half a day |

## Why this step exists

Three jobs, in order of importance:

1. **It proves the conformance suite is satisfiable.** If a from-scratch
   in-memory implementation can't pass, the contract is over-specified and
   step 10 needs revisiting — cheaper to discover here than in the Lucid
   adapter.
2. **It unblocks steps 13 and 16.** The service layer and the editor both
   need *a* store; neither should need a database to develop or test
   against.
3. **It's the reference implementation adapter authors read.** Keep it
   short and obvious.

Mechanical step. Don't overthink it.

## Prerequisites

Steps 10 and 11 complete.

## Build

Four `Map`s mirroring guideline §2's four tables: configs, snapshots,
active pointers, previews. Everything keyed by `siteId` (D1).

```ts
export class MemoryBrandThemeStore extends BaseBrandThemeStore {
  readonly capabilities = { atomicPublish: 'serialized' as const };
}
```

**Declare `serialized`, not `transactional`** (D9). A single-threaded
in-memory store genuinely serialises but has no transaction to roll back.
Over-claiming here would be caught by the suite — which is a good thing to
verify deliberately: temporarily claim `transactional`, watch the suite
fail, then set it back. That confirms step 11's most important test
actually works.

### Things that are easy to get subtly wrong

- **Publish must be genuinely serialised per site.** JavaScript is
  single-threaded but `publish` is `async` — an `await` inside it yields,
  and two interleaved calls can both read `max(version)` before either
  writes. Hold a per-site promise chain (a simple mutex keyed on `siteId`)
  around the whole read-compute-write sequence. This is the exact bug the
  conformance test exists to catch, and the in-memory adapter is the
  easiest place to write it accidentally.
- **Deep-clone on read.** Return copies, not references into the `Map`. A
  caller mutating a returned `Snapshot` must not corrupt the store — and
  the editor in step 16 will absolutely do this by accident.
- **Snapshots are append-only.** Never update a stored snapshot. Rollback
  writes only the active pointer.
- **Preview expiry.** §11 defaults `expiresAt` to 7 days. `getPreview`
  returns `null` past expiry. Take the clock as a constructor option
  (`now: () => Date`) so tests control it rather than sleeping.

### Optional, useful

A `seed(fixtures)` helper and a `dump()` for debugging. Both make step 16's
editor development far pleasanter. Keep them off the `BrandThemeStore`
interface — they're adapter extras, not contract.

## Acceptance

- [ ] Passes the full step 11 conformance suite at `serialized`
- [ ] Deliberately claiming `transactional` makes the suite fail (verify, then revert)
- [ ] `publish` holds a per-site mutex across the whole read-compute-write sequence
- [ ] Reads return deep clones — a test mutates a returned object and asserts the store is unaffected
- [ ] Clock is injectable; preview expiry is tested without sleeping
- [ ] No dependency outside `@pxlhut/brand-store` and `@pxlhut/brand-core`
- [ ] Under ~250 lines. If it's much more, it's doing something it shouldn't.

## Out of scope

Persistence to disk. Tier enforcement (step 13 — that's the service layer,
above the store). Any real database.

## Notes for step 13

The service layer should be developed and tested entirely against this
adapter. It must never import it in production code paths — the service
takes a `BrandThemeStore`, and which one is the consumer's choice.
