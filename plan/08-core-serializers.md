# Step 08 — Core: output serializers

| | |
|---|---|
| **Depends on** | 06, 07 |
| **Unlocks** | 09, 15 |
| **Output** | `brand-core/src/features/output/` |
| **Size** | one day |

## Why this step exists

The token tree is internal. Consumers need CSS. Three targets, each a
different serialisation of the *same* published tree — guideline §37 is
explicit that there's no separate generation step per output, just a
different rendering.

These live in `brand-core` rather than as three packages. They're a few
dozen lines each; splitting them buys nothing but a version matrix
(`DECISIONS.md` D10).

## Prerequisites

- Step 06's `TokenTree`, step 07's validator and escaping
- `DECISIONS.md` D7 (inline + hashed CSP)
- The current shadcn/ui theming docs — go read the actual variable list,
  don't work from memory

## Build

```ts
export function toShadcnCss(tree: TokenTree, opts?: ShadcnOpts): string;
export function toTailwindTheme(tree: TokenTree, opts?: TailwindOpts): string;
export function toCssVars(tree: TokenTree, opts?: CssVarOpts): string;
```

### `toShadcnCss` — the one that matters

This is what most consumers use, and the thing that makes or breaks
first-run experience. **Emit the exact current shadcn variable set.** A
missing `--sidebar-ring` is a visible bug in someone's app and the fastest
possible way to lose this audience's trust.

Pin the list against shadcn's own docs and **write a test that asserts
every expected variable name is present in the output**. When shadcn adds
one, that test is how you find out.

At time of writing the set is: `--background`, `--foreground`, `--card`,
`--card-foreground`, `--popover`, `--popover-foreground`, `--primary`,
`--primary-foreground`, `--secondary`, `--secondary-foreground`,
`--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`,
`--destructive`, `--destructive-foreground`, `--border`, `--input`,
`--ring`, `--chart-1` … `--chart-5`, `--sidebar` and its variants,
`--radius`. **Verify this against the live docs before you build** — it
has changed before and will again.

Output shape, per D6 (both modes always generated) and §25 (both blocks
in one string, so the read path stays a single lookup):

```css
:root{--background:oklch(...);--foreground:oklch(...);...}
:root[data-theme="dark"]{--background:oklch(...);...}
```

Options worth having: `darkMode: 'class' | 'media' | 'attribute'`,
`selector` (default `:root` — the control panel's live preview needs
`[data-site-theme]` instead, see §5), and `minify`.

`success` / `warning` / `info` aren't in shadcn's set but §34 makes them
first-class. Emit them under their own names alongside. Note it in the
README rather than dropping them.

### `toTailwindTheme`

Tailwind v4's `@theme` block is the primary target now; v3's JS config
object is legacy but still widely deployed. Support both behind an option,
and say plainly in the README which is default.

### `toCssVars`

Raw custom properties with a configurable prefix and no assumptions about
consumer naming. This is the escape hatch for anyone not on shadcn or
Tailwind, and it should be the simplest of the three.

### Escaping and hashing — non-negotiable

Every value passes through step 07's escaping on the way out. **Every
one**, including values the generator produced itself and that never
touched user input — "this path is safe" is the assumption that stops
being true after a refactor.

Export the exact byte string that gets hashed for the CSP (D7), so the
hash the service layer computes in step 13 is over what actually ships
rather than a re-serialisation of it. Emit a stable key order so the same
tree always produces the same bytes — step 09's determinism test depends
on it, and so does the checksum dedupe in guideline §7.

### Fonts — closing §35's loop

Guideline §35 says self-host a curated set and stops there. The failure it
warns about — a font name that isn't actually loaded failing silently to a
system fallback — is still reachable unless the serializer emits the
loading directive alongside the family.

Add `fontStrategy: 'none' | 'fontsource' | 'inline-face'` to the shadcn
serializer options. Under `fontsource`, emit the `@import` or document
which `@fontsource/*` package the consumer must install, next to the
`--font-heading` declaration. Document the choice; don't leave it implied.

## Acceptance

- [ ] A test asserts every pinned shadcn variable name appears in `toShadcnCss` output
- [ ] Light and dark blocks are both emitted, in one string
- [ ] Key order is stable — the same tree serialises byte-identically across runs
- [ ] `<` and `&` are escaped in output, with a test using a value that contains them
- [ ] `selector` option produces a scoped block suitable for the §5 preview container
- [ ] Tailwind v4 `@theme` and v3 config both emit, behind an option
- [ ] The exact hashable byte string is exported
- [ ] Output for a typical tree is under ~4 KB unminified — it gets inlined into every page

## Out of scope

Computing the CSP hash — step 13 (no crypto in core). Inlining into a page
— step 15. Email and PDF serializers — deferred, demand-driven (D10).

## Notes for step 09

Serializer output is what step 09's determinism property test hashes.
Stable key order is a prerequisite, not a nice-to-have.
