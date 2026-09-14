# Step 01 — Close the blocking decisions

| | |
|---|---|
| **Depends on** | nothing |
| **Unlocks** | every other step |
| **Output** | `DECISIONS.md` at repo root, edits to the guideline, one archived file |
| **Code written** | none |
| **Size** | half a day, mostly reading and deciding |

## Why this step exists

Five contradictions and gaps in `../docs/multi-tenant-theming-guideline.md`
change the shape of published artifacts or the store contract. Each one
is cheap now and expensive later — after v0.1 they're a coordinated major
version bump across every store package at once, plus a migration for
anyone who adopted early.

Read `../IMPLEMENTATION-PLAN.md` §1.1 for the full write-up of each. This
step turns them into recorded decisions.

## Prerequisites

Read, in this order:

1. `../IMPLEMENTATION-PLAN.md` — the whole thing. It's the map.
2. `../docs/multi-tenant-theming-guideline.md` §2, §7, §12, §19, §22, §33, §38.

## Build

Create `DECISIONS.md` at the repo root. Use short ADR entries — context,
decision, consequence. One per item below. Then apply each decision as an
edit to the guideline so the two never disagree.

### D1 — `site_id` everywhere (blocker B1)

§2's DDL keys every table on `tenant_id references tenants(id)`. §38 then
introduces `accounts` / `sites` and says in prose *"tenant_id throughout
this doc means site_id here"* — but never updates the DDL, and §12's
interface still reads `getConfig(tenantId: string)`.

**Decide:** `site_id` is the identifier, everywhere, in schema and in
code. A *site* is the unit that has a theme. An *account* owns zero or
more sites. "Tenant" survives only as a word in prose and UI copy.

**Apply:** rewrite §2's DDL against `sites(id)`; update §11, §12, §17,
§22, §38 to match. Confirm §17's note that `control_profiles` is the one
table not scoped per site.

### D2 — the npm scope

`brand-tokens`, `brand-kit` and `tenant-theme` were all unclaimed on npm
as of 2026-09-14, but **do not take an unscoped generic name** — they
attract squatting disputes, can't be reorganised later, and leave no room
for the sibling packages.

**Decided: `@pxlhut`.** The org did not exist on npm as of 2026-09-14, so
it must be created before step 18, and scoped packages need
`--access public` or npm defaults them to restricted.

### D3 — gamut target (blocker B3)

OKLCH expresses colours outside sRGB trivially. Take a saturated brand
hex, raise its lightness for a hover state, and you're routinely outside
sRGB — where browsers clip differently and two visitors see two different
brands. The guideline never mentions this.

