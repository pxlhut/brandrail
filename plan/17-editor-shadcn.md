# Step 17 — Editor: the shadcn component

| | |
|---|---|
| **Depends on** | 16 |
| **Unlocks** | 18 |
| **Output** | `brand-editor/registry/brand-editor/` — registry JSON + component source |
| **Size** | two days |

## Why this step exists

The hook is the capability; this is what people see in five seconds and
decide on. It's also the artefact that carries the demo — flip one JSON
field, the settings screen grows a control — which is the clearest possible
statement of what this package does and the one thing no competitor can
show.

## Prerequisites

Step 16 complete. Read the current shadcn registry docs before starting —
the format has moved and will again.

## Build

### Distribute via registry, not npm

This matters and it's easy to get wrong. shadcn/ui is not an npm
component library — it copies source into the consumer's project. Shipping
compiled React components would be fighting the ecosystem's grain, and
this audience will notice immediately.

```bash
npx shadcn add https://yourdomain/r/brand-editor.json
```

Source lands in their repo. They restyle it freely, and they're not
blocked waiting for you to expose a prop.

**Consequence:** the registry JSON must declare its shadcn dependencies
(`button`, `input`, `slider`, `select`, `tabs`, `popover`, …) so the CLI
installs them. Test the install into a clean Next.js + shadcn project
before shipping. An install that half-works is worse than no registry.

### What to build

One `<BrandEditor />` that renders from `controlConfig`, plus the
per-control pieces it composes:

| Control | Renders |
|---|---|
| `locked` | the value, visibly disabled, with a lock affordance. **Show it, don't hide it** — an owner seeing "Semantic colours · managed by the platform" understands the product; a missing field looks like a bug |
| `guided · select` | segmented control for ≤4 options, select above that |
| `guided · slider` | slider with the live value |
| `direct · color` | colour picker with live APCA feedback from the hook's violations |
| `direct · text` | input with validation |
| `direct · asset` | upload with `{ light, dark }` variants side by side (§36) |
| `raw` | a JSON editor, clearly marked as unguarded |

Plus a **live preview pane** using the step 08 `selector` option so the
site's tokens are scoped to the preview container and can't leak onto the
dashboard around it (§5). And a publish bar: dirty state, `canPublish`,
field-level errors on rejection.

`visual-walkthrough.html` has a mockup of this screen — useful for intent,
but **its config sample contradicts the schema** (it shows a bare string
array for select options where §31/§32 define `{ label, value }[]`), and it
shows 8 fields against §33's 13. Step 01 fixes that file; build from §33.

### The demo

Worth building deliberately as a documentation asset, because it is the
single clearest way to show what this package is:

1. Settings screen with `semanticColors: { tier: 'locked' }` — shown, disabled, explained.
2. Change **one line** of JSON to `{ tier: 'direct' }`.
3. Same screen now has semantic colour pickers, each APCA-validated.
4. No code changed.

Record it. Put it at the top of the README. Nothing else on npm can do
this — `react-tenant-theme` has no tier concept at all, tweakcn is a
design-time editor for one developer, and TokiForge has no permission
model.

### Accessibility

An accessibility-focused theming tool with an inaccessible settings screen
is an easy and embarrassing miss. Keyboard-navigable throughout, visible
focus states, labelled controls, colour pickers usable without a mouse,
and the locked-field explanation available to screen readers rather than
conveyed only by a lock glyph.

## Acceptance

- [ ] `npx shadcn add` installs cleanly into a fresh Next.js + shadcn project
- [ ] Registry JSON declares every shadcn dependency the components use
- [ ] All four tiers render; locked fields are **visible and disabled**, not hidden
- [ ] Both §31 guided shapes render distinctly
- [ ] Live preview is scoped and does not affect the surrounding dashboard (§5)
- [ ] Colour pickers show live APCA feedback before publish
- [ ] A rejected publish highlights the offending field
- [ ] The `locked → direct` demo works and is recorded
- [ ] Keyboard-navigable end to end with visible focus

## Out of scope

Non-React. A hosted theme-editor SaaS. Any styling opinion beyond
shadcn's defaults — consumers restyle, that's the point of the registry.
