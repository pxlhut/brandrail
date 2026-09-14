# Build plan — read this first

You are building an npm package suite that lets a multi-tenant SaaS
platform give each of its tenants a branded UI, where **the platform
vendor decides per field how much freedom each tenant gets**.

This directory is the build plan, split into steps. **One step per file,
in order.** Each step file is written to be picked up cold by a session
that has never seen the others — it states its own context, what it
depends on, what to build, and how to know it's done.

## How to use this as a fresh session

1. Read this file.
2. Open `STATUS.md` (create it from the template below if missing) to see
   which step is next.
3. Open that step's file. It tells you what to read before starting.
4. Do the step. Do **not** do the next step — scope creep across steps is
   how the acceptance criteria stop meaning anything.
5. Tick the step off in `STATUS.md`, note anything surprising under
   *Deviations*, and stop.

## Source documents

These are the inputs the plan was derived from. Step files cite them by
section (`§7`, `§33`, …) and you should read the cited sections rather
than the whole document.

| File | What it is |
|---|---|
| `../docs/multi-tenant-theming-guideline.md` | The main design document, §1–§39. Storage, publishing, tiers, SSR. Authoritative for everything it covers. |
| `../IMPLEMENTATION-PLAN.md` | Validation of the above, competitive research, and the phase breakdown these steps expand. |
| `../docs/visual-walkthrough.html` | Plain-language explanation of draft → publish → snapshot, and a mockup of the tenant's settings screen. Useful for understanding intent; **not** authoritative on schema details (it has two known inconsistencies, see step 01). |
| `../archive/plan-validation.html` | **Stale.** Validated an earlier version of the plan; its open questions are closed and its market figures don't hold up. Step 01 archives it. Don't build from it. |

## The product in one paragraph

