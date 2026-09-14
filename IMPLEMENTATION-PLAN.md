# Brand Tokens — Validation, Competitive Position, and Build Plan

Reviewed against `archive/plan-validation.html`, `docs/visual-walkthrough.html`, and
`docs/multi-tenant-theming-guideline.md` (§1–§39), plus a survey of what's
actually shipping on npm as of September 2026.

**Bottom line:** the storage/publishing half of the plan (§2–§30) is strong
and mostly ready to build. The half the product actually sells on — the
`generateTheme()` algorithm and the control-panel UI — has never been
specified at all. And the scope has grown to ~13 packages, which is the
main risk to ever shipping. Cut to 3 for v0.1.

> **Building from this?** Don't work from this document directly — it's the
> analysis. The executable version is [`plan/`](plan/), split one step per
> file so a fresh session can pick up any step cold. Start at
> [`plan/00-README.md`](plan/00-README.md).

---

# Part 1 — Validation

## 1.1 `docs/multi-tenant-theming-guideline.md` — blocking issues

These change the shape of published artifacts or the store contract, so
they must be closed before any adapter is written.

### B1. `tenant_id` vs `site_id` — the schema contradicts itself

§2 defines every table keyed on `tenant_id references tenants(id)`. §38
then introduces `accounts` / `sites` and says, in prose, *"tenant_id
throughout this doc means site_id here"* — but the DDL in §2 was never
updated, and neither was the `BrandThemeStore` interface in §12, which
still reads `getConfig(tenantId: string)`.

This is the highest-cost inconsistency in the document because it is
baked into seven store adapters, a conformance suite, and every migration
file you ship. Two adapter authors reading §2 and §38 will pick different
column names.

**Decide now:** rename to `site_id` everywhere, including the interface
(`getConfig(siteId)`), and rewrite §2's DDL against `sites(id)`. Keep
"tenant" only as a user-facing word in docs. Cost of deciding now: an
hour. Cost of deciding after v0.1: a major version bump across the whole
`stores/*` tree.

### B2. `generateTheme()` is never specified

Thirty-nine sections cover storage, tiers, rate limits, retention, and
SSR — and the one function that is the entire product is referenced
eleven times without ever being defined. Before writing adapters, this
needs a spec covering:

- **Input contract** — one brand hex, plus guided adjustments; what
  happens for an achromatic input (`#000`, `#fff`, pure gray), where hue
  is undefined and every hue-derived decision degenerates.
- **Ramp shape** — how many steps, and how the lightness curve is
  derived. Fixed OKLCH L stops (Radix-style, 12 steps) is the safe
  default; a curve derived from the input's own L is more "on brand" but
  much harder to keep contrast-stable.
- **Chroma policy** — brand colors vary enormously in chroma. A near-gray
  brand color must not produce a ramp that looks accidentally colorful at
  the light end, and a neon brand color must not produce an unreadable
  mid.
- **Role → APCA target mapping** — an explicit table: `foreground on
  background ≥ Lc 90`, `muted-foreground ≥ Lc 60`, `primary-foreground
  on primary ≥ Lc 75`, `border ≥ Lc 15`, etc. This table *is* the
  accessibility guarantee; without it "APCA-validated" is a marketing
  claim, not a behavior.
- **Purity and determinism** — §39 explicitly relies on `generateTheme()`
  being pure so SSR can't produce a hydration mismatch. Make that a
  tested property (same input → byte-identical `css_text`, across Node
  versions), not an assumption.

### B3. Gamut mapping is entirely absent

OKLCH trivially expresses colors outside sRGB. Take a saturated brand
hex, convert to OKLCH, raise lightness for a hover state, and you are
very often outside sRGB — where browsers clip differently and two
visitors see two different brands.

Every generated color needs an explicit gamut-map step. Use CSS Color 4's
algorithm (reduce chroma, binary search, hold L and H) via `culori`'s
`toGamut`, and decide the target: sRGB for maximum consistency, or emit
`oklch()` with an sRGB `color()` fallback for wide-gamut displays. Pick
sRGB-only for v0.1 — one rendering, no surprises.

### B4. §19's raw validator is under-specified, and it is the security boundary

§19 correctly identifies that `css_text` is built by concatenating token
values, and that unvalidated raw values are an injection point. But
"accept legal CSS custom-property values" is not implementable as
written, and it misses half the threat, because the output is inlined
into **HTML**, not just CSS.

The concrete rule:

