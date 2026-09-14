# Step 04 — Core: the colour engine

| | |
|---|---|
| **Depends on** | 03 |
| **Unlocks** | 05, 06 |
| **Output** | `brand-core/src/features/{palette,contrast}/`, `src/shared/color-math/` |
| **Size** | two to three days. The hardest step. |

## Why this step exists

**This is the product.** One brand hex in, a complete contrast-validated
ramp out. Every competitor either hand-authors palettes (`react-tenant-theme`,
Radix), generates against WCAG 2 instead of APCA (Leonardo), or abandoned
the attempt (`@bernankez/theme-generator`). The thing that makes this
package worth installing is that this file works.

The guideline never specified it — thirty-nine sections reference
`generateTheme()` eleven times and define it nowhere. `DECISIONS.md` D3,
D4, D5, D6 closed the open questions; this step implements them.

## Prerequisites

- `DECISIONS.md` D3 (sRGB gamut), D4 (12 fixed stops), D5 (the APCA
  table), D6 (dark derived)
- Guideline §34 (what derives from what)
- Familiarity with OKLCH: L is perceptual lightness 0–1, C is chroma
  (unbounded in theory, ~0.37 max in sRGB), H is hue 0–360.

Dependencies: `culori` (conversion, `toGamut`), `apca-w3` (contrast).
Nothing else.

## Build

### `shared/color-math/gamut.ts` — do this first

Everything downstream depends on it, and it's the smallest piece.

```ts
import { clampChroma, formatCss, oklch } from 'culori';
```

Use **`clampChroma`, not `toGamut`**. Both implement CSS Color 4's
chroma-reduction, but `toGamut('rgb','oklch')` returns an *rgb* colour
whose float noise can fail culori's own `inGamut` check — which makes
this step's round-trip acceptance criterion unpassable. `clampChroma`
stays in OKLCH, holds L and H exactly, and round-trips cleanly.

Order matters, and it is not the obvious one. Clamp-then-round does not
work: rounding chroma up by a ten-thousandth pushes a boundary colour
back outside, and a second clamp-then-round has the same problem. Settle
L and H first, clamp chroma at *those* coordinates, then round chroma
**down**.

It lives in `shared/`, not in a feature, because every feature that
produces a colour depends on it. Export one function: given `{ l, c, h }`, return an in-sRGB `{ l, c, h }`
plus the CSS string. Everything that produces a colour in this package
goes through it. No exceptions — an un-clamped colour reaching the
serializer is the bug D3 exists to prevent.

**Test it directly:** `oklch(0.7 0.35 150)` is far outside sRGB. After
clamping, converting to sRGB and back must round-trip to within a small
epsilon, and the returned L and H must be unchanged.

### `features/palette/` — the lightness scale

Twelve steps at **fixed** OKLCH lightness (D4). Fixed stops are what make
the contrast guarantee provable: step 12 against step 1 behaves the same
regardless of input.

**The stops are constrained by physics, not taste.** APCA contrast on a
surface is capped by what pure black or white achieve on it, and that
ceiling collapses in the middle of the range:

```
L 0.95 → 96    L 0.72 → 62    L 0.50 → 86
L 0.89 → 85    L 0.68 → 60    L 0.42 → 93
L 0.80 → 69    L 0.62 → 70    L 0.24 → 106
```

**No surface in L ≈ [0.57, 0.84] can carry Lc 75 text, with any
foreground whatsoever.** Every 12-step ramp spanning 0.18–0.99 crosses
that band; the only choice is which index lands in it. Index 8 is the
solid step — `primary`, `secondary`, `accent`, `destructive` — and D5
holds its foreground to Lc 75, so it must sit outside. Chroma costs
headroom too, so pick against the worst hue, not neutral grey: at peak
envelope chroma, L 0.56 yields only 74.8 on a neon green.

These stops put index 8 at 0.52 in both modes, ~5 Lc of margin:

```
light mode L: .99 .975 .95 .92 .89 .85 .79 .68 .52 .45 .37 .21
dark  mode L: .18 .21  .25 .29 .34 .39 .44 .48 .52 .68 .84 .97
```

The light ramp is dense at the top (steps 1–6 are all backgrounds and
subtle fills, where small L differences matter a lot) and sparse at the
bottom. The dark ramp is not a mirror — perceived contrast on dark grounds
behaves differently, which is exactly why APCA is polarity-aware and WCAG 2
isn't. **Do not derive dark by inverting light.** Generate it with its own
stops and let the D5 floors validate both.

**Chroma is the part that goes wrong.** Two failure modes:

- A near-grey brand colour (`#6B7280`) with chroma applied uniformly
  produces steps that look accidentally tinted at the light end.
- A neon brand colour (`#00FF88`) at full chroma produces mid-steps that
  are unreadable and light steps that look radioactive.