A tenant's business owner picks a brand colour and a few options. The
core package turns that into a complete, contrast-validated design token
tree — an OKLCH lightness ramp, semantic colours, shape tokens, light and
dark. The platform vendor controls, per field, whether that owner gets
**locked** (can't touch it), **guided** (a slider or a curated select),
**direct** (a real value, still validated) or **raw** (no guardrails).
Edits go to a mutable draft; publishing compiles an immutable snapshot of
precomputed CSS that production serves with a lookup, never a
computation.

## What makes it different from what already exists

Four capabilities. Nothing on npm holds more than one of them. Keep these
in view — they're what every acceptance criterion is ultimately
protecting:

1. **Generate a full token tree from one brand hex** — gamut-mapped,
   APCA-validated.
2. **A per-field control-tier model the vendor owns** — enforced at the
   write boundary, not just hidden in the UI. *No npm package attempts
   this. It is the moat.*
3. **Draft → publish → immutable snapshot → rollback.**
4. **Framework- and ORM-agnostic** — core imports no framework, no ORM,
   no Node built-ins.

## Packages

Deliberately small. The temptation (and the earlier plan) was thirteen
packages; that's how this dies before it ships.

| Package | Steps | Notes |
|---|---|---|
| `@pxlhut/brand-core` | 03–09 | The generator, the validator, the serializers. Runs in a browser. Deps: `culori`, `apca-w3`. Nothing else. |
| `@pxlhut/brand-store` | 10–13 | The store contract, plus `/conformance`, `/memory` and `/service` as subpath exports rather than separate packages. Zero database dependency. |
| `@pxlhut/brand-store-lucid` | 14 | AdonisJS adapter. First real consumer. |
| `@pxlhut/brand-editor` | 16–17 | The settings UI. Headless hook + a shadcn-registry component. |

Everything else — Prisma, Drizzle, Kysely, TypeORM, Sequelize, Knex,
Mongoose, email output, PDF output, edge KV, multi-region — is
**demand-driven**. Don't build them. The conformance suite in step 11 is
what makes them cheap for anyone (including you) to add later.

> The scope is `@pxlhut` (decision D2). The npm org did not exist as of
> 2026-09-14 — create it before step 18, and publish scoped packages with
> `--access public` or npm defaults them to restricted.

## Step index

| # | Step | Depends on | Output |
|---|---|---|---|
| 01 | [Close the blocking decisions](01-decisions.md) | — | `DECISIONS.md`, guideline edits. No code. |
| 02 | [Monorepo scaffold](02-scaffold.md) | 01 | pnpm workspace, build, test, CI |
| 03 | [Core: types and the field registry](03-core-types.md) | 02 | `TokenTree`, `ControlConfig`, the §33 field list |
| 04 | [Core: the colour engine](04-core-color-engine.md) | 03 | OKLCH ramp, gamut mapping, APCA targeting |
| 05 | [Core: semantic and shape tokens](05-core-semantic-shape.md) | 04 | success/warning/error/info, radius, density |
| 06 | [Core: generateTheme and merge](06-core-generate.md) | 05 | The public entry point, light + dark |
| 07 | [Core: the value validator](07-core-validator.md) | 03 | The security boundary. Do not skip. |
| 08 | [Core: output serializers](08-core-serializers.md) | 06, 07 | shadcn CSS, Tailwind theme, raw custom properties |
| 09 | [Core: property tests and budgets](09-core-proofs.md) | 08 | The tests that make the README claims true |
| 10 | [Store: the contract](10-store-contract.md) | 03 | `BrandThemeStore`, errors, capabilities |
| 11 | [Store: the conformance suite](11-store-conformance.md) | 10 | The thing that makes adapters trustworthy |
| 12 | [Store: in-memory reference adapter](12-store-memory.md) | 11 | Passes conformance; unblocks everything else |
| 13 | [Service: tiers, publish, rate limits](13-service-layer.md) | 12, 06, 07 | Where §7/§9/§18/§21/§24/§28 actually live |
| 14 | [Store: the Lucid adapter](14-store-lucid.md) | 13 | AdonisJS + migrations |
| 15 | [Delivery: the SSR read path](15-ssr-delivery.md) | 13 | Inline CSS, CSP hash, cache invalidation |
| 16 | [Editor: the headless hook](16-editor-headless.md) | 06, 13 | `useBrandEditor` |
| 17 | [Editor: the shadcn component](17-editor-shadcn.md) | 16 | Registry-distributed UI |
| 18 | [Release: docs and v0.1.0](18-release.md) | all | Honest README, changesets, publish |

Steps 04, 07, 11 and 13 are the hard ones. Steps 02, 03, 12 are
mechanical. If you have limited time, 04 and 07 are where care pays off
most — 04 is the product, 07 is the part that becomes a CVE if you rush.

## STATUS.md template

Create this at `plan/STATUS.md` on first run:

```markdown
# Status

Scope name: (unset — see step 01)

- [ ] 01 decisions
- [ ] 02 scaffold
- [ ] 03 core types
- [ ] 04 core colour engine
- [ ] 05 core semantic + shape
- [ ] 06 core generateTheme
- [ ] 07 core validator
- [ ] 08 core serializers
- [ ] 09 core proofs
- [ ] 10 store contract
- [ ] 11 store conformance
- [ ] 12 store memory
- [ ] 13 service layer
- [ ] 14 store lucid
- [ ] 15 ssr delivery
- [ ] 16 editor headless
- [ ] 17 editor shadcn
- [ ] 18 release

## Deviations
(Anything you did differently from the step file, and why. A later step
that assumed otherwise needs to know.)
```

## Conventions that apply to every step

- **TypeScript, strict.** `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`. Fix the types; don't cast.
- **No `any` in public API surface.** Internal is negotiable, exported is not.
- **Feature-based folders.** A feature owns its types, constants, logic and
  tests together. **Nothing imports a file inside another feature — only
  its `index.ts`.** Enforced by `dependency-cruiser` in CI (step 02).
- **Tests live next to source** (`brand-ramp.ts` / `brand-ramp.test.ts`),
  Vitest. Never a parallel `__tests__` tree.
- **kebab-case filenames.**
- **`site_id`, not `tenant_id`** — see step 01, decision D1. "Tenant" is a
  word for documentation and UI copy only; it never appears as an
  identifier in code.
- **Core stays pure.** No `Date.now()`, no `Math.random()`, no `process`,
  no `fs`, no network, inside `@pxlhut/brand-core`. Step 09 tests this.
- **Never widen a step's scope.** If you find work that belongs to a later
  step, write it down in `STATUS.md` under Deviations and move on.
