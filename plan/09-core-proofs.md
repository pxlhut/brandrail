# Step 09 — Core: property tests and budgets

| | |
|---|---|
| **Depends on** | 08 |
| **Unlocks** | 10 (and the README claims in 18) |
| **Output** | `brand-core/proofs/`, a CI bundle budget |
| **Size** | one day |

## Why this step exists

Every differentiating claim in the README is either true for all inputs or
it's marketing. "APCA-validated" means nothing if it holds for the three
brand colours you happened to test. "Pure and deterministic" means nothing
until something asserts it — and guideline §39's whole SSR argument rests
on that purity.

**These tests are the product's warranty.** Write them before the README
makes the claims, not after someone disputes one.

## Prerequisites

Steps 04–08 complete. Add `fast-check` as a dev dependency.

## Build

### Proof 1 — contrast holds for a thousand inputs

The headline claim. Generate 1,000 random hex colours from a **seeded**
PRNG (seeded so a failure is reproducible; a flaky unseeded property test
gets deleted within a month). For each, generate the theme and assert
**every** role pairing in `DECISIONS.md` D5 clears its floor — light and
dark, both.

Report failures usefully: the input hex, the role pair, the Lc achieved,
the floor. A bare `expected true to be false` costs an hour of bisecting.

Expect this to fail the first time you run it, and expect the failures to
cluster — most likely in the yellow-hue region, where sRGB's lightness
ceiling makes `warning-foreground` genuinely hard. That clustering is the
signal that tells you which part of step 04's chroma envelope to tune.

### Proof 2 — everything lands inside sRGB

For the same 1,000 inputs, assert every emitted colour round-trips through
sRGB unchanged within epsilon. This is `DECISIONS.md` D3's guarantee, and
it's the one that prevents "the brand looks different on my monitor"
reports that are almost impossible to reproduce.

### Proof 3 — determinism

Two forms, both needed:

- **In-process**: generate twice, assert the serialised output is
  byte-identical.
- **Cross-process**: a snapshot file of serialised output for a fixed set
  of ~20 inputs, committed to the repo, compared on every CI run.

The committed snapshot doubles as the `schemaVersion` tripwire (§6): when
it changes, you have changed the algorithm, and that is precisely the
moment to bump `schemaVersion` — not three commits later when you notice.

Also assert no input object is mutated.

### Proof 4 — purity is structural

- Build output contains no `require()` of a Node built-in.
- Grep for `Date.now`, `Math.random`, `process.`, `fetch(` in
  `brand-core/src` — CI fails on a hit.
- Import the built bundle in a jsdom environment and generate a theme
  successfully. This is the actual claim ("runs in a browser for live
  preview"); the greps are proxies for it.

### Proof 5 — the hostile corpus

Run step 07's fixture through the full pipeline — not just the validator
in isolation, but `generateTheme` → serializer — and assert nothing
hostile survives into the output string. The unit tests in step 07 test
the validator; this tests that nothing *bypasses* it.

### Proof 6 — bundle budget

Publish the number in the README; it's a real buying signal in a field
where TokiForge advertises <3 KB.

Measure minified + gzipped, core only, excluding `culori` and `apca-w3`.
Set a CI budget with headroom (suggest 15 KB) and fail the build when it's
exceeded. A budget nobody enforces is a comment.

### Proof 7 — the edge cases, explicitly

Not random: named. `#000000`, `#FFFFFF`, `#808080`, a chroma-0.005 input,
a neon (`#00FF88`), a dark saturated (`#1A0033`), a yellow (`#FFD700` —
the one that breaks contrast solvers), and a colour whose hue sits within
20° of the `info` blue from step 05.

Each gets a named test, so a regression names the case instead of
reporting "property failed after 37 runs".

## Acceptance

- [ ] 1,000 seeded random inputs clear every D5 floor, light and dark
- [ ] 1,000 seeded random inputs produce only in-sRGB colours
- [ ] Committed output snapshot for ~20 fixed inputs, compared in CI
- [ ] Same input → byte-identical output, in-process and across processes
- [ ] No Node built-in in the built bundle; jsdom import-and-generate passes
- [ ] The hostile corpus produces no dangerous substring in serialised output
- [ ] Bundle size is measured, published, and budgeted in CI
- [ ] All seven named edge cases pass as individually named tests

## Out of scope

Store behaviour — step 11's conformance suite is the equivalent artefact
for persistence. Performance benchmarking — worth having eventually, not a
v0.1 blocker.

## Notes for step 18

Each README claim must point at a proof here. If a claim has no proof,
either write the proof or cut the claim. Guideline-level honesty: v0.1 is
React-first for the editor, Postgres-first for the reference schema, and
ships one store adapter. Overstating breadth is how a package with three
real integrations gets judged as having thirteen broken ones.