**Decide (recommended):** map every generated colour into **sRGB**, using
chroma reduction holding L and H constant (CSS Color 4's algorithm,
available as `culori`'s `toGamut`). Emit `oklch()` syntax for authoring
clarity, but guarantee the value is inside sRGB so every display agrees.

Wide-gamut P3 output is a later, additive feature — a second serializer
target, not a change to the engine. Don't take it on now.

### D4 — the ramp shape (part of blocker B2)

**Decide (recommended):** a **12-step ramp at fixed OKLCH lightness
stops**, the same shape Radix uses. Fixed stops mean the contrast
behaviour of step 11 against step 1 is stable no matter what brand colour
comes in, which is what makes the APCA guarantee in D5 provable.

The alternative — deriving the lightness curve from the input colour's
own L — produces output that feels more "on brand" but makes every
contrast guarantee input-dependent and much harder to test. Not for v0.1.

Step 04 owns the actual stop values and the chroma curve.

### D5 — the APCA role table (blocker B2, the important half)

`generateTheme()` is referenced eleven times across 39 sections and
defined nowhere. The single most load-bearing missing piece is the
mapping from semantic role pairs to minimum APCA contrast (Lc). **That
table is the accessibility guarantee** — without it, "APCA-validated" is
a marketing claim with nothing behind it.

**Decide:** record this table in `DECISIONS.md`. Step 04 implements it and
step 09 proves it holds for a thousand random inputs.

| Foreground | on Background | Min \|Lc\| | Rationale |
|---|---|---|---|
| `foreground` | `background` | 90 | body text |
| `card-foreground` | `card` | 90 | body text |
| `popover-foreground` | `popover` | 90 | body text |
| `primary-foreground` | `primary` | 75 | button label, larger/bolder |
| `secondary-foreground` | `secondary` | 75 | button label |
| `accent-foreground` | `accent` | 75 | button label |
| `destructive-foreground` | `destructive` | 75 | button label |
| `muted-foreground` | `background` | 60 | secondary text, non-body |
| `ring` | `background` | 45 | focus indicator, non-text UI |
| `border` | `background` | 15 | minimum discernible boundary |
| `input` | `background` | 15 | minimum discernible boundary |

Treat these as floors, not targets — overshooting is fine, undershooting
fails the build.

### D6 — dark mode is derived, not authored

§25 defines the light/dark token *shape* (`{ light, dark }`) but never
says where the dark values come from.

**Decide:** derived, from the same brand colour, by running the same
pipeline with inverted lightness targets and the same D5 floors. The
owner picks one brand colour and gets both modes. They never author a
second palette.

**Consequence:** every step that generates a colour generates two. Build
it in from step 04, don't retrofit — §25 is right that retrofitting this
changes the shape of every stored snapshot.

### D7 — how published CSS reaches the page

§3 says inline the precompiled `css_text` into `<head>`. That's right for
first-paint, but it interacts with Content-Security-Policy: an inline
`<style>` needs either `'unsafe-inline'` (which weakens the whole page)
or a hash.

**Decide:** inline, **with a hash-based CSP**. `css_text` is computed at
publish time and never changes, so its SHA-256 can be computed once and
stored on the snapshot row. The server emits
`style-src 'sha256-<stored>'`.

**Consequence:** the snapshot table gains a `css_sha256` column alongside
`checksum`. They are different things — `checksum` hashes the token tree
for dedupe (§7 step 3); `css_sha256` hashes the serialised CSS for CSP.
Step 10 puts both on the contract.

### D8 — publish pins the config version (blocker B5)

§7 locks `brand_configs … for update`, serialising concurrent publishes.
§22 adds an optimistic `version` column, serialising concurrent draft
saves. Neither references the other, so this sequence is legal: admin A's
save begins → publish acquires the lock, reads the pre-save version →
publish ships content the owner never saw whole.

**Decide:** publish reads the config `version` under the lock and writes
it onto the snapshot as `source_config_version`. The publish API accepts
an optional `expectedConfigVersion`; when supplied and stale, publish
rejects rather than shipping.

**Consequence:** `source_config_version` on the snapshot table also makes
"which draft produced this snapshot?" answerable during support work,
which it currently isn't.

### D9 — adapters declare their atomicity

§16's conformance suite is meant to verify atomic publish. Concurrency
assertions are flaky or meaningless against SQLite and in-memory stores,
so a single suite either can't run everywhere or passes vacuously.

**Decide:** every adapter exports
`capabilities: { atomicPublish: 'transactional' | 'serialized' | 'none' }`.
The suite runs strict concurrency tests only at the level claimed, and
**fails any adapter that claims more than it delivers**. Step 11 owns
this.

### D10 — the v0.1 package cut

§13 lists seven store adapters, §27 counts "roughly ten packages", §37
adds two more.

**Decide:** four published packages for v0.1 — `brand-core`,
`brand-store` (with `/conformance`, `/memory`, `/service` as subpath
exports), `brand-store-lucid`, `brand-editor`. Everything else is
demand-driven. Record the *reason* in `DECISIONS.md`: each package is a
thing to version, test in CI, and support forever, and the conformance
suite makes later adapters cheap for anyone to add.

## Also in this step

**Archive `../archive/plan-validation.html`.** Its headline finding — that
per-tenant isolation at scale is unaddressed — is closed by guideline §4
and §5. Its architecture diagram shows an "open decision" settled by §3.
Its market figures cite a video-conferencing vendor's marketing blog
whose page now returns 404, and the "+42% retention" number is about
white-label *marketing agency services*, not SaaS product retention.

Move it to `archive/` with a dated header saying what it validated and
when, so nobody builds from it.

**Fix `../docs/visual-walkthrough.html`.** Two real inconsistencies:

1. Its config sample shows `"options": ["Sharp", "Soft", "Round"]` — a
   string array. §31 and §32 define `options: { label, value }[]`. This
   is the document a developer copies from. Fix it to
   `[{ "label": "Sharp", "value": "0.125rem" }, …]`.
2. It shows 8 fields; §33 is the reference schema with 13. Either
   regenerate it from §33 or label the mockup "illustrative subset" in
   the page itself, not only in a footnote in a different document.

Its glossary also predates §17 and §38 — add **Profile** (a reusable tier
template, copied at provisioning) and **Site vs. Account**.

## Acceptance

- [ ] `DECISIONS.md` exists at repo root with D1–D10, each stating context, decision, consequence
- [ ] The D5 APCA table is in `DECISIONS.md` verbatim — later steps read it from there
- [ ] The guideline no longer contains `tenant_id` in any schema or interface
- [ ] The real scope name has replaced `@pxlhut` across `plan/`
- [ ] `plan-validation.html` is in `archive/` with a dated header
- [ ] `visual-walkthrough.html`'s config sample matches the §31/§32 schema
- [ ] `plan/STATUS.md` exists, step 01 ticked

## Out of scope

No code. No package.json. No directory scaffolding — that's step 02.

## Notes for step 02

The scope name from D2 is needed immediately. The D10 package list is the
workspace layout.
