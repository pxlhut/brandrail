# Step 16 — Editor: the headless hook

| | |
|---|---|
| **Depends on** | 06, 13 |
| **Unlocks** | 17 |
| **Output** | `brand-editor/src/features/{field-state,preview,drafting,publishing,assets}/` |
| **Size** | one to two days |

## Why this step exists

**This package is in none of the original planning documents, and it
should be the second-highest priority after the generator.**

Guideline §33 defines thirteen fields across four tiers with two guided
control shapes. As the plan stood, every consumer hand-builds that
settings form — and that form *is* the white-label feature their customers
see. It's the largest chunk of work left on the consumer's desk, and it's
the reason someone picks this over writing 200 lines of
`react-tenant-theme` config themselves.

It's also the only place the control-tier model becomes *visible*. A tier
model you can't see is a data structure; a settings screen that reshapes
itself from config is a product.

## Prerequisites

- Steps 06 (generate, in-browser), 13 (the service's tier rules)
- Guideline §31 (two guided shapes), §33 (the field list), §3 (write path:
  400 ms debounce, client-side preview), §22 (conflict handling)

## Build

```ts
export function useBrandEditor(opts: {
  controlConfig: ControlConfig;
  initial: BrandConfig;
  onSave: (patch: Partial<BrandConfig>, expectedVersion: number) => Promise<BrandConfig>;
  onPublish: () => Promise<PublishResult>;
}): BrandEditorState;
```

Returns per-field state, tier-aware validity, live preview tokens, and the
conflict signal. **No markup, no styling.** React-only is fine for v0.1
(say so in the README); the logic ports to Vue or Svelte cheaply later if
anyone asks.

### Field state, driven by tier

For each field in `controlConfig`, return everything the UI needs to
render itself without knowing about tiers:

```ts
interface FieldState<T = unknown> {
  id: FieldId;
  tier: Tier;
  control: FieldConfig;        // discriminated — switch exhaustively
  value: T;
  setValue: (v: T) => void;
  error: string | null;
  disabled: boolean;           // true for locked
  dirty: boolean;
}
```

The renderer switches on `control` and gets exhaustiveness checking from
step 03's discriminated union. **`{ tier: 'guided', type: 'select' }` and
`{ tier: 'guided', type: 'slider' }` are different renders** — §31 exists
precisely because radius wants three discrete choices, not a drag handle.

### Validation, client-side but never *only* client-side

Run step 07's validator and the tier rules in the hook, so the owner sees
errors as they type. Then let the server reject independently — §9's whole
point is that the UI is not the enforcement boundary. **Never skip a
server call because the client thinks a value is fine.**

### Live preview

§3's write path: the preview calls `generateTheme()` **client-side**,
reading the draft, never touching snapshots. Core is browser-safe and pure
(step 02's constraint), so this is a direct call.

Return both the tokens and the serialised CSS so the consumer can inject
it into a scoped container. Use the step 08 `selector` option — §5 is
clear that this is the one place visual isolation genuinely matters,
because the preview renders next to your own dashboard chrome and a bare
`--primary` will leak onto it.

Surface `violations` from step 06 as field-level errors on the offending
roles, live. This is the accessibility feature the owner actually
experiences: the picker tells them a colour won't pass *before* they try
to publish, rather than publish failing with an error they have to
interpret.

### Draft saves

400 ms debounce after the last change (§3) — short enough to feel instant,
long enough that a fast slider drag produces one write instead of dozens.
Track `expectedVersion` and surface `ConflictError` (§22) as a distinct
state, not a generic error. Whether the UI silently refetches or prompts
"someone else changed this — reload?" is a product decision, but the hook
must make the two distinguishable.

### Publish

Expose `canPublish` (no violations, no unsaved conflict), `publishing`,
and the field-level errors a rejected publish returns (§7 step 2). A
publish rejected for contrast must highlight the offending field, not
raise a toast.

### Assets

`logo` doesn't run through `generateTheme()` at all — it's a file (§36).
The hook handles upload state and the `{ light, dark }` variant pair, and
delegates the actual upload to an injected callback. §36 is worth
following: store both variants from the start even before dark mode ships,
because retrofitting a second logo slot means re-touching every site's
stored config.

## Acceptance

- [ ] Renders state for all 13 §33 fields from a `ControlConfig`
- [ ] A `locked` field returns `disabled: true` and `setValue` is a no-op
- [ ] `guided: slider` and `guided: select` produce distinguishable state (§31)
- [ ] Changing `controlConfig` from `locked` to `direct` for `semanticColors` changes the returned field state with no other code change — **this is the demo**
- [ ] Live preview updates within one frame of a value change, no server round-trip
- [ ] Contrast violations appear as field errors before publish is attempted
- [ ] Draft saves debounce at 400 ms; a fast drag produces one save
- [ ] `ConflictError` is a distinct state, not a generic error
- [ ] Works against the step 12 in-memory store with no database

## Out of scope

Any markup or styling — step 17. Non-React ports. Server routes.

## Notes for step 17

The hook must be complete enough that the shadcn component is a pure
rendering layer. If step 17 needs logic the hook doesn't expose, add it
here rather than in the component — the headless layer is what makes the
package usable by people who won't take your UI.