Use a chroma envelope: peak near the mid steps (7–9, where the brand
colour actually reads as itself), tapering toward both ends. Scale the
whole envelope by the input's own chroma so a muted brand stays muted.
Then clamp every step through `gamut.ts`.

**Achromatic guard.** When input chroma is below ~0.01, hue is
meaningless and undefined in most conversions. Detect it, use a
configurable fallback hue for the trace amount of tint in the neutrals,
and set an `isAchromatic` flag on the result. `#000000`, `#FFFFFF` and
`#808080` must all produce sane, tested output — they're the first things
anyone types into a colour picker.

**Neutral ramp.** `neutralTone` (§33) is Warm grey / Cool grey. Generate a
second ramp at very low chroma with the hue shifted warm (~60°) or cool
(~250°). `background`, `card`, `border`, `input`, `muted` come from this
ramp, not the brand ramp — that's what §33 means by "changes the feel of
every border and background without touching brand colour".

### `features/contrast/` — hitting the APCA floors

```ts
import { APCAcontrast, sRGBtoY } from 'apca-w3';
const lc = APCAcontrast(sRGBtoY(fgRgb), sRGBtoY(bgRgb));
```

APCA is **polarity-aware**: `Lc` is positive for dark-on-light and
negative for light-on-dark, and the magnitudes are not interchangeable.
Always compare `Math.abs(lc)` against the D5 floor, and always pass
foreground and background in the right order — swapping them is not a
sign flip, it's a different number.

Two functions:

- `contrastLc(fg, bg): number` — a thin wrapper. Trivial.
- `pickForRole(ramp, bg, minLc)` — return the **least extreme** step that
  still clears `minLc`: sort candidates by lightness distance from `bg`
  ascending and take the first that passes. Reaching for the most extreme
  would pass every floor and produce a theme with nothing to do with the
  brand.

**Escalation must try both directions.** Do not pick one from
`background.l > 0.5`: APCA's polarity crossover — where dark-on-light
starts beating light-on-dark — sits near **L 0.70**, not 0.50. On an
L 0.56 surface black reaches Lc 32 while white reaches 78, so a 0.5
threshold walks the wrong way and reports an impossible floor for a
comfortably achievable pairing.

When no step clears the floor, do **not** silently return the closest
one. Escalate: push L past the ramp's end toward pure black or white until
the floor is met, and record it in the result as an adjustment. Step 09's
property test asserts the floor holds for a thousand random inputs, so a
silent near-miss here becomes a red CI run there — which is what you want,
but only if this function is honest about it.

### Purity

No `Date`, no `Math.random`, no module-level mutable caches keyed on
anything but the input. Step 09 asserts byte-identical output across runs;
a memoisation cache that isn't purely a function of its key will fail it.

## Acceptance

- [ ] Every colour this module emits is inside sRGB, asserted by round-tripping
- [ ] Light and dark ramps are generated independently (D6), neither derived by inverting the other
- [ ] `#000000`, `#FFFFFF`, `#808080`, and a chroma-0.005 input each produce a full valid ramp, each with its own test
- [ ] A neon input (`#00FF88`) and a muted input (`#6B7280`) both produce ramps whose mid-steps read as the brand colour
- [ ] For 20 varied brand colours × every surface × every floor: `pickForRole` clears the floor **whenever the surface's ceiling allows it**, and reports a `shortfall` — never a silent miss — when it does not. Demanding floors above the ceiling is demanding the impossible; that is what the ceiling check exists to separate.
- [ ] The solid step (index 8) can carry Lc 75 in both modes, for all 20 colours
- [ ] `contrastLc` compares `Math.abs`, and a test asserts fg/bg order is not commutative
- [ ] The neutral ramp shifts hue for warm vs. cool and stays under chroma 0.02
- [ ] Same input → identical output across two runs in the same process and across a fresh process

## Out of scope

Semantic colours (`success`/`warning`/`error`/`info`) — step 05, though
they reuse the chroma envelope and the contrast solver from here. Shape
tokens — step 05. Assembling a `TokenTree` — step 06. Serialising — step 08.

## Notes for step 05

Export the chroma envelope and `pickForRole` — step 05 runs the *same*
pipeline against fixed hues, and that reuse is precisely what guideline
§34 means when it says a bold brand colour should produce a bold error
red and a muted one a muted red.

`SOLID_INDEX` (8) is exported from `features/palette`. Step 06 assigns
`primary`/`secondary`/`accent`/`destructive` to it in **both** modes —
the stops were chosen so one index works for both, which is what keeps
role assignment free of mode branching.

Note the layering rule bites on tests too: `contrast` sits below
`palette`, so a test that needs real ramps belongs in
`features/palette/solver.test.ts`, not in `features/contrast`.