1. **Type-allowlist, don't blocklist.** Each token declares its type
   (`color | length | number | duration | font-stack`). Parse the
   incoming value with a real CSS value parser
   (`@csstools/css-tokenizer`) and assert the parse yields exactly one
   token of the declared type. Anything else is rejected.
2. **Hard-reject regardless of parse:** `;` `{` `}` `<` `>` `@` `\`
   `url(` `expression(` `/*` and any non-ASCII escape. A bare `}` closes
   the rule and lets the next value open a new selector.
3. **HTML-escape on serialization.** `<` and `&` must be escaped when
   `css_text` is inlined into `<style>`, or a token value containing
   `</style><script>` escapes the style context entirely. CSS validation
   alone does not catch this.
4. **CSP.** Inline `<style>` requires either `'unsafe-inline'` or a
   per-response hash. Since `css_text` is precomputed at publish time,
   store its SHA-256 on the snapshot row and emit
   `style-src 'sha256-…'` — cheap, and it turns a missed validation bug
   from an XSS into a blocked resource.

Font values are the sharp edge here: `font-family` is the one token type
that legitimately contains arbitrary-ish strings. §35 already says fonts
are a curated list at every tier — enforce that as *the value must be one
of the enum's exact values*, never as string validation.

### B5. Publish can snapshot a half-applied draft

§7 locks `brand_configs … for update`, which serializes concurrent
*publishes*. §22 adds an optimistic `version` column for concurrent
*draft saves*. Neither references the other, so this sequence is legal:

1. Admin A's save (version 4 → 5) begins.
2. Publish starts, acquires the row lock, reads version 4.
3. Publish snapshots and ships content the owner never saw.

**Fix:** publish reads the config version under the lock and writes it to
the snapshot as `source_config_version`. Optionally accept an
`expectedConfigVersion` on the publish API so the control panel can say
"this draft changed since you opened it" rather than silently shipping.
The stored column also makes "which draft produced this snapshot?"
answerable during support work, which it currently isn't.

## 1.2 Non-blocking gaps in the guideline

| # | Gap | Fix |
|---|---|---|
| N1 | §6 says old snapshots keep their original `css_text` — but never covers *wanting* to re-render them (a `generateTheme()` bug) | A backfill job that re-publishes affected sites at the new `schema_version` as new snapshot rows. Never mutate an existing snapshot. One paragraph. |
| N2 | §16's conformance suite can't portably test atomicity — concurrent-publish assertions are flaky on SQLite/in-memory | Have each adapter declare `capabilities: { atomicPublish: 'transactional' \| 'serialized' \| 'none' }`; the suite runs the strict concurrency tests only where claimed, and fails any adapter claiming more than it delivers |
| N3 | §35 says "self-host a curated font set" with no mechanism — a guided font select can still emit a name nothing loaded | Ship each curated font as an `@fontsource/*` dependency of the shadcn adapter, and have the adapter emit the `@font-face`/import *alongside* the `font-family` token. The failure §35 warns about is otherwise still reachable. |
| N4 | §24 rate-limits per tenant; §38 lets one agency account own ten sites | Add a per-account ceiling (e.g. 40 publishes / 5 min) above the per-site one |
| N5 | §10 (retention) and §29 (offboarding) are two separate nightly jobs | One scheduled-job module with two tasks; one place to monitor, one place to fail |
| N6 | §25 defines the light/dark token *shape* but not the *policy* — is the dark ramp derived, or separately authored? | Derived, from the same brand hex, using the same §34 pipeline with inverted L targets. State it, or every adapter guesses. |
| N7 | No RTL/logical-property note on the `shape`/spacing tokens | Emit logical properties (`border-start-start-radius`) where applicable, or state that radius is symmetric and RTL is a non-issue |
| N8 | Nothing says what a store adapter does when `getActiveSnapshot` is called for an unknown site | §20 makes "no active snapshot" impossible for *provisioned* sites; unknown-site is still a real case (deleted, typo'd domain). Contract should say: return `null`, never throw; the caller renders the platform default. |

## 1.3 `archive/plan-validation.html` — it has gone stale, and its numbers are weak

**It validates an earlier version of the plan.** Its headline finding —
*"the plan doesn't yet define how per-tenant theming stays isolated as
tenant count scales"* — is closed by guideline §4 (the tiering table) and
§5 (isolation only where two themes share a screen). The architecture
diagram's "open decision: per-tenant scope vs. per-tenant stylesheet" is
likewise settled by §3. Anyone reading this file today gets a wrong
picture of where the project stands.

**The market-signal numbers don't survive checking.** The `$278B /
16.2% CAGR / +42% retention` figures cite `aonmeetings.com` — a
video-conferencing vendor's marketing blog, not a research firm. The page
it points at **now returns 404**. The figures themselves trace back to an
unnamed "2026 market report", and the +42% retention figure is about
white-label *marketing agency services*, not SaaS product retention.

More fundamentally it's the wrong market. The TAM for this package is not
"white-label SaaS" — it's "Node/TypeScript SaaS teams who need per-tenant
branding," which is a developer-tools market measured in thousands of
teams, not billions of dollars. The white-label SaaS market size tells
you nothing about whether anyone will `npm install` this.

**Keep** the qualitative buyer-behavior findings — that branding *depth*
is an explicit evaluation criterion, that buyers test for completeness
across email/error pages/mobile, that per-tenant theming must be
configuration rather than per-customer engineering. Those are consistent
across independent sources and they are what actually justify §33's field
list and §37's email/PDF adapters.

**The prior-art table is under-researched.** `mx-design-tokens` has been
unpublished-to since April 2023 (dead). `@forgeframework/design-tokens`
is *your own package*. And the single nearest competitor —
`react-tenant-theme`, whose tagline is literally your use case — is
absent. See Part 2.

## 1.4 `docs/visual-walkthrough.html` — two real inconsistencies

1. **The config sample contradicts the schema.** The walkthrough shows
   `"options": ["Sharp", "Soft", "Round"]` (a string array). §31 and §32
   define `options: { label: string; value: string }[]`. The walkthrough
   is the document a non-technical stakeholder reads and a developer
   copies from — it should show `[{ "label": "Sharp", "value":
   "0.125rem" }]`.
2. **The field list is stale.** The walkthrough shows 8 fields; §33 is
   the reference schema with 13 (it gained `supportUrl`,
   `emailSenderName`, `neutralTone`, `buttonStyle`, `bodyFont`). Either
   regenerate from §33 or label the mockup "illustrative subset" in the
   UI itself, not only in a footnote elsewhere.

Minor: the glossary predates §17 and §38 — it should gain **Profile**
(reusable tier template, copied at provisioning) and **Site vs. Account**
(an agency account owns many sites; a site is what has a theme). Both are
now load-bearing concepts a reader will hit immediately.

---

# Part 2 — What's actually on npm

Download figures are last-30-days, pulled from the npm registry API on
2026-09-14.

## 2.1 The nearest competitor

**`react-tenant-theme`** — ~1,760 downloads/mo, v0.1.2, 3 versions,
last published 2026-02-21.

Its own tagline is *"a lightweight, production-ready theming engine for
multi-tenant React applications"* — the closest anything gets to this
plan. What it actually is: a React context provider that takes a
hand-authored array of tenants, each with hand-authored light/dark token
maps, and applies them as prefixed CSS variables. SSR-safe, no flicker,
`localStorage` persistence.

Every one of the four things this plan is built on is missing from it:

| | `react-tenant-theme` | This plan |
|---|---|---|
| Where tokens come from | You hand-write every hex, per tenant, per mode | Generated from one brand hex |
| Accessibility | None | APCA targets per role, enforced at the write boundary |
| Who controls what | Nothing — it's a config array in your source | Per-field tier model the platform vendor sets |
| Persistence | `localStorage` on the visitor's browser | Draft → publish → immutable snapshot → rollback |
| Framework | React only | Core has no framework dependency |

Its roadmap — cookie persistence, a pre-hydration script, a Tailwind
plugin, token validation — is a list of things this plan already treats
as solved or out of scope. It is a useful signal that the problem is
real, and not a serious incumbent.

## 2.2 The rest of the landscape

| Package | dl/mo | What it is | Why it isn't this |
|---|---|---|---|
| `colorjs.io` | 31.2M | Color conversion, gamut mapping | A primitive to build on |
| `chroma-js` | 12.9M | Color manipulation | Primitive; no OKLCH-first API |
| `@radix-ui/colors` | 11.8M | Hand-crafted accessible 12-step scales | Fixed palettes. Cannot accept an arbitrary brand hex — the exact problem you're solving |
| `style-dictionary` | 7.6M | Build-time token transformation, any platform | Build-time only. No runtime path; cannot serve N tenants from one build |
| `culori` | 7.1M | Color math, OKLCH, `toGamut` | **Use this** — it's the right dependency for B3 |
| `@pandacss/dev` | 1.6M | Build-time CSS-in-JS with a token dictionary | Themes compile at build time; per-tenant runtime is explicitly not its model |
| `@tokens-studio/sd-transforms` | 744k | Figma tokens → Style Dictionary | Design-time pipeline |
| `apca-w3` | 273k | The reference APCA implementation | **Use this** — it's the contrast primitive |
| `@adobe/leonardo-contrast-colors` | 59k | Contrast-ratio-driven palette generation | The generation half, done well — but WCAG2-first (APCA only behind a `wcag3` flag), and no tokens, adapters, or tenancy |
| `apcach` | 3.3k | Generate a color at a target APCA Lc | **Use or copy this** — it does exactly the "hit Lc 75" step |
| `@tokiforge/core` | 181 | Framework-agnostic runtime token engine, <3KB, a11y checks, token versioning | Architecturally the closest philosophical match, but built for *one product's* themes, not per-tenant SaaS. No persistence model, no tier model, negligible adoption |
| `shadcn-theme-provider` | 81 | Maps shadcn vars to Tailwind v4 at runtime | Runtime switching only; no generation, no tenancy |
| `@bernankez/theme-generator` | 14 | `inferThemeFromColor()` + `presetShadcn()` | Closest thing to your *core algorithm*. Self-described as unstable; untouched since Sept 2024 |
| tweakcn, shadcnstudio, ui.jln.dev, Lunchbox, shadcn.io/theme | web apps | Visual shadcn theme editors, OKLCH-based | Design-time, single-theme, one developer. Output is a CSS blob a human pastes into `globals.css`. No API, no runtime, no tenancy, no permission model |

## 2.3 The whitespace, stated precisely

Four capabilities define this product:

1. Generate a complete, contrast-validated token tree from **one brand hex**
2. A per-field **control-tier model the platform vendor owns**
3. A **draft → publish → snapshot → rollback** persistence contract
4. **Framework- and ORM-agnostic** delivery

Every package above has *at most one* of these. `@bernankez` has (1) and
abandoned it. Leonardo has a WCAG2 flavor of (1). `react-tenant-theme`
has a weak (4). Nothing on npm has (2) at all — the tier model is the
genuinely novel piece, and it is also the piece that maps to how
white-label is actually *priced* (guideline §33's closing observation).

**The honest risk:** (1), (3) and (4) are each individually commoditizable
— tweakcn could ship an API, Leonardo could add APCA, anyone can write a
store interface. The durable differentiator is (2) plus the fact that all
four ship as one coherent thing. Which means: **the control-tier model
and the control-panel UI are the product**, and they are precisely the
two parts the current documents specify least.

## 2.4 Naming

`brand-tokens` is unclaimed on npm, as are `brand-kit`, `tenant-theme`,
and `@brandkit/*`. Don't take the unscoped names — generic unscoped names
attract squatting disputes and can't be reorganized later. Publish under
a scope from day one (`@pxlhut/*` below is a placeholder for whatever
scope you own).

---

# Part 3 — Build plan

## 3.0 The scope problem, first

Guideline §13 lists seven store adapters, §27 counts "roughly ten
packages", and §37 adds two more — thirteen packages, a conformance
suite, and a monorepo, for a v0.1 with no users.

Every one of those is real eventually. None of them are real *now*, and
each one is a package that must be versioned, tested against the
conformance suite in CI, and kept compatible forever. Six ORM adapters
for zero users is how this project dies.

**Ship three packages in v0.1:**

| Package | Why it's in v0.1 |
|---|---|
| `@pxlhut/brand-core` | The generator. This is the product. |
| `@pxlhut/brand-store` | The interface + conformance suite + one reference in-memory implementation. Interface-only, so adopting it commits a consumer to nothing. |
| `@pxlhut/brand-store-lucid` | Your own stack (AdonisJS) is the first consumer. Dogfood it. |

Everything else — Prisma, Drizzle, Kysely, TypeORM, Sequelize, Knex,
Mongoose, email, PDF — waits for someone to ask. §16's conformance suite
is what makes that wait cheap: a Prisma adapter is a weekend for anyone
once the suite exists, including for you.

The one exception worth pulling *forward*, not back: **the control-panel
UI** (§3.4 below). It isn't in the current package list at all, and it's
the highest-leverage thing you can ship.

## 3.1 Phase 0 — close the blocking decisions (~1 day, no code)

Resolve B1–B5 from §1.1 as edits to the guideline:

- [ ] B1 — rename `tenant_id` → `site_id` throughout §2, §11, §12, §17, §22, §38. Keep "tenant" as a docs-only word.
- [ ] B2 — write the `generateTheme()` spec as a new section. Include the APCA role→Lc table; it's the piece everything else validates against.
- [ ] B3 — state the gamut target (recommend: sRGB, `culori.toGamut`).
- [ ] B4 — write §19 out properly: type allowlist, hard-reject character set, HTML escaping, CSP hash.
- [ ] B5 — add `source_config_version` to the snapshot table and an optional `expectedConfigVersion` to `publish()`.
- [ ] Regenerate `archive/plan-validation.html` against the current plan, or archive it with a dated header saying what it validated. Fix the two inconsistencies in `docs/visual-walkthrough.html` (§1.4).

## 3.2 Phase 1 — `@pxlhut/brand-core` (the generator)

The only package that matters. Zero runtime dependencies beyond `culori`
and `apca-w3`. No React, no database, no framework, no Node built-ins —
it must run in a browser for live preview (§3, write path step 2).

```
src/
  generate.ts      // generateTheme(input) -> TokenTree   [pure]
  color/
    ramp.ts        // brand hex -> OKLCH lightness ramp
    gamut.ts       // sRGB gamut mapping                  [B3]
    semantic.ts    // fixed hues, brand-matched L/C       [§34]
    contrast.ts    // APCA targets per role               [B2]
  shape.ts         // radius / borderWidth / density      [§32]
  validate.ts      // token value validator               [B4]
  merge.ts         // base < guided < direct < raw        [§18]
  types.ts         // TokenTree, TokenValue, ControlConfig
```

**Definition of done:**

- `generateTheme()` is pure and deterministic — a property test asserts
  byte-identical output across 1,000 random hex inputs, run twice.
- Every generated pairing in the APCA role table passes its target Lc,
  asserted for those same 1,000 random inputs. This is the test that
  makes the accessibility claim real.
- Achromatic and near-achromatic inputs (`#000`, `#fff`, `#808080`,
  chroma < 0.01) produce sane output, tested explicitly.
- Every output color is inside sRGB, asserted.
- `validate.ts` rejects the full B4 hostile-input corpus: `}`,
  `</style>`, `url(javascript:…)`, `expression()`, `@import`, CSS
  escapes, and an oversized value.
- Light and dark trees are generated from the same input (§25, N6).
- Bundle size published in the README — it's a real buying signal against
  TokiForge's advertised <3KB.

**Then, in the same package:** the three output serializers. They're a
few dozen lines each and splitting them into separate packages now buys
nothing but version-matrix pain.

```ts
toShadcnCss(tree, opts)   // :root{--primary:…} + [data-theme=dark]{…}
toTailwindTheme(tree)     // v4 @theme block / v3 config object
toCssVars(tree, opts)     // raw custom properties, configurable prefix
```

`toShadcnCss` must emit the **exact** current shadcn variable set
(`--background`, `--foreground`, `--card`, `--popover`, `--primary`,
`--secondary`, `--muted`, `--accent`, `--destructive`, `--border`,
`--input`, `--ring`, `--chart-1..5`, `--sidebar-*`, `--radius`). Pin that
list against shadcn's own docs and test it — a missing `--sidebar-ring`
is a visible bug in someone's app and the fastest way to lose trust with
this audience.

## 3.3 Phase 2 — `@pxlhut/brand-store` (contract + conformance)

Ship the interface (§12), the conformance suite (§16), and an in-memory
reference implementation that passes it. No database dependency anywhere
in this package.

Changes from §12 as written:

- `siteId` throughout (B1).
- `saveConfig(siteId, patch, expectedVersion)` (§22).
- `publish(siteId, input, opts?: { expectedConfigVersion?: number })` (B5).
- `getActiveSnapshot` returns `null` for unknown sites, never throws (N8).
- Adapters declare `capabilities.atomicPublish` (N2); the suite scales
  its concurrency assertions to the declared level and fails any adapter
  that over-claims.
- Extend via optional methods on a `BaseBrandThemeStore` only (§23).

**Definition of done:** the conformance suite covers concurrent publishes
never duplicating a version, identical-checksum publishes being a no-op,
rollback flipping the pointer without regenerating, `saveConfig` raising
`ConflictError` on a stale version, and tier enforcement rejecting a
write to a `locked` field.

## 3.4 Phase 3 — `@pxlhut/brand-editor` (the missing package)

**This is not in any of the current documents, and it should be the
second-highest priority after the generator.**

§33 defines thirteen fields across four tiers with two guided control
shapes. As the plan stands, every consumer hand-builds that settings
form — and that form *is* the white-label feature their customers see.
It's the largest chunk of work you'd be leaving on the consumer's desk,
and it's the reason someone picks this over writing 200 lines of
`react-tenant-theme` config themselves.

Two layers:

- **`useBrandEditor(controlConfig, draft)`** — headless. Returns
  per-field state, tier-aware validity, live-preview tokens
  (`generateTheme` in the browser), and the §22 conflict signal. No
  markup, no styling, no framework lock beyond React.
- **`<BrandEditor />`** — a shadcn-rendered default, distributed via a
  **shadcn registry** rather than as compiled components. That's how this
  audience expects to consume UI: `npx shadcn add
  https://yourdomain/r/brand-editor.json`, source lands in their repo,
  they restyle it freely. Shipping it as an npm component would be
  fighting the ecosystem's grain.

It renders directly from `control_config`, so a developer flipping
`semanticColors` from `locked` to `direct` in a profile (§17) changes the
owner's UI with no code change. That demo — one JSON edit, the settings
screen grows a control — is the single clearest way to show what this
package is, and nothing else on npm can do it.

## 3.5 Phase 4 — first real consumer

`@pxlhut/brand-store-lucid` (AdonisJS, §13) plus wiring it into Forge.
The point of this phase is not the adapter; it's that a real product
with real tenants exercises the publish path, the rollback path, and the
editor before any of it is public.

Expect this phase to send you back to Phase 0's decisions at least once.
That's why it comes before the other six ORM adapters, not after.

## 3.6 Phase 5 — everything else, demand-driven

In rough priority order, each gated on someone asking:

`brand-store-prisma` · `brand-store-drizzle` · edge/KV read path (§4, §8)
· `brand-tokens-email` (§37) · `brand-tokens-pdf` (§37) · remaining ORM
adapters · multi-region (§30 — already correctly deferred).

## 3.7 Repo and release

pnpm workspaces + Changesets (§27) is right, but sized to three packages,
not thirteen: `packages/core`, `packages/store`, `packages/store-lucid`.
CI runs the conformance suite against every store adapter on every PR.
Add the `packages/*` / `stores/*` split when there are enough packages to
justify the directory.

---

# Part 4 — Why ours wins, as a checklist

Each line is a claim a competitor cannot make. These are the README
bullets, and each maps to a test that must exist before the claim ships.

| Claim | Nobody else has it because | Proven by |
|---|---|---|
| One brand hex → complete, gamut-mapped, APCA-validated token tree | Radix ships fixed palettes; Leonardo is WCAG2 and token-less; `@bernankez` is abandoned | The 1,000-random-input contrast property test (§3.2) |
| The platform vendor decides per field how much freedom each tenant gets | **No npm package attempts this** | Tier enforcement at the write boundary (§9), in the conformance suite |
| Publish / rollback with immutable snapshots | Every competitor stores themes in a config array or `localStorage` | Conformance suite: atomicity, checksum dedupe, monotonic versions |
| Zero flicker, zero client JS on the read path | `react-tenant-theme` is client-side by construction | SSR test asserting the `<style>` block is in the first flushed byte |
| Core runs anywhere — no React, no DB, no framework | TokiForge is closest but has no persistence story at all | Core's dependency list: `culori`, `apca-w3`, nothing else |
| Your existing database works | Everyone else assumes you'll adopt theirs | Conformance suite + a documented ~7-method contract |
| A settings UI your tenants can actually use, that reflows from config | Every competitor stops at the token layer | The `locked → direct` live demo (§3.4) |
| Branding reaches email and PDF, not just CSS | Nobody — and buyers explicitly test for it | Deferred to Phase 5; don't claim it until it ships |

**What to be honest about in the README**: v0.1 is React-first for the
editor, Postgres-first for the reference schema, and has one store
adapter. Overstating breadth is how a package with three real
integrations gets judged as having thirteen broken ones.

---

# Open questions

- **Scope name.** `@pxlhut/*` is a placeholder throughout. Decide before
  the first publish; renaming a scope after v0.1 is a hard break.
- **Does the editor ship React-only?** A Vue/Svelte port of the headless
  hook is cheap; the shadcn registry component is inherently React. Worth
  deciding whether "framework-agnostic" applies to the editor or only the
  core, and saying so plainly.
- Carried forward from the guideline: whether a "re-apply profile" bulk
  action (§17) is ever needed.
