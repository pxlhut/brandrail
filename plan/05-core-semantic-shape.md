# Step 05 — Core: semantic and shape tokens

| | |
|---|---|
| **Depends on** | 04 |
| **Unlocks** | 06 |
| **Output** | `brand-core/src/features/{semantics,shape,typography}/` |
| **Size** | one day |

## Why this step exists

Two things the brand ramp can't produce.

**Semantic colours** must stay recognisable. Guideline §34: "error" has to
read as red whether the brand is blue or purple — that's a learned
convention, not a stylistic choice a theme should be free to override by
accident. But they also can't look pasted in from a different design
system.

**Shape tokens** — radius, border width, density — aren't colour at all.
They don't run through OKLCH and they don't get a contrast check
(guideline §32). The token tree needs a second generator entirely.

## Prerequisites

- Step 04's chroma envelope and `pickForRole`, exported
- Guideline §34 (the derivation split), §32 (shape as a separate branch),
  §33 (`radius`, `density`, `buttonStyle`, `elevation` defaults)

## Build

### `features/semantics/`

The rule from §34, stated exactly:

- **Hue is fixed.** Green, amber, red, blue. Never taken from the brand
  colour's hue.
- **Everything else is derived** — lightness curve, chroma level, and the
  contrast approach come from the *same* pipeline as the brand colour.

So: a bold, saturated brand produces a bold, saturated error red; a soft,
muted brand produces a correspondingly muted one. That's what makes
semantic colours feel like part of the theme without losing what makes
them legible.

Suggested OKLCH hues, to tune by eye:

| Role | Hue | Note |
|---|---|---|
| `success` | ~148 | green |
| `warning` | ~80 | amber. Expected to be hardest — pure yellow has a very low lightness ceiling in sRGB. In practice step 04's solid step at L 0.52 leaves enough headroom that it clears Lc 75 without special-casing; keep the dedicated test anyway, since it is the first thing a stop change will break |
| `destructive` | ~27 | red |
| `info` | ~250 | blue. Check it doesn't collide with a blue brand colour — if the brand hue is within ~20° of it, nudge `info` or accept the collision and document it |

Implementation: take the brand ramp's chroma envelope and lightness stops,
substitute the fixed hue, run the same clamp and the same `pickForRole`
against the D5 floors for each `*-foreground` pairing. It should be a
short file — if it isn't, you're reimplementing step 04 instead of reusing
it.

Also generate `chart-1` … `chart-5` here. Five hues distributed around the
wheel starting from the brand hue, at matched lightness and chroma so no
series visually dominates another. Consumers notice their absence fast —
shadcn ships them and charts render as transparent without them.

**Chart chroma needs a floor, unlike every other token here.** A grey
brand would otherwise produce five identical grey series, and a chart
whose categories cannot be told apart has stopped doing its job. Chart
colour is data encoding first and brand expression second — this is the
one place where inheriting the brand's chroma unconditionally is wrong.

Chart lightness sits mid-range (0.62 light / 0.68 dark) and that is fine:
these are categorical marks on a background, not text surfaces, so step
04's contrast dead zone does not apply to them.

### `features/shape/`

No colour maths. A small pure mapping.

```ts
// §32's presets
radius:  Sharp → '0.125rem' | Soft → '0.5rem' | Round → '1rem'
```

Direct tier accepts any valid length instead — but it still goes through
step 07's validator, because §32 is explicit that the injection risk in
§19 isn't specific to colour and applies to every raw-writable field.

`density` (§33) is a spacing-scale multiplier: Compact → `0.875`,
Comfortable → `1`. Emit it as `densityScale` and let the serializer decide
how to apply it — one multiplier is far cheaper to offer than a full
spacing scale, and §33 notes it's disproportionately requested.

`elevation` (the 0–100 guided slider from §33, reusing Forge's existing
surface-depth control) maps to a shadow-strength alpha, capped at 0.24 —
an aggressive ceiling makes a whole UI look muddy rather than layered.
`borderWidth` stays its own input rather than being derived from
elevation; tying them together reads well in a doc and produces a
one-value range in practice. Keep the shadow as a *strength* token rather than a
full `box-shadow` string — a composed shadow string is a much larger
injection surface for no real benefit.

`buttonStyle` (Solid / Outline) is **not** a token. It's a variant choice
the consuming component library acts on. Carry it through on the config
and let the serializer emit it as a data attribute or a single custom
property; do not try to express "outline" as a set of colour tokens.

### `features/typography/`

`headingFont` / `bodyFont` emit a `font-family` stack, always from the
curated list (§35, and the type-level constraint from step 03). Emit the
full fallback stack, never a bare family name.

The loading half is step 08's problem, but note it now: §35's failure mode
— a font name that isn't actually loaded failing silently to a system
fallback — is still reachable unless the serializer emits the `@font-face`
or import alongside the family. Guideline §35 says "self-host a curated
set" and stops there. `@fontsource/*` packages are the practical answer.

## Acceptance

- [ ] `destructive` reads as red for a blue brand, a purple brand, and a red brand — three explicit tests
- [ ] A muted brand produces visibly lower-chroma semantics than a saturated brand, asserted numerically on chroma, not by eye
- [ ] Every `*-foreground` / `*` semantic pairing clears its D5 floor, light and dark
- [ ] `warning-foreground` on `warning` clears the floor in **both** modes (the first thing a ramp-stop change will break)
- [ ] Every curated font in the registry has a stack, and every stack has a registry entry — asserted in both directions
- [ ] `chart-1..5` are distinct, matched in lightness, and none collides with `background`
- [ ] Shape tokens are pure lookups with no colour dependency
- [ ] `buttonStyle` does not appear in `TokenTree.color`

## Out of scope

Assembling the tree — step 06. Emitting CSS — step 08. Bundling fonts —
step 08.

## Notes for step 06

Step 06 composes: brand ramp (04) + neutral ramp (04) + semantics (05) +
shape (05) → one `TokenTree`. Each returns a plain data structure and
none writes into a shared object, so merge precedence stays clean.

`buildSemantics` already returns each pairing's `surface` **and** a
solved `foreground`, so step 06 assigns them directly rather than
re-running the solver.

Two things step 06 must carry through that are not tokens:
`collidesWithInfo(brandHue)` should surface as an advisory when a blue
brand sits within 20° of `info` — reported, never auto-corrected, since
nudging `info` off convention is as bad as the collision. And
`buttonStyle` rides on the config to the serializer without entering
`TokenTree.color`.
