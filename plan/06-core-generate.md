# Step 06 — Core: generateTheme and merge

| | |
|---|---|
| **Depends on** | 05 |
| **Unlocks** | 08, 13, 16 |
| **Output** | `brand-core/src/features/theme/` (`generate.ts`, `merge.ts`) |
| **Size** | one day |

## Why this step exists

The public entry point. Everything before this was parts; this assembles
them into the one function the whole system is built around — pure,
deterministic, and callable identically in a browser (live preview) and
on a server (publish).

It also resolves guideline §18: what wins when a Direct-tier edit and the
generated base theme disagree. §18 is unusually emphatic that this merge
happens **exactly once**, inside publish, before hashing — never at read
time. Honour that.

## Prerequisites

- Steps 04 and 05 complete
- Guideline §18 (merge precedence), §25 (light/dark in one tree), §7
  (where publish calls this)
- `DECISIONS.md` D6 (dark derived)

## Build

### `features/theme/merge.ts`

Guideline §18's precedence, low to high:

```
finalTokens = merge(generatedBase, guidedAdjustments, directEdits, rawOverrides)
//                  base   <   guided   <   direct   <   raw
```

Four layers, each a partial token tree, applied in order. Keep this
separate from `generate.ts` and keep it dumb — a deep merge over plain
objects with a documented precedence and no special cases. The moment it
starts knowing about colour, it's the wrong abstraction.

One real subtlety: a partial `TokenValue` override. If a direct edit sets
only `{ light: '#fff' }` on a token whose base is `{ light, dark }`, does
dark survive? **Yes** — merge per-mode, not per-token. Otherwise a
light-mode tweak silently blanks dark mode. Test this explicitly; it's the
kind of bug that ships.

### `features/theme/generate.ts`

```ts
export function generateTheme(input: GenerateInput): TokenTree;

interface GenerateInput {
  brandColor: string;              // hex, the one true input
  neutralTone?: 'warm' | 'cool';
  radius?: string;
  density?: 'compact' | 'comfortable';
  elevation?: number;              // 0-100
  headingFont?: CuratedFont;
  bodyFont?: CuratedFont;
  overrides?: {
    guided?: PartialTokenTree;
    direct?: PartialTokenTree;
    raw?: PartialTokenTree;
  };
  schemaVersion?: number;
}
```

Order of operations:

1. Parse and validate `brandColor`. Reject anything that isn't a parseable
   colour — loudly, with the field name. Do not fall back to a default;
   a silently-defaulted brand colour is a support ticket that takes an
   hour to diagnose.
2. Build the brand ramp and the neutral ramp (step 04), light and dark.
3. Assign `ColorRole`s from the ramps, running `pickForRole` for every
   pairing in the D5/D11 table. Write the assignment as an **ordered
   declarative table**, not imperative code — it is the part a designer
   will want to read, and the ordering constraint (every surface resolved
   before anything solved against it) is then testable on its own.

   **Body text must be solved once and shared.** `background`, `card`,
   `popover` and `sidebar` differ by a hundredth of a lightness step.
   Solved independently they land on *different* ramp steps, and the
   sidebar's text comes out visibly darker than the main content's for no
   reason a reader could explain. Solve against the hardest of them, then
   have the others inherit. shadcn's own default does exactly this —
   `--card-foreground` equals `--foreground`.
4. Generate semantics and charts (step 05).
5. Generate shape and typography (step 05).
6. Apply `merge()` over the four layers.
7. **Re-validate contrast after the merge.** This is the step that's easy
   to forget: a Direct-tier edit can break a floor that the generated base
   satisfied. Return the violations in the result rather than throwing —
   guideline §7 wants publish to reject with *field-level errors*, and it
   can only do that if this function reports which pairing failed.

```ts
interface GenerateResult {
  tokens: TokenTree;
  violations: { fg: ColorRole; bg: ColorRole; got: number; min: number }[];
  adjustments: { role: ColorRole; reason: string }[];
  /** Non-fatal notes — e.g. a blue brand colliding with the `info` hue (§34). */
  advisories: string[];
  /** Not a token (§32) — a variant the component library branches on. */
  buttonStyle: ButtonStyle;
}
```

Re-validation reads merged values back through `parseColor`. A value it
cannot parse is **skipped, not reported** — syntax is step 07's job, and
a contrast checker that also reported syntax errors would give publish
two ways to say the same thing and no way to say them separately.

`violations` is empty for any tree with no Direct/Raw overrides — the
generated base always satisfies its own floors. That's a good assertion to
write.

### Purity, restated

§39 relies on `generateTheme()` being pure so that server-rendered CSS and
anything recomputed client-side can't disagree — "there's nothing to
reconcile, only a lookup to repeat". That guarantee is only real if it's
tested. Step 09 does that; this step just has to not break it.

Concretely: no `Date.now()`, no `Math.random()`, no reading ambient
config, no mutation of the input object. If you add a cache, key it purely
on the serialised input.

### Schema version

`schemaVersion` goes in `meta` and is stamped on every snapshot (guideline
§6). It's what lets you change this algorithm later without invalidating
history — old snapshots keep serving their original `css_text`, only new
publishes use the new schema. Set it to `1` and bump it whenever output
changes for a fixed input. Step 09's determinism test is what tells you
when that's happened.

## Acceptance

- [ ] `generateTheme({ brandColor: '#7C6CFF' })` returns a complete tree — every `ColorRole` present, light and dark
- [ ] Merge precedence is base < guided < direct < raw, tested with all four layers setting the same token
- [ ] A partial `{ light }` override preserves the existing `dark` value
- [ ] A Direct override that breaks a contrast floor appears in `violations` with the role pair, the value, and the minimum
- [ ] With no overrides, `violations` is always empty — asserted across the step 04 test colour set
- [ ] An unparseable `brandColor` throws with the field name in the message
- [ ] The input object is not mutated
- [ ] Two calls with identical input produce deeply-equal results
- [ ] `card-foreground`, `popover-foreground` and `sidebar-foreground` are byte-identical to `foreground`, for every test brand colour
- [ ] An override layer can never rewrite `meta` — `sourceBrandColor` would become a lie

## Out of scope

CSS output — step 08. Validating the *string content* of raw overrides —
step 07 (this step validates contrast, not syntax; they're different
checks and both run). Persisting anything — step 10 onward.

## Notes for step 08

`GenerateResult.tokens` is the serializer's only input. The serializer
must not need `violations` or `adjustments` — if it does, something has
leaked from generation into output.

## Notes for step 13

`violations` is what publish turns into a 422 with field-level errors
(§7 step 2). §7 is explicit that publish must **reject** rather than
silently auto-correct — auto-correction belongs at edit time, in the
guided tier, because a silent fix at publish means the owner's saved
colour isn't what shipped.
