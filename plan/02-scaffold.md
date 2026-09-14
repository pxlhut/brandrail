# Step 02 — Monorepo scaffold

| | |
|---|---|
| **Depends on** | 01 (needs the scope name from D2, the package list from D10) |
| **Unlocks** | 03 |
| **Output** | a repo that builds, tests, lints and releases nothing yet |
| **Size** | half a day |

## Why this step exists

Four packages that must version together, a conformance suite that has to
run in CI against every store adapter, and a core package with a hard
constraint (no Node built-ins, browser-safe) that only tooling can
enforce. Get this wrong and every later step fights the build.

## Prerequisites

`DECISIONS.md` D2 (scope) and D10 (package list) from step 01.

## Build

### Workspace

pnpm workspaces + Changesets, as guideline §27 calls for, but sized to
four packages rather than thirteen. Flat `packages/*` — the
`packages/` / `adapters/` / `stores/` split §27 suggests is premature
until there are enough packages to need the separation.

```
.
├── package.json              # private root, no version
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.workspace.ts
├── .dependency-cruiser.cjs   # the architecture rule, see below
├── .changeset/
├── .github/workflows/ci.yml
├── DECISIONS.md
├── docs/
├── archive/
├── plan/
└── packages/
    ├── brand-core/
    │   ├── src/
    │   │   ├── features/
    │   │   │   ├── palette/      brand ramp, neutral ramp, achromatic guard
    │   │   │   ├── contrast/     APCA solver + the D5 role→Lc table
    │   │   │   ├── semantics/    success/warning/error/info + chart-1..5
    │   │   │   ├── shape/        radius, density, borderWidth, elevation
    │   │   │   ├── typography/   curated font enum + stacks
    │   │   │   ├── theme/        generateTheme() + merge precedence
    │   │   │   ├── validation/   value validator, escaping
    │   │   │   └── output/       shadcn, tailwind, raw-css serializers
    │   │   ├── shared/
    │   │   │   ├── color-math/   culori wrappers, gamut clamp
    │   │   │   ├── types/        TokenTree, ControlConfig, FieldConfig
    │   │   │   └── fields/       the §33 thirteen-field registry
    │   │   └── index.ts          the only public surface
    │   ├── fixtures/             hostile-value corpus (steps 07 + 09)
    │   └── proofs/               step 09 — cross-feature, never shipped
    ├── brand-store/
    │   └── src/
    │       ├── contract/         → "@pxlhut/brand-store"
    │       ├── conformance/      → "@pxlhut/brand-store/conformance"
    │       ├── memory/           → "@pxlhut/brand-store/memory"
    │       ├── service/          → "@pxlhut/brand-store/service"
    │       │   ├── features/{authoring,publishing,provisioning,access,limits,events}/
    │       │   └── shared/
    │       └── shared/
    ├── brand-store-lucid/
    │   └── src/{store,models,migrations,provider}/
    └── brand-editor/
        ├── src/features/{field-state,preview,drafting,publishing,assets}/
        └── registry/brand-editor/   shadcn registry — source, not compiled
```

**Feature-based, with one rule that makes it real:** a feature owns its
types, constants, logic and tests together, and **nothing imports a file
inside another feature — only its `index.ts`.** Tests are co-located
(`brand-ramp.ts` next to `brand-ramp.test.ts`), never in a parallel tree.

`brand-store`'s top level mirrors its published export map rather than
using `features/` — those four folders are a boundary a consumer can
actually observe, which makes them the more meaningful split. Only
`service/` has enough complexity to need features inside it.

Create all four package directories now with a `package.json` and an
empty `src/index.ts` each, even though only `brand-core` gets filled in
for the next several steps. Adding a workspace member later means
re-resolving the lockfile at an inconvenient moment.

### The architecture rule

Feature-based folders decay into ordinary folders unless the import
direction is enforced. Within `brand-core`, features may import `shared/`
and features **below** them in this order — never sideways, never upward:

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

Encode it in `.dependency-cruiser.cjs` and run it in CI. A
`palette → theme` import should fail the build, not a review. Same
principle as the purity constraint below: mechanically enforced, not left
to discipline.

Two rules to write, at minimum:

