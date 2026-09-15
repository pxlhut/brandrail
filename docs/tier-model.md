# The tier model

This is the idea the rest of the package exists to serve. Everything else —
the colour engine, the store contract, the editor — is in service of one
sentence: **the platform vendor decides, per field, how much freedom each
site's owner gets, and that decision is enforced where the data is
written, not just in what the UI shows.**

## Why per-field, not per-plan

Most white-label products gate branding with a single on/off switch:
"branding enabled" or not. That's too coarse for how pricing actually
works in practice. A platform commonly wants:

- Every tenant gets a logo and a brand colour (identity is table stakes).
- Mid-tier tenants get to pick from a curated set of fonts and corner
  styles, but can't touch the colour system that keeps error/success/
  warning states legible.
- Top-tier or agency accounts get direct colour control, still validated,
  still contrast-checked — but no longer curated.

That's four different fields at three different freedom levels, active
*simultaneously* for the same tenant. A single global toggle can't express
this; a per-field tier can.

## The four tiers

```ts
type Tier = "locked" | "guided" | "direct" | "raw";
```

| Tier | What the owner sees | What they can do |
|---|---|---|
| `locked` | The current value, visibly, with a "managed by the platform" note | Nothing — `setValue` is a no-op |
| `guided` | A segmented control (≤4 options) or a slider | Pick from a small, platform-curated space |
| `direct` | A real input — a colour picker, a text field, a file upload | Set any value, still validated and contrast-checked |
| `raw` | An unguarded JSON/CSS-variable editor | Anything the syntax validator allows |

**Locked is shown, never hidden.** An owner who sees "Semantic colours ·
managed by the platform" understands the product they're using. A field
that silently disappears looks like a bug, or like something they're
missing out on with no path to get it.

**Guided has two distinct shapes, not one** (`{ tier: "guided", type:
"select" }` vs. `{ tier: "guided", type: "slider" }`) — a segmented control
for a handful of discrete choices (border radius: Sharp/Soft/Round) is a
different UI than a continuous range (elevation: 0–100), and conflating
them into "guided = slider" was an early mistake this project's own
planning caught before it shipped.

## `ControlConfig` and `ControlProfile`

A site's own `controlConfig` names every field's tier at once:

```ts
const controlConfig: ControlConfig = {
  companyName: { tier: "direct", type: "text" },
  logo: { tier: "direct", type: "asset", variants: ["light", "dark"] },
  brandColor: { tier: "direct", type: "color" },
  semanticColors: { tier: "locked" }, // fixed hues; see "Why semanticColors defaults locked" below
  headingFont: { tier: "guided", type: "select", options: FONT_OPTIONS },
  radius: { tier: "guided", type: "select", options: RADIUS_OPTIONS },
  elevation: { tier: "guided", type: "slider", min: 0, max: 100 },
  advancedTokens: { tier: "raw" },
  // …the full field list is thirteen table rows / fourteen fields — see
  // `FIELD_REGISTRY` in `@pxlhut/brand-core` for the reference default.
};
```

A `ControlProfile` is the same shape with every field optional — a
reusable template ("free" / "pro" / "agency") copied into a new site's own
`controlConfig` at provisioning time. Editing a profile afterward never
retroactively changes a site created from it; the two are independent from
that point on. This is deliberately not a live join — a platform vendor
changing what "pro" means tomorrow shouldn't silently rewrite what every
existing pro customer can already do today.

## Enforced at the write boundary, not the UI

This is the part that makes the model real rather than decorative. Every
`saveDraft`/`publishTheme` call re-checks the incoming patch's fields
against the site's own `controlConfig` — a request that tries to set a
`locked` field, or writes a value a `guided` field's options don't contain,
is rejected server-side with `TierViolationError`, regardless of what the
client sent. **The UI reflecting the right controls is a courtesy to the
owner, not the security boundary.** A malicious or buggy client cannot
raise its own tier by skipping the rendered form and calling the API
directly.

The headless editor hook (`@pxlhut/brand-editor`) runs the same tier check
client-side too, so the owner sees a rejection as they type rather than
after a round trip — but that's a UX improvement layered on top of the
real enforcement, never a replacement for it.

## Why `semanticColors` defaults to `locked`

Error, warning, success and info aren't just colours — they're a learned
signal. An owner repainting "error" away from red because it clashes with
their brand breaks that signal for their own users, and the resulting
confusion is the platform's support ticket, not theirs. The default
profile locks this field; an agency or expert profile can flip it to
`direct` (or `raw`) for someone who understands what they're overriding.
Even then, the *hue* stays fixed — direct/raw tiers adjust lightness,
chroma and contrast style to match the brand colour, not the underlying
meaning of each role.

## Why fonts are never free text, at any tier

`headingFont`/`bodyFont` are `guided: select` only — never `direct`, never
`raw`, even in an agency profile. Two reasons, both real: an arbitrary
font-family string fails silently to a system fallback if it's wrong or
unlicensed, and re-serving a font file on behalf of someone else's chosen
typeface is a real licensing exposure the platform vendor owns, not the
tenant. The curated list is short by design (`FONT_STACKS` in
`@pxlhut/brand-core`) — each entry is a real, licensed, self-hostable
stack, not a name the browser resolves however it likes.
