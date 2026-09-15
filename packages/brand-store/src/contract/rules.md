# The store contract's rules

An adapter author reads this file. The seven rules below aren't expressible
in TypeScript — they're invariants about *behaviour*, not shape — so they
live here as prose and as doc comments on `BrandThemeStore` in `index.ts`.
Each one becomes at least one conformance test in step 11's suite. If you
can't figure out how to test a rule, that's usually a sign the rule is
ambiguous, not that the test is hard.

## 1. `publish` is atomic

Either the snapshot row and the active pointer both exist afterward, or
neither does. Never an inserted snapshot without an active pointer pointing
at it; never a pointer left aimed at a transaction that got rolled back
(guideline §7 step 4).

**Why:** the read path (a visitor's page load) does one query — the active
snapshot — and never runs `generateTheme()`. If that query can observe a
"successful" publish that only half-happened, production serves a theme
nobody chose.

## 2. Versions are monotonic per site

Starting at 1, with no gaps and no duplicates, even under concurrent
publishes to the same site (§7 step 4).

**Why:** `sourceConfigVersion` (D8) and rollback both depend on version
numbers meaning something stable. A gap or a duplicate turns "what changed
between snapshot 4 and snapshot 5" into an unanswerable question.

## 3. Identical checksum is a no-op

If the incoming `PublishInput.checksum` equals the currently-active
snapshot's, `publish()` returns the existing snapshot successfully, without
writing a new row (§7 step 3).

**Why:** publishing the same theme twice — a common real action, not an
edge case — must not burn a version number or create a second, byte-identical
snapshot row. The checksum is what makes that comparison cheap and exact
instead of a serialized-JSON string diff.

## 4. A stale `expectedVersion` on `saveConfig` throws `ConflictError`

And writes nothing (§22).

**Why:** this is the whole of optimistic concurrency for the draft config.
Two admins editing the same site's theme at once must not silently clobber
each other; the second write has to know it lost the race.

## 5. `getActiveSnapshot` returns `null` for an unknown site — never throws

Guideline §20 makes "a provisioned site with no snapshot at all" impossible
in practice (a default snapshot is published in the same transaction that
creates the site). But an *unknown* site — deleted, a typo'd domain, a
request that never should have resolved here — is real, and the caller's
job in that case is to render the platform default, not to catch an
exception.

The same rule applies to `getConfig` (unknown site) and `getPreview`
(unknown or expired preview): a lookup that legitimately has nothing to
find returns `null`, not an error. `NotFoundError` is for a different case
— an operation on something the caller has already claimed exists (e.g. a
`rollback` naming a snapshot id that isn't there).

## 6. `rollback` flips the pointer only

It never regenerates — that is the entire point of guideline §6. Rolling
back must produce byte-identical CSS to what was originally published,
even if the token-generation algorithm has changed since that snapshot was
created.

**Why:** a snapshot's `cssText` is precompiled and stored precisely so that
"go back to how it looked last Tuesday" can never come out looking
different because the generator got smarter in the meantime.

## 7. Previews are never promotable directly

`createPreview` writes to a store separate from `publish()`'s. "Promote
this preview" means re-running the full publish pipeline (step 13) with
the preview's tokens as input — it is never implemented as pointing the
active pointer at preview data directly.

**Why:** a preview link is meant to expire and be disposable. If promoting
one were a pointer flip, a preview link that outlived its intended use
(forwarded, bookmarked, left in a chat) could become the live theme without
ever going through `publish()`'s checks.

## Evolving this contract later (§23)

Two more rules, not about any one method but about the contract as a
whole — also enforced as comments in `index.ts`:

- **New capabilities are optional methods**, with a default on
  `BaseBrandThemeStore` (a no-op or a `NotSupportedError`), never a new
  *required* member of `BrandThemeStore`. A required addition breaks every
  existing adapter at once on upgrade; an optional one with a sane default
  does not.
- **This package follows strict semver.** Adapters declare a
  `peerDependency` on it, so an incompatible pairing is an install-time
  warning, not a runtime crash. The conformance suite (step 11) is pinned
  per major version of this contract.