- `no-cross-feature-internals` — a path matching
  `features/([^/]+)/.+` may only be imported from within that same
  feature. Everything else imports `features/<name>/index.ts`.
- `respect-layering` — the graph above, as explicit `from`/`to` pairs.

Add `no-circular` too. It costs nothing and catches the failure this
structure is meant to prevent.

### Build tooling

`tsup` for each package. Emit **both ESM and CJS** plus declarations —
AdonisJS 6 is ESM, but plenty of Prisma and Express consumers are still
CJS, and a core library that only ships ESM will generate issues you
don't want to spend time on.

```jsonc
// packages/*/package.json — the shape every package uses
{
  "name": "@pxlhut/brand-core",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`brand-store` needs extra export conditions for its subpaths (D10):
`.`, `./conformance`, `./memory`, `./service`. Configure `tsup` with four
entry points and declare all four in `exports`. Do this now — retrofitting
subpath exports after consumers exist is a breaking change.

### TypeScript

`tsconfig.base.json`, extended by each package:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "declaration": true,
    "isolatedModules": true
  }
}
```

`noUncheckedIndexedAccess` will be mildly annoying in the ramp code in
step 04 (array indexing everywhere). Keep it — an off-by-one in a
lightness ramp is exactly the bug it catches.

### The core purity constraint

`@pxlhut/brand-core` must run in a browser, because the control panel does
live preview client-side (guideline §3, write path step 2). It also must
be pure, because SSR correctness depends on it (§39).

Enforce mechanically, not by discipline:

- `brand-core/tsconfig.json` sets `"types": []` and `"lib": ["ES2022"]` —
  no `@types/node`, so `process` and `fs` don't typecheck.
- An ESLint `no-restricted-globals` rule for `process`, `Date`, `Math.random`,
  `fetch`, `crypto`.
- A build-output check in CI: grep `dist/index.js` for `require(` of any
  Node built-in. Cheap, catches a dependency dragging one in.

Its only runtime dependencies are `culori` and `apca-w3`. CI should fail
if a third appears without a decision recorded.

### Testing

Vitest with a workspace config so `pnpm test` at the root runs everything.
Two environments: `node` for everything, plus `jsdom` for `brand-editor`
later.

> Vitest 3 deprecated `vitest.workspace.ts` in favour of `test.projects` in
> the root `vitest.config.ts`. Use that. Each package's `test` script needs
> `--passWithNoTests` until step 04 writes the first real test, or the
> build fails on an empty package.

Step 09 adds a property-test dependency (`fast-check`) and a bundle-size
budget. Don't add them yet — they'd fail against an empty package.

### CI

One workflow, on every PR: install → typecheck → lint → test → build →
the core purity check. Add the conformance-suite matrix in step 11, when
there's a suite to run.

### Changesets

Initialise it. Set `"access": "public"` and pin the four packages to
linked versioning **only** if you want them to move together — recommended
for v0.1, since the store contract and core types are co-evolving. Revisit
after 1.0.

## Acceptance

- [ ] `pnpm install && pnpm -r build && pnpm -r test && pnpm -r typecheck` passes from a clean clone
- [ ] All four packages exist as workspace members with `src/index.ts`
- [ ] `brand-store` declares `.`, `./conformance`, `./memory`, `./service` in `exports`
- [ ] Importing `node:fs` inside `brand-core` is a **typecheck error**, not a runtime surprise
- [ ] `dependency-cruiser` is wired into CI; a deliberate `palette → theme` import **fails the build** (verify, then revert)
- [ ] Importing a file inside another feature (not its `index.ts`) fails the same way
- [ ] CI runs on PR and fails on any of the above
- [ ] `.changeset/config.json` exists

## Out of scope

No real source code. No published packages. No conformance matrix in CI —
step 11.

## Notes for step 03

Types land in `brand-core/src/shared/types/` and are re-exported by
`brand-store`. Decide now whether `brand-store` depends on `brand-core`
(simplest) or duplicates the handful of types it needs (keeps the store
contract installable standalone). **Decided: depend on it** — `brand-store` declares
`"@pxlhut/brand-core": "workspace:*"`, already wired. The store's whole
point is to carry a `TokenTree` around.
