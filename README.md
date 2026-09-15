# Brandrail

**Multi-tenant brand theming for platforms that white-label.** One hex
code in; a complete, gamut-mapped, APCA-validated design-token tree out —
with a per-field control model where *you*, the platform vendor, decide
how much freedom each tenant gets, enforced where the data is written,
not just in what the settings screen shows.

```bash
npm install @pxlhut/brand-core
```

```ts
import { generateTheme, toShadcnCss } from "@pxlhut/brand-core";

const { tokens, buttonStyle } = generateTheme({ brandColor: "#7c6cff" });
const css = toShadcnCss(tokens, { buttonStyle });
// :root{--background:oklch(...);--primary:oklch(...);...} — light + dark, done.
```

## The one thing nobody else does

Flip one line of a platform-owned config, and a tenant's settings screen
grows a control — no code change, no redeploy:

```diff
  semanticColors: {
-   tier: "locked",   // shown, disabled, "managed by the platform"
+   tier: "direct",   // now four real colour pickers, still APCA-validated
    type: "color",
  },
```

That's the whole difference between what an owner sees before and after —
the same settings screen, reading the same config, rendering a completely
different control for that field. `react-tenant-theme` has no tier concept
at all. tweakcn is a design-time editor for one developer, not a
multi-tenant permission model. TokiForge has no permission model either.
This is the moat, and it's the one differentiating claim in the table
below with no numbered proof next to it — because it's demonstrated by the
test itself:
[`brand-editor.test.tsx`](./packages/brand-editor/registry/brand-editor/brand-editor.test.tsx)'s
*"flipping `semanticColors` from locked to direct reshapes the field with
no other change"* renders the actual component, flips the actual config,
and asserts the actual DOM changes.

