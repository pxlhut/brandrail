# Step 13 — Service: tiers, publish, rate limits

| | |
|---|---|
| **Depends on** | 12, 06, 07 |
| **Unlocks** | 14, 15, 16 |
| **Output** | `brand-store/src/service/features/{authoring,publishing,provisioning,access,limits,events}/` |
| **Size** | two days. Second-hardest step after 04. |

## Why this step exists

This is where the **control-tier model** — the one pillar no npm package
has attempted, the actual moat — becomes enforcement rather than a data
shape. It's also where guideline §7 (atomic publish), §9 (tier
enforcement), §18 (merge), §21 (role checks), §24 (rate limits) and §28
(idempotency) all meet.

Guideline §9 makes the critical point: `control_config` must gate **the
API that accepts owner edits, not only hide and show controls
client-side** — otherwise a bypassed UI or a direct API call writes beyond
what the developer configured. A tier model enforced only in React is not
a tier model.

## Prerequisites

- Steps 06 (generate + violations), 07 (validator), 12 (a store to test against)
- Guideline §7, §9, §18, §21, §24, §28
- `DECISIONS.md` D7 (CSP hash), D8 (config version pinning)

## Build

Plain async functions taking a `siteId` and plain data. **No framework
types** — guideline §15 is emphatic: the moment this imports Express,
Fastify, Adonis or NestJS request/response or DI types, it stops being
backend-agnostic. Each framework's controller is a thin caller.

### `saveDraft(siteId, patch, ctx)`

Two separate checks, **in this order** (§21 — these are different
questions and both must run):

1. **Role check.** Is this user allowed to edit this site at all?
   Owner/editor/viewer scoped to the site. §21 suggests a
   `site_members(site_id, user_id, role)` table if the platform doesn't
   already have one. The service takes an injected `authorize` callback
   rather than owning the table — the platform usually already has
   identity.
2. **Tier check** (§9), per field, from the site's own `control_config`:
   - **Locked** → reject the write outright.
   - **Guided** → accept only values from the declared slider range or
     select enum. Not arbitrary strings.
   - **Direct** → accept, then run step 07's validator for the field's type.
   - **Raw** → accept, and **still** run step 07's validator (§19, §32 —
     "raw" means any *valid CSS value*, not any string; raw bypasses the
     contrast gate, never the syntax gate).

Then `store.saveConfig(siteId, patch, expectedVersion)` — surface
`ConflictError` to the caller rather than swallowing it (§22). Whether the
UI silently refetches or prompts is a product decision; the service's job
is making the conflict detectable.

Server-side rate limit: 1 write/second per site (§24). The 400 ms client
debounce is the primary defence; this is the backstop for when a
client-side bug removes it.

### `publishTheme(siteId, ctx, opts)`

Guideline §7's pipeline, in order. Every step matters:

1. **Role check**, as above.
2. **Rate limit** — 10 publishes / 5 minutes per site (§24), plus a
   per-account ceiling, since §38 lets one agency account own ten sites and
   the per-site limit alone lets them publish ten times as fast. Log
   repeated hits distinctly: as §24 notes, it's as likely to be a buggy
   auto-publish integration as abuse.
3. **Idempotency** (§28) — if `idempotencyKey` was seen in the last 24 h,
   return the cached result without re-entering the pipeline. This is
   *not* redundant with checksum dedupe: dedupe catches "same content
   published twice", idempotency catches "one request retried by the
   network before the first finished". Different failures.
4. **Read the config under lock**, capture its `version` → this becomes
   `sourceConfigVersion` (D8). If `expectedConfigVersion` was supplied and
   doesn't match, reject — don't ship a draft the owner never saw whole.
5. **`generateTheme(config)`** (step 06), producing tokens and
   `violations`.
6. **If `violations` is non-empty, reject with field-level errors.** §7 is
   explicit: do **not** silently auto-correct here. Auto-correction belongs
   at edit time in the guided tier. A silent fix at publish means the
   owner's saved colour isn't what shipped — and they'll find out from a
   customer.
7. **Serialize** (step 08) → `cssText`. Compute `checksum = hash(tokens)`
   and `cssSha256 = sha256(cssText)` (D7). The crypto lives here, not in
   core.
8. **Checksum dedupe** (§7 step 3) — if it matches the active snapshot,
   no-op and return success without writing a row.
9. **`store.publish(...)`** — the store owns atomicity (step 10, rule 1).
10. **After commit, not before**, emit `{ siteId, snapshotId, checksum }`
    for invalidation (§7 step 5). Emitting before commit means a consumer
    can invalidate against a transaction that then rolls back.

### `rollback(siteId, snapshotId, ctx)`

Role check, then `store.rollback`. No regeneration, ever (§6). Emit the
same invalidation event.

### `provisionSite(siteId, profileId, ctx)`

§20's invariant: generate and publish a default snapshot **in the same
transaction that creates the site**, so "no active snapshot" cannot happen
in production and no read path needs a null branch.

Also copies a `control_profiles` row into the site's own `control_config`
(§17). Note the trade-off §17 states plainly: after the copy the two are
independent, so updating a profile does not propagate. That's deliberate —
per-site customisation being first-class matters more than bulk edits
being free.

### Invalidation

An injectable emitter, not a hard dependency. §8: Postgres
`LISTEN/NOTIFY` at moderate scale, a real queue once pushing to edge KV,
because queues survive a worker restart and NOTIFY doesn't. Default to a
no-op emitter so the service works standalone.

Keep §8's fallback in the docs: treat the event as best-effort and keep a
short TTL (even 60 s) so a dropped event self-heals within a minute rather
than leaving a site on stale branding indefinitely.

## Acceptance

- [ ] Writing to a `locked` field is rejected **at the service**, with a store that would have accepted it — the test must prove the UI isn't the enforcement
- [ ] A `guided: select` field rejects a value outside its enum
- [ ] A `raw` field still runs the step 07 validator — proven with an entry from the hostile corpus
- [ ] Role check runs **before** tier check, asserted by a test where an unauthorised user targets a `direct` field and gets the role error
- [ ] Publish with contrast violations returns field-level errors and writes nothing
- [ ] Publish with an identical checksum writes no row and returns success
- [ ] A repeated `idempotencyKey` returns the cached result without re-running generation
- [ ] `sourceConfigVersion` is recorded; a stale `expectedConfigVersion` rejects
- [ ] The invalidation event fires **after** commit — tested by failing the transaction and asserting no event
- [ ] Rate limits enforce per site and per account
- [ ] `provisionSite` leaves a site with an active snapshot, always
- [ ] Zero framework imports (§15) — grep the built output

## Out of scope

HTTP routes — those are consumer-side snippets (§15), documented in step
18. The Lucid adapter — step 14. Delivering CSS to a page — step 15.

## Notes for step 14

The Lucid adapter only implements `BrandThemeStore`. If you find yourself
wanting tier logic in it, that logic belongs here instead — the check lives
in one service, not duplicated per adapter (§9).
