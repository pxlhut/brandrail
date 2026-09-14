# Decisions

Architecture decisions for the brand-tokens package suite. Each entry is
context → decision → consequence.

These resolve contradictions and gaps found while validating
[`docs/multi-tenant-theming-guideline.md`](docs/multi-tenant-theming-guideline.md)
(§1–§39). **Where a decision and an older passage of that document
disagree, the decision wins and the passage is a bug.**

Decided 2026-09-14 unless noted. Superseding a decision means adding a new
entry that says so — never editing one in place, because the step files in
[`plan/`](plan/) cite them by number.

| | Decision | Status |
|---|---|---|
| D1 | `site_id` everywhere | decided |
| D2 | The npm scope is `@pxlhut` | decided |
| D3 | Gamut target is sRGB | decided |
| D4 | 12-step ramp at fixed OKLCH lightness | decided |
| D5 | The APCA role→Lc table | decided |
| D6 | Dark mode is derived, not authored | decided |
| D7 | Inline CSS with a hash-based CSP | decided |
| D8 | Publish pins the config version | decided |
| D9 | Adapters declare their atomicity | decided |
| D10 | Four packages for v0.1 | decided |
| D11 | Sidebar roles are first-class, extending D5 | decided |

---

## D1 — `site_id` everywhere

**Context.** §2's DDL keyed every table on `tenant_id references
tenants(id)`. §38 then introduced `accounts` / `sites` and said, in prose,
*"tenant_id throughout this doc means site_id here"* — but never updated
the DDL, and §12's interface still read `getConfig(tenantId: string)`.

This was the highest-cost inconsistency in the document. It is baked into
every store adapter, the conformance suite, and every migration file that
ships. Two adapter authors reading §2 and §38 would have picked different
column names, and the mismatch would only surface when someone tried to
use both.

**Decision.** `site_id` is the identifier, everywhere, in schema and in
code.

- A **site** is the unit that has a theme — one domain, one brand.
- An **account** owns one or more sites. An agency managing ten client
  brands is one account with ten sites (§38).
- "Tenant" survives only as prose and UI copy, where it reads more
  naturally to a business audience. It is never an identifier.

**Consequence.** Applied to §2, §5, §11, §12, §17, §21, §22, §38 of the
guideline. `tenant_members` became `site_members`; `[data-tenant-theme]`
became `[data-site-theme]`. The guideline now carries a vocabulary note at
the top. Nothing in the codebase may be named `tenantId`; step 03's
acceptance criteria check for it.

Rate limiting now has two ceilings rather than one, because §38 lets one
account own ten sites and a per-site limit alone lets that account publish
ten times as fast (see §24 and step 13).

---

## D2 — The npm scope is `@pxlhut`

**Context.** `brand-tokens`, `brand-kit` and `tenant-theme` were all
unclaimed on npm as of 2026-09-14. Unscoped generic names were rejected:
they attract squatting disputes, can't be reorganised later, and give no
room for the three sibling packages.

**Decision.** `@pxlhut`. The four packages are:

```
@pxlhut/brand-core
@pxlhut/brand-store          (+ /conformance, /memory, /service)
@pxlhut/brand-store-lucid
@pxlhut/brand-editor
```

**Consequence.** The scope was unregistered on npm as of 2026-09-14 — the
org has to be created before the first publish, and publishing requires
`--access public` on a scoped package or npm defaults it to restricted.
Step 18's pre-publish checklist covers both.

`@appifylab` was the alternative (the org already exists and matches the
domain this is being built under) and was not taken.

Renaming a scope after v0.1 is a hard break for every consumer, so this is
settled now rather than at release.

---

## D3 — Gamut target is sRGB

**Context.** OKLCH expresses colours outside sRGB trivially. Take a
saturated brand hex, raise its lightness for a hover state, and you are
routinely outside sRGB — where browsers clip differently and two visitors
see two different brands. The guideline never mentioned gamut at all.

**Decision.** Map every generated colour into **sRGB**, by chroma
reduction holding L and H constant — the CSS Color 4 algorithm, available
as `culori`'s `toGamut`. Emit `oklch()` syntax for authoring clarity, but
guarantee the value is inside sRGB so every display agrees.

**Consequence.** One mandatory step in the pipeline that everything
producing a colour must pass through; an unclamped colour reaching the
serializer is the bug this exists to prevent. Step 09 asserts it holds for
1,000 random inputs.

Wide-gamut P3 output is a later, additive feature — a second serializer
target, not a change to the engine. Explicitly not v0.1.

---

## D4 — 12-step ramp at fixed OKLCH lightness

**Context.** Part of the larger gap that `generateTheme()` was referenced
eleven times across 39 sections and defined nowhere. The ramp shape is the
first thing that has to be pinned.

**Decision.** A **12-step ramp at fixed OKLCH lightness stops**, the shape
Radix uses.

**Consequence.** Fixed stops are what make D5's contrast guarantee
*provable*: step 12 against step 1 behaves the same regardless of what
brand colour came in. The alternative — deriving the lightness curve from
the input colour's own L — produces output that feels more "on brand" but
makes every contrast guarantee input-dependent and much harder to test.

The light and dark ramps use **different** stops (see D6); dark is not a
mirror of light. Step 04 owns the actual values and the chroma envelope.

---

## D5 — The APCA role→Lc table

**Context.** The single most load-bearing missing piece of the
`generateTheme()` spec. **This table is the accessibility guarantee** —
without it, "APCA-validated" is a marketing claim with nothing behind it.

**Decision.** These are the minimum contrasts every generated theme must
satisfy, in both light and dark mode.

| Foreground | on Background | Min \|Lc\| | Rationale |
|---|---|---|---|
| `foreground` | `background` | 90 | body text |
| `card-foreground` | `card` | 90 | body text |
| `popover-foreground` | `popover` | 90 | body text |
| `primary-foreground` | `primary` | 75 | button label, larger/bolder |
| `secondary-foreground` | `secondary` | 75 | button label |
| `accent-foreground` | `accent` | 75 | button label |
| `destructive-foreground` | `destructive` | 75 | button label |
| `success-foreground` | `success` | 75 | button label |
| `warning-foreground` | `warning` | 75 | button label |
| `info-foreground` | `info` | 75 | button label |
| `muted-foreground` | `background` | 60 | secondary text, non-body |
| `ring` | `background` | 45 | focus indicator, non-text UI |
| `border` | `background` | 15 | minimum discernible boundary |
| `input` | `background` | 15 | minimum discernible boundary |

**These are floors, not targets.** Overshooting is fine; undershooting
fails the build.

**Consequence.** APCA is polarity-aware — `Lc` is positive for
dark-on-light and negative for light-on-dark, and the magnitudes are not
interchangeable. Always compare `Math.abs(lc)`, and always pass foreground
and background in the right order; swapping them is not a sign flip, it is
a different number.

Step 09's property test asserts every row holds for 1,000 seeded random
brand colours. Expect the first run to fail, and expect the failures to
cluster in the yellow-hue region, where sRGB's lightness ceiling makes
`warning-foreground` genuinely hard. That clustering is the signal for
which part of the chroma envelope to tune.

---

## D6 — Dark mode is derived, not authored

**Context.** §25 defined the light/dark token *shape*
(`TokenValue = string | { light, dark }`) but never said where the dark
values come from.

**Decision.** Derived, from the same brand colour, by running the same
pipeline with its own lightness stops and the same D5 floors. **The owner
picks one brand colour and gets both modes.** They never author a second
palette.

**Consequence.** Every step that generates a colour generates two. Build
it in from step 04 rather than retrofitting — §25 is right that
retrofitting changes the shape of every stored snapshot, which is a real
migration rather than an additive change.

Do **not** derive dark by inverting light. Perceived contrast on dark
grounds behaves differently, which is exactly why APCA is polarity-aware
and WCAG 2 isn't.

---

## D7 — Inline CSS with a hash-based CSP

**Context.** §3 says inline the precompiled `css_text` into `<head>`,
which is right for first paint. But an inline `<style>` needs either
`'unsafe-inline'` in the Content-Security-Policy — which weakens the whole
page — or a hash.

**Decision.** Inline, **with a hash-based CSP**. `css_text` is computed
once at publish time and never changes, so its SHA-256 is computed then
and stored on the snapshot row. The server emits
`style-src 'sha256-<stored>'`.

**Consequence.** `brand_theme_snapshots` gains a `css_sha256` column
alongside `checksum`. These are **different hashes over different
things** and both are load-bearing:

- `checksum` hashes the **token tree** → publish dedupe (§7 step 3), cache
  invalidation (§8).
- `css_sha256` hashes the **serialised CSS** → the CSP header.

Conflating them produces a header that doesn't match the served bytes,
which fails closed and is unpleasant to debug.

This is also the layer that turns a missed validation bug in the raw-tier
validator from stored XSS into a blocked stylesheet. It costs one column
and one header — cheap insurance on the one part of the system that
accepts tenant-authored strings and inlines them into every visitor's
page.

The hash is computed in the service layer, not in core: core has no crypto
and no Node built-ins by design. Core exports the exact byte string that
must be hashed, so the hash is over what actually ships rather than a
re-serialisation of it.

---

## D8 — Publish pins the config version

**Context.** §7 locks `brand_configs … for update`, which serialises
concurrent *publishes*. §22 adds an optimistic `version` column, which
serialises concurrent *draft saves*. Neither referenced the other, so this
sequence was legal:

1. Admin A's save (version 4 → 5) begins.
2. Publish starts, acquires the row lock, reads version 4.
3. Publish snapshots and ships content the owner never saw whole.

**Decision.** Publish reads the config `version` under the lock and writes
it onto the snapshot as `source_config_version`. The publish API accepts
an optional `expectedConfigVersion`; when supplied and stale, publish
rejects rather than shipping.

**Consequence.** `brand_configs` carries `version int not null default 1`;
`brand_theme_snapshots` carries `source_config_version`. The stored column
also makes "which draft produced this snapshot?" answerable during support
work, which it previously wasn't.

---

## D9 — Adapters declare their atomicity

**Context.** §16's conformance suite is meant to verify atomic publish.
Concurrency assertions are flaky or meaningless against SQLite and
in-memory stores, so one suite either couldn't run everywhere or passed
vacuously — and a vacuous conformance suite is worse than none, because it
confers false confidence.

**Decision.** Every adapter exports
`capabilities: { atomicPublish: 'transactional' | 'serialized' | 'none' }`.
The suite runs strict concurrency tests only at the level claimed, **and
fails any adapter that claims more than it delivers.**

| Declared | Suite runs |
|---|---|
| `transactional` | Full concurrency: N parallel publishes, exactly one wins per intent, no torn state |
| `serialized` | Sequential ordering only; parallel assertions skipped |
| `none` | Only that the adapter documents the limitation; fails if it claims otherwise |

**Consequence.** The over-claim check is what makes the declaration
meaningful rather than decorative — an adapter can't earn a
`transactional` badge by writing the word in a config object. Step 12
verifies this deliberately: claim `transactional` on the in-memory
adapter, watch the suite fail, revert.

---

## D10 — Four packages for v0.1

**Context.** §13 listed seven store adapters, §27 counted "roughly ten
packages", §37 added two more — thirteen packages, a conformance suite and
a monorepo, for a v0.1 with no users. Each is a package that must be
versioned, tested in CI against the conformance suite, and supported
forever.

Competitive research found this is a common failure mode in this space:
packages that describe an ambitious surface and ship a fraction of it.

**Decision.** Four published packages.

| Package | What |
|---|---|
| `brand-core` | The generator, validator and serializers. Browser-safe, pure, two dependencies. |
| `brand-store` | The contract, with `/conformance`, `/memory` and `/service` as subpath exports rather than separate packages. Zero database dependency. |
| `brand-store-lucid` | AdonisJS. The first real consumer, and the dogfooding path. |
| `brand-editor` | The settings UI — headless hook plus a shadcn-registry component. |

`brand-editor` was in none of the original planning documents and is
added deliberately: §33 defines thirteen fields across four tiers, and
without it every consumer hand-builds that form — which *is* the
white-label feature their customers see.

**Everything else is demand-driven:** Prisma, Drizzle, Kysely, TypeORM,
Sequelize, Knex, Mongoose, email output (§37), PDF output (§37), edge KV
(§4 tier 3), multi-region (§30).

**Consequence.** This cut is only defensible because the conformance suite
makes later adapters cheap — a Prisma adapter becomes a weekend for
anyone, including us. **The suite is the thing that lets us not write six
adapters**, so it is not optional and not deferrable.

One deviation from §13 follows from this: §13 suggests building the Knex
adapter first and having Lucid wrap it, since Lucid is built on Knex. With
no Knex adapter in v0.1 that costs more than it saves, so Lucid is written
directly, with transaction handling kept in a small internal module a
future Knex adapter can lift.

---

## D11 — Sidebar roles are first-class, extending D5

*Added 2026-09-14 during step 03. This **extends** D5's table; it does not
supersede it.*

**Context.** Step 03's `ColorRole` union, as drafted, covered exactly the
role pairs named in D5. But shadcn ships a sidebar block —
`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`,
`--sidebar-primary-foreground`, `--sidebar-accent`,
`--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` — and
step 08's acceptance criterion is that **every** pinned shadcn variable
appears in the output.

A theme that omits them makes the shadcn sidebar component render
unstyled. That is exactly the "a missing `--sidebar-ring` is a visible bug
in someone's app" failure step 08 warns about, and it would have surfaced
at step 08 with steps 04–06 already built against a `ColorRole` union that
had nowhere to put the values.

**Decision.** The eight sidebar roles are part of `ColorRole`, generated
like any other, and D5's contrast table gains four rows:

| Foreground | on Background | Min \|Lc\| | Rationale |
|---|---|---|---|
| `sidebar-foreground` | `sidebar` | 90 | body text |
| `sidebar-primary-foreground` | `sidebar-primary` | 75 | button label |
| `sidebar-accent-foreground` | `sidebar-accent` | 75 | button label |
| `sidebar-ring` | `sidebar` | 45 | focus indicator |

`sidebar-border` is structural and takes the same Lc 15 floor as `border`,
measured against `sidebar` rather than `background`.

**Consequence.** Steps 04 and 05 fill eighteen more role slots than the
step files describe. The sidebar surface derives from the neutral ramp
with a small offset from `background`, so it reads as a distinct surface
without becoming a second accent.

Step 09's property test covers these rows like any other — they are not a
lesser tier of guarantee.

**Also noted in step 03:** guideline §33 has thirteen table *rows* but
**fourteen fields** — `headingFont` and `bodyFont` share a row. The step
file said "thirteen fields" and then listed fourteen. The registry
implements fourteen.

---

## Folder structure

Feature-based. A feature owns its types, constants, logic and tests
together, and **nothing imports a file inside another feature — only its
`index.ts`**.

Within `brand-core`, features may import `shared/` and features below them
in this order, never sideways or upward:

```
shared/
   ↑
contrast · shape · typography · validation
   ↑
palette
   ↑
semantics                      output ──→ validation (escaping)
   ↑                             ↑
theme ─────────────────────────────┘
```

Enforced by `dependency-cruiser` in CI, alongside the core purity check —
mechanically, not by review. See [`plan/02-scaffold.md`](plan/02-scaffold.md).