*(A recorded screen capture of this belongs here — it doesn't exist yet.
If you're evaluating this project and want to see it live rather than
read the test, run the quickstart below or the component's own test file.)*

## What's actually here — claim by claim

Four packages ship. The plan for this project once described thirteen —
every claim below is honest about which four, and points at the exact
test that backs it, not at prose.

| Claim | Backed by |
|---|---|
| One brand hex → a complete, gamut-mapped, APCA-validated token tree | [`proof-1-contrast.test.ts`](./packages/brand-core/proofs/proof-1-contrast.test.ts), [`proof-2-srgb.test.ts`](./packages/brand-core/proofs/proof-2-srgb.test.ts) — 1,000 seeded random brand colours each |
| The platform vendor decides, per field, how much freedom each site gets — enforced at the write boundary | [`tiers.test.ts`](./packages/brand-store/src/service/features/authoring/tiers.test.ts) |
| Publish / rollback with immutable, deduped snapshots | [`conformance/index.test.ts`](./packages/brand-store/src/conformance/index.test.ts) — atomicity, dedupe-by-checksum, monotonic versions, run against every real adapter |
| Zero flicker, zero client JS, zero `generateTheme()` call on the public read path | [`delivery/index.test.ts`](./packages/brand-store/src/service/features/delivery/index.test.ts) |
| Core runs anywhere — no React, no database, no framework, two dependencies total | [`proof-4-purity-source.test.ts`](./packages/brand-core/proofs/proof-4-purity-source.test.ts), [`proof-4-purity-browser.test.ts`](./packages/brand-core/proofs/proof-4-purity-browser.test.ts) |
| Your existing database works | An ~8-method contract ([`rules.md`](./packages/brand-store/src/contract/rules.md)) plus the same conformance suite above, run against a second real adapter (`@pxlhut/brand-store-lucid`) |
| A settings screen that reshapes itself from config | [`brand-editor.test.tsx`](./packages/brand-editor/registry/brand-editor/brand-editor.test.tsx) — see the diff above |
| Malicious tenant-authored CSS never reaches a visitor's page | [`escape.test.ts`](./packages/brand-core/src/features/validation/escape.test.ts) plus the CSS-serializer regression test in `@pxlhut/brand-store`'s delivery suite — same hostile string, both layers, see [`security.md`](./docs/security.md) |

If a claim doesn't have a test next to it, it isn't a claim this README
makes.

## Packages

| Package | What | Depends on |
|---|---|---|
| [`@pxlhut/brand-core`](./packages/brand-core) | The colour engine, the validator, the serializers. Runs in a browser. Two dependencies (`culori`, `apca-w3`). | — |
| [`@pxlhut/brand-store`](./packages/brand-store) | The persistence contract, a conformance suite, an in-memory reference adapter, and the service layer (tiers, publish, rate limits). Zero database dependency. | `brand-core` |
| [`@pxlhut/brand-store-lucid`](./packages/brand-store-lucid) | The first real store adapter — AdonisJS / Lucid ORM. | `brand-store`, `brand-core` |
| [`@pxlhut/brand-editor`](./packages/brand-editor) | A headless React hook, plus a shadcn-registry settings UI that reshapes itself from `controlConfig`. | `brand-core`, `brand-store` |

## Read this plainly, above the fold

This is v0.1. Specifically:

- **The editor is React-only.** The hook's logic is framework-agnostic
  enough to port cheaply, but no Vue or Svelte port exists today.
- **The reference schema is Postgres-first.** `@pxlhut/brand-store-lucid`'s
  migrations target Postgres; other databases work through the same
  contract but aren't tested against a shipped adapter yet.
- **One database adapter ships.** Prisma, Drizzle, Kysely, TypeORM,
  Sequelize, Knex, Mongoose — none of these exist today. Each is a
  documented ~8-method contract plus a shared conformance suite
  ([writing-an-adapter.md](./docs/writing-an-adapter.md)) — genuinely a
  weekend, not a project, and that claim is exactly as testable as every
  other one in this README: run the suite, see it pass.
- **Email and PDF output are not built.** Buyers of white-label platforms
  do check whether branding reaches transactional email and exported
  PDFs. It's a real, known gap — not claimed until it ships.

Overstating breadth is how a package with four real integrations gets
judged as having thirteen broken ones. See
[the full list of what's deliberately not in v0.1](./plan/18-release.md#deliberately-not-in-v01).

## Documentation

- **[Quickstart](./docs/quickstart.md)** — generate a theme, add
  persistence, add the settings screen. Under 20 lines for the first part.
- **[The tier model](./docs/tier-model.md)** — the conceptual piece. Why
  per-field, not per-plan; why `semanticColors` defaults locked; why fonts
  are never free text at any tier.
- **[Writing a store adapter](./docs/writing-an-adapter.md)** — the
  contract, the seven rules, the conformance suite, capability
  declarations. Aimed at someone on Drizzle who wants to be productive
  this afternoon.
- **[Backend integration](./docs/backend-integration.md)** — AdonisJS,
  Express, Fastify, Koa, NestJS snippets. Documentation, not dependencies
  — the contract never imports a framework's types.
- **[Migration and versioning](./docs/versioning.md)** — how
  `schemaVersion` lets the colour algorithm improve without rewriting a
  single already-published snapshot.
- **[Security](./docs/security.md)** — the value validator, the
  hash-based CSP, and what this package does *not* cover (authorization,
  rate limiting, transport security).
- **[The multi-tenant theming guideline](./docs/multi-tenant-theming-guideline.md)**
  — the original design document this whole project implements against,
  section by section.

## Development

```bash
pnpm install
pnpm verify   # build, typecheck, lint, architecture rules, tests, bundle-size and core-purity checks — everything CI runs
```

`packages/brand-store-lucid`'s own test suite runs its conformance tests
against a real Postgres — see its `test-support/database.ts` doc comment
for the `PG*` environment variables, or just run `pnpm --filter
'!@pxlhut/brand-store-lucid' test` to skip it locally.

This repo is a pnpm workspace with feature-based folders and an enforced
dependency graph (`dependency-cruiser`) — see `DECISIONS.md`'s "Folder
structure" section before adding a new file. `plan/` holds the full,
step-by-step build history, including every deviation from the original
plan and why — genuinely useful if you're wondering why something is
built the way it is.

## License

MIT © [Misbahur Rahman](https://www.misbahurbd.com) ([@misbahurbd](https://github.com/misbahurbd)) / [Pxlhut](https://pxlhut.com)
