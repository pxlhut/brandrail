# Step 18 — Release: docs and v0.1.0

| | |
|---|---|
| **Depends on** | all |
| **Output** | published packages, a README that doesn't overclaim |
| **Size** | two days |

## Why this step exists

The competitive research found a specific, repeated failure in this
space: packages that describe an ambitious surface and ship a fraction of
it. `@bernankez/theme-generator` calls its own API unstable and hasn't
shipped since 2024. `react-tenant-theme` sits at v0.1.2 with a roadmap
longer than its feature list.

You are shipping four packages against a plan that described thirteen.
**The README has to be honest about that or it reads like the same
thing.**

## Prerequisites

Steps 01–17 complete. Every proof in step 09 green. Conformance green
against both adapters.

## Build

### The README, claim by claim

Every differentiating claim must point at a proof from step 09 or a
conformance test from step 11. **If a claim has no proof, either write the
proof or cut the claim.**

| Claim | Backed by |
|---|---|
| One brand hex → complete, gamut-mapped, APCA-validated tree | Step 09 proofs 1 and 2 — 1,000 seeded inputs |
| The platform vendor decides per field how much freedom each site gets | Step 13's tier tests, enforced at the write boundary, not the UI |
| Publish / rollback with immutable snapshots | Step 11 conformance: atomicity, dedupe, monotonic versions |
| Zero flicker, zero client JS on the read path | Step 15's end-to-end SSR test |
| Core runs anywhere — no React, no DB, no framework | Step 09 proof 4, plus core's two-dependency list |
| Your existing database works | The documented ~7-method contract plus the conformance suite |
| A settings UI that reflows from config | Step 17's recorded demo |

Lead with the `locked → direct` demo. It's the fastest possible
explanation of the one thing nobody else does.

### What to say plainly about v0.1

In the README, above the fold, not in a footnote:

- The editor is **React-only**.
- The reference schema is **Postgres-first**.
- **One** database adapter ships (Lucid). Others are a documented
  ~7-method interface plus a conformance suite — genuinely a weekend, and
  say so.
- Email and PDF output are **not built**. Buyers do test whether branding
  reaches transactional email and exported PDFs (§37), and it's a real
  gap — but don't claim it until it ships.

Overstating breadth is how a package with three real integrations gets
judged as having thirteen broken ones.

### Docs to write

- **Quickstart** — generate a theme from a hex, in under 20 lines.
- **The tier model** — the conceptual piece. This is the novel idea and
  it needs prose, not just an API table.
- **Writing a store adapter** — the contract, the conformance suite, and
  the capability declaration (D9). Aimed at someone on Drizzle who wants
  to be productive in an afternoon.
- **Backend snippets** (§15) — Adonis, Express, Fastify, NestJS, Koa.
  **As documentation, not dependencies.** §15 is emphatic: the moment the
  package imports a framework's request/response or DI types, it stops
  being backend-agnostic. NestJS is worth a longer note — its DI container
  can wrap `BrandThemeStore` as an injectable provider if a consumer wants
  that, but the interface still can't assume NestJS exists.
- **Migration/versioning** — how `schemaVersion` (§6) lets the algorithm
  change without invalidating history, and that old snapshots keep serving
  their original `css_text` exactly as published.
- **Security** — how raw tier is validated (step 07) and how to set the
  CSP header (D7). Consumers should not have to infer this.

### Release mechanics

Changesets for coordinated bumps across the four packages (§27). CI runs
the conformance suite against every adapter before any release goes out —
§27's point stands: a broken adapter should fail CI, not surface as a
support ticket.

Publish at **0.1.0**, not 1.0.0. The store contract will learn something
from its second real adapter, and §23's optional-method rule is easier to
honour with a 0.x escape hatch still available.

### Before you publish

- [ ] npm org `@pxlhut` created; `--access public` set on all four packages (D2)
- [ ] No `@scope` or other placeholder appears in source, docs, or `plan/`
- [ ] `LICENSE` present in every package
- [ ] `repository`, `homepage`, `keywords` set on all four
- [ ] `files: ["dist"]` — don't ship `src` and tests
- [ ] Install each package into a clean project and run the quickstart
- [ ] The recorded demo is embedded at the top of the README

## Acceptance

- [ ] Every README claim maps to a named test
- [ ] v0.1 limitations stated above the fold, not buried
- [ ] All four packages published and installable from a clean project
- [ ] Quickstart works verbatim in a fresh Next.js app
- [ ] Adapter-authoring doc is complete enough to write a Drizzle adapter from
- [ ] CI gates release on the full conformance matrix

## Deliberately not in v0.1

Recorded here so the next session doesn't wonder whether they were
forgotten. Each is demand-driven (D10).

Prisma · Drizzle · Kysely · TypeORM · Sequelize · Knex · Mongoose
adapters · email output (§37) · PDF output (§37) · edge KV read path
(§4 tier 3) · multi-region (§30) · non-React editor · the "re-apply
profile" bulk action (§17's own open question — and it may never be
needed, since per-site edits are expected to be rare).
